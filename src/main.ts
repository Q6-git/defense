import '@fontsource/jua';
import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { prepareSprites, spriteUrls } from './spriteLoader';
import { STR } from './strings.ko';

/** 화면에 나올 수 있는 글자를 모두 모은다 (함수로 된 문구는 소스 안의 글자를 쓴다) */
function allText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'function') return String(v);
  if (v && typeof v === 'object') return Object.values(v).map(allText).join('');
  return '';
}

/**
 * 한글 글꼴은 글자 범위별로 쪼개진 파일이라, 쓰는 글자가 든 파일을 미리 받아 둔다.
 * 그러지 않으면 Phaser가 글자를 그린 뒤에 글꼴이 도착해서 일부 글자만 다른 글꼴로 남는다.
 * 3초 안에 못 받으면 시스템 글꼴로 시작한다.
 */
async function loadFont(): Promise<void> {
  const sample = `${allText(STR)}0123456789+-×/%!?.,:()[]`;
  const load = document.fonts.load('24px Jua', sample).then(() => undefined);
  await Promise.race([load, new Promise((r) => setTimeout(r, 3000))]);
}

// 그림과 글꼴을 먼저 준비하고 게임을 시작한다
void Promise.all([prepareSprites(), loadFont()]).then(([urls]) => {
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
