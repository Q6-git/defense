// 가전 비교 벤치마크 (Lv3 한 대). 실행: npx vite-node scripts/units.ts
// 떼거리(약한 적 40마리)와 강적(방어력 있는 튼튼한 적 4마리)에서 적 체력의 몇 %를 깎는지, 비용 대비로 본다.
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import type { EnemyId, UnitId } from '../src/core/types';

function scenario(unit: UnitId, enemy: EnemyId, count: number, gap: number, hpScale: number): number {
  const g = new Game({ ...defaultConfig('normal'), seed: 7, startMoney: 1e6, startHp: 1e9, critChance: 0, cards: [], waveMods: [] });
  // 지원형은 토스터 Lv3 두 대와 함께 둔다
  const support = unit === 'battery' || unit === 'aircon';
  const setup: [UnitId, number, number][] = support ? [['toaster', 460, 240], ['toaster', 640, 240], [unit, 560, 240]] : [[unit, 560, unit === 'vacuum' || unit === 'stove' ? 205 : 240]];
  for (const [id, x, y] of setup) {
    g.apply({ type: 'place', unit: id, x, y });
    const u = g.units[g.units.length - 1];
    g.apply({ type: 'upgrade', uid: u.uid });
    g.apply({ type: 'upgrade', uid: u.uid });
  }
  g.apply({ type: 'startWave' });
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  let total = 0, spawned = 0, leaked = 0, next = 0;
  for (let t = 0; t < 120 && (spawned < count || g.enemies.length); t += 0.05) {
    if (spawned < count && t >= next) {
      const e = g.spawnEnemy(enemy, 0);
      e.hp = e.maxHp = Math.round(e.maxHp * hpScale);
      total += e.hp;
      spawned++;
      next += gap;
    }
    g.update(0.05);
    for (const ev of g.drainEvents()) if (ev.type === 'leak') leaked += ev.damage;
    if (g.phase !== 'wave') break;
  }
  return Math.round((100 * (total - Math.min(total, leaked))) / total);
}

const cost = (id: UnitId) => new Game(defaultConfig()).cfg.units[id].levels.reduce((a, l) => a + l.cost, 0);
console.log('가전'.padEnd(12), '비용', ' 떼거리', ' 강적');
for (const id of ['toaster', 'microwave', 'vacuum', 'stove', 'strip', 'iron', 'dishwasher', 'battery', 'aircon'] as UnitId[]) {
  console.log(id.padEnd(12), String(cost(id)).padStart(5), `${scenario(id, 'goo', 40, 0.25, 10)}%`.padStart(6), `${scenario(id, 'roach', 4, 2.5, 45)}%`.padStart(6));
}
