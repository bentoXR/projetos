import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import { StageObject } from './StageObject';

/**
 * Minimalist 2D computer drawn procedurally with thick dark outlines.
 * Displays a tidy miniature grid of colored file squares on its screen as
 * digital files are stored inside.
 */
export class ComputerObject extends StageObject {
  public readonly computerId: string;
  public readonly monitorWidth = 116;
  public readonly monitorHeight = 84;
  public readonly standHeight = 16;
  public readonly baseWidth = 64;
  public readonly baseHeight = 10;

  private readonly storedColors: number[] = [];
  private screenGlowAlpha = 0;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    computerId = 'computer-1',
  ) {
    super(scene, x, y);
    this.computerId = computerId;
    this.setSize(
      this.monitorWidth,
      this.monitorHeight + this.standHeight + this.baseHeight,
    );
    this.redraw();
  }

  /**
   * Distance from container origin (center of monitor) to the bottom of the stand.
   */
  public getBottomOffset(): number {
    return this.monitorHeight / 2 + this.standHeight + this.baseHeight;
  }

  /**
   * World position of the center of the computer screen.
   */
  public getScreenCenter(): { x: number; y: number } {
    return { x: this.x, y: this.y - 2 };
  }

  /**
   * Records a tiny colored file square inside the screen grid (capped visually
   * at 15 tidy dots so the screen stays crisp and readable).
   */
  public absorbFileSquare(color: number): void {
    if (this.storedColors.length < 15) {
      this.storedColors.push(color);
    } else {
      const slot = Math.floor(Math.random() * this.storedColors.length);
      this.storedColors[slot] = color;
    }

    this.screenGlowAlpha = 0.22;
    this.redraw();

    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }

    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1.07,
      scaleY: 0.94,
      duration: 65,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.screenGlowAlpha = 0;
        if (this.scene) {
          this.setScale(1, 1);
          this.redraw();
        }
        this.pulseTween = null;
      },
    });
  }

  public redraw(): void {
    const g = this.graphics;
    const hw = this.monitorWidth / 2;
    const hh = this.monitorHeight / 2;

    g.clear();

    // Stand neck
    const neckW = 18;
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(-neckW / 2, hh - 2, neckW, this.standHeight + 4, 4);
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeRoundedRect(-neckW / 2, hh - 2, neckW, this.standHeight + 4, 4);

    // Stand base
    const baseY = hh + this.standHeight;
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(
      -this.baseWidth / 2,
      baseY,
      this.baseWidth,
      this.baseHeight,
      5,
    );
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeRoundedRect(
      -this.baseWidth / 2,
      baseY,
      this.baseWidth,
      this.baseHeight,
      5,
    );

    // Outer monitor frame
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(-hw, -hh, this.monitorWidth, this.monitorHeight, 14);
    g.lineStyle(4.5, PALETTE.stroke, 1);
    g.strokeRoundedRect(-hw, -hh, this.monitorWidth, this.monitorHeight, 14);

    // Inner screen bezel
    const padX = 11;
    const padTop = 10;
    const padBot = 16;
    const screenW = this.monitorWidth - padX * 2;
    const screenH = this.monitorHeight - padTop - padBot;
    const sx = -hw + padX;
    const sy = -hh + padTop;

    g.fillStyle(PALETTE.stroke, 0.05);
    g.fillRoundedRect(sx, sy, screenW, screenH, 7);

    if (this.screenGlowAlpha > 0) {
      g.fillStyle(PALETTE.data, this.screenGlowAlpha);
      g.fillRoundedRect(sx, sy, screenW, screenH, 7);
    }

    g.lineStyle(3, PALETTE.stroke, 1);
    g.strokeRoundedRect(sx, sy, screenW, screenH, 7);

    // Tidy miniature file grid inside screen (5 cols x 3 rows)
    const cols = 5;
    const rows = 3;
    const cellW = (screenW - 14) / cols;
    const cellH = (screenH - 12) / rows;
    const sqSize = 10;

    for (let i = 0; i < this.storedColors.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = sx + 7 + col * cellW + (cellW - sqSize) / 2;
      const cy = sy + 6 + row * cellH + (cellH - sqSize) / 2;
      g.fillStyle(this.storedColors[i], 1);
      g.fillRoundedRect(cx, cy, sqSize, sqSize, 2.5);
    }

    // Small green power indicator dot on bottom bezel
    g.fillStyle(PALETTE.solution, 1);
    g.fillCircle(hw - 16, hh - 8, 3.2);
  }
}
