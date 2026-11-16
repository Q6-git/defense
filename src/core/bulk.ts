import type { Game } from './game';
import type { Unit } from './types';

export interface BulkStep {
  unit: Unit;
  cost: number;
  star: boolean;
}

/**
 * '모두' 업그레이드에 함께 올라가는 가전: 고른 가전과 종류도 갈래도 같은 것.
 * 갈래를 아직 안 고른 가전(Lv1~3)끼리, 같은 갈래를 고른 가전끼리 한 묶음이다.
 */
export function bulkGroup(sim: Game, selected: Unit): Unit[] {
  return sim.units.filter((u) => u.def.id === selected.def.id && u.branch === selected.branch);
}

/**
 * '모두' 업그레이드의 다음 한 걸음. 묶음 안에서 가장 싼 것부터 올린다.
 *  - 갈래 전 묶음: 기본 레벨을 Lv3까지. 갈림길은 대신 골라 주지 않는다 (가전마다 직접 고른다)
 *  - 같은 갈래 묶음: ★강화
 * 올릴 것이 없거나 돈이 모자라면 null
 */
export function nextBulkStep(sim: Game, selected: Unit): BulkStep | null {
  let pick: BulkStep | null = null;
  for (const u of bulkGroup(sim, selected)) {
    const opts = sim.upgradeOptions(u);
    // 갈림길(선택지 2개)과 최대 레벨(0개)은 건너뛴다
    if (opts.length !== 1) continue;
    const step: BulkStep = { unit: u, cost: opts[0].cost, star: !!opts[0].star };
    if (!pick || step.cost < pick.cost || (step.cost === pick.cost && u.uid < pick.unit.uid)) pick = step;
  }
  return pick && pick.cost <= sim.money ? pick : null;
}
