import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import { wobble, type AnimatableObject } from '../utils/animations';

export type DraggableTarget = AnimatableObject;

export interface DraggableConfig<TData = unknown> {
  id?: string;
  type?: string;
  data?: TData;
  /** Optional custom hit area shape when target has no default bounds. */
  hitArea?: Phaser.Geom.Rectangle | Phaser.Geom.Circle;
  /** Optional resting scale override. Defaults to current scale (or 1 if mid-popIn). */
  baseScale?: number;
  /** Scale multiplier while held. Defaults to 1.06. */
  dragScale?: number;
  /** Return to origin when dropped outside any zone. Defaults to true. */
  returnOnMiss?: boolean;
  onPick?: (item: DraggableItem<TData>) => void;
  onMove?: (item: DraggableItem<TData>, x: number, y: number) => void;
  onDrop?: (item: DraggableItem<TData>, zone: DropZoneItem) => void;
  onReject?: (item: DraggableItem<TData>, zone: DropZoneItem) => void;
}

export interface DraggableItem<TData = unknown> {
  id: string;
  type: string;
  target: DraggableTarget;
  data: TData | undefined;
  originX: number;
  originY: number;
  baseScaleX: number;
  baseScaleY: number;
  baseDepth: number;
  dragScale: number;
  returnOnMiss: boolean;
  config: DraggableConfig<TData>;
}

export interface DropZoneConfig {
  id: string;
  /** Bounds in world coordinates used for hit detection and highlight glow. */
  getBounds: () => Phaser.Geom.Rectangle;
  /** Corner radius for the highlight outline. Defaults to 16. */
  cornerRadius?: number;
  /** Depth of the highlight graphics. Defaults to 50. */
  highlightDepth?: number;
  accepts: (item: DraggableItem) => boolean;
  onAccept?: (item: DraggableItem, zone: DropZoneItem) => void;
  onReject?: (item: DraggableItem, zone: DropZoneItem) => void;
  onHoverChange?: (
    isHovering: boolean,
    isAccepted: boolean,
    item: DraggableItem | null,
  ) => void;
}

export interface DropZoneItem {
  id: string;
  config: DropZoneConfig;
  highlightGraphics: Phaser.GameObjects.Graphics;
  hovered: boolean;
}

/**
 * Unified mouse & touch drag-and-drop system with drop zones, hover glow
 * feedback, and an "invisible wall" bounce-back animation on rejection.
 */
export class DragSystem {
  private readonly scene: Phaser.Scene;
  private readonly emitter = new Phaser.Events.EventEmitter();
  private readonly draggables = new Map<DraggableTarget, DraggableItem>();
  private readonly dropZones = new Map<string, DropZoneItem>();

  private activeItem: DraggableItem | null = null;
  private activeZone: DropZoneItem | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private nextId = 1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bindInput();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private bindInput(): void {
    const input = this.scene.input;
    input.on(Phaser.Input.Events.DRAG_START, this.handleDragStart, this);
    input.on(Phaser.Input.Events.DRAG, this.handleDrag, this);
    input.on(Phaser.Input.Events.DRAG_END, this.handleDragEnd, this);
  }

  public registerDraggable<TData = unknown>(
    target: DraggableTarget,
    config: DraggableConfig<TData> = {},
  ): DraggableItem<TData> {
    if (config.hitArea) {
      const callback =
        config.hitArea instanceof Phaser.Geom.Circle
          ? Phaser.Geom.Circle.Contains
          : Phaser.Geom.Rectangle.Contains;
      target.setInteractive(config.hitArea, callback);
    } else if (!target.input) {
      target.setInteractive();
    }

    if (target.input) {
      target.input.cursor = 'grab';
    }

    this.scene.input.setDraggable(target, true);

    const depthable = target as unknown as { depth?: number };
    const restingScaleX = config.baseScale ?? (target.scaleX > 0.05 ? target.scaleX : 1);
    const restingScaleY = config.baseScale ?? (target.scaleY > 0.05 ? target.scaleY : 1);

    const item: DraggableItem<TData> = {
      id: config.id ?? `draggable-${this.nextId++}`,
      type: config.type ?? 'default',
      target,
      data: config.data,
      originX: target.x,
      originY: target.y,
      baseScaleX: restingScaleX,
      baseScaleY: restingScaleY,
      baseDepth: typeof depthable.depth === 'number' ? depthable.depth : 0,
      dragScale: config.dragScale ?? 1.06,
      returnOnMiss: config.returnOnMiss ?? true,
      config,
    };

    this.draggables.set(target, item as DraggableItem);
    return item;
  }

