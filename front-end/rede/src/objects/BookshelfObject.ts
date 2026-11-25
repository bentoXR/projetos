import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import { wobble, type SketchPoint } from '../utils/animations';
import type { StoredPaperRecord } from './DrawerObject';
import { StageObject } from './StageObject';

/**
 * Tall 2D bookshelf drawn procedurally with 3 shelves.
 * Visually fills with neatly standing colored folders as papers are stored.
 */
export class BookshelfObject extends StageObject {
  public readonly shelfId: string;
  public readonly capacity: number;
  public readonly shelfWidth = 148;
  public readonly shelfHeight = 236;

  private readonly storedPapers: StoredPaperRecord[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    shelfId: string,
    capacity = 9,
  ) {
    super(scene, x, y);
    this.shelfId = shelfId;
    this.capacity = capacity;
    this.setSize(this.shelfWidth, this.shelfHeight);
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
    wobble(this.scene, this, { angleDeg: 2.5, duration: 220, squash: 0.025 });
    return true;
  }

  public redraw(): void {
    const g = this.graphics;
    const hw = this.shelfWidth / 2;
    const hh = this.shelfHeight / 2;
    const shelfCount = 3;
    const innerPad = 10;
    const usableH = this.shelfHeight - innerPad * 2;
    const rowH = usableH / shelfCount;

    g.clear();

    // Outer frame
    g.fillStyle(PALETTE.background, 1);
    g.fillRoundedRect(-hw, -hh, this.shelfWidth, this.shelfHeight, 14);
    g.lineStyle(4.5, PALETTE.stroke, 1);
    g.strokeRoundedRect(-hw, -hh, this.shelfWidth, this.shelfHeight, 14);

    // Shelf divider bars
    g.lineStyle(4, PALETTE.stroke, 1);
    for (let row = 1; row < shelfCount; row++) {
      const y = -hh + innerPad + row * rowH;
      g.lineBetween(-hw + 4, y, hw - 4, y);
    }

    // Render stored papers as upright geometric folders across the 3 shelves
    const perRow = Math.ceil(this.capacity / shelfCount);
    const folderGap = 5;
    const innerW = this.shelfWidth - 28;
    const folderW = Math.min(
      26,
      (innerW - folderGap * (perRow - 1)) / perRow,
    );

    for (let i = 0; i < this.storedPapers.length; i++) {
      const paper = this.storedPapers[i];
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const shelfBottomY = -hh + innerPad + (row + 1) * rowH - 5;
      const folderH = rowH - 18 - (i % 2) * 5;
      const fx = -hw + 14 + col * (folderW + folderGap);
      const fy = shelfBottomY - folderH;

      g.fillStyle(paper.tintColor, 1);
      g.fillRoundedRect(fx, fy, folderW, folderH, 5);
      g.lineStyle(2.5, PALETTE.stroke, 1);
      g.strokeRoundedRect(fx, fy, folderW, folderH, 5);

      // Tiny colored spine dot from the fixed palette
      g.fillStyle(paper.accentColor, 1);
      g.fillCircle(fx + folderW / 2, fy + 11, 3.5);
    }
  }

  public getDropBounds(): Phaser.Geom.Rectangle {
    const pad = 12;
    return new Phaser.Geom.Rectangle(
      this.x - this.shelfWidth / 2 - pad,
      this.y - this.shelfHeight / 2 - pad,
      this.shelfWidth + pad * 2,
      this.shelfHeight + pad * 2,
    );
  }

  public getSketchPaths(): SketchPoint[][] {
    const hw = this.shelfWidth / 2;
    const hh = this.shelfHeight / 2;
    const rowH = (this.shelfHeight - 20) / 3;

    return [
      [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
        { x: -hw, y: -hh },
      ],
      [
        { x: -hw + 6, y: -hh + 10 + rowH },
        { x: hw - 6, y: -hh + 10 + rowH },
      ],
      [
        { x: -hw + 6, y: -hh + 10 + rowH * 2 },
        { x: hw - 6, y: -hh + 10 + rowH * 2 },
      ],
    ];
  }
}
