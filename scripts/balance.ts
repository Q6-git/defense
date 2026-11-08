// 밸런스 확인용 헤드리스 시뮬레이션. 실행: npx vite-node scripts/balance.ts
// 봇 두 종류로 20웨이브를 돌려 어디까지 버티는지 본다.
//  - naive: 토스터만 깔고 업그레이드 (처음 하는 사람)
//  - smart: 세탁기 + 감속 + 범위 + 버프를 섞어 쓰는 사람
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import type { DifficultyId, UnitId } from '../src/core/types';
import { DIFFICULTY_ORDER } from '../src/data/difficulty';

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
  { unit: 'toaster', x: 680, y: 240 },
  { unit: 'microwave', x: 600, y: 430 },
  { unit: 'vacuum', x: 250, y: 430 },
  { unit: 'washer', x: 60, y: 240 },
  { upgradeAll: 'toaster' },
  { unit: 'fan', x: 780, y: 590 },
  { unit: 'washer', x: 60, y: 420 },
  { unit: 'microwave', x: 360, y: 240 },
  { unit: 'washer', x: 60, y: 620 },
  { unit: 'wifi', x: 440, y: 430 },
  { upgradeAll: 'microwave' },
  { upgradeAll: 'washer' },
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
  { upgradeAll: 'toaster' },
  { upgradeAll: 'toaster' },
];

/** Lv4 갈림길 선택 규칙. 없으면 갈림길을 찍지 않는다 */
type BranchPick = ((id: UnitId) => 0 | 1) | null;

/** 계획이 끝난 뒤 남는 돈은 업그레이드, 갈림길, 경로 근처 빈칸 설치에 쓴다 */
function spendGreedy(g: Game, pickBranch: BranchPick): void {
  for (const u of g.units) {
    const opts = g.upgradeOptions(u);
    if (opts.length === 1 && g.money >= opts[0].cost) g.apply({ type: 'upgrade', uid: u.uid });
    if (opts.length === 2 && pickBranch) {
      const b = pickBranch(u.def.id);
      if (g.money >= opts[b].cost) g.apply({ type: 'upgrade', uid: u.uid, branch: b });
    }
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

function run(
  diff: DifficultyId, plan: Step[], callEarly: boolean, spendRest = false, useSkills = false, pickBranch: BranchPick = null,
): { wave: number; hp: number; won: boolean } {
  const g = new Game({ ...defaultConfig(diff), seed: 42 });
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
        const targets = g.units.filter((u) => u.def.id === s.upgradeAll && g.upgradeOptions(u)[0]?.branch === null);
        const lowest = Math.min(...targets.map((u) => u.level));
        const u = targets.find((t) => t.level === lowest);
        if (u) {
          if (!g.apply({ type: 'upgrade', uid: u.uid }).ok) return;
          continue; // 같은 단계에서 남은 유닛도 업그레이드
        }
      }
      i++;
    }
    if (spendRest) spendGreedy(g, pickBranch);
  };
  g.apply({ type: 'startWave' });
  for (let t = 0; t < 3600 && !g.finished; t += 0.1) {
    tryBuild();
    if (useSkills && g.phase === 'wave' && g.enemies.length) {
      // 가장 앞선 적을 뚫어뻥으로 내려치고, 적이 많으면 과부하
      const lead = g.enemies.reduce((a, b) => (b.dist > a.dist ? b : a));
      if (g.cooldowns.plunger <= 0 && lead.dist > g.path.length * 0.6) g.apply({ type: 'ability', id: 'plunger', x: lead.x, y: lead.y });
      if (g.cooldowns.overload <= 0 && (g.enemies.length > 8 || g.enemies.some((e) => e.def.boss))) g.apply({ type: 'ability', id: 'overload' });
    }
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
  ['naive', naive, false, false],
  ['naive+스킬', naive, false, true],
  ['smart', smart, false, false],
  ['smart+', smart, true, false],
  ['smart+스킬', smart, true, true],
] as const;
const only = process.argv.find((a) => (DIFFICULTY_ORDER as string[]).includes(a)) as DifficultyId | undefined;
for (const diff of process.argv.includes('--branches') ? [] : only ? [only] : DIFFICULTY_ORDER) {
  console.log(`[${diff}]`);
  for (const [name, plan, rest, skills] of cases) {
    const r = run(diff, plan, true, rest, skills);
    console.log(`  ${name.padEnd(10)} → 웨이브 ${String(r.wave).padStart(2)}  HP ${String(r.hp).padStart(4)}  ${r.won ? '승리' : '패배'}`);
  }
}

// 갈림길 비교: 모두 A / 모두 B / 한 유닛만 반대로. 한쪽만 압도적으로 좋으면 고민이 사라지므로 비슷해야 한다.
if (process.argv.includes('--branches')) {
  const units: UnitId[] = ['toaster', 'fan', 'microwave', 'vacuum', 'wifi', 'washer'];
  const variants: [string, BranchPick][] = [
    ['갈림길 없음', null],
    ['모두 A', () => 0],
    ['모두 B', () => 1],
    ...units.map((id): [string, BranchPick] => [`${id}만 B`, (u) => (u === id ? 1 : 0)]),
  ];
  for (const diff of (only ? [only] : ['normal', 'hard', 'hell']) as DifficultyId[]) {
    console.log(`[갈림길 비교: ${diff}]`);
    for (const [name, pick] of variants) {
      const r = run(diff, smart, true, true, true, pick);
      console.log(`  ${name.padEnd(14)} → 웨이브 ${String(r.wave).padStart(2)}  HP ${String(r.hp).padStart(4)}  ${r.won ? '승리' : '패배'}`);
    }
  }
}
