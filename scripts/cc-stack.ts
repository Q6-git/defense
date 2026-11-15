// 군중 제어(감속·얼림·밀어내기) 겹치기 확인. 실행: npx vite-node scripts/cc-stack.ts
// 입구 근처에 선풍기 Lv4 여러 대(+ 에어컨)를 두고, 아주 튼튼한 적이 20초 동안 얼마나 전진하는지 잰다.
// 아무리 겹쳐도 적은 계속 전진해야 한다 (감속 하한 35%, 보스 50%, 밀어내기는 밀 때마다 절반).
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import type { EnemyId } from '../src/core/types';
/** 입구 근처 선풍기 n대(Lv4 갈래) + 에어컨(갈래, 별) 아래에서 적이 20초 동안 얼마나 전진하나 */
function advance(enemy: EnemyId, branch: 0 | 1, fans: number, aircon: 0 | 1 | null, stars = 0): number {
  const g = new Game({ ...defaultConfig('hell'), seed: 3, startMoney: 1e9, cards: [] });
  const T = (c: number, r: number) => ({ x: c * 52 + 26, y: 72 + r * 52 + 26 });
  const spots = [[1, 0], [2, 0], [3, 0], [5, 0], [6, 0], [2, 2], [4, 2], [6, 2]];
  const lv4 = (unit: 'fan' | 'aircon', p: { x: number; y: number }, b: 0 | 1) => {
    if (!g.apply({ type: 'place', unit, ...p }).ok) throw new Error('place ' + unit);
    const u = g.units[g.units.length - 1];
    g.apply({ type: 'upgrade', uid: u.uid });
    g.apply({ type: 'upgrade', uid: u.uid });
    g.apply({ type: 'upgrade', uid: u.uid, branch: b });
    for (let i = 0; i < stars; i++) g.apply({ type: 'upgrade', uid: u.uid });
  };
  for (let i = 0; i < fans; i++) lv4('fan', T(spots[i][0], spots[i][1]), branch);
  if (aircon !== null) lv4('aircon', T(19, 6), aircon);
  g.apply({ type: 'startWave' });
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  const e = g.spawnEnemy(enemy, 100);
  e.hp = e.maxHp = 1e12;
  for (let t = 0; t < 20; t += 0.05) g.update(0.05);
  return Math.round(e.dist - 100);
}
const free = (id: EnemyId) => { const g = new Game({ ...defaultConfig('hell') }); return Math.round(g.cfg.enemies[id].speed * g.cfg.enemySpeedMul * 20); };
for (const id of ['grease', 'boss', 'goo'] as EnemyId[]) {
  console.log(`== ${id} (방해 없이 20초 ${free(id)}px)`);
  for (const [n, ac, st] of [[4, null, 0], [8, null, 0], [4, 0, 0], [8, 0, 0], [8, 0, 5], [8, 1, 5]] as const) {
    console.log(`선풍기 ${n}대 ${ac === null ? '' : `+ 에어컨(${ac ? '제습' : '급냉'}${st ? ` ★${st}` : ''})`}`.padEnd(30), '태풍', String(advance(id, 0, n, ac, st)).padStart(5), '  냉풍', String(advance(id, 1, n, ac, st)).padStart(5));
  }
}
