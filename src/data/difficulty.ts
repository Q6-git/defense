import type { DifficultyId } from '../core/types';

export interface DifficultyDef {
  id: DifficultyId;
  /** 적 체력 배율 */
  hpMul: number;
  /** 적 이동 속도 배율 */
  speedMul: number;
  /** 처치 보상 배율 */
  rewardMul: number;
  startMoney: number;
  startHp: number;
}

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard', 'hell'];

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  easy: { id: 'easy', hpMul: 0.7, speedMul: 0.9, rewardMul: 1.1, startMoney: 500, startHp: 1000 },
  normal: { id: 'normal', hpMul: 1, speedMul: 1, rewardMul: 0.9, startMoney: 350, startHp: 500 },
  hard: { id: 'hard', hpMul: 1.1, speedMul: 1.05, rewardMul: 0.9, startMoney: 350, startHp: 300 },
  hell: { id: 'hell', hpMul: 1.25, speedMul: 1.1, rewardMul: 0.85, startMoney: 350, startHp: 150 },
};
