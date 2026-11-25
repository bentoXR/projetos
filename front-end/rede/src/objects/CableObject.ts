import Phaser from 'phaser';
import { PALETTE } from '../data/palette';

/**
 * Reusable 2D network cable drawn as a smooth quadratic curve with thick
 * dark strokes (#1F2430) and circular end-ports.
 */
export class CableObject {
  public readonly cableId: string;
  public readonly graphics: Phaser.GameObjects.Graphics;

  private startX: number;
  private startY: number;
  private endX: number;
  private endY: number;
  private sag: number;
  private connected = false;

  constructor(
    scene: Phaser.Scene,
    cableId: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    sag = 46,
  ) {
    this.cableId = cableId;
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
    this.sag = sag;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(200);
    this.redraw();
  }

  public setStart(x: number, y: number): void {
    this.startX = x;
    this.startY = y;
    this.redraw();
  }

  public setEnd(x: number, y: number): void {
    this.endX = x;
    this.endY = y;
    this.redraw();
  }

  public setSag(sag: number): void {
    this.sag = sag;
    this.redraw();
  }

  public setConnected(connected: boolean): void {
    this.connected = connected;
    this.redraw();
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getStart(): { x: number; y: number } {
    return { x: this.startX, y: this.startY };
  }

  public getEnd(): { x: number; y: number } {
    return { x: this.endX, y: this.endY };
  }

  /**
   * Computes a world point along the cable's quadratic Bezier curve (0 <= t <= 1).
   */
  public getPointAt(t: number): { x: number; y: number } {
    const clamped = Phaser.Math.Clamp(t, 0, 1);
    const inv = 1 - clamped;
    const ctrlX = (this.startX + this.endX) / 2;
    const ctrlY = Math.max(this.startY, this.endY) + this.sag;

    return {
      x:
        inv * inv * this.startX +
        2 * inv * clamped * ctrlX +
        clamped * clamped * this.endX,
      y:
        inv * inv * this.startY +
        2 * inv * clamped * ctrlY +
        clamped * clamped * this.endY,
    };
  }

  public getMidpoint(): { x: number; y: number } {
    return this.getPointAt(0.5);
  }

  public redraw(): void {
    const g = this.graphics;
    if (!g.scene) return;

    g.clear();

    const steps = 28;
    g.lineStyle(5, PALETTE.stroke, 1);
    g.beginPath();
    const p0 = this.getPointAt(0);
    g.moveTo(p0.x, p0.y);
    for (let i = 1; i <= steps; i++) {
      const pt = this.getPointAt(i / steps);
      g.lineTo(pt.x, pt.y);
    }
    g.strokePath();

    // Start connector port
    const portFill = this.connected ? PALETTE.solution : PALETTE.background;
    g.fillStyle(portFill, 1);
    g.fillCircle(this.startX, this.startY, 7);
    g.lineStyle(3.5, PALETTE.stroke, 1);
    g.strokeCircle(this.startX, this.startY, 7);

    // End connector port (drawn when connected; loose plug handle is separate)
    if (this.connected) {
      g.fillStyle(PALETTE.solution, 1);
      g.fillCircle(this.endX, this.endY, 7);
      g.lineStyle(3.5, PALETTE.stroke, 1);
      g.strokeCircle(this.endX, this.endY, 7);
    }
  }

  public destroy(): void {
    if (this.graphics.scene) {
      this.graphics.destroy();
    }
  }
}
