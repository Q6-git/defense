import '@fontsource/jua';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { prepareSprites, spriteUrls } from './spriteLoader';
import { loadFontFor } from './i18n';

// 그림과 글꼴을 먼저 준비하고 게임을 시작한다
void Promise.all([prepareSprites(), loadFontFor()]).then(([urls]) => {
  Object.assign(spriteUrls, urls);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#3a3341',
    // 투명: 격자 맵은 뒤에 깐 3D 캔버스가 보이게 한다
    transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    scene: [GameScene],
  });
  // 안전장치: 화면 그리기(WebGL)가 끊기면 UI가 사라지므로 한 번 새로 고친다 (진행 상황은 저장돼 있다)
  game.events.once(Phaser.Core.Events.READY, () => {
    game.canvas.addEventListener('webglcontextlost', () => {
      try {
        if (sessionStorage.getItem('reloadedOnLost')) return;
        sessionStorage.setItem('reloadedOnLost', '1');
      } catch {
        return;
      }
      location.reload();
    });
  });
});
