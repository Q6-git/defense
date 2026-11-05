// 밸런스 확인용 헤드리스 시뮬레이션. 실행: npx vite-node scripts/balance.ts
// 봇 두 종류로 20웨이브를 돌려 어디까지 버티는지 본다.
//  - naive: 토스터만 깔고 업그레이드 (처음 하는 사람)
//  - smart: 세탁기 + 감속 + 범위 + 버프를 섞어 쓰는 사람
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import type { UnitId } from '../src/core/types';

type Step = { unit: UnitId; x: number; y: number } | { upgradeAll: UnitId };

const NAIVE_SPOTS = [
  [520, 240], [780, 240], [250, 430], [600, 430], [780, 590], [360, 240], [420, 430], [940, 240],
  [250, 620], [500, 620], [680, 240], [960, 560],
];
const naive: Step[] = [];
for (const [x, y] of NAIVE_SPOTS) naive.push({ unit: 'toaster', x, y });
for (let i = 0; i < 3; i++) naive.push({ upgradeAll: 'toaster' });

const smart: Step[] = [
  { unit: 'toaster', x: 520, y: 240 },
  { unit: 'toaster', x: 780, y: 240 },
  { unit: 'washer', x: 60, y: 240 },
  { unit: 'fan', x: 780, y: 590 },
  { unit: 'microwave', x: 600, y: 430 },
  { unit: 'washer', x: 60, y: 420 },
  { unit: 'vacuum', x: 250, y: 430 },
  { unit: 'washer', x: 60, y: 620 },
  { upgradeAll: 'washer' },
  { unit: 'microwave', x: 360, y: 240 },
  { unit: 'wifi', x: 440, y: 430 },
  { upgradeAll: 'microwave' },
  { unit: 'vacuum', x: 920, y: 240 },
  { upgradeAll: 'washer' },
  { upgradeAll: 'toaster' },
  { upgradeAll: 'vacuum' },
  { upgradeAll: 'fan' },
  { unit: 'fan', x: 250, y: 620 },
  { unit: 'microwave', x: 600, y: 620 },
  { upgradeAll: 'microwave' },
  { upgradeAll: 'wifi' },
  { upgradeAll: 'toaster' },
  { upgradeAll: 'vacuum' },
  { upgradeAll: 'wifi' },
  { unit: 'microwave', x: 900, y: 450 },
  { upgradeAll: 'microwave' },
  { upgradeAll: 'microwave' },
  { unit: 'toaster', x: 680, y: 240 },
  { upgradeAll: 'toaster' },
  { upgradeAll: 'toaster' },
];

/** 계획이 끝난 뒤 남는 돈은 경로 근처 빈칸에 유닛을 깔고 업그레이드하는 데 쓴다 */
function spendGreedy(g: Game): void {
  for (const u of g.units) {
    const c = g.upgradeCost(u);
    if (c !== null && g.money >= c) g.apply({ type: 'upgrade', uid: u.uid });
  }
  const pick: UnitId = g.units.filter((u) => u.def.id === 'microwave').length > g.units.filter((u) => u.def.id === 'toaster').length ? 'toaster' : 'microwave';
  if (g.money < g.cfg.units[pick].levels[0].cost * 2) return;
  for (let y = 80; y < 720; y += 30) {
    for (let x = 30; x < 1020; x += 30) {
      const d = g.path.distanceTo({ x, y });
      if (d < 70 && g.canPlace(pick, x, y) === null) {
        g.apply({ type: 'place', unit: pick, x, y });
        return;
      }
    }
  }
}

const VERBOSE = process.argv.includes('-v');

function run(plan: Step[], callEarly: boolean, spendRest = false): { wave: number; hp: number; won: boolean } {
  const g = new Game(defaultConfig());
  let lastWave = 0;
  let i = 0;
  const tryBuild = () => {
    while (i < plan.length) {
      const s = plan[i];
      if ('unit' in s) {
        const r = g.apply({ type: 'place', unit: s.unit, x: s.x, y: s.y });
        if (!r.ok) {
          if (r.reason === 'money') return;
          throw new Error(`설치 실패 ${s.unit} ${s.x},${s.y}: ${r.reason}`);
        }
      } else {
        const targets = g.units.filter((u) => u.def.id === s.upgradeAll && g.upgradeCost(u) !== null);
        const lowest = Math.min(...targets.map((u) => u.level));
        const u = targets.find((t) => t.level === lowest);
        if (u) {
          if (!g.apply({ type: 'upgrade', uid: u.uid }).ok) return;
          continue; // 같은 단계에서 남은 유닛도 업그레이드
        }
      }
      i++;
    }
    if (spendRest) spendGreedy(g);
  };
  g.apply({ type: 'startWave' });
  for (let t = 0; t < 3600 && !g.finished; t += 0.1) {
    tryBuild();
    if (callEarly && g.phase === 'intermission' && g.timer < 12) g.apply({ type: 'startWave' });
    g.update(0.1);
    if (VERBOSE && g.wave !== lastWave) {
      lastWave = g.wave;
      const dps = g.units.length;
      console.log(`  w${g.wave} 시작: HP ${g.hp} 돈 ${g.money} 유닛 ${dps}개 (${g.units.map((u) => u.def.id[0] + (u.level + 1)).join(' ')})`);
    }
  }
  return { wave: g.wave, hp: g.hp, won: g.phase === 'won' };
}

const cases = [
  ['naive', naive, false],
  ['smart', smart, false],
  ['smart+', smart, true],
] as const;
for (const [name, plan, rest] of cases) {
  for (const early of [false, true]) {
    const r = run(plan, early, rest);
    console.log(`${name.padEnd(7)} 조기호출=${early ? 'O' : 'X'}  → 웨이브 ${r.wave}  HP ${r.hp}  ${r.won ? '승리' : '패배'}`);
  }
}
