// 판 밖 성장: 부품(🔩)으로 올리는 연구와 가전 강화(숙련도). 엔진·화면에 의존하지 않는 순수 로직이다.
import type { Progress } from './achievements';
import { MASTERY, type GameConfig } from './core/game';
import type { AbilityId, UnitId } from './core/types';

/**
 * 판 밖 성장(연구·숙련도) 스위치. 무한 모드 랭킹 판에도 그대로 적용된다 (부품을 모아 키우는 동기).
 * false로 끄면 연구·숙련도 화면이 안 보이고, 저장된 값이 있어도 판에 반영되지 않으며, 뽑기 중복은 부품으로 환급된다.
 */
export const META = { enabled: true };

/**
 * 가전 강화 확률표: [성공 확률, 한 번 시도하는 부품]. n번째 칸이 +n으로 올라갈 때의 값이다.
 * 높은 단계는 확률이 낮고 시도 값은 싸서, 여러 번 두드리는 맛이 있다. 가전 하나 +10까지 평균 부품 약 2,200
 */
export const ENHANCE: readonly { chance: number; cost: number }[] = [
  { chance: 1, cost: 30 }, { chance: 1, cost: 30 }, { chance: 0.8, cost: 40 }, { chance: 0.65, cost: 50 }, { chance: 0.5, cost: 60 },
  { chance: 0.35, cost: 70 }, { chance: 0.22, cost: 80 }, { chance: 0.12, cost: 80 }, { chance: 0.06, cost: 80 }, { chance: 0.03, cost: 80 },
];
/** 실패할 때마다 다음 성공 확률에 더해지는 값. 성공하면 처음으로 돌아간다 (운이 나빠도 언젠가는 붙는다) */
export const ENHANCE_PITY = 0.03;
/** 성공했을 때 대성공(+2단계)이 될 확률 */
export const ENHANCE_GREAT = 0.1;

export function masteryLevel(p: Progress, unit: string): number {
  return Math.min(MASTERY.max, Math.max(0, p.mastery[unit] ?? 0));
}

/** 다음 강화의 비용. 최대 단계면 null */
export function enhanceCost(p: Progress, unit: string): number | null {
  return ENHANCE[masteryLevel(p, unit)]?.cost ?? null;
}

/** 다음 강화의 성공 확률 (실패 보정 포함). 최대 단계면 0 */
export function enhanceChance(p: Progress, unit: string): number {
  const step = ENHANCE[masteryLevel(p, unit)];
  return step ? Math.min(1, step.chance + ENHANCE_PITY * (p.masteryFail[unit] ?? 0)) : 0;
}

export interface EnhanceResult {
  result: 'success' | 'great' | 'fail';
  /** 시도한 뒤의 단계 */
  level: number;
  /** 오른 단계 수 (실패면 0, 대성공이면 2) */
  gained: number;
}

/**
 * 강화를 한 번 시도한다. 부품이 모자라거나 최대 단계면 null (아무것도 바뀌지 않는다).
 * 실패해도 단계는 내려가지 않고 부품만 쓰이며, 다음 확률이 오른다.
 */
export function enhance(p: Progress, unit: string, rng: () => number = Math.random): EnhanceResult | null {
  const cost = enhanceCost(p, unit);
  if (cost === null || p.parts < cost) return null;
  const level = masteryLevel(p, unit);
  const chance = enhanceChance(p, unit);
  p.parts -= cost;
  if (rng() >= chance) {
    p.masteryFail[unit] = (p.masteryFail[unit] ?? 0) + 1;
    return { result: 'fail', level, gained: 0 };
  }
  // 대성공은 두 단계가 남아 있을 때만
  const gained = level + 2 <= MASTERY.max && rng() < ENHANCE_GREAT ? 2 : 1;
  p.mastery[unit] = level + gained;
  p.masteryFail[unit] = 0;
  return { result: gained === 2 ? 'great' : 'success', level: level + gained, gained };
}

