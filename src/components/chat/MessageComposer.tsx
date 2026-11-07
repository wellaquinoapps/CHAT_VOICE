import React, { useRef, useState } from 'react';
import { Send } from 'lucide-react';

interface MessageComposerProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await onSend(trimmed);
      setText('');
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const canSend = text.trim().length > 0 && !isSending && !disabled;

  return (
    <div className="flex items-end gap-2 px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={isSending}
        placeholder={disabled ? "Aguardando vínculo da conversa..." : "Digite uma mensagem..."}
        className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50 max-h-40 leading-relaxed"
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        className="flex-shrink-0 h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center transition-all hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
};

