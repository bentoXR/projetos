import Phaser from 'phaser';
import { PALETTE, PAPER_TINTS } from '../data/palette';
import { wobble } from '../utils/animations';
import { StageObject } from './StageObject';

export interface PaperConfig {
  id: string;
  /** Soft fill color derived from the fixed palette. */
  tintColor?: number;
  /** Accent band color (from the fixed palette) for visual clarity. */
  accentColor?: number;
  /** Distinct vibrant blue styling for "the blue paper from yesterday". */
  isBlueTarget?: boolean;
  width?: number;
  height?: number;
}

/**
 * Flat geometric paper sheet drawn purely with Phaser Graphics.
 * Features a folded corner and subtle abstract lines (no text).
 */
export class PaperObject extends StageObject {
  public readonly paperId: string;
  public readonly tintColor: number;
  public readonly accentColor: number;
  public readonly isBlueTarget: boolean;
  public readonly paperWidth: number;
  public readonly paperHeight: number;
  public isStored = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: PaperConfig) {
    super(scene, x, y);
    this.paperId = config.id;
    this.isBlueTarget = config.isBlueTarget ?? false;
    this.tintColor = this.isBlueTarget
      ? PALETTE.data
      : (config.tintColor ?? PAPER_TINTS[0]);
    this.accentColor = this.isBlueTarget
      ? PALETTE.background
      : (config.accentColor ?? PALETTE.data);
    this.paperWidth = config.width ?? 54;
    this.paperHeight = config.height ?? 68;

    this.setSize(this.paperWidth, this.paperHeight);
    this.redraw();
  }

  public redraw(): void {
    const g = this.graphics;
    const hw = this.paperWidth / 2;
    const hh = this.paperHeight / 2;
    const fold = 13;

    g.clear();

    // Main paper body with clipped top-right corner
    g.fillStyle(this.tintColor, 1);
    g.beginPath();
    g.moveTo(-hw, -hh);
    g.lineTo(hw - fold, -hh);
    g.lineTo(hw, -hh + fold);
    g.lineTo(hw, hh);
    g.lineTo(-hw, hh);
    g.closePath();
    g.fillPath();

    // Crisp outer contour
    g.lineStyle(3.5, PALETTE.stroke, 1);
    g.beginPath();
    g.moveTo(-hw, -hh);
    g.lineTo(hw - fold, -hh);
    g.lineTo(hw, -hh + fold);
    g.lineTo(hw, hh);
    g.lineTo(-hw, hh);
    g.closePath();
    g.strokePath();

    // Folded corner flap
    g.fillStyle(PALETTE.background, 1);
    g.beginPath();
    g.moveTo(hw - fold, -hh);
    g.lineTo(hw - fold, -hh + fold);
    g.lineTo(hw, -hh + fold);
    g.closePath();
    g.fillPath();

    g.lineStyle(3, PALETTE.stroke, 1);
    g.beginPath();
    g.moveTo(hw - fold, -hh);
    g.lineTo(hw - fold, -hh + fold);
    g.lineTo(hw, -hh + fold);
    g.strokePath();

    // Small colored data header bar + abstract content lines
    g.fillStyle(this.accentColor, this.isBlueTarget ? 0.95 : 0.9);
    g.fillRoundedRect(-hw + 9, -hh + 11, this.paperWidth - 28, 6, 3);

    const lineColor = this.isBlueTarget ? PALETTE.background : PALETTE.stroke;
    const lineAlpha = this.isBlueTarget ? 0.72 : 0.35;
    g.lineStyle(2.5, lineColor, lineAlpha);
    const lineStartX = -hw + 9;
    const lineEndX = hw - 9;
    g.lineBetween(lineStartX, -4, lineEndX, -4);
    g.lineBetween(lineStartX, 7, lineEndX - 6, 7);
    g.lineBetween(lineStartX, 18, lineEndX - 12, 18);
  }

  /**
   * Animates the paper floating down from above with a gentle leaf-like sway,
   * landing softly on the desk.
   */
  public fallTo(
    targetX: number,
    targetY: number,
    options: {
      startOffsetY?: number;
      duration?: number;
      restingAngle?: number;
      onLand?: () => void;
    } = {},
  ): Promise<void> {
    const {
      startOffsetY = 230,
      duration = 900,
      restingAngle = Phaser.Math.Between(-6, 6),
      onLand,
    } = options;

    const startX = targetX + Phaser.Math.Between(-18, 18);
    const startY = targetY - startOffsetY;
    const swayAmplitude = Phaser.Math.Between(14, 24);
    const swayDir = Math.random() < 0.5 ? -1 : 1;

    this.setPosition(startX, startY);
    this.setAlpha(0);

    return new Promise<void>((resolve) => {
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: 'Quad.easeOut',
        onUpdate: (tween) => {
          if (!this.scene) return;
          const t = tween.getValue() ?? 0;
          const sway = Math.sin(t * Math.PI * 2) * swayAmplitude * (1 - t) * swayDir;
          const currentX = Phaser.Math.Linear(startX, targetX, t) + sway;
          const currentY = Phaser.Math.Linear(startY, targetY, t);
          this.setPosition(currentX, currentY);
          this.setAngle(
            Phaser.Math.Linear(swayDir * 14, restingAngle, t) +
              Math.cos(t * Math.PI * 2) * 8 * (1 - t),
          );
          this.setAlpha(Math.min(1, t * 4));
        },
        onComplete: () => {
          if (!this.scene) {
            resolve();
            return;
          }
          this.setPosition(targetX, targetY);
          this.setAngle(restingAngle);
          this.setAlpha(1);
          wobble(this.scene, this, { angleDeg: 5, duration: 240, squash: 0.04 });
          onLand?.();
          resolve();
        },
      });
    });
  }
}
