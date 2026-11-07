// ==============================================================================
// FUNCTION: revoke-device
// DESCRIPTION: Allows guardian to revoke child session/device or user to revoke own.
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
    const { deviceId } = body;

    if (!deviceId || typeof deviceId !== 'string') {
      return new Response(JSON.stringify({ error: 'deviceId é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Execute deletion using user's RLS permissions
    // RLS policy permits deleting own device OR guardian deleting child device
    const { data, error } = await supabase
      .from('user_devices')
      .delete()
      .eq('id', deviceId)
      .select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: 'Dispositivo não encontrado ou permissão negada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Dispositivo revogado com sucesso.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

