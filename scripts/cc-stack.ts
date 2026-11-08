// 군중 제어(얼림·밀어내기) 겹치기 확인. 실행: npx vite-node scripts/cc-stack.ts
// 입구 근처에 선풍기 Lv4를 여러 대 두고, 아주 튼튼한 적이 10초 동안 얼마나 전진하는지 잰다.
// 여러 대를 겹쳐도 적이 계속 전진해야 한다 (영원히 묶어 두면 무한 모드가 끝나지 않는다).
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';

function advance(branch: 0 | 1, fans: number): number {
  const g = new Game({ ...defaultConfig('hell'), seed: 3, startMoney: 1e7 });
  for (let i = 0; i < fans; i++) {
    const x = 120 + (i % 4) * 60;
    const y = i < 4 ? 98 : 202;
    g.apply({ type: 'place', unit: 'fan', x, y });
    const u = g.units[g.units.length - 1];
    g.apply({ type: 'upgrade', uid: u.uid });
    g.apply({ type: 'upgrade', uid: u.uid });
    g.apply({ type: 'upgrade', uid: u.uid, branch });
  }
  g.apply({ type: 'startWave' });
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  const e = g.spawnEnemy('goo', 100);
  e.hp = e.maxHp = 1e12;
  g.update(10);
  return Math.round(e.dist - 100);
}

const free = (() => {
  const g = new Game({ ...defaultConfig('hell'), seed: 3 });
  return Math.round(g.cfg.enemies.goo.speed * g.cfg.enemySpeedMul * 10);
})();
console.log(`방해 없이 10초 전진: ${free}px`);
for (const n of [1, 2, 4, 8]) {
  console.log(`선풍기 ${n}대  태풍 → ${String(advance(0, n)).padStart(4)}px   냉풍 → ${String(advance(1, n)).padStart(4)}px`);
}
