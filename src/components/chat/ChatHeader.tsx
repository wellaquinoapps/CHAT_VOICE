import React from 'react';
import { Phone, Video } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

interface ChatHeaderProps {
  peerName?: string;
  peerAvatar?: string | null;
  peerOnline?: boolean;
  onVoiceCall: () => void;
  onVideoCall: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  peerName,
  peerAvatar,
  peerOnline,
  onVoiceCall,
  onVideoCall,
}) => {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm flex-shrink-0">
      <Avatar name={peerName} src={peerAvatar} online={peerOnline} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{peerName ?? 'Família'}</p>
        <p className="text-xs text-gray-400">{peerOnline ? 'Online' : 'Offline'}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onVoiceCall} title="Chamada de voz">
          <Phone className="h-5 w-5 text-indigo-600" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onVideoCall} title="Chamada de vídeo">
          <Video className="h-5 w-5 text-indigo-600" />
        </Button>
      </div>
    </header>
  );
};

