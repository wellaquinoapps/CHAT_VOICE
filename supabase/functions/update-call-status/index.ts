// ==============================================================================
// FUNCTION: update-call-status
// DESCRIPTION: Transition call state (ringing -> accepted, rejected, ended, etc.).
// ==============================================================================

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/supabaseClient.ts';

const VALID_STATUSES = ['ringing', 'accepted', 'rejected', 'missed', 'ended', 'cancelled'] as const;
type CallStatus = typeof VALID_STATUSES[number];

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
    const { callId, status } = body;

    if (!callId || typeof callId !== 'string') {
      return new Response(JSON.stringify({ error: 'callId é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!VALID_STATUSES.includes(status as CallStatus)) {
      return new Response(
        JSON.stringify({ error: `status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify current call
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (callError || !call) {
      return new Response(JSON.stringify({ error: 'Chamada não encontrada ou acesso negado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status,
    };

    if (status === 'accepted' && !call.answered_at) {
      updatePayload.answered_at = now;
    } else if (['ended', 'rejected', 'missed', 'cancelled'].includes(status)) {
      if (!call.ended_at) {
        updatePayload.ended_at = now;
      }
    }

    const { data: updatedCall, error: updateError } = await supabase
      .from('calls')
      .update(updatePayload)
      .eq('id', callId)
      .select()
      .single();

    if (updateError || !updatedCall) {
      return new Response(JSON.stringify({ error: updateError?.message || 'Falha ao atualizar chamada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        call: updatedCall,
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

