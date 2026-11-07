// ==============================================================================
// FUNCTION: redeem-family-invite
// DESCRIPTION: Child redeems single-use invite code to bind to a family.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/supabaseClient.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user, supabase } = await getAuthenticatedUser(req);
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string' || token.trim().length < 16) {
      return new Response(JSON.stringify({ error: 'Código de convite inválido ou ausente.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call stored procedure via RPC
    const { data, error } = await supabase.rpc('redeem_family_invite', {
      p_token: token.trim(),
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          familyId: data.family_id,
          familyName: data.family_name,
          guardianId: data.guardian_id,
          conversationId: data.conversation_id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

