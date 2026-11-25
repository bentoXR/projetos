import Phaser from 'phaser';
import { PALETTE, PAPER_TINTS } from '../../data/palette';
import { DrawerObject } from '../../objects/DrawerObject';
import { PaperObject } from '../../objects/PaperObject';
import {
  pulseHint,
  wobble,
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
 * Chapter 2 (1:00–2:10):
 * - Papers fall faster than the player can file them; drawers & bookshelf fill up.
 * - Narrator stays silent at first, then softly says: "Hum. Isso está ficando... complicado."
 * - Scene becomes visibly crowded with clean geometric paper stacks across desk & floor.
 * - Narrator asks: "Preciso daquele papel azul de ontem."
 * - Player rummages through piles (drag or tap papers aside, check drawers) to uncover
 *   and grab the blue paper. A gentle pulse hint appears after ~9.5s if needed.
 * - On finding it: "Você achou. Mas quanto tempo levou?"
 */
export class Chapter02Overload implements Chapter {
  public readonly id = 'chapter-02-overload';

  private ctx!: StageContext;
  private stopped = false;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];
  private hintPulse: PulseHintHandle | null = null;

  private clutterPapers: PaperObject[] = [];
  private targetBluePaper: PaperObject | null = null;
  private searchFound = false;
  private drawerPeekListeners: Array<{
    drawer: DrawerObject;
    handler: () => void;
  }> = [];
  private paperClickListeners: Array<{
    paper: PaperObject;
    handler: () => void;
  }> = [];

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
    for (const timer of this.pendingTimers) {
      timer.remove(false);
    }
    this.pendingTimers = [];
    this.hintPulse?.stop();
    this.hintPulse = null;
    this.detachSearchInteractions();
  }

  private async runSequence(): Promise<void> {
    const { camera, narrator, state } = this.ctx;
    const desk = state.desk;
    if (!desk) {
      this.resolveChapter?.();
      return;
    }

    // Pull the camera back slightly more so the whole desk + floor + shelf fit cleanly.
    const overviewZoom = this.getResponsiveScale(820);
    void camera.setView(desk.x + 112, desk.y + 12, overviewZoom, {
      duration: 950,
      ease: 'Sine.easeInOut',
    });

    // Keep any unfiled papers from Chapter 1 as part of the growing mess.
    this.clutterPapers = [...state.activePapers];

    // Phase A (1:00–1:40): Accelerating paper avalanche with narrator silence first.
    await this.runAvalanchePhase();
    if (this.stopped) return;

    // Brief breath once the paper rain stops.
    await this.wait(1100);
    if (this.stopped) return;

    // Phase B (1:40–2:10): Search for "aquele papel azul de ontem".
    narrator.say('ch2.find_blue_paper');
    await this.runSearchPhase();
  }

  private async runAvalanchePhase(): Promise<void> {
    const { narrator, state } = this.ctx;
    const desk = state.desk;
    if (!desk) return;

    const totalStormPapers = 40;
    const bluePaperIndex = 14;
    const floorY = desk.y + desk.topHeight / 2 + desk.legHeight - 28;
    const deskSurfaceY = desk.getSurfaceY() - 28;

    // Anchor spot where the special blue paper will be buried under a stack.
    const blueAnchorX = desk.x - 42;
    const blueAnchorY = deskSurfaceY - 4;

    // Narrator stays silent for ~9.5s while chaos builds, then comments softly.
    this.schedule(9400, () => {
      if (!this.stopped) {
        narrator.say('ch2.getting_complicated');
      }
    });

    for (let i = 0; i < totalStormPapers; i++) {
      if (this.stopped) return;

      const progress = i / (totalStormPapers - 1);
      // Starts brisk (~520ms) and accelerates rapidly down to ~190ms.
      const intervalMs = Math.round(Phaser.Math.Linear(520, 190, progress));

      if (i === bluePaperIndex) {
        this.spawnClutterPaper(blueAnchorX, blueAnchorY, 32, true);
      } else if (i > bluePaperIndex && i <= bluePaperIndex + 7) {
        // Deliberately bury the blue paper under 7 overlapping papers on that stack:
        // first 4 sit tightly over it so it's genuinely hidden until rummaged.
        const layer = i - bluePaperIndex;
        const spreadX = layer <= 4 ? 11 : 24;
        const spreadY = layer <= 4 ? 9 : 16;
        const coverX = blueAnchorX + Phaser.Math.Between(-spreadX, spreadX);
        const coverY = blueAnchorY + Phaser.Math.Between(-spreadY, spreadY);
        const depth = 34 + layer * 2;
        this.spawnClutterPaper(coverX, coverY, depth, false);
      } else {
        // Distribute across desk piles, floor piles, and around drawers/bookshelf.
        const spot = this.pickClutterSpot(
          i,
          desk.x,
          deskSurfaceY,
          floorY,
        );
        const depth = 24 + (i % 24) + (spot.isFloor ? 12 : 0);
        this.spawnClutterPaper(spot.x, spot.y, depth, false);
      }

      await this.wait(intervalMs);
    }

    // Save references for Chapter 3 (computer vacuuming up the mess at 2:10).
    state.clutterPapers = [...this.clutterPapers];
    state.targetBluePaper = this.targetBluePaper;
  }

  private pickClutterSpot(
    index: number,
    deskX: number,
    deskSurfaceY: number,
    floorY: number,
  ): { x: number; y: number; isFloor: boolean } {
    const zone = index % 6;

    // 0, 1, 2: Dense overlapping piles across the tabletop
    if (zone === 0) {
      return {
        x: deskX - 108 + Phaser.Math.Between(-36, 36),
        y: deskSurfaceY + Phaser.Math.Between(-30, 8),
        isFloor: false,
      };
    }
    if (zone === 1) {
      return {
        x: deskX + 6 + Phaser.Math.Between(-44, 44),
        y: deskSurfaceY + Phaser.Math.Between(-34, 8),
        isFloor: false,
      };
    }
    if (zone === 2) {
      return {
        x: deskX + 106 + Phaser.Math.Between(-34, 34),
        y: deskSurfaceY + Phaser.Math.Between(-26, 8),
        isFloor: false,
      };
    }
    // 3: Spilled pile on the floor to the left of the desk
    if (zone === 3) {
      return {
        x: deskX - 210 + Phaser.Math.Between(-45, 38),
        y: floorY + Phaser.Math.Between(-28, 14),
        isFloor: true,
      };
    }
    // 4: Floor pile under the left side of the desk (keeps Drawer 1 clickable)
    if (zone === 4) {
      return {
        x: deskX - 102 + Phaser.Math.Between(-34, 28),
        y: floorY + Phaser.Math.Between(-20, 16),
        isFloor: true,
      };
    }
    // 5: Floor pile between desk/drawer 2 and the bookshelf
    return {
      x: deskX + 278 + Phaser.Math.Between(-58, 52),
      y: floorY + Phaser.Math.Between(-28, 14),
      isFloor: true,
    };
  }

  private spawnClutterPaper(
    targetX: number,
    targetY: number,
    depth: number,
    isBlueTarget: boolean,
  ): void {
    const { scene, audio, state } = this.ctx;
    const idx = this.clutterPapers.length;

    // Avoid bright blue accents on distractor papers so the target blue paper
    // is unmistakably distinct once uncovered.
    const nonBlueTints = [PAPER_TINTS[1], PAPER_TINTS[2], PAPER_TINTS[3]];
    const nonBlueAccents = [
      PAPER_ACCENTS[1],
      PAPER_ACCENTS[2],
      PAPER_ACCENTS[3],
    ];

    const tintColor = isBlueTarget
      ? PALETTE.data
      : nonBlueTints[idx % nonBlueTints.length];
    const accentColor = isBlueTarget
      ? PALETTE.background
      : nonBlueAccents[idx % nonBlueAccents.length];

    const paper = new PaperObject(scene, targetX, targetY - 260, {
      id: isBlueTarget ? 'paper-blue-yesterday' : `clutter-${idx + 1}`,
      tintColor,
      accentColor,
      isBlueTarget,
    });
    paper.setDepth(depth);

    this.clutterPapers.push(paper);
    state.activePapers.push(paper);
    if (isBlueTarget) {
      this.targetBluePaper = paper;
    }

    // Play soft thud on every other paper during the storm so audio stays pleasant.
    const shouldPlaySound = isBlueTarget || idx % 2 === 0;
    void paper.fallTo(targetX, targetY, {
      startOffsetY: Phaser.Math.Between(220, 310),
      duration: Phaser.Math.Between(520, 740),
      restingAngle: isBlueTarget ? -7 : Phaser.Math.Between(-26, 26),
      onLand: shouldPlaySound ? () => audio.playSoftThud() : undefined,
    });
  }

  private runSearchPhase(): Promise<void> {
    const { scene, drag, audio, narrator, state } = this.ctx;
    this.searchFound = false;

    // Disable Chapter 1 filing drop zones during the search so rummaging papers
    // doesn't trigger "drawer is full" bounces or captions.
    for (const drawer of state.drawers) {
      drag.unregisterDropZone(drawer.drawerId);
    }
    if (state.bookshelf) {
      drag.unregisterDropZone(state.bookshelf.shelfId);
    }

    return new Promise<void>((resolve) => {
      // 1) Make all loose clutter papers rummageable: drag freely OR tap to toss aside!
      for (const paper of this.clutterPapers) {
        if (!paper.scene || paper.isStored) continue;

        drag.unregisterDraggable(paper);

        const hitRect = new Phaser.Geom.Rectangle(
          -paper.paperWidth / 2 - 6,
          -paper.paperHeight / 2 - 6,
          paper.paperWidth + 12,
          paper.paperHeight + 12,
        );

        if (paper.isBlueTarget) {
          paper.setInteractive(hitRect, Phaser.Geom.Rectangle.Contains);
          if (paper.input) paper.input.cursor = 'pointer';

          const onFindBlue = (): void => {
            if (this.searchFound || this.stopped) return;
            this.searchFound = true;
            void this.handleBluePaperFound(paper).then(resolve);
          };

          paper.on(Phaser.Input.Events.POINTER_DOWN, onFindBlue);
          this.paperClickListeners.push({ paper, handler: onFindBlue });
        } else {
          let dragStartX = 0;
          let dragStartY = 0;

          drag.registerDraggable(paper, {
            id: paper.paperId,
            type: 'clutter',
            data: paper,
            baseScale: 1,
            hitArea: hitRect,
            dragScale: 1.07,
            returnOnMiss: false,
            onPick: () => {
              dragStartX = paper.x;
              dragStartY = paper.y;
              audio.playSnapClick();
            },
          });

          // If the player simply taps/clicks a covering paper without dragging far,
          // playfully flick it aside so rummaging feels snappy on mouse & mobile!
          const onTapFlick = (): void => {
            if (this.searchFound || this.stopped || !paper.scene) return;
            const moved = Phaser.Math.Distance.Between(
              dragStartX,
              dragStartY,
              paper.x,
              paper.y,
            );
            if (moved < 10) {
              const dir = paper.x < (state.desk?.x ?? paper.x) ? -1 : 1;
              const pushX = paper.x + dir * Phaser.Math.Between(65, 115);
              const pushY = paper.y + Phaser.Math.Between(-22, 34);
              audio.playSoftThud();
              scene.tweens.add({
                targets: paper,
                x: pushX,
                y: pushY,
                angle: paper.angle + dir * Phaser.Math.Between(14, 28),
                duration: 240,
                ease: 'Quad.easeOut',
              });
            }
          };

          paper.on(Phaser.Input.Events.POINTER_UP, onTapFlick);
          this.paperClickListeners.push({ paper, handler: onTapFlick });
        }
      }

      // 2) Allow clicking drawers to peek inside (shows it's not there!).
      let drawerHintSpoken = false;
      for (const drawer of state.drawers) {
        if (!drawer.scene) continue;
        drawer.setInteractive(
          new Phaser.Geom.Rectangle(
            -drawer.drawerWidth / 2,
            -drawer.drawerHeight / 2,
            drawer.drawerWidth,
            drawer.drawerHeight,
          ),
          Phaser.Geom.Rectangle.Contains,
        );
        if (drawer.input) drawer.input.cursor = 'pointer';

        const onPeekDrawer = (): void => {
          if (this.searchFound || this.stopped) return;
          drawer.setOpen(true);
          audio.playSoftThud();
          wobble(scene, drawer, { angleDeg: 4, duration: 240 });
          if (!drawerHintSpoken) {
            drawerHintSpoken = true;
            narrator.say('ch2.drawer_empty_of_blue');
          }
          this.schedule(460, () => drawer.setOpen(false));
        };

        drawer.on(Phaser.Input.Events.POINTER_DOWN, onPeekDrawer);
        this.drawerPeekListeners.push({ drawer, handler: onPeekDrawer });
      }

      // 3) Gentle anti-boredom hint: if not found after ~9.5s, subtly pulse the
      //    blue paper and nudge nearby covering papers slightly so a blue edge peeks out.
      this.schedule(9500, () => {
        if (this.searchFound || this.stopped || !this.targetBluePaper?.scene) {
          return;
        }
        this.nudgePapersCoveringTarget(this.targetBluePaper);
        this.hintPulse = pulseHint(scene, this.targetBluePaper, {
          scaleFactor: 1.1,
          minAlpha: 0.88,
          duration: 760,
        });
      });
    });
  }

  /**
   * Gently nudges any clutter papers sitting directly on top of the blue target
   * slightly outward so its pulsing blue corner becomes visible if the player
   * has been searching for a while.
   */
  private nudgePapersCoveringTarget(target: PaperObject): void {
    const { scene } = this.ctx;
    for (const paper of this.clutterPapers) {
      if (paper === target || !paper.scene || paper.depth < target.depth) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(
        paper.x,
        paper.y,
        target.x,
        target.y,
      );
      if (dist < 42) {
        const angle = Phaser.Math.Angle.Between(
          target.x,
          target.y,
          paper.x + 1,
          paper.y,
        );
        scene.tweens.add({
          targets: paper,
          x: paper.x + Math.cos(angle) * 34,
          y: paper.y + Math.sin(angle) * 24,
          duration: 380,
          ease: 'Sine.easeOut',
        });
      }
    }
  }

  private async handleBluePaperFound(paper: PaperObject): Promise<void> {
    const { scene, camera, audio, narrator } = this.ctx;

    this.hintPulse?.stop();
    this.hintPulse = null;
    this.detachSearchInteractions();

    audio.playSuccess();

    const focus = camera.getFocus();
    paper.setDepth(300);

    // Lift the blue paper proudly into view while the messy room remains behind it.
    await new Promise<void>((resolve) => {
      scene.tweens.add({
        targets: paper,
        x: focus.x,
        y: focus.y - 36,
        scaleX: 1.32,
        scaleY: 1.32,
        angle: 0,
        duration: 460,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (paper.scene) {
            wobble(scene, paper, { angleDeg: 6, duration: 320 });
          }
          resolve();
        },
      });
    });

    if (this.stopped) return;

    narrator.say('ch2.found_how_long');
    await this.wait(3800);
    if (this.stopped) return;

    this.resolveChapter?.();
  }

  private detachSearchInteractions(): void {
    const { drag } = this.ctx;

    for (const { paper, handler } of this.paperClickListeners) {
      if (paper.scene) {
        paper.off(Phaser.Input.Events.POINTER_DOWN, handler);
        paper.off(Phaser.Input.Events.POINTER_UP, handler);
        drag.unregisterDraggable(paper);
        paper.disableInteractive();
      }
    }
    this.paperClickListeners = [];

    for (const { drawer, handler } of this.drawerPeekListeners) {
      if (drawer.scene) {
        drawer.off(Phaser.Input.Events.POINTER_DOWN, handler);
        drawer.disableInteractive();
      }
    }
    this.drawerPeekListeners = [];
  }

  private getResponsiveScale(desiredWorldWidth: number): number {
    const vp = this.ctx.getViewport();
    const fitWidth = (vp.width * 0.9) / desiredWorldWidth;
    const fitHeight = (vp.height * 0.78) / 360;
    return Phaser.Math.Clamp(Math.min(1, fitWidth, fitHeight), 0.4, 1);
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
