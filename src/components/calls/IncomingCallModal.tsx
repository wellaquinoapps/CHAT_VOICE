import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { soundService } from '../../lib/soundService';
import type { Call } from '../../lib/calls';

interface IncomingCallModalProps {
  call: Call;
  callerName?: string;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  call,
  callerName,
  onAccept,
  onReject,
}) => {
  const isVideo = call.call_type === 'video';

  useEffect(() => {
    soundService.startRingtone();
    return () => {
      soundService.stopAll();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center justify-center gap-8 text-white">
      {/* Animated pulse rings */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-indigo-600/30 animate-ping" style={{ transform: 'scale(1.8)' }} />
        <div className="absolute inset-0 rounded-full bg-indigo-600/20 animate-ping" style={{ transform: 'scale(2.4)', animationDelay: '0.3s' }} />
        <Avatar name={callerName} size="xl" className="relative z-10" />
      </div>

      <div className="text-center space-y-1">
        <p className="text-gray-400 text-sm">Chamada {isVideo ? 'de vídeo' : 'de voz'} recebida</p>
        <p className="text-2xl font-bold">{callerName ?? 'Desconhecido'}</p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-12">
        {/* Reject */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onReject}
            className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg"
          >
            <PhoneOff className="h-7 w-7 text-white" />
          </button>
          <span className="text-xs text-gray-400">Recusar</span>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onAccept}
            className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg"
          >
            {isVideo ? (
              <Video className="h-7 w-7 text-white" />
            ) : (
              <Phone className="h-7 w-7 text-white" />
            )}
          </button>
          <span className="text-xs text-gray-400">Atender</span>
        </div>
      </div>
    </div>
  );
};

