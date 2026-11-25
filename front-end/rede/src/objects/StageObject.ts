import Phaser from 'phaser';

/**
 * Base container for procedural 2D objects on the stage.
 * All visuals are drawn with Phaser Graphics (zero external image assets).
 */
export abstract class StageObject extends Phaser.GameObjects.Container {
  protected readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.graphics = scene.add.graphics();
    this.add(this.graphics);
    scene.add.existing(this);
  }

  /** Subclasses draw their flat geometric shapes using the fixed palette. */
  public abstract redraw(): void;
}
