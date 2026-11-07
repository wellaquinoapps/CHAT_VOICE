import { supabase } from './supabase';
import type { Database, CallType, CallStatus } from '../types/database.types';

export type Call = Database['public']['Tables']['calls']['Row'] & {
  initiator?: Database['public']['Tables']['profiles']['Row'];
};

export async function initiateCall(conversationId: string, callType: CallType): Promise<Call> {
  const { data, error } = await supabase.functions.invoke('create-call', {
    body: { conversationId, callType },
  });

  if (error) throw error;
  if (!data?.call) throw new Error('Falha ao iniciar chamada.');

  return data.call;
}

export async function updateCallStatus(callId: string, status: CallStatus): Promise<Call> {
  const { data, error } = await supabase.functions.invoke('update-call-status', {
    body: { callId, status },
  });

  if (error) throw error;
  if (!data?.call) throw new Error('Falha ao atualizar estado da chamada.');

  return data.call;
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

