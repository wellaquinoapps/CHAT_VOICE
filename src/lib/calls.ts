import { supabase } from './supabase';
import type { Database, CallType, CallStatus } from '../types/database.types';

export type Call = Database['public']['Tables']['calls']['Row'] & {
  initiator?: Database['public']['Tables']['profiles']['Row'];
};

export async function initiateCall(conversationId: string, callType: CallType): Promise<Call> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado.');

  // Obter family_id da conversa
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('id, family_id')
    .eq('id', conversationId)
    .single();

  if (convError || !conv) throw new Error('Conversa não encontrada.');

  const { data: call, error: callError } = await supabase
    .from('calls')
    .insert({
      family_id: conv.family_id,
      conversation_id: conversationId,
      initiated_by: user.id,
      call_type: callType,
      status: 'ringing',
    })
    .select('*, initiator:profiles!calls_initiated_by_fkey(*)')
    .single();

  if (callError) throw callError;
  return call as Call;
}

export async function updateCallStatus(callId: string, status: CallStatus): Promise<Call> {
  const updates: any = { status };
  const now = new Date().toISOString();
  if (status === 'accepted') updates.answered_at = now;
  if (['ended', 'rejected', 'missed', 'cancelled'].includes(status)) updates.ended_at = now;

  const { data: call, error: updateError } = await supabase
    .from('calls')
    .update(updates)
    .eq('id', callId)
    .select('*, initiator:profiles!calls_initiated_by_fkey(*)')
    .single();

  if (updateError) throw updateError;
  return call as Call;
}

export async function fetchCallHistory(conversationId: string, limit: number = 20) {
  const { data, error } = await supabase
    .from('calls')
    .select('*, initiator:profiles!calls_initiated_by_fkey(*)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching call history:', error);
    return [];
  }

  return (data || []) as Call[];
}

export function subscribeToCalls(
  conversationId: string,
  onIncomingCall: (call: Call) => void,
  onCallUpdated: (call: Call) => void
) {
  const channel = supabase
    .channel(`calls:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'calls',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onIncomingCall(payload.new as Call);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onCallUpdated(payload.new as Call);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

