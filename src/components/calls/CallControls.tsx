import React from 'react';
import { Mic, MicOff, Video, VideoOff, CameraIcon, PhoneOff } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isVideo: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
  onHangup: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isVideoOff,
  isVideo,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
  onHangup,
}) => {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mute */}
      <button
        onClick={onToggleMute}
        className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors shadow-md ${
          isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
        }`}
        title={isMuted ? 'Ativar microfone' : 'Silenciar'}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>

      {/* Hangup */}
      <button
        onClick={onHangup}
        className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg"
        title="Encerrar chamada"
      >
        <PhoneOff className="h-6 w-6 text-white" />
      </button>

      {/* Video toggle or switch camera */}
      {isVideo ? (
        <button
          onClick={onToggleVideo}
          className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors shadow-md ${
            isVideoOff ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
          }`}
          title={isVideoOff ? 'Ativar câmera' : 'Desativar câmera'}
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </button>
      ) : (
        <button
          onClick={onSwitchCamera}
          className="h-12 w-12 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition-colors shadow-md"
          title="Alternar câmera"
        >
          <CameraIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

