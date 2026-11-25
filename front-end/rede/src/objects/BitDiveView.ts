import Phaser from 'phaser';
import { PALETTE_HEX } from '../data/palette';

/**
 * Real ASCII binary for "OI" (0x4F, 0x49): 01001111 01001001.
 * Used for an authentic two-level NRZ-L electrical pulse waveform inside the wire.
 */
const SIGNAL_BITS: readonly number[] = [
  0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1,
];

/**
 * Full-viewport magnified cross-section of the cable for the optional deep-dive.
 * Uses a dedicated retina 2D canvas overlay (z-index 15, below the Narrator's
 * z-index 20) so it stays crisp and unaffected while the main Phaser camera is
 * zoomed deep into the wire.
 */
export class BitDiveView {
  private readonly scene: Phaser.Scene;
  private readonly overlayEl: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly backBtn: HTMLButtonElement;

  private scrollOffset = 0;
  private closed = false;
  private onReturnCallback: (() => void) | null = null;

  private readonly handleUpdate = (_time: number, delta: number): void => {
    if (this.closed) return;
    this.scrollOffset += (delta / 1000) * 1.65;
    this.renderFrame();
  };

  private readonly handleResize = (): void => {
    if (this.closed) return;
    this.resizeCanvas();
    this.renderFrame();
  };

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.triggerReturn();
    }
  };

  constructor(scene: Phaser.Scene, onReturn: () => void) {
    this.scene = scene;
    this.onReturnCallback = onReturn;

    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '15',
      backgroundColor: PALETTE_HEX.background,
      opacity: '0',
      transition: 'opacity 320ms ease',
      touchAction: 'none',
      userSelect: 'none',
    });

    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      width: '100%',
      height: '100%',
      display: 'block',
    });

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D context for BitDiveView');
    }
    this.ctx2d = ctx;

    this.backBtn = this.createBackButton();

    this.overlayEl.appendChild(this.canvas);
    this.overlayEl.appendChild(this.backBtn);
    document.body.appendChild(this.overlayEl);

    this.resizeCanvas();
    this.renderFrame();

    // Smooth fade-in on next animation frame
    window.requestAnimationFrame(() => {
      if (!this.closed) {
        this.overlayEl.style.opacity = '1';
      }
    });

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.handleUpdate);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private createBackButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Voltar à cena');
    Object.assign(btn.style, {
      position: 'fixed',
      top: 'max(22px, env(safe-area-inset-top, 22px))',
      left: 'max(22px, env(safe-area-inset-left, 22px))',
      width: '54px',
      height: '54px',
      borderRadius: '999px',
      border: `4px solid ${PALETTE_HEX.stroke}`,
      backgroundColor: PALETTE_HEX.background,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      transition: 'transform 160ms ease',
      zIndex: '16',
    });

    // Pure geometric left-arrow SVG drawn inline (zero external assets)
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${PALETTE_HEX.stroke}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/></svg>`;

    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      btn.style.transform = 'scale(0.92)';
      this.triggerReturn();
    });

    return btn;
  }

  private resizeCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(w * dpr));
    this.canvas.height = Math.max(1, Math.floor(h * dpr));
    this.ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private renderFrame(): void {
    const ctx = this.ctx2d;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cy = h * 0.46;
    const bandHalf = Math.min(115, h * 0.21);
    const highY = cy - bandHalf * 0.46;
    const lowY = cy + bandHalf * 0.46;

    // 1) Clean off-white background
    ctx.fillStyle = PALETTE_HEX.background;
    ctx.fillRect(0, 0, w, h);

    // 2) Subtle magnified cable interior
    ctx.fillStyle = 'rgba(31, 36, 48, 0.045)';
    ctx.fillRect(0, cy - bandHalf, w, bandHalf * 2);

    // 3) Thick dark top & bottom cable walls
    ctx.strokeStyle = PALETTE_HEX.stroke;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, cy - bandHalf);
    ctx.lineTo(w, cy - bandHalf);
    ctx.moveTo(0, cy + bandHalf);
    ctx.lineTo(w, cy + bandHalf);
    ctx.stroke();

    // 4) Dashed HIGH (1) and LOW (0) reference voltage levels
    ctx.save();
    ctx.strokeStyle = 'rgba(31, 36, 48, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(54, highY);
    ctx.lineTo(w - 16, highY);
    ctx.moveTo(54, lowY);
    ctx.lineTo(w - 16, lowY);
    ctx.stroke();
    ctx.restore();

    // Left-edge 1 / 0 markers
    ctx.fillStyle = PALETTE_HEX.stroke;
    ctx.font =
      '700 18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', 28, highY);
    ctx.fillText('0', 28, lowY);

    // 5) Crisp scrolling square-wave pulse in PALETTE.data (#4F8CFF)
    const leftX = 54;
    const rightX = w - 16;
    const bitWidth = Math.max(54, Math.min(80, w / 10.5));
    const visibleSlots = Math.ceil((rightX - leftX) / bitWidth) + 2;

    const firstBitIdx = Math.floor(this.scrollOffset);
    const frac = this.scrollOffset - firstBitIdx;

    ctx.strokeStyle = PALETTE_HEX.data;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    let started = false;
    let prevY = lowY;
    const dots: Array<{ x: number; y: number; bit: number }> = [];

    for (let s = -1; s <= visibleSlots; s++) {
      const bitIndex = firstBitIdx + s;
      const wrapped =
        ((bitIndex % SIGNAL_BITS.length) + SIGNAL_BITS.length) %
        SIGNAL_BITS.length;
      const bit = SIGNAL_BITS[wrapped];

      // Scrolls left -> right (from PC 1 toward PC 2)
      const xStart = rightX - (s - frac) * bitWidth;
      const xEnd = xStart - bitWidth;
      if (xStart < leftX || xEnd > rightX) continue;

      const clampedStart = Math.max(leftX, Math.min(rightX, xStart));
      const clampedEnd = Math.max(leftX, Math.min(rightX, xEnd));
      const levelY = bit === 1 ? highY : lowY;

      if (!started) {
        ctx.moveTo(clampedStart, levelY);
        started = true;
      } else if (levelY !== prevY) {
        ctx.lineTo(clampedStart, levelY);
      }
      ctx.lineTo(clampedEnd, levelY);
      prevY = levelY;

      if (clampedStart - clampedEnd > bitWidth * 0.52) {
        dots.push({
          x: (clampedStart + clampedEnd) / 2,
          y: levelY,
          bit,
        });
      }
    }
    ctx.stroke();

    // 6) Pulse dots & crisp bit digits above/below each plateau
    ctx.font =
      '700 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    for (const d of dots) {
      ctx.fillStyle = d.bit === 1 ? PALETTE_HEX.data : PALETTE_HEX.stroke;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillText(String(d.bit), d.x, d.bit === 1 ? highY - 22 : lowY + 22);
    }
  }

  private triggerReturn(): void {
    if (this.closed) return;
    this.closed = true;
    this.detachListeners();

    const cb = this.onReturnCallback;
    this.onReturnCallback = null;

    this.overlayEl.style.opacity = '0';
    window.setTimeout(() => {
      if (this.overlayEl.parentElement) {
        this.overlayEl.parentElement.removeChild(this.overlayEl);
      }
      cb?.();
    }, 300);
  }

  private detachListeners(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.handleUpdate);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  public destroy(): void {
    if (this.closed) return;
    this.closed = true;
    this.detachListeners();
    if (this.overlayEl.parentElement) {
      this.overlayEl.parentElement.removeChild(this.overlayEl);
    }
  }
}
