import Phaser from 'phaser';
import { PALETTE_HEX } from '../data/palette';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { DragSystem } from '../systems/DragSystem';
import { Narrator } from '../systems/Narrator';
import { PointerInputSystem } from '../systems/PointerInputSystem';
import {
  computeViewportMetrics,
  type ViewportMetrics,
} from '../utils/viewport';
import type { Chapter, StageContext, StageWorldState } from './chapters/Chapter';
import { Chapter01Desk } from './chapters/Chapter01Desk';
import { Chapter02Overload } from './chapters/Chapter02Overload';
import { Chapter03Computer } from './chapters/Chapter03Computer';
import { Chapter04Sneakernet } from './chapters/Chapter04Sneakernet';
import { Chapter05FirstNetwork } from './chapters/Chapter05FirstNetwork';
import { Chapter06CableWeb } from './chapters/Chapter06CableWeb';

/**
 * The single continuous stage for Rede.
 * Owns all reusable systems and chains independent chapters seamlessly on
 * the same evolving world.
 */
export class StageScene extends Phaser.Scene {
  public static readonly KEY = 'StageScene';

  private viewport!: ViewportMetrics;
  private pointerInput!: PointerInputSystem;
  private cameraSystem!: CameraSystem;
  private audioSystem!: AudioSystem;
  private dragSystem!: DragSystem;
  private narrator!: Narrator;

  private chapters: Chapter[] = [];
  private activeChapter: Chapter | null = null;
  private isShuttingDown = false;

  private worldState: StageWorldState = {
    desk: null,
    drawers: [],
    bookshelf: null,
    activePapers: [],
    clutterPapers: [],
    targetBluePaper: null,
    computer: null,
    blueFile: null,
    secondDesk: null,
    secondComputer: null,
    floppyDisk: null,
    computers: [],
    extraDesks: [],
    cables: [],
    totalPapersFiled: 0,
  };

  constructor() {
    super(StageScene.KEY);
  }

  public create(): void {
    this.isShuttingDown = false;
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

    const context: StageContext = {
      scene: this,
      camera: this.cameraSystem,
      audio: this.audioSystem,
      drag: this.dragSystem,
      narrator: this.narrator,
      pointer: this.pointerInput,
      worldOrigin: {
        x: this.viewport.centerX,
        y: this.viewport.centerY,
      },
      getViewport: () => this.viewport,
      state: this.worldState,
    };

    // Ordered sequence of chapters sharing the same continuous stage.
    // Act 1 (0:00–5:00): From paper desk to the first tangled 4-PC network.
    this.chapters = [
      new Chapter01Desk(),
      new Chapter02Overload(),
      new Chapter03Computer(),
      new Chapter04Sneakernet(),
      new Chapter05FirstNetwork(),
      new Chapter06CableWeb(),
      // NEXT CHAPTER ENTRY POINT (Act 2 — Hub & Switch):
      // Append the future Hub & Switch chapter here; it will receive all 4
      // computers (`ctx.state.computers`), desks, and 6 tangled cables
      // (`ctx.state.cables`) seamlessly on the same StageScene.
    ];

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    void this.runChapterSequence(context);
  }

  public getViewport(): ViewportMetrics {
    return this.viewport;
  }

  public getPointerInput(): PointerInputSystem {
    return this.pointerInput;
  }

  private async runChapterSequence(context: StageContext): Promise<void> {
    for (const chapter of this.chapters) {
      if (this.isShuttingDown) break;
      this.activeChapter = chapter;
      await chapter.start(context);
    }
    this.activeChapter = null;
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.viewport = computeViewportMetrics(gameSize.width, gameSize.height);
  }

  private handleShutdown(): void {
    this.isShuttingDown = true;
    this.activeChapter?.stop();
    this.activeChapter = null;
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.narrator.destroy();
    this.audioSystem.destroy();
  }
}