  public unregisterDraggable(target: DraggableTarget): void {
    if (this.activeItem?.target === target) {
      this.clearActiveHover();
      this.activeItem = null;
    }
    this.draggables.delete(target);
    if (target.scene && target.input) {
      this.scene.input.setDraggable(target, false);
    }
  }

  public registerDropZone(config: DropZoneConfig): DropZoneItem {
    const existing = this.dropZones.get(config.id);
    if (existing) {
      this.unregisterDropZone(config.id);
    }

    const highlightGraphics = this.scene.add.graphics();
    highlightGraphics.setDepth(config.highlightDepth ?? 50);

    const zone: DropZoneItem = {
      id: config.id,
      config,
      highlightGraphics,
      hovered: false,
    };

    this.dropZones.set(config.id, zone);
    return zone;
  }

  public unregisterDropZone(id: string): void {
    const zone = this.dropZones.get(id);
    if (!zone) return;
    if (this.activeZone === zone) {
      this.activeZone = null;
    }
    if (zone.highlightGraphics.scene) {
      zone.highlightGraphics.destroy();
    }
    this.dropZones.delete(id);
  }

  public on(event: string, fn: (...args: unknown[]) => void): void {
    this.emitter.on(event, fn);
  }

  public off(event: string, fn: (...args: unknown[]) => void): void {
    this.emitter.off(event, fn);
  }

  private handleDragStart(
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ): void {
    const item = this.draggables.get(gameObject as DraggableTarget);
    if (!item) return;

    this.scene.tweens.killTweensOf(item.target);

    item.originX = item.target.x;
    item.originY = item.target.y;
    this.activeItem = item;
    this.dragOffsetX = item.target.x - pointer.worldX;
    this.dragOffsetY = item.target.y - pointer.worldY;

    const depthable = item.target as unknown as {
      setDepth?: (d: number) => void;
    };
    depthable.setDepth?.(100);

    if (item.target.input) {
      item.target.input.cursor = 'grabbing';
    }

    this.scene.tweens.add({
      targets: item.target,
      scaleX: item.baseScaleX * item.dragScale,
      scaleY: item.baseScaleY * item.dragScale,
      duration: 120,
      ease: 'Back.easeOut',
    });

    item.config.onPick?.(item);
    this.emitter.emit('pick', item);
  }

  private handleDrag(
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ): void {
    const item = this.draggables.get(gameObject as DraggableTarget);
    if (!item || this.activeItem !== item) return;

    const nextX = pointer.worldX + this.dragOffsetX;
    const nextY = pointer.worldY + this.dragOffsetY;
    item.target.setPosition(nextX, nextY);

    item.config.onMove?.(item, nextX, nextY);
    this.emitter.emit('move', item, nextX, nextY);

    const hoveredZone = this.findZoneAt(pointer.worldX, pointer.worldY, item);
    this.updateZoneHover(hoveredZone, item);
  }

  private handleDragEnd(
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ): void {
    const item = this.draggables.get(gameObject as DraggableTarget);
    if (!item || this.activeItem !== item) return;

    const zone = this.findZoneAt(pointer.worldX, pointer.worldY, item);
    this.clearActiveHover();
    this.activeItem = null;

    if (item.target.input) {
      item.target.input.cursor = 'grab';
    }

    const depthable = item.target as unknown as {
      setDepth?: (d: number) => void;
    };
    depthable.setDepth?.(item.baseDepth);

    // Restore resting scale.
    this.scene.tweens.add({
      targets: item.target,
      scaleX: item.baseScaleX,
      scaleY: item.baseScaleY,
      duration: 150,
      ease: 'Quad.easeOut',
    });

    if (zone) {
      const accepted = zone.config.accepts(item);
      if (accepted) {
        zone.config.onAccept?.(item, zone);
        item.config.onDrop?.(item, zone);
        this.emitter.emit('accept', item, zone);
      } else {
        this.playRejectBounce(item, zone);
        zone.config.onReject?.(item, zone);
        item.config.onReject?.(item, zone);
        this.emitter.emit('reject', item, zone);
      }
      return;
    }

    if (item.returnOnMiss) {
      this.scene.tweens.add({
        targets: item.target,
        x: item.originX,
        y: item.originY,
        duration: 280,
        ease: 'Back.easeOut',
      });
    }
    this.emitter.emit('miss', item);
  }

