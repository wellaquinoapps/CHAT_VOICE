import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas na Vercel.' });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    const { familyId, childName, childEmail, childPassword } = req.body || {};

    if (!familyId || !childName || !childEmail || !childPassword) {
      return res.status(400).json({ error: 'Dados incompletos: familyId, childName, childEmail e childPassword são obrigatórios.' });
    }

    if (childPassword.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    // 1. Validar guardião ativo
    const { data: guardianMember } = await adminClient
      .from('family_members')
      .select('id')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .eq('member_role', 'guardian')
      .eq('status', 'active')
      .maybeSingle();

    if (!guardianMember) {
      return res.status(403).json({ error: 'Apenas o responsável ativo desta família pode cadastrar filhos.' });
    }

    // 2. Criar conta da criança
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email: childEmail.trim().toLowerCase(),
      password: childPassword,
      email_confirm: true,
      user_metadata: {
        display_name: childName.trim(),
        role: 'child',
      },
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    const childUserId = authData.user.id;

    // 3. Atualizar perfil
    await adminClient.from('profiles').upsert({
      id: childUserId,
      display_name: childName.trim(),
      role: 'child',
    });

    // 4. Vincular na família
    await adminClient.from('family_members').upsert({
      family_id: familyId,
      user_id: childUserId,
      member_role: 'child',
      status: 'active',
    }, { onConflict: 'family_id,user_id' });

    // 5. Criar conversa direta
    let convId = null;
    const { data: existingConv } = await adminClient
      .from('conversations')
      .select('id, conversation_members!inner(user_id)')
      .eq('family_id', familyId)
      .eq('conversation_type', 'direct')
      .limit(20);

    if (existingConv) {
      for (const c of existingConv) {
        const memberIds = c.conversation_members.map(m => m.user_id);
        if (memberIds.includes(user.id) && memberIds.includes(childUserId)) {
          convId = c.id;
          break;
        }
      }
    }

    if (!convId) {
      const { data: newConv } = await adminClient
        .from('conversations')
        .insert({ family_id: familyId, conversation_type: 'direct' })
        .select('id')
        .single();

      if (newConv) {
        convId = newConv.id;
        await adminClient.from('conversation_members').insert([
          { conversation_id: convId, user_id: user.id },
          { conversation_id: convId, user_id: childUserId },
        ]);
      }
    }

    return res.status(200).json({
      success: true,
      childId: childUserId,
      displayName: childName.trim(),
      email: childEmail.trim().toLowerCase(),
      conversationId: convId,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
}

