import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { ComputerObject } from '../../objects/ComputerObject';
import { DeskObject } from '../../objects/DeskObject';
import { DigitalFileObject } from '../../objects/DigitalFileObject';
import { FloppyDiskObject } from '../../objects/FloppyDiskObject';
import {
  drawIn,
  fadeOut,
  popIn,
  pulseHint,
  wobble,
  type DrawInHandle,
  type PulseHintHandle,
} from '../../utils/animations';
import type { Chapter, StageContext } from './Chapter';

/**
 * Chapter 4 (3:00–4:20):
 * - A second desk with a colleague's computer appears beside the first.
 * - Dragging the blue file directly to PC 2 hits an "invisible wall" and bounces back.
 * - A simple floppy disk appears; player copies the file onto the floppy and carries
 *   it to the colleague's PC.
 * - Repeated across growing distances: side-by-side -> across the room -> another floor
 *   (suggested with camera zoom-out and clean minimalist stairs/floor lines).
 * - Narrator humorously introduces the term "sneakernet".
 */
export class Chapter04Sneakernet implements Chapter {
  public readonly id = 'chapter-04-sneakernet';

  private ctx!: StageContext;
  private stopped = false;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];
  private drawHandles: DrawInHandle[] = [];
  private activePulse: PulseHintHandle | null = null;
  private spaceGuideGraphics: Phaser.GameObjects.Graphics | null = null;
  private resolveChapter: (() => void) | null = null;

  public start(ctx: StageContext): Promise<void> {
    this.ctx = ctx;
    this.stopped = false;

    return new Promise<void>((resolve) => {
      this.resolveChapter = resolve;
      void this.runSequence();
    });
  }

  public stop(): void {
    this.stopped = true;
    for (const t of this.pendingTimers) {
      t.remove(false);
    }
    this.pendingTimers = [];
    for (const h of this.drawHandles) {
      h.stop();
    }
    this.drawHandles = [];
    this.clearPulse();
    if (this.spaceGuideGraphics?.scene) {
      this.spaceGuideGraphics.destroy();
      this.spaceGuideGraphics = null;
    }
    this.ctx.drag.unregisterDropZone('pc2-wall-zone');
    this.ctx.drag.unregisterDropZone('floppy-load-zone');
    this.ctx.drag.unregisterDropZone('pc2-deliver-zone');
  }

  private async runSequence(): Promise<void> {
    const { scene, camera, audio, narrator, state } = this.ctx;
    const desk1 = state.desk;
    const pc1 = state.computer;
    if (!desk1 || !pc1) {
      this.resolveChapter?.();
      return;
    }

    // 1) Pull camera back to make room for the colleague's desk on the right.
    const desk2InitialX = desk1.x + 420;
    const desk2InitialY = desk1.y;
    const initialPairZoom = this.getResponsiveScale(860, 380);
    await camera.setView(
      (desk1.x + desk2InitialX) / 2,
      desk1.y - 20,
      initialPairZoom,
      { duration: 820, ease: 'Cubic.easeInOut' },
    );
    if (this.stopped) return;

    // 2) Second desk sketches in, followed by the colleague's computer.
    const desk2 = new DeskObject(scene, desk2InitialX, desk2InitialY);
    desk2.setDepth(10);
    state.secondDesk = desk2;

    const desk2Draw = drawIn(scene, desk2, {
      paths: desk2.getSketchPaths(),
      drawDuration: 760,
      fillDuration: 280,
      strokeWidth: 4,
    });
    this.drawHandles.push(desk2Draw);
    await desk2Draw.promise;
    if (this.stopped) return;

    const pc2 = new ComputerObject(scene, desk2.x, 0, 'computer-2');
    pc2.setPosition(desk2.x, desk2.getSurfaceY() - pc2.getBottomOffset() + 4);
    pc2.setDepth(210);
    state.secondComputer = pc2;

    popIn(scene, pc2, { duration: 460 });
    audio.playPop();

    await this.wait(420);
    if (this.stopped) return;

    // 3) Narrator: "Seu colega precisa desse arquivo."
    narrator.say('ch4.colleague_needs_file');

    // Ensure the blue digital file is present above PC 1.
    const blueFile =
      state.blueFile && state.blueFile.scene
        ? state.blueFile
        : await this.spawnFileAbove(pc1, PALETTE.data, 'blue-digital-file');
    if (this.stopped) return;
    state.blueFile = blueFile;

    // 4) Wait for the player to try dragging the blue file directly to PC 2
    //    and bounce off the invisible wall!
    await this.waitForInvisibleWallAttempt(blueFile, pc1, pc2);
    if (this.stopped) return;

    narrator.say('ch4.lives_in_that_pc');
    await this.wait(2200);
    if (this.stopped) return;

    // 5) Floppy disk sketches in beside PC 1.
    const floppyHomeX = desk1.x + 114;
    const floppyHomeY = desk1.getSurfaceY() - 30;
    const floppy = new FloppyDiskObject(scene, floppyHomeX, floppyHomeY);
    floppy.setDepth(240);
    state.floppyDisk = floppy;

    const floppyDraw = drawIn(scene, floppy, {
      paths: floppy.getSketchPaths(),
      drawDuration: 620,
      fillDuration: 240,
      strokeWidth: 3.5,
    });
    this.drawHandles.push(floppyDraw);
    await floppyDraw.promise;
    if (this.stopped) return;

    audio.playPop();
    narrator.say('ch4.floppy_arrives');

    // 6) Delivery #1 — Right next door (blue file)
    await this.runFloppyDelivery(
      blueFile,
      floppy,
      floppyHomeX,
      floppyHomeY,
      pc2,
      PALETTE.data,
    );
    state.blueFile = null;
    if (this.stopped) return;

    await this.wait(550);
    if (this.stopped) return;

    // 7) Delivery #2 — Across the room (yellow file)
    const acrossX = desk1.x + 790;
    const acrossY = desk1.y;
    await this.moveColleagueDesk(desk1, desk2, pc2, acrossX, acrossY, 'room');
    if (this.stopped) return;

    const yellowFile = await this.spawnFileAbove(
      pc1,
      PALETTE.highlight,
      'file-yellow',
    );
    if (this.stopped) return;
    narrator.say('ch4.across_room');
    await this.runFloppyDelivery(
      yellowFile,
      floppy,
      floppyHomeX,
      floppyHomeY,
      pc2,
      PALETTE.highlight,
    );
    if (this.stopped) return;

    await this.wait(550);
    if (this.stopped) return;

    // 8) Delivery #3 — Another floor (green file)
    const upperFloorX = desk1.x + 960;
    const upperFloorY = desk1.y - 235;
    await this.moveColleagueDesk(
      desk1,
      desk2,
      pc2,
      upperFloorX,
      upperFloorY,
      'floor',
    );
    if (this.stopped) return;

    const greenFile = await this.spawnFileAbove(
      pc1,
      PALETTE.solution,
      'file-green',
    );
    if (this.stopped) return;
    narrator.say('ch4.another_floor');
    await this.runFloppyDelivery(
      greenFile,
      floppy,
      floppyHomeX,
      floppyHomeY,
      pc2,
      PALETTE.solution,
    );
    if (this.stopped) return;

    // 9) Sneakernet punchline!
    await this.wait(350);
    if (this.stopped) return;
    narrator.say('ch4.sneakernet');
    await this.wait(4900);
    if (this.stopped) return;

    // 10) Smoothly bring colleague's desk back into a clean networking pair
    //     for Chapter 5 (4:20 — the cable!).
    this.clearSpaceGuides();
    const pairEndX = desk1.x + 460;
    await this.moveColleagueDesk(desk1, desk2, pc2, pairEndX, desk1.y, 'none');
    if (this.stopped) return;

    this.resolveChapter?.();
  }

  private waitForInvisibleWallAttempt(
    file: DigitalFileObject,
    pc1: ComputerObject,
    pc2: ComputerObject,
  ): Promise<void> {
    const { scene, drag, audio } = this.ctx;

    return new Promise<void>((resolve) => {
      let attempted = false;

      this.setPulse(file);

      drag.registerDropZone({
        id: 'pc2-wall-zone',
        getBounds: () => this.getComputerDropBounds(pc2),
        cornerRadius: 16,
        highlightDepth: 250,
        accepts: () => false,
        onReject: () => {
          if (attempted || this.stopped) return;
          attempted = true;

          audio.playGentleError();
          wobble(scene, pc2, { angleDeg: 7, duration: 300, squash: 0.04 });
          this.flashInvisibleWall((pc1.x + pc2.x) / 2, pc1.y - 10);

          this.clearPulse();
          drag.unregisterDropZone('pc2-wall-zone');
          drag.unregisterDraggable(file);

          this.schedule(460, resolve);
        },
      });

      drag.registerDraggable(file, {
        id: file.fileId,
        type: 'digital-file',
        data: file,
        baseScale: 1,
        hitArea: new Phaser.Geom.Rectangle(
          -file.fileSize / 2 - 14,
          -file.fileSize / 2 - 14,
          file.fileSize + 28,
          file.fileSize + 28,
        ),
        dragScale: 1.12,
        returnOnMiss: true,
        onPick: () => {
          this.clearPulse();
          audio.playSnapClick();
        },
      });
    });
  }

  /**
   * Two-step floppy delivery:
   *   Step A: Drag digital file onto the floppy disk (copy).
   *   Step B: Drag loaded floppy disk all the way to PC 2 (deliver).
   */
  private async runFloppyDelivery(
    file: DigitalFileObject,
    floppy: FloppyDiskObject,
    floppyHomeX: number,
    floppyHomeY: number,
    pc2: ComputerObject,
    fileColor: number,
  ): Promise<void> {
    // Step A: Load file into floppy disk
    await this.waitForFileOntoFloppy(file, floppy, fileColor);
    if (this.stopped) return;

    // Step B: Carry floppy disk to PC 2
    await this.waitForFloppyToComputer(
      floppy,
      floppyHomeX,
      floppyHomeY,
      pc2,
      fileColor,
    );
  }

  private waitForFileOntoFloppy(
    file: DigitalFileObject,
    floppy: FloppyDiskObject,
    fileColor: number,
  ): Promise<void> {
    const { scene, drag, audio } = this.ctx;

    return new Promise<void>((resolve) => {
      this.setPulse(file);

      drag.registerDropZone({
        id: 'floppy-load-zone',
        getBounds: () => floppy.getDropBounds(),
        cornerRadius: 12,
        highlightDepth: 255,
        accepts: (item) => item.type === 'digital-file',
        onAccept: () => {
          this.clearPulse();
          drag.unregisterDropZone('floppy-load-zone');
          drag.unregisterDraggable(file);

          audio.playSnapClick();

          scene.tweens.add({
            targets: file,
            x: floppy.x,
            y: floppy.y + 8,
            scaleX: 0.35,
            scaleY: 0.35,
            duration: 170,
            ease: 'Back.easeIn',
            onComplete: () => {
              if (file.scene) file.destroy();
              if (this.stopped) {
                resolve();
                return;
              }
              floppy.setLoadedColor(fileColor);
              wobble(scene, floppy, { angleDeg: 8, duration: 280 });
              resolve();
            },
          });
        },
      });

      drag.registerDraggable(file, {
        id: file.fileId,
        type: 'digital-file',
        data: file,
        baseScale: 1,
        hitArea: new Phaser.Geom.Rectangle(
          -file.fileSize / 2 - 14,
          -file.fileSize / 2 - 14,
          file.fileSize + 28,
          file.fileSize + 28,
        ),
        dragScale: 1.12,
        returnOnMiss: true,
        onPick: () => {
          this.clearPulse();
          audio.playSnapClick();
        },
      });
    });
  }

  private waitForFloppyToComputer(
    floppy: FloppyDiskObject,
    homeX: number,
    homeY: number,
    pc2: ComputerObject,
    fileColor: number,
  ): Promise<void> {
    const { scene, drag, audio } = this.ctx;

    return new Promise<void>((resolve) => {
      this.setPulse(floppy);

      drag.registerDropZone({
        id: 'pc2-deliver-zone',
        getBounds: () => this.getComputerDropBounds(pc2),
        cornerRadius: 16,
        highlightDepth: 255,
        accepts: (item) => item.type === 'floppy-disk',
        onAccept: () => {
          this.clearPulse();
          drag.unregisterDropZone('pc2-deliver-zone');
          drag.unregisterDraggable(floppy);

          audio.playSuccess();
          pc2.absorbFileSquare(fileColor);
          wobble(scene, pc2, { angleDeg: 5, duration: 280, squash: 0.04 });

          // Empty the floppy disk and glide it back to Desk 1.
          floppy.setLoadedColor(null);
          scene.tweens.add({
            targets: floppy,
            x: homeX,
            y: homeY,
            duration: 460,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
              if (floppy.scene) {
                wobble(scene, floppy, { angleDeg: 4, duration: 200 });
              }
              resolve();
            },
          });
        },
      });

      drag.registerDraggable(floppy, {
        id: 'floppy-disk-1',
        type: 'floppy-disk',
        data: floppy,
        baseScale: 1,
        hitArea: new Phaser.Geom.Rectangle(
          -floppy.diskWidth / 2 - 16,
          -floppy.diskHeight / 2 - 16,
          floppy.diskWidth + 32,
          floppy.diskHeight + 32,
        ),
        dragScale: 1.1,
        returnOnMiss: true,
        onPick: () => {
          this.clearPulse();
          audio.playSnapClick();
        },
      });
    });
  }

  private async moveColleagueDesk(
    desk1: DeskObject,
    desk2: DeskObject,
    pc2: ComputerObject,
    targetX: number,
    targetY: number,
    guideStyle: 'room' | 'floor' | 'none',
  ): Promise<void> {
    const { scene, camera } = this.ctx;
    const pc2TargetY = targetY - desk2.topHeight / 2 - pc2.getBottomOffset() + 4;

    this.clearSpaceGuides();

    const spanX = Math.abs(targetX - desk1.x) + 460;
    const spanY = Math.abs(targetY - desk1.y) + 390;
    const centerX = (desk1.x + targetX) / 2;
    const centerY = (desk1.y + targetY) / 2 - 22;
    const targetZoom = this.getResponsiveScale(spanX, spanY);

    const moveDeskPromise = new Promise<void>((resolve) => {
      scene.tweens.add({
        targets: desk2,
        x: targetX,
        y: targetY,
        duration: 920,
        ease: 'Cubic.easeInOut',
        onComplete: () => resolve(),
      });
    });

    const movePcPromise = new Promise<void>((resolve) => {
      scene.tweens.add({
        targets: pc2,
        x: targetX,
        y: pc2TargetY,
        duration: 920,
        ease: 'Cubic.easeInOut',
        onComplete: () => resolve(),
      });
    });

    await Promise.all([
      moveDeskPromise,
      movePcPromise,
      camera.setView(centerX, centerY, targetZoom, {
        duration: 960,
        ease: 'Cubic.easeInOut',
      }),
    ]);

    if (this.stopped) return;

    if (guideStyle === 'room') {
      this.drawRoomGapGuide(desk1, desk2);
    } else if (guideStyle === 'floor') {
      this.drawUpperFloorStairsGuide(desk1, desk2);
    }
  }

  private drawRoomGapGuide(desk1: DeskObject, desk2: DeskObject): void {
    const { scene } = this.ctx;
    const g = scene.add.graphics();
    g.setDepth(5);
    this.spaceGuideGraphics = g;

    const floorY = desk1.y + desk1.topHeight / 2 + desk1.legHeight + 4;
    const startX = desk1.x + desk1.deskWidth / 2 + 24;
    const endX = desk2.x - desk2.deskWidth / 2 - 24;

    g.lineStyle(3, PALETTE.stroke, 0.22);
    for (let x = startX; x < endX - 10; x += 22) {
      g.lineBetween(x, floorY, Math.min(x + 11, endX), floorY);
    }
  }

  private drawUpperFloorStairsGuide(desk1: DeskObject, desk2: DeskObject): void {
    const { scene } = this.ctx;
    const g = scene.add.graphics();
    g.setDepth(5);
    this.spaceGuideGraphics = g;

    const lowerFloorY = desk1.y + desk1.topHeight / 2 + desk1.legHeight + 4;
    const upperFloorY = desk2.y + desk2.topHeight / 2 + desk2.legHeight + 4;

    // Clean lower floor line & upper floor ledge
    g.lineStyle(3.5, PALETTE.stroke, 0.22);
    g.lineBetween(desk1.x - 190, lowerFloorY, desk1.x + 310, lowerFloorY);
    g.lineBetween(desk2.x - 230, upperFloorY, desk2.x + 210, upperFloorY);

    // Simple minimalist staircase connecting lower floor to upper floor
    const steps = 6;
    const stairStartX = desk1.x + 310;
    const stairEndX = desk2.x - 230;
    const stepW = (stairEndX - stairStartX) / steps;
    const stepH = (lowerFloorY - upperFloorY) / steps;

    g.lineStyle(3.5, PALETTE.stroke, 0.28);
    g.beginPath();
    g.moveTo(stairStartX, lowerFloorY);
    for (let s = 0; s < steps; s++) {
      const nextY = lowerFloorY - (s + 1) * stepH;
      const nextX = stairStartX + (s + 1) * stepW;
      g.lineTo(stairStartX + s * stepW, nextY);
      g.lineTo(nextX, nextY);
    }
    g.strokePath();
  }

  private clearSpaceGuides(): void {
    if (!this.spaceGuideGraphics) return;
    const g = this.spaceGuideGraphics;
    this.spaceGuideGraphics = null;
    if (g.scene) {
      fadeOut(this.ctx.scene, g, { duration: 280, destroyOnComplete: true });
    }
  }

  private flashInvisibleWall(wallX: number, centerY: number): void {
    const { scene } = this.ctx;
    const wall = scene.add.graphics();
    wall.setDepth(280);
    wall.lineStyle(4, PALETTE.problem, 0.85);
    for (let y = centerY - 76; y < centerY + 76; y += 18) {
      wall.lineBetween(wallX, y, wallX, y + 10);
    }
    fadeOut(scene, wall, {
      delay: 140,
      duration: 280,
      destroyOnComplete: true,
    });
  }

  private spawnFileAbove(
    pc: ComputerObject,
    color: number,
    id: string,
  ): Promise<DigitalFileObject> {
    const { scene, audio } = this.ctx;
    const file = new DigitalFileObject(
      scene,
      pc.x,
      pc.y - pc.monitorHeight / 2 - 44,
      { id, color, size: 46 },
    );
    file.setDepth(270);
    audio.playPop();

    return new Promise<DigitalFileObject>((resolve) => {
      popIn(scene, file, {
        duration: 300,
        onComplete: () => resolve(file),
      });
    });
  }

  private getComputerDropBounds(pc: ComputerObject): Phaser.Geom.Rectangle {
    const pad = 26;
    return new Phaser.Geom.Rectangle(
      pc.x - pc.monitorWidth / 2 - pad,
      pc.y - pc.monitorHeight / 2 - pad,
      pc.monitorWidth + pad * 2,
      pc.monitorHeight + pc.standHeight + pc.baseHeight + pad * 2,
    );
  }

  private setPulse(target: DigitalFileObject | FloppyDiskObject): void {
    this.clearPulse();
    this.activePulse = pulseHint(this.ctx.scene, target, {
      scaleFactor: 1.09,
      minAlpha: 0.9,
      duration: 780,
    });
  }

  private clearPulse(): void {
    this.activePulse?.stop();
    this.activePulse = null;
  }

  private getResponsiveScale(
    desiredWorldWidth: number,
    desiredWorldHeight: number,
  ): number {
    const vp = this.ctx.getViewport();
    const fitWidth = (vp.width * 0.9) / desiredWorldWidth;
    const fitHeight = (vp.height * 0.78) / desiredWorldHeight;
    return Phaser.Math.Clamp(Math.min(1, fitWidth, fitHeight), 0.34, 1);
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
