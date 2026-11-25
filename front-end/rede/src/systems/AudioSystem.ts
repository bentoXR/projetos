/**
 * Pure Web Audio API synthesizer with zero external audio files.
 * Unlocks automatically on the first user gesture to comply with browser
 * autoplay policies, and keeps volume soft and pleasant.
 */
export class AudioSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.18;
  private muted = false;
  private unlocked = false;

  private readonly handleUnlock = (): void => {
    this.unlock();
  };

  constructor() {
    window.addEventListener('pointerdown', this.handleUnlock, { passive: true });
    window.addEventListener('touchstart', this.handleUnlock, { passive: true });
    window.addEventListener('keydown', this.handleUnlock, { passive: true });
  }

  /**
   * Initializes or resumes the AudioContext after a user interaction.
   */
  public unlock(): boolean {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtx) return false;

    if (!this.context) {
      this.context = new AudioCtx();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }

    this.unlocked = true;
    this.detachUnlockListeners();
    return true;
  }

  public isUnlocked(): boolean {
    return this.unlocked && this.context !== null;
  }

  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(0.6, value));
    if (this.masterGain && this.context && !this.muted) {
      this.masterGain.gain.setTargetAtTime(
        this.volume,
        this.context.currentTime,
        0.02,
      );
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.volume,
        this.context.currentTime,
        0.02,
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private getReadyNodes(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.unlocked || !this.context || !this.masterGain || this.muted) {
      return null;
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return { ctx: this.context, out: this.masterGain };
  }

  /**
   * Soft elastic "pop" for objects appearing on the stage.
   */
  public playPop(): void {
    const ready = this.getReadyNodes();
    if (!ready) return;
    const { ctx, out } = ready;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.065);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.095);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.9, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Warm musical "plim" for successful actions and solutions.
   */
  public playSuccess(): void {
    const ready = this.getReadyNodes();
    if (!ready) return;
    const { ctx, out } = ready;
    const now = ctx.currentTime;

    const notes = [
      { freq: 587.33, start: 0, duration: 0.24, amp: 0.55 }, // D5
      { freq: 880.0, start: 0.065, duration: 0.34, amp: 0.7 }, // A5
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.linearRampToValueAtTime(note.amp, now + note.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + note.start + note.duration,
      );

      osc.connect(gain);
      gain.connect(out);

      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }
  }

  /**
   * Gentle muffled "tum" for placing or landing objects softly.
   */
  public playSoftThud(): void {
    const ready = this.getReadyNodes();
    if (!ready) return;
    const { ctx, out } = ready;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.13);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.95, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Crisp tactile click for snapping into a slot or connecting a cable.
   */
  public playSnapClick(): void {
    const ready = this.getReadyNodes();
    if (!ready) return;
    const { ctx, out } = ready;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.038);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.75, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(out);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Friendly, non-harsh "erro gentil" — two soft muted descending notes.
   */
  public playGentleError(): void {
    const ready = this.getReadyNodes();
    if (!ready) return;
    const { ctx, out } = ready;
    const now = ctx.currentTime;

    const tones = [
      { freq: 330, start: 0, duration: 0.12 },
      { freq: 262, start: 0.095, duration: 0.18 },
    ];

    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, now + tone.start);

      gain.gain.setValueAtTime(0.001, now + tone.start);
      gain.gain.linearRampToValueAtTime(0.55, now + tone.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + tone.start + tone.duration,
      );

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.duration + 0.02);
    }
  }

  private detachUnlockListeners(): void {
    window.removeEventListener('pointerdown', this.handleUnlock);
    window.removeEventListener('touchstart', this.handleUnlock);
    window.removeEventListener('keydown', this.handleUnlock);
  }

  public destroy(): void {
    this.detachUnlockListeners();
    if (this.context && this.context.state !== 'closed') {
      void this.context.close();
    }
    this.context = null;
    this.masterGain = null;
  }
}
