import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import { wobble, type SketchPoint } from '../utils/animations';
import { StageObject } from './StageObject';

export interface StoredPaperRecord {
  id: string;
  tintColor: number;
  accentColor: number;
}

/**
 * Simple 2D drawer that slides open smoothly on hover/insert and visually
 * shows stored paper edges peeking inside (no counters or HUD text).
 */
export class DrawerObject extends StageObject {
  public readonly drawerId: string;
  public readonly capacity: number;
  public readonly drawerWidth = 114;
  public readonly drawerHeight = 76;

  private readonly storedPapers: StoredPaperRecord[] = [];
  private openAmount = 0; // 0 = closed, 1 = open
  private openTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    drawerId: string,
    capacity = 4,
  ) {
    super(scene, x, y);
    this.drawerId = drawerId;
    this.capacity = capacity;
    this.setSize(this.drawerWidth, this.drawerHeight);
    this.redraw();
  }

  public getCount(): number {
    return this.storedPapers.length;
  }

  public isFull(): boolean {
    return this.storedPapers.length >= this.capacity;
  }

  public getStoredPapers(): readonly StoredPaperRecord[] {
    return this.storedPapers;
  }

  public storePaper(record: StoredPaperRecord): boolean {
    if (this.isFull()) return false;
    this.storedPapers.push(record);
    this.redraw();
    wobble(this.scene, this, { angleDeg: 4, duration: 220, squash: 0.04 });
    return true;
  }

  /**
   * Smoothly animates the drawer front sliding open or closed.
   */
  public setOpen(open: boolean): void {
    const target = open ? 1 : 0;
    if (Math.abs(this.openAmount - target) < 0.01 && !this.openTween) return;

    if (this.openTween) {
      this.openTween.stop();
      this.openTween = null;
    }

    const state = { value: this.openAmount };
    this.openTween = this.scene.tweens.add({
      targets: state,
      value: target,
      duration: open ? 190 : 230,
      ease: open ? 'Back.easeOut' : 'Quad.easeInOut',
      onUpdate: () => {
        this.openAmount = state.value;
        this.redraw();
      },
      onComplete: () => {
        this.openAmount = target;
        this.openTween = null;
        this.redraw();
      },
    });
  }

  public redraw(): void {
    const g = this.graphics;
    const hw = this.drawerWidth / 2;
    const hh = this.drawerHeight / 2;
    const slideOffset = this.openAmount * 14;

    g.clear();

    // Outer cabinet shell
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(-hw, -hh, this.drawerWidth, this.drawerHeight, 12);
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeRoundedRect(-hw, -hh, this.drawerWidth, this.drawerHeight, 12);

    // Interior cavity visible when open or when papers peek out
    const cavityH = Math.max(8, 12 + slideOffset);
    g.fillStyle(PALETTE.stroke, 0.08);
    g.fillRoundedRect(-hw + 8, -hh + 8, this.drawerWidth - 16, cavityH, 5);

    // Draw stacked paper strips tucked inside the drawer
    const maxSlots = this.capacity;
    const stripAreaW = this.drawerWidth - 24;
    for (let i = 0; i < this.storedPapers.length; i++) {
      const paper = this.storedPapers[i];
      const yPos = -hh + 13 + (i / maxSlots) * (8 + slideOffset * 0.45);
      g.fillStyle(paper.tintColor, 1);
      g.fillRoundedRect(-stripAreaW / 2, yPos, stripAreaW, 9, 3);
      g.lineStyle(2, PALETTE.stroke, 0.85);
      g.strokeRoundedRect(-stripAreaW / 2, yPos, stripAreaW, 9, 3);
    }

    // Sliding drawer front face
    const faceY = -hh + 18 + slideOffset * 0.65;
    const faceH = this.drawerHeight - 24;
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(-hw + 5, faceY, this.drawerWidth - 10, faceH, 9);
    g.lineStyle(3.5, PALETTE.stroke, 1);
    g.strokeRoundedRect(-hw + 5, faceY, this.drawerWidth - 10, faceH, 9);

    // Minimalist rounded pull handle
    const handleW = 30;
    const handleH = 7;
    const handleColor = this.isFull() ? PALETTE.solution : PALETTE.stroke;
    g.fillStyle(handleColor, 1);
    g.fillRoundedRect(
      -handleW / 2,
      faceY + faceH / 2 - handleH / 2,
      handleW,
      handleH,
      3.5,
    );
  }

  public getDropBounds(): Phaser.Geom.Rectangle {
    const pad = 12;
    return new Phaser.Geom.Rectangle(
      this.x - this.drawerWidth / 2 - pad,
      this.y - this.drawerHeight / 2 - pad,
      this.drawerWidth + pad * 2,
      this.drawerHeight + pad * 2,
    );
  }

  public getSketchPaths(): SketchPoint[][] {
    const hw = this.drawerWidth / 2;
    const hh = this.drawerHeight / 2;
    return [
      [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
        { x: -hw, y: -hh },
      ],
      [
        { x: -hw + 8, y: -hh + 18 },
        { x: hw - 8, y: -hh + 18 },
      ],
      [
        { x: -14, y: 6 },
        { x: 14, y: 6 },
      ],
    ];
  }
}
