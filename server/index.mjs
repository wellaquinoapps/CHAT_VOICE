import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0 && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
} catch {
  console.warn('Could not load .env file, using existing environment variables');
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('❌ Missing required env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Admin client with service role key (NEVER sent to browser)
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/functions/v1/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'local-dev-server' });
});

// ── register-child ────────────────────────────────────────────────────────────
app.post('/functions/v1/register-child', async (req, res) => {
  try {
    // 1. Validate the caller's JWT
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }

    const token = authHeader.slice(7);

    // Get caller user info from Supabase Auth
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    const { familyId, childName, childEmail, childPassword } = req.body;

    if (!familyId || !childName || !childEmail || !childPassword) {
      return res.status(400).json({ error: 'Dados incompletos. familyId, childName, childEmail e childPassword são obrigatórios.' });
    }

    if (childPassword.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    // 2. Validate that caller is an active guardian of this family
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

    // 3. Create child auth account (email already confirmed, no email sent)
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
      console.error('Auth create error:', createError);
      return res.status(400).json({ error: createError.message });
    }

    const childUserId = authData.user.id;

    // 4. Upsert profile as 'child'
    await adminClient.from('profiles').upsert({
      id: childUserId,
      display_name: childName.trim(),
      role: 'child',
    });

    // 5. Add child to family_members
    await adminClient.from('family_members').upsert({
      family_id: familyId,
      user_id: childUserId,
      member_role: 'child',
      status: 'active',
    }, { onConflict: 'family_id,user_id' });

    // 6. Find or create direct conversation
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

    console.log(`✅ Child account created: ${childEmail} (${childUserId})`);
    return res.status(200).json({
      success: true,
      childId: childUserId,
      displayName: childName.trim(),
      email: childEmail.trim().toLowerCase(),
      conversationId: convId,
    });

  } catch (err) {
    console.error('register-child error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno' });
  }
});

// ── generate-family-invite (fallback for local dev) ───────────────────────────
app.post('/functions/v1/generate-invite', async (req, res) => {
  res.status(501).json({ error: 'Use o botão Cadastrar Filho para adicionar membros em dev local.' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 PrivateLine dev server running at http://localhost:${PORT}`);
  console.log('   Supabase URL:', SUPABASE_URL);
  console.log('   Mode: local dev (proxying Edge Functions)\n');
});

