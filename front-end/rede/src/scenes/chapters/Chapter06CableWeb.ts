import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { CableObject } from '../../objects/CableObject';
import { ComputerObject } from '../../objects/ComputerObject';
import { DeskObject } from '../../objects/DeskObject';
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
 * Chapter 6 (5:00 — End of Act 1):
 * - A 3rd and 4th computer appear in scattered positions.
 * - The player connects everyone to everyone by dragging wires from any computer
 *   to another. Each new wire works (sending blue data dots), but the crossing
 *   cables quickly turn into a chaotic web.
 * - Narrator: "Hm. Acho que vamos precisar de uma ideia melhor."
 * - Smooth breathing transition into quiet stillness, leaving all 4 computers
 *   and 6 cables in StageWorldState ready for the future Hub & Switch chapter.
 */
export class Chapter06CableWeb implements Chapter {
  public readonly id = 'chapter-06-cable-web';

  private ctx!: StageContext;
  private stopped = false;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];
  private drawHandles: DrawInHandle[] = [];
  private hintPulse: PulseHintHandle | null = null;
  private hintBadge: Phaser.GameObjects.Container | null = null;

  private computers: ComputerObject[] = [];
  private connectedPairs = new Set<string>();
  private draftCable: CableObject | null = null;
  private draftSource: ComputerObject | null = null;
  private hoverHighlight: Phaser.GameObjects.Graphics | null = null;
  private hoveredTarget: ComputerObject | null = null;

  private resolveChapter: (() => void) | null = null;
  private resolveMeshComplete: (() => void) | null = null;

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.draftCable || !this.draftSource || this.stopped) return;
    this.draftCable.setEnd(pointer.worldX, pointer.worldY);

    const target = this.findValidTargetAt(
      pointer.worldX,
      pointer.worldY,
      this.draftSource,
    );
    this.updateHoverHighlight(target);
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.draftCable || !this.draftSource || this.stopped) return;

    const source = this.draftSource;
    const target = this.findValidTargetAt(
      pointer.worldX,
      pointer.worldY,
      source,
    );

    this.clearHoverHighlight();
    this.draftCable.destroy();
    this.draftCable = null;
    this.draftSource = null;

    if (target) {
      this.connectComputers(source, target);
    } else {
      this.ctx.audio.playSoftThud();
    }
  };

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
    this.clearHint();
    this.detachWiringListeners();
  }

  private async runSequence(): Promise<void> {
    const { scene, camera, audio, narrator, state } = this.ctx;
    const desk1 = state.desk;
    const pc1 = state.computer;
    const pc2 = state.secondComputer;
    if (!desk1 || !pc1 || !pc2) {
      this.resolveChapter?.();
      return;
    }

    // 1) Pull camera back to reveal space above for the 3rd & 4th computers.
    const centerX = desk1.x + 245;
    const centerY = desk1.y - 110;
    const webZoom = this.getResponsiveScale(960, 620);

    await camera.setView(centerX, centerY, webZoom, {
      duration: 900,
      ease: 'Cubic.easeInOut',
    });
    if (this.stopped) return;

    // 2) Spawn 3rd and 4th computers in slightly scattered positions so crossing
    //    cables form an unmistakably tangled web across the center.
    const desk3 = new DeskObject(scene, desk1.x + 65, desk1.y - 255);
    desk3.setDepth(10);
    state.extraDesks.push(desk3);

    const desk4 = new DeskObject(scene, desk1.x + 515, desk1.y - 210);
    desk4.setDepth(10);
    state.extraDesks.push(desk4);

    const draw3 = drawIn(scene, desk3, {
      paths: desk3.getSketchPaths(),
      drawDuration: 680,
      fillDuration: 240,
      strokeWidth: 4,
    });
    const draw4 = drawIn(scene, desk4, {
      paths: desk4.getSketchPaths(),
      drawDuration: 740,
      fillDuration: 240,
      strokeWidth: 4,
    });
    this.drawHandles.push(draw3, draw4);
    await Promise.all([draw3.promise, draw4.promise]);
    if (this.stopped) return;

    const pc3 = new ComputerObject(scene, desk3.x, 0, 'computer-3');
    pc3.setPosition(desk3.x, desk3.getSurfaceY() - pc3.getBottomOffset() + 4);
    pc3.setDepth(210);

    const pc4 = new ComputerObject(scene, desk4.x, 0, 'computer-4');
    pc4.setPosition(desk4.x, desk4.getSurfaceY() - pc4.getBottomOffset() + 4);
    pc4.setDepth(210);

    popIn(scene, pc3, { duration: 420 });
    audio.playPop();
    await this.wait(160);
    if (this.stopped) return;
    popIn(scene, pc4, { duration: 420 });
    audio.playPop();

    this.computers = [pc1, pc2, pc3, pc4];
    state.computers = [...this.computers];

    // Record the existing PC 1 <-> PC 2 cable from Chapter 5.
    this.connectedPairs.add(this.pairKey(pc1, pc2));

    await this.wait(380);
    if (this.stopped) return;

    narrator.say('ch6.more_computers');

    // 3) Let the player wire all 4 computers together (5 new cables -> 6 total).
    await this.waitForChaoticWeb();
    if (this.stopped) return;

    this.detachWiringListeners();

    // 4) Brief pause to take in the messy web of crossing cables.
    await this.wait(850);
    if (this.stopped) return;

    narrator.say('ch6.need_better_idea');
    await this.wait(4100);
    if (this.stopped) return;

    // 5) Gentle Act 1 closing breath: camera eases back slightly into stillness.
    const restZoom = Math.max(0.32, camera.getZoom() * 0.94);
    await camera.setView(centerX, centerY, restZoom, {
      duration: 1350,
      ease: 'Sine.easeInOut',
    });
    if (this.stopped) return;

    this.resolveChapter?.();
  }

  private waitForChaoticWeb(): Promise<void> {
    const { scene, audio } = this.ctx;

    return new Promise<void>((resolve) => {
      this.resolveMeshComplete = resolve;

      this.hoverHighlight = scene.add.graphics();
      this.hoverHighlight.setDepth(255);

      // Subtle pulsing plug dot on PC 3 to invite the first wire drag without text.
      const pc3 = this.computers[2];
      if (pc3) {
        this.spawnWireHint(pc3.x + pc3.monitorWidth / 2 + 8, pc3.y + 8);
      }

      for (const pc of this.computers) {
        pc.setInteractive(
          new Phaser.Geom.Rectangle(
            -pc.monitorWidth / 2 - 18,
            -pc.monitorHeight / 2 - 18,
            pc.monitorWidth + 36,
            pc.monitorHeight + pc.standHeight + pc.baseHeight + 36,
          ),
          Phaser.Geom.Rectangle.Contains,
        );
        if (pc.input) pc.input.cursor = 'pointer';

        pc.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
          if (this.stopped || this.draftCable) return;
          if (!this.hasUnconnectedPeers(pc)) {
            audio.playSoftThud();
            return;
          }

          this.clearHint();
          this.draftSource = pc;
          const anchor = this.getPortAnchor(pc, pointer.worldX, pointer.worldY);
          this.draftCable = new CableObject(
            scene,
            'draft-cable',
            anchor.x,
            anchor.y,
            pointer.worldX,
            pointer.worldY,
            30,
          );
          this.draftCable.graphics.setDepth(245);
          audio.playSnapClick();
        });
      }

      scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
      scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
      scene.input.on(
        Phaser.Input.Events.POINTER_UP_OUTSIDE,
        this.handlePointerUp,
      );
    });
  }

  private connectComputers(a: ComputerObject, b: ComputerObject): void {
    const { scene, audio, state } = this.ctx;
    const key = this.pairKey(a, b);
    if (this.connectedPairs.has(key)) return;
    this.connectedPairs.add(key);

    const start = this.getPortAnchor(a, b.x, b.y);
    const end = this.getPortAnchor(b, a.x, a.y);

    // Vary sag slightly per cable so crossing wires visibly weave and tangle.
    const sagVariations = [38, -26, 56, -42, 68, 22];
    const sag = sagVariations[state.cables.length % sagVariations.length];

    const cable = new CableObject(
      scene,
      `cable-${a.computerId}-${b.computerId}`,
      start.x,
      start.y,
      end.x,
      end.y,
      sag,
    );
    cable.setConnected(true);
    cable.graphics.setDepth(195 + state.cables.length);
    state.cables.push(cable);

    audio.playSnapClick();
    wobble(scene, b, { angleDeg: 4, duration: 220, squash: 0.03 });

    // Send a quick burst of blue dots along the new cable to show it works!
    void this.sendQuickPulse(cable, b);

    // All 4 computers connected to every other computer = 6 total pairs (5 new wires).
    const totalPairs = (this.computers.length * (this.computers.length - 1)) / 2;
    if (this.connectedPairs.size >= totalPairs) {
      const done = this.resolveMeshComplete;
      this.resolveMeshComplete = null;
      this.schedule(520, () => done?.());
    }
  }

  private async sendQuickPulse(
    cable: CableObject,
    receiver: ComputerObject,
  ): Promise<void> {
    const { scene, audio } = this.ctx;
    const startPt = cable.getStart();
    const dotPromises: Promise<void>[] = [];

    for (let i = 0; i < 4; i++) {
      if (this.stopped) return;
      const dot = scene.add.graphics();
      dot.setDepth(260);
      dot.fillStyle(PALETTE.data, 1);
      dot.fillCircle(0, 0, 6.5);
      dot.lineStyle(2.5, PALETTE.stroke, 1);
      dot.strokeCircle(0, 0, 6.5);
      dot.setPosition(startPt.x, startPt.y);

      const p = new Promise<void>((resolve) => {
        const state = { t: 0 };
        scene.tweens.add({
          targets: state,
          t: 1,
          duration: 460,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            if (!dot.scene) return;
            const pt = cable.getPointAt(state.t);
            dot.setPosition(pt.x, pt.y);
          },
          onComplete: () => {
            if (dot.scene) dot.destroy();
            resolve();
          },
        });
      });

      dotPromises.push(p);
      await this.wait(75);
    }

    await Promise.all(dotPromises);
    if (!this.stopped && receiver.scene) {
      receiver.absorbFileSquare(PALETTE.data);
      audio.playPop();
    }
  }

  private findValidTargetAt(
    worldX: number,
    worldY: number,
    source: ComputerObject,
  ): ComputerObject | null {
    for (const pc of this.computers) {
      if (pc === source) continue;
      if (this.connectedPairs.has(this.pairKey(source, pc))) continue;

      const pad = 28;
      const rect = new Phaser.Geom.Rectangle(
        pc.x - pc.monitorWidth / 2 - pad,
        pc.y - pc.monitorHeight / 2 - pad,
        pc.monitorWidth + pad * 2,
        pc.monitorHeight + pc.standHeight + pc.baseHeight + pad * 2,
      );
      if (rect.contains(worldX, worldY)) {
        return pc;
      }
    }
    return null;
  }

  private updateHoverHighlight(target: ComputerObject | null): void {
    if (this.hoveredTarget === target) return;
    this.hoveredTarget = target;

    const g = this.hoverHighlight;
    if (!g || !g.scene) return;
    g.clear();

    if (!target) return;

    const pad = 12;
    const x = target.x - target.monitorWidth / 2 - pad;
    const y = target.y - target.monitorHeight / 2 - pad;
    const w = target.monitorWidth + pad * 2;
    const h = target.monitorHeight + target.standHeight + target.baseHeight + pad * 2;

    g.fillStyle(PALETTE.solution, 0.14);
    g.fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(4, PALETTE.solution, 0.95);
    g.strokeRoundedRect(x, y, w, h, 18);
  }

  private clearHoverHighlight(): void {
    this.hoveredTarget = null;
    if (this.hoverHighlight?.scene) {
      this.hoverHighlight.clear();
    }
  }

  private getPortAnchor(
    pc: ComputerObject,
    towardX: number,
    towardY: number,
  ): { x: number; y: number } {
    const dx = towardX - pc.x;
    const dy = towardY - pc.y;
    const offsetX =
      Math.abs(dx) > 40 ? Math.sign(dx) * (pc.monitorWidth / 2 + 2) : dx * 0.25;
    const offsetY = Phaser.Math.Clamp(dy * 0.12, -16, 20);
    return { x: pc.x + offsetX, y: pc.y + offsetY };
  }

  private hasUnconnectedPeers(pc: ComputerObject): boolean {
    return this.computers.some(
      (other) => other !== pc && !this.connectedPairs.has(this.pairKey(pc, other)),
    );
  }

  private pairKey(a: ComputerObject, b: ComputerObject): string {
    return a.computerId < b.computerId
      ? `${a.computerId}|${b.computerId}`
      : `${b.computerId}|${a.computerId}`;
  }

  private spawnWireHint(x: number, y: number): void {
    const { scene } = this.ctx;
    const badge = scene.add.container(x, y);
    badge.setDepth(270);

    const g = scene.add.graphics();
    g.fillStyle(PALETTE.highlight, 1);
    g.fillCircle(0, 0, 11);
    g.lineStyle(3.5, PALETTE.stroke, 1);
    g.strokeCircle(0, 0, 11);
    badge.add(g);

    this.hintBadge = badge;
    popIn(scene, badge, {
      duration: 280,
      onComplete: () => {
        if (badge.scene && this.hintBadge === badge) {
          this.hintPulse = pulseHint(scene, badge, {
            scaleFactor: 1.18,
            minAlpha: 0.85,
            duration: 720,
          });
        }
      },
    });
  }

  private clearHint(): void {
    this.hintPulse?.stop();
    this.hintPulse = null;
    if (this.hintBadge?.scene) {
      const b = this.hintBadge;
      this.hintBadge = null;
      fadeOut(this.ctx.scene, b, { duration: 160, destroyOnComplete: true });
    }
  }

  private detachWiringListeners(): void {
    const { scene } = this.ctx;
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    scene.input.off(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.handlePointerUp,
    );

    for (const pc of this.computers) {
      if (pc.scene) {
        pc.removeAllListeners(Phaser.Input.Events.POINTER_DOWN);
        pc.disableInteractive();
      }
    }

    if (this.draftCable) {
      this.draftCable.destroy();
      this.draftCable = null;
    }
    this.draftSource = null;

    if (this.hoverHighlight?.scene) {
      this.hoverHighlight.destroy();
      this.hoverHighlight = null;
    }
    this.hoveredTarget = null;
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
