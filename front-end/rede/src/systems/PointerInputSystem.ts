import Phaser from 'phaser';

export interface UnifiedPointerEvent {
  id: number;
  isTouch: boolean;
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  isDown: boolean;
  raw: Phaser.Input.Pointer;
}

export type UnifiedPointerHandler = (event: UnifiedPointerEvent) => void;

/**
 * Normalizes mouse and touch interactions into a single pointer API.
 * Uses Phaser's unified Pointer events while ensuring consistent world
 * coordinates and clean mobile touch behavior.
 */
export class PointerInputSystem {
  private readonly scene: Phaser.Scene;
  private readonly emitter = new Phaser.Events.EventEmitter();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bindEvents();
  }

  private bindEvents(): void {
    const input = this.scene.input;

    // Prevent the browser context menu on right-click or long-press.
    input.mouse?.disableContextMenu();

    input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private toUnifiedEvent(pointer: Phaser.Input.Pointer): UnifiedPointerEvent {
    return {
      id: pointer.id,
      isTouch: pointer.wasTouch,
      screenX: pointer.x,
      screenY: pointer.y,
      worldX: pointer.worldX,
      worldY: pointer.worldY,
      isDown: pointer.isDown,
      raw: pointer,
    };
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.emitter.emit('down', this.toUnifiedEvent(pointer));
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    this.emitter.emit('move', this.toUnifiedEvent(pointer));
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    this.emitter.emit('up', this.toUnifiedEvent(pointer));
  }

  public onDown(handler: UnifiedPointerHandler): void {
    this.emitter.on('down', handler);
  }

  public onMove(handler: UnifiedPointerHandler): void {
    this.emitter.on('move', handler);
  }

  public onUp(handler: UnifiedPointerHandler): void {
    this.emitter.on('up', handler);
  }

  public destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    input.off(
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      this.handlePointerUp,
      this,
    );
    this.emitter.removeAllListeners();
  }
}
