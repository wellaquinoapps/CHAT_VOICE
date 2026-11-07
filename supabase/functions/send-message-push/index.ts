// ==============================================================================
// FUNCTION: send-message-push
// DESCRIPTION: Privacy-preserving push notification for new messages.
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

    // Support both direct client call with messageId and Database Webhook payload
    let messageId = body.messageId || (body.record && body.record.id);

    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch message info with sender details
    const { data: message, error: msgError } = await adminClient
      .from('messages')
      .select('id, conversation_id, sender_id, created_at')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: 'Mensagem não encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch conversation recipients (everyone except sender)
    const { data: recipients, error: recipError } = await adminClient
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', message.conversation_id)
      .neq('user_id', message.sender_id);

    if (recipError || !recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum destinatário elegível.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientIds = recipients.map((r: { user_id: string }) => r.user_id);

    // Fetch push subscriptions for recipients
    const { data: subscriptions, error: subError } = await adminClient
      .from('push_subscriptions')
      .select('*')
      .in('user_id', recipientIds);

    if (subError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma inscrição de push ativa para os destinatários.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let dispatched = 0;
    let expiredCleaned = 0;

    for (const sub of subscriptions) {
      // Respect privacy: generic message title/body, NO confidential body preview on lock screen
      const result = await sendWebPushNotification(sub, {
        title: 'Nova mensagem',
        body: 'Você recebeu uma mensagem na sua conversa familiar.',
        data: {
          conversationId: message.conversation_id,
          messageId: message.id,
        },
      });

      if (result.success) {
        dispatched++;
      } else if (result.expired) {
        await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        expiredCleaned++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched,
        expiredCleaned,
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

