import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../src/achievements';
import { defaultConfig } from '../src/config';
import { Game, MASTERY } from '../src/core/game';
import type { UnitId } from '../src/core/types';
import { UNIT_ORDER } from '../src/data/units';
import { applyMeta, buyMastery, buyResearch, masteryCost, MASTERY_COSTS, RESEARCH, researchCost, REROLL_COST } from '../src/meta';
import { STR } from '../src/strings.ko';

const game = (p = emptyProgress(), deck: UnitId[] = [...UNIT_ORDER]) =>
  new Game({ ...applyMeta(defaultConfig(), p, deck), seed: 1, startMoney: 1e6, critChance: 0, cards: [] });

describe('가전 숙련도', () => {
  it('부품으로 한 레벨씩 올리고, 부품이 모자라거나 최대 레벨이면 못 올린다', () => {
    const p = { ...emptyProgress(), parts: MASTERY_COSTS[0] - 1 };
    expect(buyMastery(p, 'toaster')).toBe(false);
    p.parts = 10000;
    for (let i = 0; i < MASTERY.max; i++) {
      expect(masteryCost(p, 'toaster')).toBe(MASTERY_COSTS[i]);
      expect(buyMastery(p, 'toaster')).toBe(true);
    }
    expect(p.mastery.toaster).toBe(MASTERY.max);
    expect(p.parts).toBe(10000 - MASTERY_COSTS.reduce((a, b) => a + b, 0));
    expect(masteryCost(p, 'toaster')).toBeNull();
    expect(buyMastery(p, 'toaster')).toBe(false);
    expect(MASTERY_COSTS.length).toBe(MASTERY.max);
  });

  it('공격형은 공격력·화상·수입이, 지원형은 버프·감속이 오른다 (다른 가전은 그대로)', () => {
    const p = { ...emptyProgress(), mastery: { toaster: 5, stove: 2, washer: 5, wifi: 5, aircon: 5 } };
    const g = game(p);
    const k = 1 + MASTERY.power * 5;
    const sk = 1 + MASTERY.support * 5;
    expect(g.levelStats('toaster', 0).damage).toBeCloseTo(12 * k);
    expect(g.levelStats('stove', 0).dot!.dps).toBeCloseTo(18 * (1 + MASTERY.power * 2));
    expect(g.levelStats('washer', 0).income).toBe(Math.round(40 * k));
    expect(g.levelStats('wifi', 0).buff).toBeCloseTo(0.15 * sk);
    expect(g.levelStats('aircon', 0).globalSlow).toBeCloseTo(0.2 * sk);
    expect(g.levelStats('microwave', 0).damage).toBe(30);
    // 사거리와 공격 속도는 그대로
    expect(g.levelStats('toaster', 0).range).toBe(150);
    expect(g.levelStats('toaster', 0).cooldown).toBe(0.7);
  });

  it('★강화와 곱해지고, 실제 피해에 반영된다', () => {
    const g = game({ ...emptyProgress(), mastery: { toaster: 5 } });
    expect(g.levelStats('toaster', 3, 1, 2).damage).toBeCloseTo(260 * 1.5 * 1.2);
    g.apply({ type: 'startWave' });
    g.enemies = [];
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const e = g.spawnEnemy('grease', 570);
    const hp = e.hp;
    g.update(1 / 60);
    expect(hp - e.hp).toBeCloseTo(12 * 1.2);
  });
});

describe('연구', () => {
  it('레벨마다 비용이 오르고 최대 레벨에서 멈춘다', () => {
    const p = { ...emptyProgress(), parts: 100000 };
    for (const r of RESEARCH) {
      for (const cost of r.costs) {
        expect(researchCost(p, r.id)).toBe(cost);
        expect(buyResearch(p, r.id)).toBe(true);
      }
      expect(researchCost(p, r.id)).toBeNull();
      expect(buyResearch(p, r.id)).toBe(false);
      expect(STR.research[r.id]?.name, r.id).toBeTruthy();
    }
    expect(buyResearch({ ...emptyProgress(), parts: 59 }, 'allowance')).toBe(false);
  });

  it('연구가 없으면 기본 설정 그대로 (다시 뽑기 비용만 정해진다)', () => {
    const base = defaultConfig();
    const cfg = applyMeta(base, emptyProgress(), [...UNIT_ORDER]);
    expect([cfg.startMoney, cfg.startHp, cfg.sellRate]).toEqual([base.startMoney, base.startHp, base.sellRate]);
    expect(cfg.abilities).toEqual(base.abilities);
    expect([cfg.cardChoices, cfg.cardRerollCost]).toEqual([3, REROLL_COST]);
  });

  it('모두 올리면 시작 자금, 기지 HP, 스킬 대기시간, 환불, 카드에 반영된다', () => {
    const p = { ...emptyProgress(), parts: 100000 };
    for (const r of RESEARCH) while (buyResearch(p, r.id));
    const base = defaultConfig();
    const cfg = applyMeta(base, p, ['toaster']);
    expect(cfg.startMoney).toBe(base.startMoney + 100);
    expect(cfg.startHp).toBe(Math.round(base.startHp * 1.2));
    expect(cfg.abilities.plunger.cooldown).toBeCloseTo(20 * 0.85);
    expect(cfg.abilities.overload.cooldown).toBeCloseTo(40 * 0.85);
    expect(cfg.sellRate).toBeCloseTo(0.7);
    expect([cfg.cardChoices, cfg.cardRerollCost]).toEqual([4, 20]);
    expect(cfg.deck).toEqual(['toaster']);
    // 4장 중에 고른다
    const g = new Game({ ...cfg, seed: 3 });
    g.wave = 2;
    g.phase = 'intermission';
    g.apply({ type: 'startWave' });
    g.update(0.05);
    g.enemies = [];
    (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    g.update(0.05);
    expect(g.offer?.length).toBe(4);
  });
});
