import { supabase } from './supabase';
import type { CallType } from '../types/database.types';

export interface WebRTCEventCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (error: Error) => void;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalingSubscription: { unsubscribe: () => void } | null = null;

  private callId: string | null = null;
  private currentUserId: string | null = null;
  private remoteUserId: string | null = null;
  private isVideoCall: boolean = false;
  private callbacks: WebRTCEventCallbacks | null = null;

  async startLocalMedia(callType: CallType, facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream> {
    this.isVideoCall = callType === 'video';

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: this.isVideoCall
        ? {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (err: any) {
      console.error('Failed to get user media:', err);
      throw new Error(`Permissão de câmera/microfone negada ou dispositivo indisponível: ${err.message}`);
    }
  }

  private async getIceServers(): Promise<RTCIceServer[]> {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];
  }

  async initializeCall(
    callId: string,
    currentUserId: string,
    remoteUserId: string,
    callbacks: WebRTCEventCallbacks
  ): Promise<void> {
    this.callId = callId;
    this.currentUserId = currentUserId;
    this.remoteUserId = remoteUserId;
    this.callbacks = callbacks;

    const iceServers = await this.getIceServers();

    this.peerConnection = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 2,
    });

    this.remoteStream = new MediaStream();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    }

    this.peerConnection.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.remoteStream = stream;
      if (this.callbacks) {
        this.callbacks.onRemoteStream(stream);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.callbacks) {
        this.callbacks.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate && this.callId && this.currentUserId && this.remoteUserId) {
        try {
          await supabase.from('call_signals').insert({
            call_id: this.callId,
            sender_id: this.currentUserId,
            receiver_id: this.remoteUserId,
            signal_type: 'ice-candidate',
            payload: event.candidate.toJSON() as any,
          });
        } catch (e) {
          console.error('Error sending ICE candidate:', e);
        }
      }
    };

    this.subscribeToSignaling();
  }

  async createOffer(): Promise<void> {
    if (!this.peerConnection || !this.callId || !this.currentUserId || !this.remoteUserId) {
      throw new Error('PeerConnection not initialized');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await supabase.from('call_signals').insert({
      call_id: this.callId,
      sender_id: this.currentUserId,
      receiver_id: this.remoteUserId,
      signal_type: 'offer',
      payload: {
        type: offer.type,
        sdp: offer.sdp,
      },
    });
  }

  async createAnswer(): Promise<void> {
    if (!this.peerConnection || !this.callId || !this.currentUserId || !this.remoteUserId) {
      throw new Error('PeerConnection not initialized');
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    await supabase.from('call_signals').insert({
      call_id: this.callId,
      sender_id: this.currentUserId,
      receiver_id: this.remoteUserId,
      signal_type: 'answer',
      payload: {
        type: answer.type,
        sdp: answer.sdp,
      },
    });
  }

  private subscribeToSignaling() {
    if (!this.callId || !this.currentUserId) return;

    // 1. Processar sinais já existentes no banco (ex: a oferta inicial enviada antes do receptor montar o componente)
    supabase
      .from('call_signals')
      .select('*')
      .eq('call_id', this.callId)
      .neq('sender_id', this.currentUserId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          data.forEach(async (signal) => {
            await this.handleIncomingSignal(signal);
          });
        }
      });

    // 2. Escutar novos sinais em tempo real
    const channel = supabase
      .channel(`signals:${this.callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signals',
          filter: `call_id=eq.${this.callId}`,
        },
        async (payload) => {
          const signal = payload.new as any;
          if (signal.sender_id === this.currentUserId) return;
          await this.handleIncomingSignal(signal);
        }
      )
      .subscribe();

    this.signalingSubscription = {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  private pendingCandidates: RTCIceCandidateInit[] = [];

  private async handleIncomingSignal(signal: any) {
    try {
      if (signal.signal_type === 'offer' && this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload));
        // Adicionar candidatos ICE que chegaram antes da oferta
        while (this.pendingCandidates.length > 0) {
          const c = this.pendingCandidates.shift();
          if (c) await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
        }
        await this.createAnswer();
      } else if (signal.signal_type === 'answer' && this.peerConnection) {
        if (this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload));
          while (this.pendingCandidates.length > 0) {
            const c = this.pendingCandidates.shift();
            if (c) await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
          }
        }
      } else if (signal.signal_type === 'ice-candidate' && this.peerConnection) {
        if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.payload));
        } else {
          this.pendingCandidates.push(signal.payload);
        }
      }
    } catch (err: any) {
      console.error('Error handling WebRTC signal:', err);
      this.callbacks?.onError(err);
    }
  }

  toggleMicrophone(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled !== undefined ? enabled : !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  toggleCamera(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled !== undefined ? enabled : !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  async switchCamera(currentFacingMode: 'user' | 'environment'): Promise<'user' | 'environment'> {
    if (!this.localStream || !this.peerConnection) return currentFacingMode;

    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    const oldVideoTrack = this.localStream.getVideoTracks()[0];
    if (oldVideoTrack) {
      oldVideoTrack.stop();
      this.localStream.removeTrack(oldVideoTrack);
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      this.localStream.addTrack(newVideoTrack);

      const sender = this.peerConnection.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      return newFacingMode;
    } catch (e) {
      console.error('Failed to switch camera:', e);
      return currentFacingMode;
    }
  }

  cleanup(): void {
    if (this.signalingSubscription) {
      this.signalingSubscription.unsubscribe();
      this.signalingSubscription = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.callId = null;
    this.currentUserId = null;
    this.remoteUserId = null;
    this.callbacks = null;
  }
}

export const webrtcService = new WebRTCService();

