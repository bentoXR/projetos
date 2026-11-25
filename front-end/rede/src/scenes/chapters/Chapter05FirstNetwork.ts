import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { BitDiveView } from '../../objects/BitDiveView';
import { CableObject } from '../../objects/CableObject';
import { ComputerObject } from '../../objects/ComputerObject';
import { DigitalFileObject } from '../../objects/DigitalFileObject';
import {
  fadeOut,
  popIn,
  pulseHint,
  wobble,
  type PulseHintHandle,
} from '../../utils/animations';
import type { Chapter, StageContext } from './Chapter';

/**
 * Chapter 5 (4:20–5:00):
 * - Narrator: "E se o arquivo pudesse andar sozinho?"
 * - A cable sprouts from PC 1 looking for PC 2; player drags its plug to PC 2
 *   and snaps it in with a crisp click.
 * - A blue file transforms into a row of blue dots (bits) traveling along the
 *   wire into PC 2.
 * - Narrator: "Duas máquinas conversando. Isso é uma rede."
 * - Optional deep-dive: narrator asks "Quer ver o que passa por dentro do cabo?"
 *   with two clean visual icons (dive in vs. continue). Accepting dives the camera
 *   into the wire to show real two-level electrical pulses (1 and 0) with a clean
 *   back icon to return; declining continues smoothly.
 */
export class Chapter05FirstNetwork implements Chapter {
  public readonly id = 'chapter-05-first-network';

