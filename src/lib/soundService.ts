// Simple Web Audio API Synthesizer for Ringtone and Ringback tone without external audio files

class SoundService {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private ringbackInterval: any = null;

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Toca o som de chamada chamando (tuuu... tuuu...) para quem está ligando
  startRingback() {
    this.stopAll();
    const playBeep = () => {
      try {
        const ctx = this.getContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      } catch (e) {
        console.warn('Erro ao tocar ringback:', e);
      }
    };

    playBeep();
    this.ringbackInterval = setInterval(playBeep, 3500);
  }

  // Toca o som de chamada recebida (trim trim trim...) para quem recebe
  startRingtone() {
    this.stopAll();
    const playRing = () => {
      try {
        const ctx = this.getContext();
        // Duplo tom harmonioso (telefone tradicional)
        [480, 440].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 1.5);
        });
      } catch (e) {
        console.warn('Erro ao tocar ringtone:', e);
      }
    };

    playRing();
    this.ringtoneInterval = setInterval(playRing, 2500);
  }

  stopAll() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }
  }
}

export const soundService = new SoundService();

