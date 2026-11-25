import Phaser from 'phaser';
import { PALETTE, PAPER_TINTS } from '../../data/palette';
import { BookshelfObject } from '../../objects/BookshelfObject';
import { DeskObject } from '../../objects/DeskObject';
import { DrawerObject } from '../../objects/DrawerObject';
import { PaperObject } from '../../objects/PaperObject';
import {
  drawIn,
  fadeOut,
  pulseHint,
  type DrawInHandle,
  type PulseHintHandle,
} from '../../utils/animations';
import type { Chapter, StageContext } from './Chapter';

const PAPER_ACCENTS = [
  PALETTE.data,
  PALETTE.highlight,
  PALETTE.solution,
  PALETTE.problem,
] as const;

/**
 * Chapter 1 (0:00–1:00):
 * - Clean white stage, brief silence, desk sketches in line-by-line.
 * - First paper falls and pulses gently; player drags it into the drawer.
 * - More papers arrive at a pleasant pace that gradually accelerates.
 * - As drawers fill, a second drawer and then a bookshelf appear while the
 *   camera smoothly pulls back to reveal the growing space.
 */
export class Chapter01Desk implements Chapter {
  public readonly id = 'chapter-01-desk';

  private ctx!: StageContext;
  private stopped = false;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];
  private drawHandles: DrawInHandle[] = [];
  private firstPaperPulse: PulseHintHandle | null = null;

  private paperCounter = 0;
  private drawerTwoSpawned = false;
  private bookshelfSpawned = false;
  private firstPaperFiled = false;
  private chapterCompleted = false;
  private resolveChapter: (() => void) | null = null;

  /** Target total filed papers to complete the 0:00–1:00 chapter gracefully. */
  private readonly targetFiledPapers = 14;
  /** Maximum unfiled papers resting on the desk during this calm opening. */
  private readonly maxDeskPapers = 4;

  public start(ctx: StageContext): Promise<void> {
    this.ctx = ctx;
    this.stopped = false;

    return new Promise<void>((resolve) => {
      this.resolveChapter = resolve;
      void this.runIntroSequence();
    });
  }

  public stop(): void {
    this.stopped = true;
    this.clearSpawnTimer();
    for (const t of this.pendingTimers) {
      t.remove(false);
    }
    this.pendingTimers = [];
    this.firstPaperPulse?.stop();
    this.firstPaperPulse = null;
    for (const h of this.drawHandles) {
      h.stop();
    }
    this.drawHandles = [];
  }

  private async runIntroSequence(): Promise<void> {
    const { scene, camera, audio, narrator, worldOrigin, state } = this.ctx;

    // Fit initial zoom cleanly for narrow portrait phones while staying 1.0 on desktop.
    const baseZoom = this.getResponsiveScale(440);
    await camera.setView(worldOrigin.x, worldOrigin.y, baseZoom, {
      duration: 0,
    });

    // Brief contemplative silence on the empty white stage.
    await this.wait(850);
    if (this.stopped) return;

    // Desk sketches in line-by-line, then fills in.
    const desk = new DeskObject(scene, worldOrigin.x, worldOrigin.y + 38);
    desk.setDepth(10);
    state.desk = desk;

    const deskDraw = drawIn(scene, desk, {
      paths: desk.getSketchPaths(),
      drawDuration: 920,
      fillDuration: 340,
      strokeWidth: 4,
    });
    this.drawHandles.push(deskDraw);
    await deskDraw.promise;
    if (this.stopped) return;

    audio.playSoftThud();
    narrator.say('ch1.desk_intro');

    // First drawer sketches in tucked cleanly under the right side of the desk.
    await this.wait(420);
    if (this.stopped) return;

    const drawer1 = await this.spawnDrawer(
      'drawer-1',
      desk.x + 56,
      desk.y + 62,
      4,
    );
    if (this.stopped || !drawer1) return;

    // Wait a gentle beat before the very first paper floats down.
    await this.wait(950);
    if (this.stopped) return;

    await this.spawnPaper({ isFirst: true });
  }

  private async spawnDrawer(
    id: string,
    x: number,
    y: number,
    capacity: number,
  ): Promise<DrawerObject | null> {
    const { scene, drag, audio, narrator, state } = this.ctx;
    const drawer = new DrawerObject(scene, x, y, id, capacity);
    drawer.setDepth(14);
    state.drawers.push(drawer);

    const handle = drawIn(scene, drawer, {
      paths: drawer.getSketchPaths(),
      drawDuration: 620,
      fillDuration: 260,
      strokeWidth: 3.5,
    });
    this.drawHandles.push(handle);
    await handle.promise;
    if (this.stopped) return null;

    audio.playPop();

    drag.registerDropZone({
      id: drawer.drawerId,
      getBounds: () => drawer.getDropBounds(),
      cornerRadius: 14,
      highlightDepth: 40,
      accepts: (item) => item.type === 'paper' && !drawer.isFull(),
      onHoverChange: (isHovering, isAccepted) => {
        if (isHovering && isAccepted) {
          drawer.setOpen(true);
          audio.playSoftThud();
        } else {
          drawer.setOpen(false);
        }
      },
      onAccept: (item) => {
        const paper = item.data as PaperObject;
        this.filePaperIntoDrawer(paper, drawer);
      },
      onReject: () => {
        audio.playGentleError();
        if (drawer.isFull()) {
          narrator.say('ch1.drawer_already_full');
        }
      },
    });

    return drawer;
  }

  private async spawnBookshelf(): Promise<void> {
    const { scene, drag, audio, camera, narrator, state } = this.ctx;
    const desk = state.desk;
    if (!desk || this.bookshelfSpawned) return;
    this.bookshelfSpawned = true;

    // Align the bottom of the bookshelf with the desk legs' floor line.
    const floorY = desk.y + desk.topHeight / 2 + desk.legHeight;
    const shelfX = desk.x + 382;
    const shelfY = floorY - 118;

    // Pull the camera back and pan gently right to frame desk + drawers + shelf.
    const targetZoom = this.getResponsiveScale(740);
    await camera.setView(desk.x + 128, desk.y - 4, targetZoom, {
      duration: 820,
      ease: 'Cubic.easeInOut',
    });
    if (this.stopped) return;

    const shelf = new BookshelfObject(scene, shelfX, shelfY, 'bookshelf-1', 9);
    shelf.setDepth(12);
    state.bookshelf = shelf;

    const handle = drawIn(scene, shelf, {
      paths: shelf.getSketchPaths(),
      drawDuration: 820,
      fillDuration: 300,
      strokeWidth: 4,
    });
    this.drawHandles.push(handle);
    await handle.promise;
    if (this.stopped) return;

    audio.playPop();
    narrator.say('ch1.bookshelf_appears');

    drag.registerDropZone({
      id: shelf.shelfId,
      getBounds: () => shelf.getDropBounds(),
      cornerRadius: 16,
      highlightDepth: 40,
      accepts: (item) => item.type === 'paper' && !shelf.isFull(),
      onHoverChange: (isHovering, isAccepted) => {
        if (isHovering && isAccepted) {
          audio.playSnapClick();
        }
      },
      onAccept: (item) => {
        const paper = item.data as PaperObject;
        this.filePaperIntoBookshelf(paper, shelf);
      },
      onReject: () => {
        audio.playGentleError();
      },
    });
  }

  private async spawnPaper(options: { isFirst?: boolean } = {}): Promise<void> {
    const { scene, drag, audio, state } = this.ctx;
    const desk = state.desk;
    if (!desk || this.stopped) return;

    const index = this.paperCounter++;
    const tintColor = options.isFirst
      ? PAPER_TINTS[0]
      : PAPER_TINTS[index % PAPER_TINTS.length];
    const accentColor = options.isFirst
      ? PALETTE.data
      : PAPER_ACCENTS[index % PAPER_ACCENTS.length];

    const range = desk.getLandingRangeX();
    const targetX = options.isFirst
      ? desk.x - 62
      : Phaser.Math.Between(Math.round(range.minX), Math.round(range.maxX));
    const targetY = desk.getSurfaceY() - 32 + Phaser.Math.Between(-4, 4);

    const paper = new PaperObject(scene, targetX, targetY - 220, {
      id: `paper-${index + 1}`,
      tintColor,
      accentColor,
    });
    paper.setDepth(22 + (index % 15));
    state.activePapers.push(paper);

    await paper.fallTo(targetX, targetY, {
      duration: options.isFirst ? 980 : 780,
      restingAngle: options.isFirst ? -4 : Phaser.Math.Between(-9, 9),
      onLand: () => audio.playSoftThud(),
    });
    if (this.stopped || !paper.scene) return;

    // Gentle pulse on the very first paper inviting the player to grab it.
    if (options.isFirst) {
      this.firstPaperPulse = pulseHint(scene, paper, {
        scaleFactor: 1.08,
        minAlpha: 0.9,
        duration: 820,
      });
    }

    drag.registerDraggable(paper, {
      id: paper.paperId,
      type: 'paper',
      data: paper,
      baseScale: 1,
      hitArea: new Phaser.Geom.Rectangle(
        -paper.paperWidth / 2 - 10,
        -paper.paperHeight / 2 - 10,
        paper.paperWidth + 20,
        paper.paperHeight + 20,
      ),
      dragScale: 1.09,
      returnOnMiss: true,
      onPick: () => {
        if (options.isFirst && this.firstPaperPulse) {
          this.firstPaperPulse.stop();
          this.firstPaperPulse = null;
        }
        audio.playSnapClick();
      },
    });
  }

  private filePaperIntoDrawer(paper: PaperObject, drawer: DrawerObject): void {
    const { scene, drag, audio, state } = this.ctx;
    if (paper.isStored) return;
    paper.isStored = true;

    drag.unregisterDraggable(paper);
    state.activePapers = state.activePapers.filter((p) => p !== paper);

    drawer.setOpen(true);

    // Tuck the paper smoothly into the open drawer slot, then close it.
    scene.tweens.add({
      targets: paper,
      x: drawer.x,
      y: drawer.y - 10,
      scaleX: 0.55,
      scaleY: 0.45,
      angle: 0,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!paper.scene) return;
        drawer.storePaper({
          id: paper.paperId,
          tintColor: paper.tintColor,
          accentColor: paper.accentColor,
        });
        audio.playSuccess();
        fadeOut(scene, paper, { duration: 110, destroyOnComplete: true });
        this.schedule(180, () => drawer.setOpen(false));
        this.handlePaperFiled();
      },
    });
  }

  private filePaperIntoBookshelf(
    paper: PaperObject,
    shelf: BookshelfObject,
  ): void {
    const { scene, drag, audio, state } = this.ctx;
    if (paper.isStored) return;
    paper.isStored = true;

    drag.unregisterDraggable(paper);
    state.activePapers = state.activePapers.filter((p) => p !== paper);

    scene.tweens.add({
      targets: paper,
      x: shelf.x,
      y: shelf.y,
      scaleX: 0.5,
      scaleY: 0.65,
      angle: 0,
      duration: 190,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!paper.scene) return;
        shelf.storePaper({
          id: paper.paperId,
          tintColor: paper.tintColor,
          accentColor: paper.accentColor,
        });
        audio.playSuccess();
        fadeOut(scene, paper, { duration: 110, destroyOnComplete: true });
        this.handlePaperFiled();
      },
    });
  }

  private handlePaperFiled(): void {
    const { narrator, camera, state } = this.ctx;
    state.totalPapersFiled++;

    // 1) Right after the very first paper is stored: "Um papel. Fácil."
    if (!this.firstPaperFiled) {
      this.firstPaperFiled = true;
      narrator.say('ch1.one_paper');
      this.scheduleNextPaper(1500);
      return;
    }

    // 2) When the first drawer fills, zoom out slightly and sketch in drawer #2.
    const drawer1 = state.drawers[0];
    if (drawer1?.isFull() && !this.drawerTwoSpawned && state.desk) {
      this.drawerTwoSpawned = true;
      this.clearSpawnTimer();
      void (async () => {
        const desk = state.desk!;
        const targetZoom = this.getResponsiveScale(560);
        await camera.setView(desk.x + 56, desk.y + 18, targetZoom, {
          duration: 680,
          ease: 'Cubic.easeInOut',
        });
        if (this.stopped) return;
        await this.spawnDrawer('drawer-2', desk.x + 232, desk.y + 62, 4);
        if (this.stopped) return;
        narrator.say('ch1.drawer_full');
        this.scheduleNextPaper(950);
      })();
      return;
    }

    // 3) When the second drawer fills, zoom out further and sketch in the bookshelf.
    const drawer2 = state.drawers[1];
    if (drawer2?.isFull() && !this.bookshelfSpawned) {
      this.clearSpawnTimer();
      void (async () => {
        await this.spawnBookshelf();
        if (this.stopped) return;
        this.scheduleNextPaper(900);
      })();
      return;
    }

    // 4) Chapter 1 completion: 14 papers filed (or bookshelf near full).
    if (
      state.totalPapersFiled >= this.targetFiledPapers &&
      !this.chapterCompleted
    ) {
      this.chapterCompleted = true;
      this.clearSpawnTimer();
      this.resolveChapter?.();
      return;
    }

    // Keep the flow lively if the desk is empty.
    if (state.activePapers.length === 0 && !this.spawnTimer) {
      this.scheduleNextPaper(this.getCurrentSpawnDelay());
    }
  }

  /**
   * Computes a pleasant, gradually accelerating interval (in ms) from ~2.5s
   * down to ~1.15s across the 0:20–1:00 ramp.
   */
  private getCurrentSpawnDelay(): number {
    const filed = this.ctx.state.totalPapersFiled;
    const progress = Phaser.Math.Clamp(filed / this.targetFiledPapers, 0, 1);
    return Math.round(Phaser.Math.Linear(2450, 1150, progress));
  }

  private scheduleNextPaper(delayMs: number): void {
    this.clearSpawnTimer();
    if (this.stopped || this.chapterCompleted) return;

    this.spawnTimer = this.ctx.scene.time.delayedCall(delayMs, () => {
      this.spawnTimer = null;
      if (this.stopped || this.chapterCompleted) return;

      const { state } = this.ctx;
      const totalSpawnedNotDone =
        state.totalPapersFiled + state.activePapers.length;

      // Avoid overflowing the desk during Chapter 1; wait softly if busy.
      if (
        state.activePapers.length < this.maxDeskPapers &&
        totalSpawnedNotDone < this.targetFiledPapers
      ) {
        void this.spawnPaper();
      }

      if (totalSpawnedNotDone + 1 < this.targetFiledPapers) {
        this.scheduleNextPaper(this.getCurrentSpawnDelay());
      }
    });
  }

  private clearSpawnTimer(): void {
    if (this.spawnTimer) {
      this.spawnTimer.remove(false);
      this.spawnTimer = null;
    }
  }

  /**
   * Keeps the expanding room comfortably framed on desktop, landscape mobile,
   * and portrait phones without clipping.
   */
  private getResponsiveScale(desiredWorldWidth: number): number {
    const vp = this.ctx.getViewport();
    const fitWidth = (vp.width * 0.88) / desiredWorldWidth;
    const fitHeight = (vp.height * 0.74) / 340;
    return Phaser.Math.Clamp(Math.min(1, fitWidth, fitHeight), 0.42, 1);
  }

  private schedule(ms: number, fn: () => void): void {
    const timer = this.ctx.scene.time.delayedCall(ms, () => {
      this.pendingTimers = this.pendingTimers.filter((t) => t !== timer);
      if (!this.stopped) fn();
    });
    this.pendingTimers.push(timer);
  }

  private wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.schedule(ms, resolve);
    });
  }
}
