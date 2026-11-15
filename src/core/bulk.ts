import type { Game } from './game';
import type { Unit, UnitId } from './types';

export interface BulkStep {
  unit: Unit;
  branch?: 0 | 1;
  cost: number;
  star: boolean;
}

/**
 * '모두' 업그레이드의 다음 한 걸음. 같은 종류 가전을 이 순서로 올린다.
 *  1) 기본 레벨(Lv3까지) — 가장 싼 것부터
 *  2) 모두 Lv3이면 갈림길 — 이미 고른 갈래(branch)로
 *  3) 그다음 ★강화 — 가장 싼 것부터
 * 앞 순위에 남은 일이 있으면 돈이 모자라도 뒤 순위로 넘어가지 않는다 (null).
 */
export function nextBulkStep(sim: Game, id: UnitId, branch: 0 | 1 | null): BulkStep | null {
  const same = sim.units.filter((u) => u.def.id === id);
  const tiers: BulkStep[][] = [[], [], []];
  for (const u of same) {
    const opts = sim.upgradeOptions(u);
    if (!opts.length) continue;
    if (opts.length === 2) {
      if (branch === null) continue;
      tiers[1].push({ unit: u, branch, cost: opts[branch].cost, star: false });
    } else if (opts[0].star) tiers[2].push({ unit: u, cost: opts[0].cost, star: true });
    else tiers[0].push({ unit: u, cost: opts[0].cost, star: false });
  }
  const tier = tiers.find((t) => t.length > 0);
  if (!tier) return null;
  const pick = tier.sort((a, b) => a.cost - b.cost || a.unit.uid - b.unit.uid)[0];
  return pick.cost <= sim.money ? pick : null;
}

/** 갈림길에서 고를 갈래: 고른 가전의 갈래, 없으면 같은 종류에서 가장 많이 고른 갈래 */
export function bulkBranch(sim: Game, u: Unit): 0 | 1 | null {
  if (u.branch !== null) return u.branch;
  const n = [0, 0];
  for (const x of sim.units) if (x.def.id === u.def.id && x.branch !== null) n[x.branch]++;
  if (n[0] + n[1] === 0) return null;
  return n[1] > n[0] ? 1 : 0;
}
