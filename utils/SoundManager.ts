class SoundManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  play(type: 'place' | 'rotate' | 'perfect' | 'junk' | 'gameOver') {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      switch (type) {
        case 'rotate':
          // Short high tick
          this.osc(t, 600, 800, 0.05, 'sine', 0.05);
          break;
        case 'place':
          // Soft thud
          this.osc(t, 150, 50, 0.1, 'triangle', 0.1);
          break;
        case 'perfect':
          // Magical high arpeggio (C Major 7)
          this.note(t, 523.25, 0.1, 'sine', 0.1); // C5
          this.note(t + 0.06, 659.25, 0.1, 'sine', 0.1); // E5
          this.note(t + 0.12, 783.99, 0.1, 'sine', 0.1); // G5
          this.note(t + 0.18, 987.77, 0.3, 'sine', 0.1); // B5
          break;
        case 'junk':
          // Mechanical crunch / break sound
          // A low sawtooth descending
          this.osc(t, 150, 40, 0.3, 'sawtooth', 0.15);
          // With some noise/dissonance
          this.osc(t, 140, 30, 0.3, 'square', 0.1);
          break;
        case 'gameOver':
          // Sad descending slide
          this.osc(t, 400, 100, 1.5, 'triangle', 0.2);
          this.osc(t + 0.1, 390, 95, 1.4, 'sawtooth', 0.1);
          break;
      }
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }

  private osc(t: number, startFreq: number, endFreq: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.connect(g);
    g.connect(this.ctx.destination);
    
    o.frequency.setValueAtTime(startFreq, t);
    o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    
    o.start(t);
    o.stop(t + dur);
  }

  private note(t: number, freq: number, dur: number, type: OscillatorType = 'sine', vol: number = 0.1) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.connect(g);
    g.connect(this.ctx.destination);
    
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    
    o.start(t);
    o.stop(t + dur);
  }
}

export const soundManager = new SoundManager();
