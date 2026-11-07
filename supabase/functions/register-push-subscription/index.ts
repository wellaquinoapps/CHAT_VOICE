// ==============================================================================
// FUNCTION: register-push-subscription
// DESCRIPTION: Stores/updates Web Push subscription for authenticated device.
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
    const { endpoint, keys, deviceLabel } = body;

    if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
      return new Response(JSON.stringify({ error: 'Endpoint HTTPS válido é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!keys || !keys.p256dh || !keys.auth) {
      return new Response(JSON.stringify({ error: 'Chaves p256dh e auth são obrigatórias.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert subscription
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          device_label: deviceLabel || 'Web Browser',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' }
      )
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, subscriptionId: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

