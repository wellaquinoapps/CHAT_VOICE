import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Cliente com o token do usuário para validar quem está chamando
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente admin com Service Role para criar o usuário da criança
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { familyId, childName, childEmail, childPassword } = body;

    if (!familyId || !childName || !childEmail || !childPassword) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos: familyId, childName, childEmail e childPassword são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (childPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha da criança deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Validar se o solicitante é realmente um guardião ativo da família informada
    const { data: guardianMember, error: guardianCheckError } = await adminClient
      .from('family_members')
      .select('id, member_role, status')
      .eq('family_id', familyId)
      .eq('user_id', user.id)
      .eq('member_role', 'guardian')
      .eq('status', 'active')
      .maybeSingle();

    if (guardianCheckError || !guardianMember) {
      return new Response(
        JSON.stringify({ error: 'Apenas o responsável ativo desta família pode cadastrar crianças' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Criar a conta de autenticação da criança via admin (com email_confirm já verdadeiro)
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
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const childUserId = authData.user.id;

    // 3. Garantir perfil da criança como role 'child'
    await adminClient
      .from('profiles')
      .upsert({
        id: childUserId,
        display_name: childName.trim(),
        role: 'child',
      });

    // 4. Vincular a criança na tabela family_members
    const { error: memberInsertError } = await adminClient
      .from('family_members')
      .insert({
        family_id: familyId,
        user_id: childUserId,
        member_role: 'child',
        status: 'active',
      });

    if (memberInsertError) {
      console.error('Erro ao vincular membro familiar:', memberInsertError);
    }

    // 5. Criar a conversa direta entre o responsável e o filho
    const { data: convData, error: convError } = await adminClient
      .from('conversations')
      .insert({
        family_id: familyId,
        conversation_type: 'direct',
      })
      .select('id')
      .single();

    if (!convError && convData) {
      await adminClient.from('conversation_members').insert([
        { conversation_id: convData.id, user_id: user.id },
        { conversation_id: convData.id, user_id: childUserId },
      ]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        childId: childUserId,
        displayName: childName.trim(),
        email: childEmail.trim().toLowerCase(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

