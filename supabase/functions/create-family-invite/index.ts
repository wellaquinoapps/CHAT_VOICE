// ==============================================================================
// FUNCTION: create-family-invite
// DESCRIPTION: Generates single-use high-entropy family invite for child linking.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser, getSupabaseAdminClient } from '../_shared/supabaseClient.ts';

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
    const { familyId, expiresInHours = 24 } = body;

    if (!familyId || typeof familyId !== 'string') {
      return new Response(JSON.stringify({ error: 'familyId é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hours = Number(expiresInHours);
    if (isNaN(hours) || hours < 1 || hours > 168) {
      return new Response(
        JSON.stringify({ error: 'Validade deve ser entre 1 e 168 horas (7 dias).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call stored procedure via RPC using user's permissions
    const { data, error } = await supabase.rpc('generate_family_invite', {
      p_family_id: familyId,
      p_expires_in_hours: hours,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite: {
          inviteId: data.invite_id,
          familyId: data.family_id,
          token: data.token,
          expiresAt: data.expires_at,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

