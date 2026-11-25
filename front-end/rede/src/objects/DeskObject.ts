import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import type { SketchPoint } from '../utils/animations';
import { StageObject } from './StageObject';

/**
 * Simple 2D geometric desk drawn with thick dark outlines and flat fills.
 * Supports line-by-line sketch entrance via getSketchPaths().
 */
export class DeskObject extends StageObject {
  public readonly deskWidth = 340;
  public readonly topHeight = 26;
  public readonly legHeight = 112;
  public readonly legWidth = 18;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.setSize(this.deskWidth, this.topHeight + this.legHeight);
    this.redraw();
  }

  public redraw(): void {
    const g = this.graphics;
    const hw = this.deskWidth / 2;
    const topY = -this.topHeight / 2;
    const legInset = 30;
    const legTopY = topY + this.topHeight - 2;

    g.clear();

    // Left leg
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(
      -hw + legInset,
      legTopY,
      this.legWidth,
      this.legHeight,
      6,
    );
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeRoundedRect(
      -hw + legInset,
      legTopY,
      this.legWidth,
      this.legHeight,
      6,
    );

    // Right leg
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(
      hw - legInset - this.legWidth,
      legTopY,
      this.legWidth,
      this.legHeight,
      6,
    );
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeRoundedRect(
      hw - legInset - this.legWidth,
      legTopY,
      this.legWidth,
      this.legHeight,
      6,
    );

    // Subtle crossbar between legs for visual balance
    const barY = legTopY + 34;
    g.lineStyle(3.5, PALETTE.stroke, 0.28);
    g.lineBetween(
      -hw + legInset + this.legWidth,
      barY,
      hw - legInset - this.legWidth,
      barY,
    );

    // Tabletop (drawn last so it sits cleanly over leg joints)
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(-hw, topY, this.deskWidth, this.topHeight, 10);
    g.lineStyle(4.5, PALETTE.stroke, 1);
    g.strokeRoundedRect(-hw, topY, this.deskWidth, this.topHeight, 10);
  }

  /**
   * Returns hand-drawn sketch strokes for drawIn() so the desk appears
   * line-by-line: tabletop first, then left leg, then right leg.
   */
  public getSketchPaths(): SketchPoint[][] {
    const hw = this.deskWidth / 2;
    const topY = -this.topHeight / 2;
    const botY = topY + this.topHeight;
    const legInset = 30;
    const legBot = botY + this.legHeight;

    return [
      // Tabletop rectangle
      [
        { x: -hw, y: topY },
        { x: hw, y: topY },
        { x: hw, y: botY },
        { x: -hw, y: botY },
        { x: -hw, y: topY },
      ],
      // Left leg
      [
        { x: -hw + legInset, y: botY },
        { x: -hw + legInset, y: legBot },
        { x: -hw + legInset + this.legWidth, y: legBot },
        { x: -hw + legInset + this.legWidth, y: botY },
      ],
      // Right leg
      [
        { x: hw - legInset - this.legWidth, y: botY },
        { x: hw - legInset - this.legWidth, y: legBot },
        { x: hw - legInset, y: legBot },
        { x: hw - legInset, y: botY },
      ],
    ];
  }

  /**
   * World Y coordinate right on top of the desk surface.
   */
  public getSurfaceY(): number {
    return this.y - this.topHeight / 2;
  }

  /**
   * World X range where falling papers can land comfortably on the tabletop.
   */
  public getLandingRangeX(): { minX: number; maxX: number } {
    return {
      minX: this.x - this.deskWidth * 0.34,
      maxX: this.x + this.deskWidth * 0.24,
    };
  }
}
