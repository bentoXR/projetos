import Phaser from 'phaser';
import { PALETTE_HEX } from './data/palette';
import { StageScene } from './scenes/StageScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: PALETTE_HEX.background,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    activePointers: 2,
    touch: {
      capture: true,
    },
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: [StageScene],
};

new Phaser.Game(config);