  /**
   * Plays an "invisible wall" knock-back before springing back to origin.
   */
  private playRejectBounce(item: DraggableItem, zone: DropZoneItem): void {
    const bounds = zone.config.getBounds();
    const dx = item.originX - bounds.centerX;
    const dy = item.originY - bounds.centerY;
    const len = Math.hypot(dx, dy) || 1;
    const pushX = item.target.x + (dx / len) * 26;
    const pushY = item.target.y + (dy / len) * 26;

    // Brief wall recoil, then elastic return to origin with a playful wobble.
    this.scene.tweens.add({
      targets: item.target,
      x: pushX,
      y: pushY,
      duration: 95,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!item.target.scene) return;
        wobble(this.scene, item.target, { angleDeg: 9, duration: 300 });
        this.scene.tweens.add({
          targets: item.target,
          x: item.originX,
          y: item.originY,
          duration: 360,
          ease: 'Back.easeOut',
        });
      },
    });
  }

  private findZoneAt(
    pointerX: number,
    pointerY: number,
    item: DraggableItem,
  ): DropZoneItem | null {
    for (const zone of this.dropZones.values()) {
      const rect = zone.config.getBounds();
      if (
        rect.contains(pointerX, pointerY) ||
        rect.contains(item.target.x, item.target.y)
      ) {
        return zone;
      }
    }
    return null;
  }

  private updateZoneHover(
    nextZone: DropZoneItem | null,
    item: DraggableItem,
  ): void {
    if (this.activeZone === nextZone) return;

    if (this.activeZone) {
      this.activeZone.hovered = false;
      this.activeZone.highlightGraphics.clear();
      this.activeZone.config.onHoverChange?.(false, false, null);
    }

    this.activeZone = nextZone;

    if (nextZone) {
      const accepted = nextZone.config.accepts(item);
      nextZone.hovered = true;
      this.drawZoneHighlight(nextZone, accepted);
      nextZone.config.onHoverChange?.(true, accepted, item);
      this.emitter.emit('hover', item, nextZone, accepted);
    }
  }

  private drawZoneHighlight(zone: DropZoneItem, accepted: boolean): void {
    const rect = zone.config.getBounds();
    const radius = zone.config.cornerRadius ?? 16;
    const color = accepted ? PALETTE.solution : PALETTE.problem;
    const g = zone.highlightGraphics;

    g.clear();
    g.fillStyle(color, 0.14);
    g.fillRoundedRect(
      rect.x - 4,
      rect.y - 4,
      rect.width + 8,
      rect.height + 8,
      radius + 3,
    );
    g.lineStyle(4, color, 0.95);
    g.strokeRoundedRect(
      rect.x - 4,
      rect.y - 4,
      rect.width + 8,
      rect.height + 8,
      radius + 3,
    );
  }

  private clearActiveHover(): void {
    if (!this.activeZone) return;
    this.activeZone.hovered = false;
    this.activeZone.highlightGraphics.clear();
    this.activeZone.config.onHoverChange?.(false, false, null);
    this.activeZone = null;
  }

  public destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.DRAG_START, this.handleDragStart, this);
    input.off(Phaser.Input.Events.DRAG, this.handleDrag, this);
    input.off(Phaser.Input.Events.DRAG_END, this.handleDragEnd, this);

    for (const zone of this.dropZones.values()) {
      if (zone.highlightGraphics.scene) {
        zone.highlightGraphics.destroy();
      }
    }
    this.dropZones.clear();
    this.draggables.clear();
    this.emitter.removeAllListeners();
  }
}
