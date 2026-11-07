import { supabase } from './supabase';
import type { Database } from '../types/database.types';

export type Message = Database['public']['Tables']['messages']['Row'];

export async function fetchMessages(conversationId: string, limit: number = 30, beforeCreatedAt?: string) {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeCreatedAt) {
    query = query.lt('created_at', beforeCreatedAt);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).reverse();
}

export async function sendMessage(conversationId: string, bodyText: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado.');

  const cleanBody = bodyText.trim();
  if (!cleanBody || cleanBody.length > 4000) {
    throw new Error('A mensagem deve ter entre 1 e 4000 caracteres.');
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: cleanBody,
      message_type: 'text',
    })
    .select()
    .single();

  if (error) throw error;

  try {
    supabase.functions.invoke('send-message-push', {
      body: { messageId: message.id },
    }).catch((e) => console.warn('Background push error:', e));
  } catch (_e) {
    // Ignore push background error
  }

  return message;
}

export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (message: Message) => void,
  onMessageUpdated?: (message: Message) => void,
  onMessageDeleted?: (messageId: string) => void
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onNewMessage(payload.new as Message);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (onMessageUpdated) {
          onMessageUpdated(payload.new as Message);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (onMessageDeleted && payload.old?.id) {
          onMessageDeleted(payload.old.id);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

