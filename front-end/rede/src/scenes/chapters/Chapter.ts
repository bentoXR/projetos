import type Phaser from 'phaser';
import type { BookshelfObject } from '../../objects/BookshelfObject';
import type { CableObject } from '../../objects/CableObject';
import type { ComputerObject } from '../../objects/ComputerObject';
import type { DeskObject } from '../../objects/DeskObject';
import type { DigitalFileObject } from '../../objects/DigitalFileObject';
import type { DrawerObject } from '../../objects/DrawerObject';
import type { FloppyDiskObject } from '../../objects/FloppyDiskObject';
import type { PaperObject } from '../../objects/PaperObject';
import type { AudioSystem } from '../../systems/AudioSystem';
import type { CameraSystem } from '../../systems/CameraSystem';
import type { DragSystem } from '../../systems/DragSystem';
import type { Narrator } from '../../systems/Narrator';
import type { PointerInputSystem } from '../../systems/PointerInputSystem';
import type { ViewportMetrics } from '../../utils/viewport';

/**
 * Persistent world objects shared across consecutive chapters on the single
 * continuous StageScene.
 */
export interface StageWorldState {
  desk: DeskObject | null;
  drawers: DrawerObject[];
  bookshelf: BookshelfObject | null;
  activePapers: PaperObject[];
  /** Loose clutter papers accumulated during Chapter 2 (kept for Chapter 3). */
  clutterPapers: PaperObject[];
  /** "The blue paper from yesterday" once created in Chapter 2. */
  targetBluePaper: PaperObject | null;
  /** Primary computer introduced in Chapter 3. */
  computer: ComputerObject | null;
  /** Retrieved blue digital file icon (reused in Chapter 4). */
  blueFile: DigitalFileObject | null;
  /** Second desk & colleague's computer introduced in Chapter 4. */
  secondDesk: DeskObject | null;
  secondComputer: ComputerObject | null;
  /** Floppy disk introduced in Chapter 4. */
  floppyDisk: FloppyDiskObject | null;
  /** All computers currently on stage (ready for Hub & Switch in Act 2). */
  computers: ComputerObject[];
  /** Additional desks spawned in Chapter 6+ (kept for continuity). */
  extraDesks: DeskObject[];
  /** Network cables connecting computers (Chapter 5+). */
  cables: CableObject[];
  totalPapersFiled: number;
}

/**
 * Shared services and stage references provided to every chapter.
 */
export interface StageContext {
  scene: Phaser.Scene;
  camera: CameraSystem;
  audio: AudioSystem;
  drag: DragSystem;
  narrator: Narrator;
  pointer: PointerInputSystem;
  worldOrigin: { x: number; y: number };
  getViewport: () => ViewportMetrics;
  state: StageWorldState;
}

/**
 * Independent narrative/interactive segment that runs on StageScene and
 * resolves when ready to hand off to the next chapter.
 */
export interface Chapter {
  readonly id: string;
  start(ctx: StageContext): Promise<void>;
  stop(): void;
}
