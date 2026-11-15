// 몬스터 도감: 보여 줄 순서와 처음 나오는 웨이브. 설명 문구는 strings.ko.ts의 STR.enemies
import type { EnemyId } from './core/types';
import { WAVES } from './data/waves';

/** 도감 순서 (대략 처음 나오는 순서, 보스는 마지막) */
export const BESTIARY: EnemyId[] = [
  'goo', 'rat', 'grease', 'roach', 'splitter', 'splitling', 'ghost', 'shield', 'healer', 'charger', 'sixseven', 'dancer', 'boss',
];

/** 정해진 웨이브(1~20) 중 처음 나오는 웨이브. 작은 방울은 분열 슬라임이 갈라져서 나온다. 없으면 null(무한 모드에서만) */
export function firstWave(id: EnemyId): number | null {
  const find = (target: EnemyId) => {
    const i = WAVES.findIndex((w) => w.groups.some((g) => g.enemy === target));
    return i < 0 ? null : i + 1;
  };
  return id === 'splitling' ? find('splitter') : find(id);
}
