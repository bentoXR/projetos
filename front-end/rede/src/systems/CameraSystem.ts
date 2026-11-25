import Phaser from 'phaser';

export interface CameraMoveOptions {
  duration?: number;
  ease?: string;
}

export interface CameraDiveOptions extends CameraMoveOptions {
  zoom?: number;
}

interface CameraSnapshot {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface CameraPoint {
  x: number;
  y: number;
}

/**
 * Smooth camera controller for the single continuous stage.
 * Supports gentle zoom in/out as the scene grows in scale, plus diving into
 * a specific object (e.g., technical deep-dives) and returning seamlessly.
 */
export class CameraSystem {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly emitter = new Phaser.Events.EventEmitter();
  private readonly diveStack: CameraSnapshot[] = [];

  private activeTween: Phaser.Tweens.Tween | null = null;
  private focusX: number;
  private focusY: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.focusX = scene.scale.width / 2;
    this.focusY = scene.scale.height / 2;

    this.camera.centerOn(this.focusX, this.focusY);

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  public getZoom(): number {
    return this.camera.zoom;
  }

  public getFocus(): CameraPoint {
    return { x: this.focusX, y: this.focusY };
  }

  public isDiving(): boolean {
    return this.diveStack.length > 0;
  }

  /**
   * Smoothly zooms out to reveal more of the stage.
   */
  public zoomOut(
    targetZoom: number,
    options: CameraMoveOptions = {},
  ): Promise<void> {
    const clamped = Math.min(this.camera.zoom, Math.max(0.15, targetZoom));
    return this.animateTo(this.focusX, this.focusY, clamped, options);
  }

  /**
   * Smoothly zooms in, optionally panning toward a new focal point.
   */
  public zoomIn(
    targetZoom: number,
    options: CameraMoveOptions & Partial<CameraPoint> = {},
  ): Promise<void> {
    const clamped = Math.max(this.camera.zoom, Math.min(8, targetZoom));
    const x = options.x ?? this.focusX;
    const y = options.y ?? this.focusY;
    return this.animateTo(x, y, clamped, options);
  }

  /**
   * Smoothly pans the camera center to a world coordinate.
   */
  public panTo(
    x: number,
    y: number,
    options: CameraMoveOptions = {},
  ): Promise<void> {
    return this.animateTo(x, y, this.camera.zoom, options);
  }

  /**
   * Smoothly transitions to an exact center point and zoom level.
   */
  public setView(
    x: number,
    y: number,
    zoom: number,
    options: CameraMoveOptions = {},
  ): Promise<void> {
    return this.animateTo(x, y, Phaser.Math.Clamp(zoom, 0.15, 8), options);
  }

  /**
   * Saves the current view and smoothly dives into an object or point.
   */
  public async diveInto(
    target: CameraPoint,
    options: CameraDiveOptions = {},
  ): Promise<void> {
    const { zoom = 2.6, duration = 780, ease = 'Cubic.easeInOut' } = options;

    this.diveStack.push({
      centerX: this.focusX,
      centerY: this.focusY,
      zoom: this.camera.zoom,
    });

    this.emitter.emit('dive:start', { target, zoom });
    await this.animateTo(target.x, target.y, zoom, { duration, ease });
    this.emitter.emit('dive:complete', { target, zoom });
  }

  /**
   * Smoothly returns to the camera state saved before the last diveInto().
   */
  public async returnFromDive(options: CameraMoveOptions = {}): Promise<void> {
    const snapshot = this.diveStack.pop();
    if (!snapshot) return;

    const { duration = 720, ease = 'Cubic.easeInOut' } = options;

    this.emitter.emit('return:start', snapshot);
    await this.animateTo(snapshot.centerX, snapshot.centerY, snapshot.zoom, {
      duration,
      ease,
    });
    this.emitter.emit('return:complete', snapshot);
  }

  public on(event: string, fn: (...args: unknown[]) => void): void {
    this.emitter.on(event, fn);
  }

  public off(event: string, fn: (...args: unknown[]) => void): void {
    this.emitter.off(event, fn);
  }

  private animateTo(
    targetX: number,
    targetY: number,
    targetZoom: number,
    options: CameraMoveOptions,
  ): Promise<void> {
    const { duration = 620, ease = 'Sine.easeInOut' } = options;

    if (this.activeTween) {
      this.activeTween.stop();
      this.activeTween = null;
    }

    const state = {
      x: this.focusX,
      y: this.focusY,
      zoom: this.camera.zoom,
    };

    if (duration <= 0) {
      this.focusX = targetX;
      this.focusY = targetY;
      this.camera.setZoom(targetZoom);
      this.camera.centerOn(targetX, targetY);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.activeTween = this.scene.tweens.add({
        targets: state,
        x: targetX,
        y: targetY,
        zoom: targetZoom,
        duration,
        ease,
        onUpdate: () => {
          this.focusX = state.x;
          this.focusY = state.y;
          this.camera.setZoom(state.zoom);
          this.camera.centerOn(state.x, state.y);
        },
        onComplete: () => {
          this.focusX = targetX;
          this.focusY = targetY;
          this.camera.setZoom(targetZoom);
          this.camera.centerOn(targetX, targetY);
          this.activeTween = null;
          resolve();
        },
      });
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.camera.setViewport(0, 0, gameSize.width, gameSize.height);
    this.camera.centerOn(this.focusX, this.focusY);
  }

  public destroy(): void {
    if (this.activeTween) {
      this.activeTween.stop();
      this.activeTween = null;
    }
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.emitter.removeAllListeners();
  }
}
