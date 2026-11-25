import Phaser from 'phaser';
import {
  getNarrationLine,
  type NarrationCatalog,
  type NarrationLine,
} from '../data/narration';
import { PALETTE_HEX } from '../data/palette';

const VOICE_STORAGE_KEY = 'rede.narrator.voiceEnabled';

export type NarratorFinishHandler = (lineId: string) => void;

/**
 * Discreet bottom-caption narrator with variation rotation, silence delays,
 * finish events, and optional browser speechSynthesis in pt-BR (off by default).
 */
export class Narrator {
  private readonly catalog: NarrationCatalog | null;
  private readonly emitter = new Phaser.Events.EventEmitter();
  private readonly lastVariationIndex = new Map<string, number>();

  private containerEl: HTMLDivElement | null = null;
  private textEl: HTMLParagraphElement | null = null;

  private silenceTimer: number | null = null;
  private hideTimer: number | null = null;
  private activeLineId: string | null = null;
  private voiceEnabled = false;

  constructor(customCatalog?: NarrationCatalog) {
    this.catalog = customCatalog ?? null;
    this.voiceEnabled = this.readVoicePreference();
    this.mountCaptionElement();
  }

  /**
   * Displays a narration line by id immediately (cancelling any previous line).
   */
  public say(id: string): void {
    const line = this.resolveLine(id);
    if (!line) return;

    this.cancel();

    const chosenText = this.pickVariation(line);
    const durationMs =
      line.durationMs ?? this.estimateReadingDuration(chosenText);

    this.activeLineId = id;
    this.showCaption(chosenText);

    if (this.voiceEnabled && this.isSpeechSupported()) {
      this.speak(chosenText, id, durationMs);
    } else {
      this.scheduleFinish(id, durationMs);
    }
  }

  /**
   * Waits in silence for `ms` milliseconds, then delivers the line.
   */
  public sayAfterSilence(id: string, ms: number): void {
    this.cancel();
    this.silenceTimer = window.setTimeout(() => {
      this.silenceTimer = null;
      this.say(id);
    }, Math.max(0, ms));
  }

  /**
   * Cancels any pending silence timer, active caption, and speech utterance.
   */
  public cancel(): void {
    if (this.silenceTimer !== null) {
      window.clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (this.isSpeechSupported()) {
      window.speechSynthesis.cancel();
    }

    this.activeLineId = null;
    this.hideCaption();
  }

  /**
   * Registers a callback fired when a narration line finishes displaying/speaking.
   * Returns an unsubscribe function.
   */
  public onFinish(handler: NarratorFinishHandler): () => void {
    this.emitter.on('finish', handler);
    return () => {
      this.emitter.off('finish', handler);
    };
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  public setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
    this.saveVoicePreference(enabled);
    if (!enabled && this.isSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  public toggleVoice(): boolean {
    this.setVoiceEnabled(!this.voiceEnabled);
    return this.voiceEnabled;
  }

  public destroy(): void {
    this.cancel();
    this.emitter.removeAllListeners();
    if (this.containerEl?.parentElement) {
      this.containerEl.parentElement.removeChild(this.containerEl);
    }
    this.containerEl = null;
    this.textEl = null;
  }

  private resolveLine(id: string): NarrationLine | undefined {
    if (this.catalog && this.catalog[id]) {
      return this.catalog[id];
    }
    return getNarrationLine(id);
  }

  private pickVariation(line: NarrationLine): string {
    const options = [line.text, ...(line.variations ?? [])];
    if (options.length === 1) return options[0];

    const lastIdx = this.lastVariationIndex.get(line.id) ?? -1;
    const nextIdx = (lastIdx + 1) % options.length;
    this.lastVariationIndex.set(line.id, nextIdx);
    return options[nextIdx];
  }

  private estimateReadingDuration(text: string): number {
    // Comfortable reading speed for short captions: ~55ms per char, clamped.
    return Math.max(2400, Math.min(6200, 1300 + text.length * 52));
  }

  private scheduleFinish(lineId: string, delayMs: number): void {
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      if (this.activeLineId !== lineId) return;
      this.activeLineId = null;
      this.hideCaption();
      this.emitter.emit('finish', lineId);
    }, delayMs);
  }

  private speak(text: string, lineId: string, fallbackDurationMs: number): void {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.02;
      utterance.pitch = 1.0;
      utterance.volume = 0.85;

      const voices = window.speechSynthesis.getVoices();
      const ptBrVoice =
        voices.find((v) => v.lang.toLowerCase() === 'pt-br') ??
        voices.find((v) => v.lang.toLowerCase().startsWith('pt'));
      if (ptBrVoice) {
        utterance.voice = ptBrVoice;
      }

      let finished = false;
      const complete = (): void => {
        if (finished || this.activeLineId !== lineId) return;
        finished = true;
        if (this.hideTimer !== null) {
          window.clearTimeout(this.hideTimer);
          this.hideTimer = null;
        }
        this.scheduleFinish(lineId, 450);
      };

      utterance.onend = complete;
      utterance.onerror = complete;

      // Safety fallback in case a browser never fires speechSynthesis onend.
      this.hideTimer = window.setTimeout(
        complete,
        Math.max(fallbackDurationMs + 2500, 5000),
      );

      window.speechSynthesis.speak(utterance);
    } catch {
      this.scheduleFinish(lineId, fallbackDurationMs);
    }
  }

  private isSpeechSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  private readVoicePreference(): boolean {
    try {
      return window.localStorage.getItem(VOICE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private saveVoicePreference(enabled: boolean): void {
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage errors in restricted browsing contexts.
    }
  }

  private mountCaptionElement(): void {
    const container = document.createElement('div');
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    Object.assign(container.style, {
      position: 'fixed',
      left: '50%',
      bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
      transform: 'translate(-50%, 8px)',
      maxWidth: 'min(560px, calc(100vw - 40px))',
      padding: '8px 16px',
      borderRadius: '999px',
      backgroundColor: 'rgba(250, 250, 247, 0.88)',
      border: `1.5px solid rgba(31, 36, 48, 0.14)`,
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 320ms ease, transform 320ms ease',
      zIndex: '20',
      textAlign: 'center',
      backdropFilter: 'blur(4px)',
    });

    const p = document.createElement('p');
    Object.assign(p.style, {
      margin: '0',
      color: PALETTE_HEX.stroke,
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 'clamp(14px, 1.8vw, 16px)',
      fontWeight: '500',
      lineHeight: '1.4',
      letterSpacing: '0.01em',
    });

    container.appendChild(p);
    document.body.appendChild(container);

    this.containerEl = container;
    this.textEl = p;
  }

  private showCaption(text: string): void {
    if (!this.containerEl || !this.textEl) return;
    this.textEl.textContent = text;
    this.containerEl.style.opacity = '1';
    this.containerEl.style.transform = 'translate(-50%, 0)';
  }

  private hideCaption(): void {
    if (!this.containerEl) return;
    this.containerEl.style.opacity = '0';
    this.containerEl.style.transform = 'translate(-50%, 8px)';
  }
}
