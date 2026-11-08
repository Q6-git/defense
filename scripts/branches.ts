// 갈림길 비교 벤치마크. 실행: npx vite-node scripts/branches.ts
// 같은 자리에 Lv4 가전을 두고 두 상황에서 적 전체 체력의 몇 %를 깎는지 잰다.
//  - 떼거리: 약한 적 40마리가 촘촘히
//  - 강적: 방어력 있는 튼튼한 적 4마리
// 한 유닛의 A/B가 각자 다른 상황에서 이기면 설계 의도대로다.
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import type { EnemyId, UnitId } from '../src/core/types';

type Setup = { unit: UnitId; x: number; y: number; branch?: 0 | 1; level?: number }[];

/** 지원형 유닛은 혼자서는 피해를 못 주니 토스터 Lv3 두 대와 같이 둔다 */
const HELPERS: Setup = [
  { unit: 'toaster', x: 460, y: 240, level: 2 },
  { unit: 'toaster', x: 640, y: 240, level: 2 },
];

function scenario(setup: Setup, enemy: EnemyId, count: number, gap: number, hpScale: number): { pct: number; money: number } {
  const g = new Game({ ...defaultConfig('normal'), seed: 7, startMoney: 1e6, startHp: 1e9, critChance: 0 });
  for (const s of setup) {
    g.apply({ type: 'place', unit: s.unit, x: s.x, y: s.y });
    const u = g.units[g.units.length - 1];
    const target = s.branch !== undefined ? 3 : (s.level ?? 0);
    while (u.level < target) g.apply({ type: 'upgrade', uid: u.uid, branch: s.branch });
  }
  g.apply({ type: 'startWave' });
  g.enemies = [];
  // 웨이브 1 스폰은 지우고 직접 넣는다
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  const money0 = g.money;
  let total = 0;
  let spawned = 0;
  let t = 0;
  let next = 0;
  let leaked = 0;
  while (t < 120 && (spawned < count || g.enemies.length)) {
    if (spawned < count && t >= next) {
      const e = g.spawnEnemy(enemy, 0);
      e.hp = e.maxHp = Math.round(e.maxHp * hpScale);
      total += e.hp;
      spawned++;
      next += gap;
    }
    g.update(0.05);
    for (const ev of g.drainEvents()) if (ev.type === 'leak') leaked += ev.damage;
    t += 0.05;
    if (g.phase !== 'wave') break;
  }
  // 깎인 체력 = 전체 - 기지까지 살아서 들어간 체력
  return { pct: Math.round((100 * (total - Math.min(total, leaked))) / total), money: g.money - money0 };
}

const SPOT = { x: 560, y: 240 };
const SUPPORT: UnitId[] = ['fan', 'wifi', 'washer'];

console.log('유닛/갈래'.padEnd(18), '떼거리', '  강적', '  번 돈(떼거리)');
for (const id of ['toaster', 'fan', 'microwave', 'vacuum', 'wifi', 'washer'] as UnitId[]) {
  for (const branch of [0, 1] as const) {
    const g = new Game(defaultConfig());
    const name = `${id} ${branch === 0 ? 'A' : 'B'} ${g.cfg.units[id].branches![branch].emoji} ${g.cfg.units[id].branches![branch].id}`;
    const vacSpot = id === 'vacuum' ? { x: 560, y: 210 } : SPOT;
    const setup: Setup = [...(SUPPORT.includes(id) ? HELPERS : []), { unit: id, ...vacSpot, branch }];
    const swarm = scenario(setup, 'goo', 40, 0.25, 10);
    const tank = scenario(setup, 'roach', 4, 2.5, 45);
    console.log(name.padEnd(24), `${swarm.pct}%`.padStart(5), `${tank.pct}%`.padStart(6), String(swarm.money).padStart(8));
  }
}
