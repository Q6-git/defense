// 판 밖 성장: 부품(🔩)으로 올리는 연구와 가전 숙련도. 엔진·화면에 의존하지 않는 순수 로직이다.
import type { Progress } from './achievements';
import { MASTERY, type GameConfig } from './core/game';
import type { AbilityId, UnitId } from './core/types';

/**
 * 판 밖 성장(연구·숙련도) 스위치. 지금은 꺼 둔다: 올린 상태의 난이도와 랭킹 영향을 확인한 뒤에 연다.
 * 꺼져 있으면 연구·숙련도 화면이 안 보이고, 저장된 값이 있어도 판에 반영되지 않으며, 뽑기 중복은 부품으로 환급된다.
 * 켜려면 enabled를 true로.
 */
export const META = { enabled: false };

/** 숙련도 레벨별 비용 (1레벨부터). 뽑기에서 중복이 나와도 한 레벨 오른다 */
export const MASTERY_COSTS = [40, 70, 110, 160, 220];

export function masteryLevel(p: Progress, unit: string): number {
  return Math.min(MASTERY.max, Math.max(0, p.mastery[unit] ?? 0));
}

/** 다음 숙련도 레벨의 비용. 최대 레벨이면 null */
export function masteryCost(p: Progress, unit: string): number | null {
  return MASTERY_COSTS[masteryLevel(p, unit)] ?? null;
}

/** 부품으로 숙련도를 한 레벨 올린다. 부품이 모자라거나 최대 레벨이면 false */
export function buyMastery(p: Progress, unit: string): boolean {
  const cost = masteryCost(p, unit);
  if (cost === null || p.parts < cost) return false;
  p.parts -= cost;
  p.mastery[unit] = masteryLevel(p, unit) + 1;
  return true;
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
