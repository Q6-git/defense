// 무작위 조작 점검: 강화·연구·덱을 무작위로 정한 판 120개를 무작위 조작(설치·업그레이드·갈림길 '모두'·판매·카드·스킬)으로 끝까지 돌려
// 예외나 이상값(NaN, 음수 돈)이 없는지 본다. 실행: npx vite-node scripts/fuzz.ts
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import { forkAll, nextBulkStep } from '../src/core/bulk';
import type { DifficultyId, UnitId } from '../src/core/types';
import { MAP_ORDER, type MapId } from '../src/data/map';
import { GACHA_UNITS, UNIT_ORDER } from '../src/data/units';
import { applyMeta, RESEARCH } from '../src/meta';
import { emptyProgress } from '../src/achievements';
import { makeRng } from '../src/core/rng';

const ALL: UnitId[] = [...UNIT_ORDER, ...GACHA_UNITS];
let runs = 0, problems = 0, maxWave = 0;
for (let seed = 1; seed <= 120; seed++) {
  const r = makeRng(seed * 31);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const p = emptyProgress();
  for (const u of ALL) p.mastery[u] = Math.floor(r() * 11);
  for (const x of RESEARCH) p.research[x.id] = Math.floor(r() * (x.costs.length + 1));
  const deck = [...ALL].sort(() => r() - 0.5).slice(0, 6);
  const diff = pick(['easy', 'normal', 'hard', 'hell'] as DifficultyId[]);
  const map = pick(MAP_ORDER) as MapId;
  const g = new Game({ ...applyMeta(defaultConfig(diff, seed % 3 === 0, map), p, deck), seed });
  g.money += 3000;
  const { area } = g.cfg.map;
  try {
    for (let t = 0; t < 4000 && !g.finished; t++) {
      const roll = r();
      if (g.offer) {
        const c = r();
        g.apply(c < 0.2 ? { type: 'rerollCards' } : c < 0.3 ? { type: 'skipCard' } : { type: 'pickCard', index: Math.floor(r() * g.offer.length) });
      } else if (roll < 0.15) {
        g.apply({ type: 'place', unit: pick(deck), x: area.x + r() * area.w, y: area.y + r() * area.h });
      } else if (roll < 0.3 && g.units.length) {
        const u = pick(g.units);
        const opts = g.upgradeOptions(u);
        if (opts.length === 2 && r() < 0.5) forkAll(g, u, r() < 0.5 ? 0 : 1);
        else g.apply({ type: 'upgrade', uid: u.uid, branch: r() < 0.5 ? 0 : 1 });
      } else if (roll < 0.33 && g.units.length) {
        const u = pick(g.units);
        for (let i = 0; i < 20; i++) { const s = nextBulkStep(g, u); if (!s) break; g.apply({ type: 'upgrade', uid: s.unit.uid }); }
      } else if (roll < 0.35 && g.units.length) {
        g.apply({ type: 'sell', uid: pick(g.units).uid });
      } else if (roll < 0.4) {
        g.apply({ type: 'ability', id: r() < 0.5 ? 'plunger' : 'overload', x: area.x + r() * area.w, y: area.y + r() * area.h });
      } else if (roll < 0.45) {
        g.apply({ type: 'startWave' });
      }
      if (g.phase === 'won' && g.cfg.extraWave && seed % 2) g.apply({ type: 'continueEndless' });
      g.update(0.25);
      const bad = !Number.isFinite(g.money) || g.money < 0 || !Number.isFinite(g.hp) || g.enemies.some((e) => !Number.isFinite(e.hp) || !Number.isFinite(e.x)) || g.units.some((u) => !Number.isFinite(g.stats(u).damage));
      if (bad) { problems++; console.log('이상값', { seed, diff, map, wave: g.wave, money: g.money, hp: g.hp }); break; }
    }
  } catch (e) {
    problems++;
    console.log('예외', { seed, diff, map, wave: g.wave }, (e as Error).stack?.split('\n').slice(0, 4).join(' | '));
  }
  runs++;
  maxWave = Math.max(maxWave, g.wave);
}
console.log(`판 ${runs}개, 문제 ${problems}개, 가장 멀리 간 웨이브 ${maxWave}`);
