import React from 'react';
import type { Message } from '../../lib/messages';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  senderName?: string;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, senderName }) => {
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
          isMe
            ? 'bg-indigo-600 text-white rounded-br-sm'
            : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm'
        }`}
      >
        {!isMe && senderName && (
          <p className="text-xs font-semibold text-indigo-600 mb-1">{senderName}</p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={`text-[10px] mt-1 text-right ${
            isMe ? 'text-indigo-200' : 'text-gray-400'
          }`}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
};

