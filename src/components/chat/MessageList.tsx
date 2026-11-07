import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronUp } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../../lib/messages';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  memberNames?: Record<string, string>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  hasMore,
  isLoadingMore,
  onLoadMore,
  memberNames = {},
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(isAtBottom);
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
    >
      {hasMore && (
        <div className="flex justify-center mb-3">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50 bg-indigo-50 rounded-full px-3 py-1.5 transition-colors"
          >
            <ChevronUp className="h-3 w-3" />
            {isLoadingMore ? 'Carregando...' : 'Carregar mais'}
          </button>
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <p className="text-sm">Nenhuma mensagem ainda.</p>
          <p className="text-xs mt-1">Diga olá! 👋</p>
        </div>
      )}

      {messages.map(msg => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isMe={msg.sender_id === currentUserId}
          senderName={memberNames[msg.sender_id]}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

