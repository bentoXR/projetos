import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX } from '../data/palette';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { DragSystem } from '../systems/DragSystem';
import { Narrator } from '../systems/Narrator';
import { PointerInputSystem } from '../systems/PointerInputSystem';
import {
  drawIn,
  fadeOut,
  popIn,
  pulseHint,
  wobble,
  type DrawInHandle,
  type PulseHintHandle,
} from '../utils/animations';
import {
  computeViewportMetrics,
  type ViewportMetrics,
} from '../utils/viewport';

/**
 * TEMPORARY TEST SCENE — FOR VERIFYING CORE SYSTEMS ONLY.
 * Remove this scene (and restore StageScene in src/main.ts) once real content
 * development begins.
 *
 * Hidden keyboard controls (no visible HUD, keeping the clean off-white stage):
 *   1 -> Test animation utilities (popIn, wobble, drawIn, pulseHint, fadeOut)
 *   2 -> Test CameraSystem (zoomOut -> zoomIn -> diveInto -> returnFromDive)
 *   3 -> Test AudioSystem (5 synthesized Web Audio sounds)
 *   4 -> Test DragSystem (accept zone glow + invisible-wall reject bounce)
 *   5 -> Test Narrator (say + variations + onFinish -> sayAfterSilence)
 *   V -> Toggle optional pt-BR speechSynthesis voice (persisted in localStorage)
 *   0 -> Clear stage & reset camera
 */
export class SystemsTestScene extends Phaser.Scene {
  public static readonly KEY = 'SystemsTestScene';

  private viewport!: ViewportMetrics;
  private pointerInput!: PointerInputSystem;
  private cameraSystem!: CameraSystem;
  private audioSystem!: AudioSystem;
  private dragSystem!: DragSystem;
  private narrator!: Narrator;

  private demoObjects: Phaser.GameObjects.GameObject[] = [];
  private activePulseHandles: PulseHintHandle[] = [];
  private activeDrawHandles: DrawInHandle[] = [];
  private activeTimers: Phaser.Time.TimerEvent[] = [];
  private registeredZoneIds: string[] = [];

  private cameraStep = 0;
  private cameraTarget: Phaser.GameObjects.Container | null = null;
  private unsubscribeNarratorFinish: (() => void) | null = null;
  private waitingForFollowup = false;