  private ctx!: StageContext;
  private stopped = false;
  private pendingTimers: Phaser.Time.TimerEvent[] = [];
  private activePulses: PulseHintHandle[] = [];
  private bitDiveView: BitDiveView | null = null;
  private plugSyncHandler: (() => void) | null = null;
  private plugSwayTween: Phaser.Tweens.Tween | null = null;
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
    this.clearPulses();
    this.stopPlugSway();
    this.detachPlugSync();
    this.bitDiveView?.destroy();
    this.bitDiveView = null;
    this.ctx.drag.unregisterDropZone('pc2-cable-port');
  }

  private async runSequence(): Promise<void> {
    const { scene, camera, audio, narrator, state } = this.ctx;
    const pc1 = state.computer;
    const pc2 = state.secondComputer;
    if (!pc1 || !pc2) {
      this.resolveChapter?.();
      return;
    }

    // Gently retire the floppy disk as we move beyond sneakernet.
    if (state.floppyDisk?.scene) {
      const floppy = state.floppyDisk;
      state.floppyDisk = null;
      fadeOut(scene, floppy, {
        duration: 420,
        shrinkTo: 0.8,
        destroyOnComplete: true,
      });
    }

    await this.wait(520);
    if (this.stopped) return;

    // 1) Narrator: "E se o arquivo pudesse andar sozinho?"
    narrator.say('ch5.walk_alone');

    await this.wait(850);
    if (this.stopped) return;

    // 2) Cable sprouts from PC 1's right side, searching for PC 2.
    const cable = await this.sproutAndConnectCable(pc1, pc2);
    if (this.stopped || !cable) return;

    state.cables.push(cable);

    // 3) Blue file transforms into a row of blue dots (bits) traveling across the cable!
    await this.wait(320);
    if (this.stopped) return;
    await this.sendBitStreamAcrossCable(pc1, pc2, cable);
    if (this.stopped) return;

    // 4) Narrator: "Duas máquinas conversando. Isso é uma rede."
    narrator.say('ch5.this_is_a_network');
    await this.wait(3800);
    if (this.stopped) return;

    // 5) Optional deep-dive choice: two clean visual icons above the cable.
    narrator.say('ch5.ask_dive');
    const wantsDive = await this.waitForDiveChoice(cable);
    if (this.stopped) return;

    if (wantsDive) {
      await this.runCableDeepDive(cable);
      if (this.stopped) return;
      audio.playPop();
    } else {
      audio.playSnapClick();
    }

    // Ensure camera is nicely framed on the connected pair for the next chapter.
    const midX = (pc1.x + pc2.x) / 2;
    const midY = (pc1.y + pc2.y) / 2 + 24;
    const zoom = this.getResponsiveScale(860, 380);
    await camera.setView(midX, midY, zoom, { duration: 480 });
    if (this.stopped) return;

    await this.wait(550);
    if (this.stopped) return;

    this.resolveChapter?.();
  }

  private async sproutAndConnectCable(
    pc1: ComputerObject,
    pc2: ComputerObject,
  ): Promise<CableObject | null> {
    const { scene, drag, audio } = this.ctx;

    const startX = pc1.x + pc1.monitorWidth / 2 + 2;
    const startY = pc1.y + 12;
    const targetPortX = pc2.x - pc2.monitorWidth / 2 - 2;
    const targetPortY = pc2.y + 12;

    const restingTipX = startX + 128;
    const restingTipY = startY + 26;

    const cable = new CableObject(
      scene,
      'cable-pc1-pc2',
      startX,
      startY,
      startX + 4,
      startY,
      36,
    );

    // Animate the wire sprouting out of PC 1 curiously toward PC 2.
    audio.playPop();
    const growState = { x: startX + 4, y: startY };
    await new Promise<void>((resolve) => {
      scene.tweens.add({
        targets: growState,
        x: restingTipX,
        y: restingTipY,
        duration: 560,
        ease: 'Back.easeOut',
        onUpdate: () => cable.setEnd(growState.x, growState.y),
        onComplete: () => resolve(),
      });
    });
    if (this.stopped) return null;

    // Draggable plug handle at the loose end of the cable.
    const plugHandle = this.createPlugHandle(restingTipX, restingTipY);
    popIn(scene, plugHandle, { duration: 240 });

    // Gentle curious searching sway until grabbed.
    this.plugSwayTween = scene.tweens.add({
      targets: plugHandle,
      y: restingTipY - 12,
      x: restingTipX + 10,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Keep the cable tip glued to the plug handle during sway, drag, and bounce-back.
    this.plugSyncHandler = () => {
      if (plugHandle.scene && !cable.isConnected()) {
        cable.setEnd(plugHandle.x, plugHandle.y);
      }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.plugSyncHandler);

    return new Promise<CableObject>((resolve) => {
      const pulse = pulseHint(scene, plugHandle, {
        scaleFactor: 1.12,
        minAlpha: 0.9,
        duration: 760,
      });
      this.activePulses.push(pulse);

      // Generous drop zone around PC 2's port & monitor so connecting feels effortless.
      drag.registerDropZone({
        id: 'pc2-cable-port',
        getBounds: () =>
          new Phaser.Geom.Rectangle(
            pc2.x - pc2.monitorWidth / 2 - 42,
            pc2.y - pc2.monitorHeight / 2 - 22,
            pc2.monitorWidth + 64,
            pc2.monitorHeight + pc2.standHeight + 44,
          ),
        cornerRadius: 16,
        highlightDepth: 255,
        accepts: (item) => item.type === 'cable-plug',
        onAccept: () => {
          this.clearPulses();
          this.stopPlugSway();
          this.detachPlugSync();
          drag.unregisterDropZone('pc2-cable-port');
          drag.unregisterDraggable(plugHandle);
          if (plugHandle.scene) plugHandle.destroy();

          cable.setEnd(targetPortX, targetPortY);
          cable.setConnected(true);
          audio.playSnapClick();
          wobble(scene, pc2, { angleDeg: 4, duration: 220, squash: 0.03 });

          // Elastic cable sag twang when snapping into the port!
          const sagState = { sag: 16 };
          scene.tweens.add({
            targets: sagState,
            sag: 48,
            duration: 420,
            ease: 'Elastic.easeOut',
            onUpdate: () => cable.setSag(sagState.sag),
          });

          resolve(cable);
        },
      });

      drag.registerDraggable(plugHandle, {
        id: 'cable-plug-1',
        type: 'cable-plug',
        data: cable,
        baseScale: 1,
        hitArea: new Phaser.Geom.Circle(0, 0, 28),
        dragScale: 1.15,
        returnOnMiss: true,
        onPick: () => {
          this.stopPlugSway();
          this.clearPulses();
          audio.playSnapClick();
        },
      });
    });
  }

  private createPlugHandle(x: number, y: number): Phaser.GameObjects.Container {
    const { scene } = this.ctx;
    const container = scene.add.container(x, y);
    container.setDepth(265);

    const g = scene.add.graphics();
    g.fillStyle(PALETTE.highlight, 1);
    g.fillCircle(0, 0, 14);
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeCircle(0, 0, 14);

    // Tiny plug tip prongs
    g.fillStyle(PALETTE.stroke, 1);
    g.fillRoundedRect(11, -5, 7, 10, 2);

    container.add(g);
    container.setSize(34, 34);
    return container;
  }

  /**
   * Pops a blue file from PC 1, morphs it into a row of 8 blue dots (bits),
   * and animates them flowing along the cable directly into PC 2.
   */
  private async sendBitStreamAcrossCable(
    pc1: ComputerObject,
    pc2: ComputerObject,
    cable: CableObject,
  ): Promise<void> {
    const { scene, audio } = this.ctx;
    const startPt = cable.getStart();

    // Brief file pop above PC 1 before dissolving into traveling blue dots
    const file = new DigitalFileObject(
      scene,
      pc1.x,
      pc1.y - pc1.monitorHeight / 2 - 42,
      { id: 'cable-file-blue', color: PALETTE.data, size: 42 },
    );
    file.setDepth(270);
    await new Promise<void>((resolve) => {
      popIn(scene, file, { duration: 260, onComplete: resolve });
    });
    if (this.stopped) return;

    await this.wait(220);
    if (this.stopped) return;

    // Shrink file into the cable's start port
    await new Promise<void>((resolve) => {
      scene.tweens.add({
        targets: file,
        x: startPt.x,
        y: startPt.y,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: 210,
        ease: 'Back.easeIn',
        onComplete: () => {
          if (file.scene) file.destroy();
          resolve();
        },
      });
    });
    if (this.stopped) return;

    // Launch a clean row of 8 blue dots (1 byte!) along the cable curve
    const dotCount = 8;
    const dotPromises: Promise<void>[] = [];

    for (let i = 0; i < dotCount; i++) {
      if (this.stopped) return;

      const dot = scene.add.graphics();
      dot.setDepth(260);
      dot.fillStyle(PALETTE.data, 1);
      dot.fillCircle(0, 0, 7.5);
      dot.lineStyle(2.5, PALETTE.stroke, 1);
      dot.strokeCircle(0, 0, 7.5);
      dot.setPosition(startPt.x, startPt.y);

      if (i % 2 === 0) {
        audio.playPop();
      }

      const travel = new Promise<void>((resolve) => {
        const progress = { t: 0 };
        scene.tweens.add({
          targets: progress,
          t: 1,
          duration: 640,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            if (!dot.scene) return;
            const pt = cable.getPointAt(progress.t);
            dot.setPosition(pt.x, pt.y);
          },
          onComplete: () => {
            if (dot.scene) dot.destroy();
            resolve();
          },
        });
      });

      dotPromises.push(travel);
      await this.wait(95);
    }

    await Promise.all(dotPromises);
    if (this.stopped) return;

    // PC 2 receives the file effortlessly!
    audio.playSuccess();
    pc2.absorbFileSquare(PALETTE.data);
    wobble(scene, pc2, { angleDeg: 6, duration: 280, squash: 0.04 });
  }

  /**
   * Presents two clean circular visual icons above the cable midpoint:
   *  - Left (blue pulse/magnifier icon): dive into the cable
   *  - Right (green forward-arrow icon): continue without diving
   */
  private waitForDiveChoice(cable: CableObject): Promise<boolean> {
    const { scene } = this.ctx;
    const mid = cable.getMidpoint();
    const choiceY = mid.y - 78;

    return new Promise<boolean>((resolve) => {
      let chosen = false;

      const diveBtn = this.createChoiceIconButton(
        mid.x - 46,
        choiceY,
        'dive',
        () => {
          if (chosen || this.stopped) return;
          chosen = true;
          cleanupButtons();
          resolve(true);
        },
      );

      const skipBtn = this.createChoiceIconButton(
        mid.x + 46,
        choiceY,
        'skip',
        () => {
          if (chosen || this.stopped) return;
          chosen = true;
          cleanupButtons();
          resolve(false);
        },
      );

      popIn(scene, diveBtn, {
        duration: 340,
        onComplete: () => {
          if (!chosen && diveBtn.scene) {
            this.activePulses.push(
              pulseHint(scene, diveBtn, {
                scaleFactor: 1.09,
                minAlpha: 0.9,
                duration: 820,
              }),
            );
          }
        },
      });
      popIn(scene, skipBtn, { delay: 90, duration: 340 });

      const cleanupButtons = (): void => {
        this.clearPulses();
        for (const btn of [diveBtn, skipBtn]) {
          if (btn.scene) {
            btn.disableInteractive();
            fadeOut(scene, btn, {
              duration: 200,
              shrinkTo: 0.7,
              destroyOnComplete: true,
            });
          }
        }
      };
    });
  }

  private createChoiceIconButton(
    x: number,
    y: number,
    kind: 'dive' | 'skip',
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const { scene } = this.ctx;
    const container = scene.add.container(x, y);
    container.setDepth(280);

    const g = scene.add.graphics();
    const r = 28;

    g.fillStyle(PALETTE.background, 1);
    g.fillCircle(0, 0, r);
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeCircle(0, 0, r);

    if (kind === 'dive') {
      // Crisp blue square-wave pulse icon representing "look inside the wire"
      g.lineStyle(3.8, PALETTE.data, 1);
      g.beginPath();
      g.moveTo(-14, 6);
      g.lineTo(-7, 6);
      g.lineTo(-7, -7);
      g.lineTo(1, -7);
      g.lineTo(1, 6);
      g.lineTo(8, 6);
      g.lineTo(8, -7);
      g.lineTo(14, -7);
      g.strokePath();
    } else {
      // Crisp green forward arrow icon representing "continue"
      g.lineStyle(4, PALETTE.solution, 1);
      g.beginPath();
      g.moveTo(-10, 0);
      g.lineTo(9, 0);
      g.moveTo(2, -8);
      g.lineTo(10, 0);
      g.lineTo(2, 8);
      g.strokePath();
    }

    container.add(g);
    container.setSize(r * 2, r * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, r + 8),
      Phaser.Geom.Circle.Contains,
    );
    if (container.input) container.input.cursor = 'pointer';
    container.once(Phaser.Input.Events.POINTER_DOWN, onClick);

    return container;
  }

  private async runCableDeepDive(cable: CableObject): Promise<void> {
    const { scene, camera, audio, narrator } = this.ctx;

    audio.playPop();
    await camera.diveInto(cable.getMidpoint(), {
      zoom: 4.2,
      duration: 780,
      ease: 'Cubic.easeInOut',
    });
    if (this.stopped) return;

    await new Promise<void>((resolve) => {
      this.bitDiveView = new BitDiveView(scene, () => {
        this.bitDiveView = null;
        narrator.cancel();
        resolve();
      });

      narrator.say('ch5.dive_pulses');
      this.schedule(4900, () => {
        if (this.bitDiveView && !this.stopped) {
          narrator.say('ch5.dive_bits');
        }
      });
    });

    if (this.stopped) return;

    await camera.returnFromDive({ duration: 720, ease: 'Cubic.easeInOut' });
  }

  private stopPlugSway(): void {
    if (this.plugSwayTween) {
      this.plugSwayTween.stop();
      this.plugSwayTween = null;
    }
  }

  private detachPlugSync(): void {
    if (this.plugSyncHandler) {
      this.ctx.scene.events.off(
        Phaser.Scenes.Events.UPDATE,
        this.plugSyncHandler,
      );
      this.plugSyncHandler = null;
    }
  }

  private clearPulses(): void {
    for (const p of this.activePulses) {
      p.stop();
    }
    this.activePulses = [];
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