/** 강화 단계에 따른 테두리 등급: 0 없음, 1 은(+5), 2 금(+8), 3 무지개(+10) */
export function masteryTier(level: number): 0 | 1 | 2 | 3 {
  return level >= MASTERY.max ? 3 : level >= 8 ? 2 : level >= 5 ? 1 : 0;
}

export type ResearchId = 'allowance' | 'outlet' | 'plunger' | 'overload' | 'resale' | 'reroll' | 'choice';

export interface ResearchDef {
  id: ResearchId;
  emoji: string;
  /** 레벨별 비용 (길이가 최대 레벨) */
  costs: number[];
  /** 레벨당 효과 크기 (설명 문구와 applyMeta가 함께 쓴다) */
  step: number;
}

/** 카드 다시 뽑기 기본 비용 (💰) */
export const REROLL_COST = 60;

export const RESEARCH: ResearchDef[] = [
  { id: 'allowance', emoji: '💰', costs: [60, 120, 200, 300], step: 25 }, // 시작 자금 +25
  { id: 'outlet', emoji: '🔌', costs: [60, 120, 200, 300], step: 0.05 }, // 기지 HP +5%
  { id: 'plunger', emoji: '🪠', costs: [80, 160, 260], step: 0.05 }, // 뚫어뻥 대기시간 -5%
  { id: 'overload', emoji: '⚡', costs: [80, 160, 260], step: 0.05 }, // 과부하 대기시간 -5%
  { id: 'resale', emoji: '♻️', costs: [100, 200], step: 0.05 }, // 판매 환불 +5%p
  { id: 'reroll', emoji: '🎲', costs: [100, 200], step: 20 }, // 카드 다시 뽑기 비용 -20
  { id: 'choice', emoji: '🃏', costs: [600], step: 1 }, // 카드 선택지 +1장
];

export function researchLevel(p: Progress, id: ResearchId): number {
  const def = RESEARCH.find((r) => r.id === id);
  return Math.min(def?.costs.length ?? 0, Math.max(0, p.research[id] ?? 0));
}

/** 다음 연구 레벨의 비용. 최대 레벨이면 null */
export function researchCost(p: Progress, id: ResearchId): number | null {
  return RESEARCH.find((r) => r.id === id)?.costs[researchLevel(p, id)] ?? null;
}

export function buyResearch(p: Progress, id: ResearchId): boolean {
  const cost = researchCost(p, id);
  if (cost === null || p.parts < cost) return false;
  p.parts -= cost;
  p.research[id] = researchLevel(p, id) + 1;
  return true;
}

/** 연구·숙련도·덱을 한 판의 설정에 반영한다 */
export function applyMeta(cfg: GameConfig, p: Progress, deck: UnitId[]): GameConfig {
  // 꺼져 있으면 덱(카드 후보)과 다시 뽑기 비용만 정한다
  if (!META.enabled) return { ...cfg, deck, cardRerollCost: REROLL_COST };
  const lv = (id: ResearchId) => researchLevel(p, id);
  const step = (id: ResearchId) => RESEARCH.find((r) => r.id === id)!.step * lv(id);
  const abilities = { ...cfg.abilities };
  for (const id of ['plunger', 'overload'] as AbilityId[]) {
    abilities[id] = { ...abilities[id], cooldown: abilities[id].cooldown * (1 - step(id)) };
  }
  const mastery: Partial<Record<UnitId, number>> = {};
  for (const id of Object.keys(cfg.units) as UnitId[]) mastery[id] = masteryLevel(p, id);
  return {
    ...cfg,
    abilities,
    deck,
    mastery,
    startMoney: cfg.startMoney + step('allowance'),
    startHp: Math.round(cfg.startHp * (1 + step('outlet'))),
    sellRate: cfg.sellRate + step('resale'),
    cardChoices: (cfg.cardChoices ?? 3) + step('choice'),
    cardRerollCost: REROLL_COST - step('reroll'),
  };
}
