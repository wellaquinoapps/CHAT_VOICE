// ==============================================================================
// FUNCTION: send-incoming-call-push
// DESCRIPTION: Push notification dispatched when an incoming call is ringing.
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser, getSupabaseAdminClient } from '../_shared/supabaseClient.ts';
import { sendWebPushNotification } from '../_shared/webpush.ts';

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

    const adminClient = getSupabaseAdminClient();
    const body = await req.json();
    const callId = body.callId || (body.record && body.record.id);

    if (!callId) {
      return new Response(JSON.stringify({ error: 'callId é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch call
    const { data: call, error: callError } = await adminClient
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      return new Response(JSON.stringify({ error: 'Chamada não encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only notify if call is currently ringing
    if (call.status !== 'ringing') {
      return new Response(JSON.stringify({ message: 'Chamada não está mais em estado ringing.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get recipients (conversation members except initiator)
    const { data: members, error: memError } = await adminClient
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', call.conversation_id)
      .neq('user_id', call.initiated_by);

    if (memError || !members || members.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum destinatário encontrado.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientIds = members.map((m: { user_id: string }) => m.user_id);

    // Fetch subscriptions
    const { data: subscriptions } = await adminClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma inscrição push encontrada.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let dispatched = 0;
    for (const sub of subscriptions) {
      const result = await sendWebPushNotification(sub, {
        title: 'Chamada recebida',
        body: call.call_type === 'video' ? 'Chamada de vídeo recebida' : 'Chamada de voz recebida',
        data: {
          callId: call.id,
          conversationId: call.conversation_id,
          callType: call.call_type,
        },
      });

      if (result.success) {
        dispatched++;
      } else if (result.expired) {
        await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, dispatched }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

