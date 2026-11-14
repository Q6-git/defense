// 가전 비교 벤치마크. 실행: npx vite-node scripts/units.ts  (--lv3: Lv3만)
// 같은 자리에 한 대를 두고 세 상황에서 적 체력의 몇 %를 깎는지 잰 뒤, 1000💰당 효율로 비교한다.
//  - 떼거리: 약한 적 40마리가 0.25초 간격으로 몰려온다
//  - 강적:   방어력 8짜리 튼튼한 적 4마리
//  - 보스:   방어력 12짜리 보스 한 마리
// 지원형(와이파이·보조배터리·에어컨·선풍기)은 토스터 Lv3 두 대 옆에 두고, 토스터만 있을 때보다 늘어난 몫을 잰다.
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import type { EnemyId, UnitId } from '../src/core/types';
import { GACHA_UNITS, UNIT_ORDER } from '../src/data/units';

type Branch = 0 | 1 | undefined;
const SUPPORT: UnitId[] = ['wifi', 'battery', 'aircon', 'fan'];
const SCENARIOS: { name: string; enemy: EnemyId; count: number; gap: number; hpScale: number }[] = [
  { name: '떼거리', enemy: 'goo', count: 40, gap: 0.25, hpScale: 30 },
  { name: '강적', enemy: 'roach', count: 4, gap: 2.5, hpScale: 45 },
  { name: '보스', enemy: 'boss', count: 1, gap: 0, hpScale: 6 },
];

/** unit을 Lv3(또는 Lv4 갈래)로 두고 적 체력의 몇 %를 깎았는지. unit이 null이면 지원형 비교용 토스터만 */
function run(unit: UnitId | null, br: Branch, sc: (typeof SCENARIOS)[number]): number {
  const g = new Game({ ...defaultConfig('normal'), seed: 7, startMoney: 1e6, startHp: 1e9, critChance: 0, cards: [], waveMods: [] });
  const support = unit === null || SUPPORT.includes(unit);
  const setup: [UnitId, number, number][] = support ? [['toaster', 460, 240], ['toaster', 640, 240]] : [];
  if (unit) setup.push([unit, 560, unit === 'vacuum' || unit === 'stove' ? 205 : 240]);
  for (const [id, x, y] of setup) {
    if (!g.apply({ type: 'place', unit: id, x, y }).ok) throw new Error(`설치 실패 ${id}`);
    const u = g.units[g.units.length - 1];
    g.apply({ type: 'upgrade', uid: u.uid });
    g.apply({ type: 'upgrade', uid: u.uid });
    if (id === unit && br !== undefined) g.apply({ type: 'upgrade', uid: u.uid, branch: br });
  }
  g.apply({ type: 'startWave' });
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  let total = 0, spawned = 0, leaked = 0, next = 0;
  for (let t = 0; t < 300 && (spawned < sc.count || g.enemies.length); t += 0.05) {
    if (spawned < sc.count && t >= next) {
      const e = g.spawnEnemy(sc.enemy, 0);
      e.hp = e.maxHp = Math.round(e.maxHp * sc.hpScale);
      total += e.hp;
      spawned++;
      next += sc.gap;
    }
    g.update(0.05);
    for (const ev of g.drainEvents()) if (ev.type === 'leak') leaked += ev.damage;
    if (g.phase !== 'wave') break;
  }
  return (100 * (total - Math.min(total, leaked))) / total;
}

const G = new Game(defaultConfig());
const cost = (id: UnitId, br: Branch) => G.cfg.units[id].levels.reduce((a, l) => a + l.cost, 0) + (br !== undefined ? G.cfg.units[id].branches![br].cost : 0);
const baseline = SCENARIOS.map((sc) => run(null, undefined, sc));

const rows: [UnitId, Branch][] = [];
for (const id of [...UNIT_ORDER, ...GACHA_UNITS]) {
  if (id === 'washer') continue;
  rows.push([id, undefined]);
  if (!process.argv.includes('--lv3')) for (const b of [0, 1] as const) if (G.cfg.units[id].branches) rows.push([id, b]);
}
const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log('가전'.padEnd(20), pad('비용', 5), ...SCENARIOS.map((s) => pad(s.name, 6)), '  |', ...SCENARIOS.map((s) => pad(s.name, 6)), ' (1000💰당)');
for (const [id, br] of rows) {
  const c = cost(id, br);
  const support = SUPPORT.includes(id);
  const pct = SCENARIOS.map((sc, i) => run(id, br, sc) - (support ? baseline[i] : 0));
  const name = (support ? '+' : '') + id + (br !== undefined ? '/' + G.cfg.units[id].branches![br].id : '');
  console.log(name.padEnd(20), pad(c, 5), ...pct.map((p) => pad(`${Math.round(p)}%`, 6)), '  |', ...pct.map((p) => pad((p * 1000 / c).toFixed(1), 6)));
}
console.log(`(지원형 기준: 토스터 Lv3 두 대만 → ${baseline.map((b) => `${Math.round(b)}%`).join(' / ')})`);