  constructor() {
    super(SystemsTestScene.KEY);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(PALETTE_HEX.background);
    this.viewport = computeViewportMetrics(
      this.scale.width,
      this.scale.height,
    );

    this.pointerInput = new PointerInputSystem(this);
    this.cameraSystem = new CameraSystem(this);
    this.audioSystem = new AudioSystem();
    this.dragSystem = new DragSystem(this);
    this.narrator = new Narrator();

    this.unsubscribeNarratorFinish = this.narrator.onFinish((lineId) => {
      if (lineId === 'test.welcome' && this.waitingForFollowup) {
        this.waitingForFollowup = false;
        this.narrator.sayAfterSilence('test.silence_followup', 900);
      }
    });

    this.bindHiddenKeys();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupAll, this);
  }

  public getPointerInput(): PointerInputSystem {
    return this.pointerInput;
  }

  private bindHiddenKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    keyboard.on('keydown-ONE', () => this.runAnimationDemo());
    keyboard.on('keydown-TWO', () => void this.runCameraDemo());
    keyboard.on('keydown-THREE', () => this.runAudioDemo());
    keyboard.on('keydown-FOUR', () => this.runDragDemo());
    keyboard.on('keydown-FIVE', () => this.runNarratorDemo());
    keyboard.on('keydown-ZERO', () => this.resetDemo());
    keyboard.on('keydown-V', () => {
      const enabled = this.narrator.toggleVoice();
      this.audioSystem.playSnapClick();
      this.narrator.say(enabled ? 'test.voice_on' : 'test.voice_off');
    });
  }

  /**
   * Key 1: Demonstrates popIn, wobble, drawIn, pulseHint, and fadeOut.
   */
  private runAnimationDemo(): void {
    this.clearDemoObjects();
    void this.cameraSystem.setView(
      this.viewport.centerX,
      this.viewport.centerY,
      1,
      { duration: 300 },
    );
    this.audioSystem.playPop();

    const cx = this.viewport.centerX;
    const cy = this.viewport.centerY;
    const spacing = Math.min(130, this.viewport.width / 6);

    // 1) popIn — blue rounded card
    const popCard = this.createRoundedCard(
      cx - spacing * 2,
      cy,
      82,
      82,
      PALETTE.data,
    );
    popIn(this, popCard, { duration: 520 });

    // 2) wobble — green rounded card
    const wobbleCard = this.createRoundedCard(
      cx - spacing,
      cy,
      82,
      82,
      PALETTE.solution,
    );
    popIn(this, wobbleCard, {
      delay: 100,
      onComplete: () => {
        wobble(this, wobbleCard, { angleDeg: 10, duration: 480, repeat: 1 });
      },
    });

    // 3) drawIn — sketched line by line, then fills in
    const sketchCard = this.createRoundedCard(cx, cy, 92, 74, PALETTE.data);
    const drawHandle = drawIn(this, sketchCard, {
      drawDuration: 750,
      fillDuration: 320,
      fallbackWidth: 92,
      fallbackHeight: 74,
    });
    this.activeDrawHandles.push(drawHandle);

    // 4) pulseHint — yellow circle inviting a tap/click
    const pulseCircle = this.createCircleToken(
      cx + spacing,
      cy,
      40,
      PALETTE.highlight,
    );
    const pulseHandle = pulseHint(this, pulseCircle);
    this.activePulseHandles.push(pulseHandle);

    pulseCircle.setInteractive(
      new Phaser.Geom.Circle(0, 0, 42),
      Phaser.Geom.Circle.Contains,
    );
    if (pulseCircle.input) pulseCircle.input.cursor = 'pointer';
    pulseCircle.once(Phaser.Input.Events.POINTER_DOWN, () => {
      pulseHandle.stop();
      wobble(this, pulseCircle, { angleDeg: 12 });
      this.audioSystem.playSuccess();
    });

    // 5) fadeOut — coral circle that fades out when tapped (or after 3.2s)
    const fadeCircle = this.createCircleToken(
      cx + spacing * 2,
      cy,
      40,
      PALETTE.problem,
    );
    popIn(this, fadeCircle, { delay: 180 });
    fadeCircle.setInteractive(
      new Phaser.Geom.Circle(0, 0, 42),
      Phaser.Geom.Circle.Contains,
    );
    if (fadeCircle.input) fadeCircle.input.cursor = 'pointer';
    fadeCircle.once(Phaser.Input.Events.POINTER_DOWN, () => {
      this.audioSystem.playSoftThud();
      fadeOut(this, fadeCircle, { shrinkTo: 0.75, destroyOnComplete: true });
    });
  }

  /**
   * Key 2: Cycles through zoomOut -> zoomIn -> diveInto -> returnFromDive.
   */
  private async runCameraDemo(): Promise<void> {
    if (!this.cameraTarget || !this.cameraTarget.scene) {
      this.clearDemoObjects();
      this.cameraStep = 0;

      const cx = this.viewport.centerX;
      const cy = this.viewport.centerY;

      // Subtle reference ring around stage center so zoom changes are unmistakable.
      const frame = this.add.graphics();
      frame.lineStyle(3, PALETTE.stroke, 0.2);
      frame.strokeRoundedRect(cx - 220, cy - 130, 440, 260, 24);
      this.demoObjects.push(frame);

      const target = this.createRoundedCard(cx + 95, cy - 18, 96, 72, PALETTE.data);
      popIn(this, target);
      target.setInteractive(
        new Phaser.Geom.Rectangle(-48, -36, 96, 72),
        Phaser.Geom.Rectangle.Contains,
      );
      if (target.input) target.input.cursor = 'pointer';
      target.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (this.cameraSystem.isDiving()) {
          void this.cameraSystem.returnFromDive();
        } else {
          void this.cameraSystem.diveInto(
            { x: target.x, y: target.y },
            { zoom: 2.5 },
          );
        }
      });

      this.cameraTarget = target;
    }

    this.audioSystem.playSnapClick();

    const step = this.cameraStep % 4;
    this.cameraStep++;

    if (step === 0) {
      await this.cameraSystem.zoomOut(0.68, { duration: 600 });
    } else if (step === 1) {
      await this.cameraSystem.zoomIn(1.2, { duration: 600 });
    } else if (step === 2 && this.cameraTarget) {
      await this.cameraSystem.diveInto(
        { x: this.cameraTarget.x, y: this.cameraTarget.y },
        { zoom: 2.6, duration: 760 },
      );
    } else {
      await this.cameraSystem.returnFromDive({ duration: 700 });
      await this.cameraSystem.setView(
        this.viewport.centerX,
        this.viewport.centerY,
        1,
        { duration: 420 },
      );
    }
  }

  /**
   * Key 3: Plays all 5 synthesized Web Audio sounds with clickable visual beats.
   */
  private runAudioDemo(): void {
    this.clearDemoObjects();
    void this.cameraSystem.setView(
      this.viewport.centerX,
      this.viewport.centerY,
      1,
      { duration: 280 },
    );

    // Ensure Web Audio is unlocked by the keypress or click gesture.
    this.audioSystem.unlock();

    const cx = this.viewport.centerX;
    const cy = this.viewport.centerY;
    const spacing = Math.min(115, this.viewport.width / 6.2);

    const sounds: Array<{ color: number; play: () => void }> = [
      { color: PALETTE.data, play: () => this.audioSystem.playPop() },
      { color: PALETTE.solution, play: () => this.audioSystem.playSuccess() },
      { color: PALETTE.highlight, play: () => this.audioSystem.playSoftThud() },
      { color: PALETTE.data, play: () => this.audioSystem.playSnapClick() },
      { color: PALETTE.problem, play: () => this.audioSystem.playGentleError() },
    ];

    sounds.forEach((entry, idx) => {
      const x = cx + (idx - 2) * spacing;
      const dot = this.createCircleToken(x, cy, 32, entry.color);
      dot.setInteractive(
        new Phaser.Geom.Circle(0, 0, 34),
        Phaser.Geom.Circle.Contains,
      );
      if (dot.input) dot.input.cursor = 'pointer';

      dot.on(Phaser.Input.Events.POINTER_DOWN, () => {
        entry.play();
        wobble(this, dot, { angleDeg: 10, duration: 260 });
      });

      const timer = this.time.delayedCall(idx * 260, () => {
        if (!dot.scene) return;
        popIn(this, dot, { duration: 340 });
        entry.play();
      });
      this.activeTimers.push(timer);
    });
  }

  /**
   * Key 4: Drag-and-drop demo with an accepting zone and a rejecting wall zone.
   */
  private runDragDemo(): void {
    this.clearDemoObjects();
    void this.cameraSystem.setView(
      this.viewport.centerX,
      this.viewport.centerY,
      1,
      { duration: 280 },
    );

    const cx = this.viewport.centerX;
    const cy = this.viewport.centerY;
    const spreadX = Math.min(200, this.viewport.width * 0.28);
    const zoneW = 136;
    const zoneH = 110;

    // Left zone: accepts "data" items
    const acceptRect = new Phaser.Geom.Rectangle(
      cx - spreadX - zoneW / 2,
      cy - zoneH / 2,
      zoneW,
      zoneH,
    );
    const acceptGraphic = this.add.graphics();
    acceptGraphic.fillStyle(PALETTE.solution, 0.08);
    acceptGraphic.fillRoundedRect(
      acceptRect.x,
      acceptRect.y,
      acceptRect.width,
      acceptRect.height,
      18,
    );
    acceptGraphic.lineStyle(3.5, PALETTE.stroke, 0.85);
    acceptGraphic.strokeRoundedRect(
      acceptRect.x,
      acceptRect.y,
      acceptRect.width,
      acceptRect.height,
      18,
    );
    this.demoObjects.push(acceptGraphic);

    // Right zone: rejects "data" items (invisible wall bounce-back)
    const rejectRect = new Phaser.Geom.Rectangle(
      cx + spreadX - zoneW / 2,
      cy - zoneH / 2,
      zoneW,
      zoneH,
    );
    const rejectGraphic = this.add.graphics();
    rejectGraphic.fillStyle(PALETTE.problem, 0.08);
    rejectGraphic.fillRoundedRect(
      rejectRect.x,
      rejectRect.y,
      rejectRect.width,
      rejectRect.height,
      18,
    );
    rejectGraphic.lineStyle(3.5, PALETTE.stroke, 0.85);
    rejectGraphic.strokeRoundedRect(
      rejectRect.x,
      rejectRect.y,
      rejectRect.width,
      rejectRect.height,
      18,
    );
    this.demoObjects.push(rejectGraphic);

    this.dragSystem.registerDropZone({
      id: 'test-accept-zone',
      getBounds: () => acceptRect,
      accepts: (item) => item.type === 'data',
      onAccept: (item) => {
        this.audioSystem.playSuccess();
        this.tweens.add({
          targets: item.target,
          x: acceptRect.centerX,
          y: acceptRect.centerY,
          duration: 220,
          ease: 'Back.easeOut',
        });
        this.narrator.say('test.drag_accept');
      },
    });
    this.registeredZoneIds.push('test-accept-zone');

    this.dragSystem.registerDropZone({
      id: 'test-reject-zone',
      getBounds: () => rejectRect,
      accepts: () => false,
      onReject: () => {
        this.audioSystem.playGentleError();
        this.narrator.say('test.drag_reject');
      },
    });
    this.registeredZoneIds.push('test-reject-zone');

    // Draggable blue data token in the center
    const token = this.createRoundedCard(cx, cy, 74, 74, PALETTE.data);
    popIn(this, token);
    this.dragSystem.registerDraggable(token, {
      id: 'test-data-card',
      type: 'data',
      hitArea: new Phaser.Geom.Rectangle(-37, -37, 74, 74),
      onPick: () => this.audioSystem.playSnapClick(),
    });
  }

  /**
   * Key 5: Tests Narrator say(), variation rotation, onFinish, and sayAfterSilence().
   */
  private runNarratorDemo(): void {
    this.waitingForFollowup = true;
    this.audioSystem.playPop();
    this.narrator.say('test.welcome');
  }

  /**
   * Key 0: Clears all temporary demo visuals and resets camera & narrator.
   */
  private resetDemo(): void {
    this.clearDemoObjects();
    this.narrator.cancel();
    this.waitingForFollowup = false;
    this.cameraStep = 0;
    void this.cameraSystem.setView(
      this.viewport.centerX,
      this.viewport.centerY,
      1,
      { duration: 360 },
    );
  }

  private createRoundedCard(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(fillColor, 1);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);
    container.add(g);
    container.setSize(width, height);
    this.demoObjects.push(container);
    return container;
  }

  private createCircleToken(
    x: number,
    y: number,
    radius: number,
    fillColor: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(fillColor, 1);
    g.fillCircle(0, 0, radius);
    g.lineStyle(4, PALETTE.stroke, 1);
    g.strokeCircle(0, 0, radius);
    container.add(g);
    container.setSize(radius * 2, radius * 2);
    this.demoObjects.push(container);
    return container;
  }

  private clearDemoObjects(): void {
    for (const timer of this.activeTimers) {
      timer.remove(false);
    }
    this.activeTimers = [];

    for (const pulse of this.activePulseHandles) {
      pulse.stop();
    }
    this.activePulseHandles = [];

    for (const handle of this.activeDrawHandles) {
      handle.stop();
    }
    this.activeDrawHandles = [];

    for (const zoneId of this.registeredZoneIds) {
      this.dragSystem.unregisterDropZone(zoneId);
    }
    this.registeredZoneIds = [];

    for (const obj of this.demoObjects) {
      if (obj.scene) {
        obj.destroy();
      }
    }
    this.demoObjects = [];
    this.cameraTarget = null;
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.viewport = computeViewportMetrics(gameSize.width, gameSize.height);
  }

  private cleanupAll(): void {
    this.clearDemoObjects();
    this.unsubscribeNarratorFinish?.();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.narrator.destroy();
    this.audioSystem.destroy();
  }
}
