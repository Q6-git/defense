import type { UnitId } from './types';

export type CardRarity = 'common' | 'rare' | 'legend';

/**
 * 카드로 바뀌는 수치 모음. 곱하는 값은 1, 더하는 값은 0이 기본이다.
 * 게임 로직은 원래 수치에 이 값을 적용해서 쓴다.
 */
export interface Mods {
  /** 유닛별 공격력 배율 */
  damage: Record<UnitId, number>;
  allDamage: number;
  allRange: number;
  fanRange: number;
  splash: number;
  vacuumSpeed: number;
  /** 와이파이 버프에 더해지는 값 (0.1 = +10%p) */
  wifiBuff: number;
  reward: number;
  placeCost: number;
  upgradeCost: number;
  /** Lv4 갈림길 비용 배율 (upgradeCost와 함께 적용) */
  branchCost: number;
  plungerCooldown: number;
  overloadCooldown: number;
  plungerDamage: number;
  plungerRadius: number;
  /** 과부하 지속 시간에 더해지는 초 */
  overloadDuration: number;
  /** 크리티컬 확률에 더해지는 값 */
  critChance: number;
  critChanceMul: number;
  /** 크리티컬 배율에 더해지는 값 */
  critDamage: number;
  /** 판매 환불 비율 (기본 비율보다 크면 이 값을 쓴다) */
  sellRate: number;
  waveBonus: number;
  enemySpeed: number;
  washerMax: number;
  /** 적이 죽을 때 주변에 주는 피해 (그 적 최대 체력 대비 비율) */
  chain: number;
  /** 웨이브마다 처음 기지에 닿는 적(보스 제외) 1마리를 무효로 한다 */
  breaker: boolean;
}

export function baseMods(): Mods {
  return {
    damage: {
      toaster: 1, fan: 1, microwave: 1, vacuum: 1, wifi: 1, washer: 1,
      stove: 1, strip: 1, battery: 1, iron: 1, aircon: 1, dishwasher: 1,
    },
    allDamage: 1, allRange: 1, fanRange: 1, splash: 1, vacuumSpeed: 1, wifiBuff: 0,
    reward: 1, placeCost: 1, upgradeCost: 1, branchCost: 1,
    plungerCooldown: 1, overloadCooldown: 1, plungerDamage: 1, plungerRadius: 1, overloadDuration: 0,
    critChance: 0, critChanceMul: 1, critDamage: 0, sellRate: 0, waveBonus: 1, enemySpeed: 1,
    washerMax: 0, chain: 0, breaker: false,
  };
}

export interface CardDef {
  id: string;
  emoji: string;
  rarity: CardRarity;
  /** 좋은 효과와 나쁜 효과가 함께 있는 카드 */
  risk?: boolean;
  /** 한 판에 고를 수 있는 최대 횟수 */
  max: number;
  /** 고르는 즉시 받는 돈 */
  money?: number;
  /** 고르는 즉시 바뀌는 기지 HP (음수면 깎임. 현재 HP가 이보다 많아야 고를 수 있다) */
  hp?: number;
  /** 고를 때마다 한 번씩 적용된다 */
  apply?: (m: Mods) => void;
}
