import type { AbilityDef, AbilityId } from '../core/types';

export const ABILITY_ORDER: AbilityId[] = ['plunger', 'overload'];

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  /** 누른 곳을 내려쳐 범위 피해 + 기절 */
  plunger: { id: 'plunger', emoji: '🪠', cooldown: 20, radius: 90, damage: 60, damagePerWave: 30, stun: 1.6 },
  /** 모든 가전 공격 속도 2배 */
  overload: { id: 'overload', emoji: '⚡', cooldown: 40, duration: 6, speedMul: 2 },
};
