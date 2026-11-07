import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Avatar } from '../ui/Avatar';
import { CallControls } from './CallControls';
import { webrtcService } from '../../lib/webrtcService';
import { updateCallStatus } from '../../lib/calls';
import { supabase } from '../../lib/supabase';
import type { Call } from '../../lib/calls';

interface ActiveCallScreenProps {
  call: Call;
  isInitiator: boolean;
  peerId?: string;
  peerName?: string;
  onCallEnded: () => void;
}

function useCallTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export const ActiveCallScreen: React.FC<ActiveCallScreenProps> = ({
  call,
  isInitiator,
  peerId,
  peerName,
  onCallEnded,
}) => {
  const isVideo = call.call_type === 'video';
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRinging, setIsRinging] = useState(call.status === 'ringing');
  const timer = useCallTimer();

  // Atualizar quando o status da chamada mudar (ex: atendida)
  useEffect(() => {
    setIsRinging(call.status === 'ringing');
  }, [call.status]);

  const handleHangup = useCallback(async () => {
    webrtcService.cleanup();
    try {
      const finalStatus = isRinging ? 'cancelled' : 'ended';
      await updateCallStatus(call.id, finalStatus);
    } catch (e) {
      console.error('Error updating call status:', e);
    }
    onCallEnded();
  }, [call.id, isRinging, onCallEnded]);

  useEffect(() => {
    const start = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Não autenticado.');

        const remoteUserId = peerId || (isInitiator ? '' : call.initiated_by);

        const localStream = await webrtcService.startLocalMedia(call.call_type);

        if (localVideoRef.current && isVideo) {
          localVideoRef.current.srcObject = localStream;
        }

        if (remoteUserId) {
          await webrtcService.initializeCall(call.id, user.id, remoteUserId, {
            onRemoteStream: (stream) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current.play().catch(e => console.warn('Erro ao tocar vídeo remoto:', e));
              }
              if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = stream;
                remoteAudioRef.current.play().catch(e => console.warn('Erro ao tocar áudio remoto:', e));
              }
            },
            onConnectionStateChange: (state) => {
              if (state === 'failed' || state === 'closed') {
                handleHangup();
              }
            },
            onError: (err) => {
              console.error('WebRTC error:', err);
            },
          });

          if (isInitiator) {
            await webrtcService.createOffer();
          }
        }
      } catch (err) {
        console.error('Failed to start call media/offer:', err);
      }
    };

    start();

    return () => {
      webrtcService.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId]);

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    webrtcService.toggleMicrophone(!newMuted);
    setIsMuted(newMuted);
  };

  const handleToggleVideo = () => {
    const newOff = !isVideoOff;
    webrtcService.toggleCamera(!newOff);
    setIsVideoOff(newOff);
  };

  const handleSwitchCamera = async () => {
    const newFacing = await webrtcService.switchCamera(facingMode);
    setFacingMode(newFacing);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {isVideo ? (
        <>
          {/* Remote video fullscreen */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Local video PIP */}
          <div className="absolute top-4 right-4 w-28 h-40 rounded-xl overflow-hidden shadow-lg border-2 border-white/30 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>
        </>
      ) : (
        /* Audio call UI */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-white">
          <Avatar name={peerName} size="xl" />
          <div className="text-center">
            <p className="text-2xl font-bold">{peerName ?? 'Desconhecido'}</p>
            <p className="text-indigo-400 font-medium text-sm mt-1">
              {isRinging ? 'Chamando...' : timer}
            </p>
          </div>
          {/* Elemento de áudio invisível para reproduzir a voz remota */}
          <audio ref={remoteAudioRef} autoPlay playsInline />
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pb-10 pt-6 flex flex-col items-center gap-3">
        {isVideo && (
          <p className="text-white text-sm font-medium tabular-nums">
            {isRinging ? 'Chamando...' : timer}
          </p>
        )}
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isVideo={isVideo}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onSwitchCamera={handleSwitchCamera}
          onHangup={handleHangup}
        />
      </div>
    </div>
  );
};
