// ==============================================================================
// FUNCTION: create-call
// DESCRIPTION: Initiates an audio or video call between authorized family members.
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

    const { user, supabase } = await getAuthenticatedUser(req);
    const body = await req.json();
    const { conversationId, callType } = body;

    if (!conversationId || typeof conversationId !== 'string') {
      return new Response(JSON.stringify({ error: 'conversationId é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (callType !== 'audio' && callType !== 'video') {
      return new Response(JSON.stringify({ error: 'callType deve ser "audio" ou "video".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify conversation membership and get family_id
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id, family_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conv) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada ou acesso negado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there is already an active ringing or accepted call in this conversation
    const { data: existingCalls } = await supabase
      .from('calls')
      .select('id, status')
      .eq('conversation_id', conversationId)
      .in('status', ['ringing', 'accepted'])
      .limit(1);

    if (existingCalls && existingCalls.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Já existe uma chamada em andamento nesta conversa.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert call
    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        family_id: conv.family_id,
        conversation_id: conversationId,
        initiated_by: user.id,
        call_type: callType,
        status: 'ringing',
      })
      .select()
      .single();

    if (callError || !call) {
      return new Response(JSON.stringify({ error: callError?.message || 'Falha ao iniciar chamada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify recipient(s) in conversation (excluding the initiator)
    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', user.id);

    // Send push notification to recipient(s)
    if (members && members.length > 0) {
      const adminClient = getSupabaseAdminClient();
      const recipientIds = members.map((m: { user_id: string }) => m.user_id);

      const { data: subscriptions } = await adminClient
        .from('push_subscriptions')
        .select('*')
        .in('user_id', recipientIds);

      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          try {
            const pushResult = await sendWebPushNotification(sub, {
              title: 'Chamada recebida',
              body: callType === 'video' ? 'Chamada de vídeo recebida' : 'Chamada de voz recebida',
              data: {
                callId: call.id,
                conversationId: conversationId,
                callType: callType,
              },
            });

            if (pushResult.expired) {
              await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
            }
          } catch (e) {
            console.error('Failed to dispatch push notification:', e);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        call,
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

