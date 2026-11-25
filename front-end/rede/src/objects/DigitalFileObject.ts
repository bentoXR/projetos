import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import { StageObject } from './StageObject';

export interface DigitalFileConfig {
  id: string;
  color?: number;
  size?: number;
}

/**
 * Clean geometric digital file square drawn purely with Phaser Graphics.
 * Used for both flying micro-squares and the retrieved blue digital file.
 */
export class DigitalFileObject extends StageObject {
  public readonly fileId: string;
  public readonly fileColor: number;
  public readonly fileSize: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: DigitalFileConfig,
  ) {
    super(scene, x, y);
    this.fileId = config.id;
    this.fileColor = config.color ?? PALETTE.data;
    this.fileSize = config.size ?? 44;

    this.setSize(this.fileSize, this.fileSize);
    this.redraw();
  }

  public redraw(): void {
    const g = this.graphics;
    const half = this.fileSize / 2;
    const radius = Math.max(4, Math.round(this.fileSize * 0.22));

    g.clear();

    g.fillStyle(this.fileColor, 1);
    g.fillRoundedRect(-half, -half, this.fileSize, this.fileSize, radius);
    g.lineStyle(this.fileSize >= 32 ? 3.5 : 2.5, PALETTE.stroke, 1);
    g.strokeRoundedRect(-half, -half, this.fileSize, this.fileSize, radius);

    // Subtle crisp inner bars for larger file icons (still zero text)
    if (this.fileSize >= 32) {
      const barW = this.fileSize * 0.52;
      g.fillStyle(PALETTE.background, 0.92);
      g.fillRoundedRect(-barW / 2, -7, barW, 4.5, 2);
      g.fillRoundedRect(-barW / 2, 2, barW * 0.72, 4.5, 2);
    }
  }
}
