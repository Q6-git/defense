import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { prepareSprites, spriteUrls } from './spriteLoader';

// 그림 파일을 먼저 검사해 두고 게임을 시작한다
void prepareSprites().then((urls) => {
  Object.assign(spriteUrls, urls);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#14161c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    scene: [GameScene],
  });
});
