import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { ComputerObject } from '../../objects/ComputerObject';
import { DigitalFileObject } from '../../objects/DigitalFileObject';
import { PaperObject } from '../../objects/PaperObject';
import {
  fadeOut,
  popIn,
  pulseHint,
  wobble,
  type PulseHintHandle,
} from '../../utils/animations';
import type { Chapter, StageContext } from './Chapter';

/**
 * Chapter 3 (2:10–3:00):
 * - Short silence; minimalist computer pops into the middle of the mess with a "plim".
 * - Papers transform one by one into small colored squares that arc into the computer.
 * - Drawers and bookshelf fade out; the off-white stage breathes again.
 * - Narrator: "Tudo coube aqui dentro. Isso é um arquivo: informação guardada em forma digital."
 * - Narrator asks for the blue paper again; tapping the computer reveals the blue
 *   digital file instantaneously with a crisp, satisfying pop.
 * - Camera smoothly zooms back in on the clean desk with just the computer.
 */
export class Chapter03Computer implements Chapter {
  public readonly id = 'chapter-03-computer';

  private ctx!: StageContext;
  private stopped = false;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];
  private computerPulse: PulseHintHandle | null = null;
  private computerClickHandler: (() => void) | null = null;
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
    this.computerPulse?.stop();
    this.computerPulse = null;
    this.detachComputerClick();
  }

  private async runSequence(): Promise<void> {
    const { scene, camera, audio, narrator, state } = this.ctx;
    const desk = state.desk;
    if (!desk) {
      this.resolveChapter?.();
      return;
    }

    // 1) Short contemplative silence after "Você achou. Mas quanto tempo levou?".
    await this.wait(1050);
    if (this.stopped) return;

    // 2) Computer pops into the middle of the desk with a crisp "plim"!
    const computer = new ComputerObject(scene, desk.x, 0, 'computer-1');
    const compY = desk.getSurfaceY() - computer.getBottomOffset() + 4;
    computer.setPosition(desk.x, compY);
    computer.setDepth(210);
    state.computer = computer;

    popIn(scene, computer, { duration: 520, ease: 'Back.easeOut' });
    audio.playSuccess();
    this.spawnRipple(desk.x, compY, PALETTE.solution, 92, 460);

    await this.wait(720);
    if (this.stopped) return;

    // 3) Transform every paper (and archived furniture items) into colored squares
    //    flying gracefully into the computer screen!
    await this.absorbAllPapersIntoComputer(computer);
    if (this.stopped) return;

    // 4) Empty the room: fade out drawers and bookshelf so the white stage breathes.
    await this.clearFurniture();
    if (this.stopped) return;

    await this.wait(420);
    if (this.stopped) return;

    // 5) Narrator explains what a digital file is.
    narrator.say('ch3.everything_fit');
    await this.wait(4700);
    if (this.stopped) return;

    // 6) Ask for the blue paper again — now instant!
    narrator.say('ch3.ask_blue_again');
    await this.waitForComputerTap(computer);
    if (this.stopped) return;

    // 7) Instant blue digital file payoff!
    await this.revealBlueFileInstantly(computer);
    if (this.stopped) return;

    narrator.say('ch3.instant_payoff');

    // 8) Camera smoothly zooms back in on the clean desk with just the computer.
    const closeZoom = this.getResponsiveScale(440);
    await camera.setView(desk.x, desk.y - 26, closeZoom, {
      duration: 1150,
      ease: 'Cubic.easeInOut',
    });
    if (this.stopped) return;

    await this.wait(1200);
    if (this.stopped) return;

    this.resolveChapter?.();
  }

  private async absorbAllPapersIntoComputer(
    computer: ComputerObject,
  ): Promise<void> {
    const { state } = this.ctx;
    const screenCenter = computer.getScreenCenter();

    // Collect every unique live paper on stage (target blue paper first for clarity).
    const seen = new Set<PaperObject>();
    const orderedPapers: PaperObject[] = [];

    const addIfLive = (p: PaperObject | null | undefined): void => {
      if (p && p.scene && !seen.has(p)) {
        seen.add(p);
        orderedPapers.push(p);
      }
    };

    addIfLive(state.targetBluePaper);
    for (const p of state.clutterPapers) addIfLive(p);
    for (const p of state.activePapers) addIfLive(p);

    const flightPromises: Promise<void>[] = [];

    // Cascade papers one by one: first few are clearly readable, then accelerate smoothly.
    for (let i = 0; i < orderedPapers.length; i++) {
      if (this.stopped) return;
      const paper = orderedPapers[i];
      const color = paper.isBlueTarget ? PALETTE.data : paper.accentColor;
      const playSound = i < 4 || i % 4 === 0;

      flightPromises.push(
        this.morphPaperIntoComputer(paper, color, screenCenter, computer, playSound),
      );

      const progress = Math.min(1, i / Math.max(1, orderedPapers.length - 1));
      const staggerMs = Math.round(Phaser.Math.Linear(95, 32, progress));
      await this.wait(staggerMs);
    }

    // Also launch a few colored squares out of the drawers & bookshelf as they empty.
    const furnitureSources: Array<{ x: number; y: number; colors: number[] }> =
      [];
    for (const drawer of state.drawers) {
      if (!drawer.scene) continue;
      furnitureSources.push({
        x: drawer.x,
        y: drawer.y - 8,
        colors: drawer.getStoredPapers().map((r) => r.accentColor),
      });
    }
    if (state.bookshelf?.scene) {
      furnitureSources.push({
        x: state.bookshelf.x,
        y: state.bookshelf.y,
        colors: state.bookshelf.getStoredPapers().map((r) => r.accentColor),
      });
    }

    let extraIdx = 0;
    for (const source of furnitureSources) {
      for (const color of source.colors) {
        if (this.stopped) return;
        const startX = source.x + Phaser.Math.Between(-24, 24);
        const startY = source.y + Phaser.Math.Between(-24, 24);
        flightPromises.push(
          this.flySquareToScreen(
            startX,
            startY,
            color,
            screenCenter,
            computer,
            extraIdx % 3 === 0,
          ),
        );
        extraIdx++;
        await this.wait(36);
      }
    }

    await Promise.all(flightPromises);

    state.activePapers = [];
    state.clutterPapers = [];
    state.targetBluePaper = null;
  }

  private morphPaperIntoComputer(
    paper: PaperObject,
    squareColor: number,
    destination: { x: number; y: number },
    computer: ComputerObject,
    playSound: boolean,
  ): Promise<void> {
    const { scene } = this.ctx;
    const startX = paper.x;
    const startY = paper.y;

    return new Promise<void>((resolve) => {
      if (!paper.scene) {
        resolve();
        return;
      }

      // Quick snappy shrink of the paper sheet before replacing with a colored square.
      scene.tweens.add({
        targets: paper,
        scaleX: 0.28,
        scaleY: 0.28,
        angle: 0,
        duration: 120,
        ease: 'Back.easeIn',
        onComplete: () => {
          if (paper.scene) {
            paper.destroy();
          }
          if (this.stopped) {
            resolve();
            return;
          }
          void this.flySquareToScreen(
            startX,
            startY,
            squareColor,
            destination,
            computer,
            playSound,
          ).then(resolve);
        },
      });
    });
  }

  private flySquareToScreen(
    startX: number,
    startY: number,
    color: number,
    destination: { x: number; y: number },
    computer: ComputerObject,
    playSound: boolean,
  ): Promise<void> {
    const { scene, audio } = this.ctx;

    const square = new DigitalFileObject(scene, startX, startY, {
      id: 'micro-file',
      color,
      size: 18,
    });
    square.setDepth(260);
    square.setScale(0.6);

    // Gentle upward arc control point so squares curve gracefully into the screen.
    const midX = (startX + destination.x) / 2 + Phaser.Math.Between(-36, 36);
    const midY =
      Math.min(startY, destination.y) - Phaser.Math.Between(55, 115);

    return new Promise<void>((resolve) => {
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: Phaser.Math.Between(340, 440),
        ease: 'Cubic.easeIn',
        onUpdate: (tween) => {
          if (!square.scene) return;
          const t = tween.getValue() ?? 0;
          const inv = 1 - t;
          const x =
            inv * inv * startX + 2 * inv * t * midX + t * t * destination.x;
          const y =
            inv * inv * startY + 2 * inv * t * midY + t * t * destination.y;
          square.setPosition(x, y);
          // Pop up slightly mid-flight, then tuck smoothly into the screen.
          const scale = t < 0.35 ? Phaser.Math.Linear(0.6, 1.05, t / 0.35) : Phaser.Math.Linear(1.05, 0.35, (t - 0.35) / 0.65);
          square.setScale(scale);
        },
        onComplete: () => {
          if (square.scene) {
            square.destroy();
          }
          if (!this.stopped && computer.scene) {
            computer.absorbFileSquare(color);
            if (playSound) {
              audio.playPop();
            }
          }
          resolve();
        },
      });
    });
  }

  private async clearFurniture(): Promise<void> {
    const { scene, state } = this.ctx;
    const promises: Promise<void>[] = [];

    for (const drawer of state.drawers) {
      if (!drawer.scene) continue;
      promises.push(
        new Promise<void>((resolve) => {
          fadeOut(scene, drawer, {
            duration: 500,
            shrinkTo: 0.86,
            destroyOnComplete: true,
            onComplete: resolve,
          });
        }),
      );
    }
    state.drawers = [];

    if (state.bookshelf?.scene) {
      const shelf = state.bookshelf;
      promises.push(
        new Promise<void>((resolve) => {
          fadeOut(scene, shelf, {
            duration: 540,
            shrinkTo: 0.88,
            destroyOnComplete: true,
            onComplete: resolve,
          });
        }),
      );
      state.bookshelf = null;
    }

    await Promise.all(promises);
  }

  private waitForComputerTap(computer: ComputerObject): Promise<void> {
    const { scene } = this.ctx;

    return new Promise<void>((resolve) => {
      computer.setInteractive(
        new Phaser.Geom.Rectangle(
          -computer.monitorWidth / 2 - 14,
          -computer.monitorHeight / 2 - 14,
          computer.monitorWidth + 28,
          computer.monitorHeight + computer.standHeight + computer.baseHeight + 28,
        ),
        Phaser.Geom.Rectangle.Contains,
      );
      if (computer.input) computer.input.cursor = 'pointer';

      this.computerPulse = pulseHint(scene, computer, {
        scaleFactor: 1.06,
        minAlpha: 0.92,
        duration: 780,
      });

      this.computerClickHandler = () => {
        this.computerPulse?.stop();
        this.computerPulse = null;
        this.detachComputerClick();
        resolve();
      };

      computer.once(Phaser.Input.Events.POINTER_DOWN, this.computerClickHandler);
    });
  }

  private async revealBlueFileInstantly(
    computer: ComputerObject,
  ): Promise<void> {
    const { scene, audio, state } = this.ctx;
    const screen = computer.getScreenCenter();

    audio.playSuccess();
    wobble(scene, computer, { angleDeg: 5, duration: 240, squash: 0.04 });
    this.spawnRipple(screen.x, screen.y, PALETTE.data, 84, 380);

    const blueFile = new DigitalFileObject(scene, screen.x, screen.y, {
      id: 'blue-digital-file',
      color: PALETTE.data,
      size: 46,
    });
    blueFile.setDepth(270);
    state.blueFile = blueFile;

    // Instant, snappy pop straight out of the screen above the computer!
    popIn(scene, blueFile, { duration: 240, ease: 'Back.easeOut' });
    await new Promise<void>((resolve) => {
      scene.tweens.add({
        targets: blueFile,
        y: computer.y - computer.monitorHeight / 2 - 44,
        duration: 240,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (blueFile.scene) {
            wobble(scene, blueFile, { angleDeg: 7, duration: 260 });
          }
          resolve();
        },
      });
    });
  }

  private spawnRipple(
    x: number,
    y: number,
    color: number,
    maxRadius: number,
    duration: number,
  ): void {
    const { scene } = this.ctx;
    const ring = scene.add.graphics();
    ring.setPosition(x, y);
    ring.setDepth(205);

    const state = { t: 0 };
    scene.tweens.add({
      targets: state,
      t: 1,
      duration,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        if (!ring.scene) return;
        const radius = Phaser.Math.Linear(24, maxRadius, state.t);
        const alpha = (1 - state.t) * 0.75;
        ring.clear();
        ring.lineStyle(4, color, alpha);
        ring.strokeCircle(0, 0, radius);
      },
      onComplete: () => {
        if (ring.scene) ring.destroy();
      },
    });
  }

  private detachComputerClick(): void {
    const computer = this.ctx.state.computer;
    if (computer?.scene && this.computerClickHandler) {
      computer.off(Phaser.Input.Events.POINTER_DOWN, this.computerClickHandler);
      computer.disableInteractive();
    }
    this.computerClickHandler = null;
  }

  private getResponsiveScale(desiredWorldWidth: number): number {
    const vp = this.ctx.getViewport();
    const fitWidth = (vp.width * 0.88) / desiredWorldWidth;
    const fitHeight = (vp.height * 0.74) / 340;
    return Phaser.Math.Clamp(Math.min(1, fitWidth, fitHeight), 0.44, 1);
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
