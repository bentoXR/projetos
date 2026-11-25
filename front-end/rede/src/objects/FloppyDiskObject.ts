import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import type { SketchPoint } from '../utils/animations';
import { StageObject } from './StageObject';

/**
 * Minimalist 2D floppy disk drawn procedurally with thick dark outlines.
 * Visually shows when it carries a digital file by coloring its label area.
 */
export class FloppyDiskObject extends StageObject {
  public readonly diskWidth = 56;
  public readonly diskHeight = 60;

  private loadedColor: number | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.setSize(this.diskWidth, this.diskHeight);
    this.redraw();
  }

  public isLoaded(): boolean {
    return this.loadedColor !== null;
  }

  public getLoadedColor(): number | null {
    return this.loadedColor;
  }

  public setLoadedColor(color: number | null): void {
    this.loadedColor = color;
    this.redraw();
  }

  public redraw(): void {
    const g = this.graphics;
    const hw = this.diskWidth / 2;
    const hh = this.diskHeight / 2;
    const cut = 10;

    g.clear();

    // Outer disk shell with clipped top-right corner
    g.fillStyle(PALETTE.background, 1);
    g.beginPath();
    g.moveTo(-hw + 4, -hh);
    g.lineTo(hw - cut, -hh);
    g.lineTo(hw, -hh + cut);
    g.lineTo(hw, hh - 4);
    g.lineTo(hw - 4, hh);
    g.lineTo(-hw + 4, hh);
    g.lineTo(-hw, hh - 4);
    g.lineTo(-hw, -hh + 4);
    g.closePath();
    g.fillPath();

    g.lineStyle(4, PALETTE.stroke, 1);
    g.beginPath();
    g.moveTo(-hw + 4, -hh);
    g.lineTo(hw - cut, -hh);
    g.lineTo(hw, -hh + cut);
    g.lineTo(hw, hh - 4);
    g.lineTo(hw - 4, hh);
    g.lineTo(-hw + 4, hh);
    g.lineTo(-hw, hh - 4);
    g.lineTo(-hw, -hh + 4);
    g.closePath();
    g.strokePath();

    // Top metal shutter
    const shutterW = 28;
    const shutterH = 18;
    g.fillStyle(PALETTE.stroke, 0.14);
    g.fillRoundedRect(-shutterW / 2 - 2, -hh + 2, shutterW, shutterH, 3);
    g.lineStyle(3, PALETTE.stroke, 1);
    g.strokeRoundedRect(-shutterW / 2 - 2, -hh + 2, shutterW, shutterH, 3);

    // Tiny shutter slot
    g.fillStyle(PALETTE.stroke, 1);
    g.fillRoundedRect(2, -hh + 6, 5, 10, 2);

    // Bottom label area — lights up with the carried file's palette color
    const labelW = this.diskWidth - 16;
    const labelH = 22;
    const labelY = hh - labelH - 6;

    g.fillStyle(this.loadedColor ?? PALETTE.background, 1);
    g.fillRoundedRect(-labelW / 2, labelY, labelW, labelH, 4);
    g.lineStyle(2.5, PALETTE.stroke, 1);
    g.strokeRoundedRect(-labelW / 2, labelY, labelW, labelH, 4);

    // Subtle horizontal lines on the label
    const lineColor =
      this.loadedColor !== null ? PALETTE.background : PALETTE.stroke;
    const lineAlpha = this.loadedColor !== null ? 0.85 : 0.3;
    g.lineStyle(2.5, lineColor, lineAlpha);
    g.lineBetween(-labelW / 2 + 6, labelY + 8, labelW / 2 - 6, labelY + 8);
    g.lineBetween(-labelW / 2 + 6, labelY + 15, labelW / 2 - 12, labelY + 15);
  }

  public getDropBounds(): Phaser.Geom.Rectangle {
    const pad = 16;
    return new Phaser.Geom.Rectangle(
      this.x - this.diskWidth / 2 - pad,
      this.y - this.diskHeight / 2 - pad,
      this.diskWidth + pad * 2,
      this.diskHeight + pad * 2,
    );
  }

  public getSketchPaths(): SketchPoint[][] {
    const hw = this.diskWidth / 2;
    const hh = this.diskHeight / 2;
    const cut = 10;
    return [
      [
        { x: -hw, y: -hh },
        { x: hw - cut, y: -hh },
        { x: hw, y: -hh + cut },
        { x: hw, y: hh },
        { x: -hw, y: hh },
        { x: -hw, y: -hh },
      ],
      [
        { x: -16, y: -hh + 2 },
        { x: -16, y: -hh + 20 },
        { x: 12, y: -hh + 20 },
        { x: 12, y: -hh + 2 },
      ],
      [
        { x: -hw + 8, y: hh - 28 },
        { x: hw - 8, y: hh - 28 },
        { x: hw - 8, y: hh - 6 },
        { x: -hw + 8, y: hh - 6 },
        { x: -hw + 8, y: hh - 28 },
      ],
    ];
  }
}
