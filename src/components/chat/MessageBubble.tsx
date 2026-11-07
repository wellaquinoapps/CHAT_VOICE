import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '../../lib/messages';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  senderName?: string;
}

function formatDateTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  if (isToday) return time;
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${date} às ${time}`;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, senderName }) => {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
          isMe
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm'
        }`}
      >
        {!isMe && senderName && (
          <p className="text-xs font-semibold text-indigo-600 mb-1">{senderName}</p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.body}</p>
        
        <div className={`flex items-center justify-end gap-1 mt-1 text-[11px] ${
          isMe ? 'text-indigo-200' : 'text-gray-400'
        }`}>
          <span>{formatDateTime(message.created_at)}</span>
          {isMe && (
            <span title="Entregue">
              <CheckCheck className="h-3.5 w-3.5 text-indigo-300 inline" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};


