import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emptyProgress } from '../src/achievements';
import { defaultConfig } from '../src/config';
import { Game, MASTERY } from '../src/core/game';
import type { UnitId } from '../src/core/types';
import { UNIT_ORDER, UNITS } from '../src/data/units';
import { applyMeta, enhance, enhanceChance, enhanceKinds, enhanceCost, ENHANCE, ENHANCE_GREAT, ENHANCE_PITY, masteryTier, META, buyResearch, RESEARCH, researchCost, REROLL_COST } from '../src/meta';
import { STR } from '../src/strings.ko';

const game = (p = emptyProgress(), deck: UnitId[] = [...UNIT_ORDER]) =>
  new Game({ ...applyMeta(defaultConfig(), p, deck), seed: 1, startMoney: 1e6, critChance: 0, cards: [] });

// 스위치는 기본으로 켜져 있다. 다른 테스트가 바꿔 놓았어도 여기서는 켠 상태로 확인한다
beforeAll(() => void (META.enabled = true));
afterAll(() => void (META.enabled = true));

describe('판 밖 성장 스위치', () => {
  it('꺼져 있으면 저장된 연구·숙련도가 판에 반영되지 않는다 (덱과 다시 뽑기 비용만 정해진다)', () => {
    const p = { ...emptyProgress(), parts: 100000, mastery: { toaster: 10 } };
    for (const r of RESEARCH) while (buyResearch(p, r.id));
    META.enabled = false;
    try {
      const base = defaultConfig();
      const cfg = applyMeta(base, p, ['toaster']);
      expect([cfg.startMoney, cfg.startHp, cfg.sellRate]).toEqual([base.startMoney, base.startHp, base.sellRate]);
      expect(cfg.abilities).toEqual(base.abilities);
      expect(cfg.mastery).toBeUndefined();
      expect(cfg.cardChoices).toBeUndefined();
      expect([cfg.deck, cfg.cardRerollCost]).toEqual([['toaster'], REROLL_COST]);
      expect(new Game({ ...cfg, seed: 1 }).levelStats('toaster', 0).damage).toBe(12);
    } finally {
      META.enabled = true;
    }
  });
});

/** 정해진 값을 차례로 돌려주는 난수 */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('가전 강화 (확률형)', () => {
  it('확률표는 +10까지 10칸이고, 위로 갈수록 확률이 낮아진다', () => {
    expect(ENHANCE.length).toBe(MASTERY.max);
    expect(MASTERY.max).toBe(10);
    for (let i = 1; i < ENHANCE.length; i++) expect(ENHANCE[i].chance).toBeLessThanOrEqual(ENHANCE[i - 1].chance);
    expect(ENHANCE[0].chance).toBe(1);
    expect(ENHANCE[9]).toEqual({ chance: 0.03, cost: 80 });
  });

  it('성공하면 한 단계 오르고 부품이 든다. 부품이 모자라면 시도할 수 없다', () => {
    const p = { ...emptyProgress(), parts: 29 };
    expect(enhance(p, 'toaster', seq(0.5))).toBeNull();
    expect(p.parts).toBe(29);
    p.parts = 100;
    // 둘째 난수(대성공 판정)가 높으면 보통 성공
    expect(enhance(p, 'toaster', seq(0.5, 0.9))).toEqual({ result: 'success', level: 1, gained: 1 });
    expect([p.parts, p.mastery.toaster]).toEqual([70, 1]);
    expect(enhanceCost(p, 'toaster')).toBe(30);
  });

  it('실패하면 단계는 그대로이고 부품만 쓰이며, 다음 확률이 3%p씩 오른다. 성공하면 보정이 사라진다', () => {
    const p = { ...emptyProgress(), parts: 10000, mastery: { toaster: 6 } };
    expect(enhanceChance(p, 'toaster')).toBeCloseTo(0.22);
    for (let i = 1; i <= 3; i++) {
      expect(enhance(p, 'toaster', seq(0.99))).toEqual({ result: 'fail', level: 6, gained: 0 });
      expect(p.mastery.toaster).toBe(6);
      expect(enhanceChance(p, 'toaster')).toBeCloseTo(0.22 + ENHANCE_PITY * i);
    }
    expect(p.parts).toBe(10000 - 80 * 3);
    // 0.30은 기본 확률(22%)로는 실패지만 보정(31%)으로 성공한다
    expect(enhance(p, 'toaster', seq(0.3, 0.9))).toMatchObject({ result: 'success', level: 7 });
    expect(p.masteryFail.toaster).toBe(0);
    expect(enhanceChance(p, 'toaster')).toBeCloseTo(0.12);
    // 다른 가전의 확률에는 영향이 없다
    expect(enhanceChance(p, 'fan')).toBe(1);
  });

  it('운이 가장 나빠도 +10은 34번째 시도에는 붙는다', () => {
    const p = { ...emptyProgress(), parts: 1e6, mastery: { toaster: 9 } };
    let tries = 0;
    while (p.mastery.toaster < 10) {
      enhance(p, 'toaster', seq(0.9999));
      tries++;
      expect(tries).toBeLessThan(100);
    }
    expect(tries).toBe(34);
  });

  it('대성공: 성공했을 때 10% 확률로 두 단계 오른다 (+9에서는 한 단계만)', () => {
    const p = { ...emptyProgress(), parts: 10000 };
    expect(enhance(p, 'toaster', seq(0, ENHANCE_GREAT - 0.01))).toEqual({ result: 'great', level: 2, gained: 2 });
    expect(enhance(p, 'toaster', seq(0, ENHANCE_GREAT + 0.01))).toEqual({ result: 'success', level: 3, gained: 1 });
    p.mastery.toaster = 9;
    expect(enhance(p, 'toaster', seq(0, 0))).toEqual({ result: 'success', level: 10, gained: 1 });
  });

  it('최대 단계에서는 더 강화할 수 없다', () => {
    const p = { ...emptyProgress(), parts: 10000, mastery: { toaster: 10 } };
    expect(enhanceCost(p, 'toaster')).toBeNull();
    expect(enhanceChance(p, 'toaster')).toBe(0);
    expect(enhance(p, 'toaster', seq(0))).toBeNull();
    expect(p.parts).toBe(10000);
  });

  it('테두리 등급: +5 은, +8 금, +10 무지개', () => {
    expect([0, 4, 5, 7, 8, 9, 10].map(masteryTier)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('공격형은 공격력·화상·수입이, 지원형은 버프·감속이 오른다 (다른 가전은 그대로)', () => {
    const p = { ...emptyProgress(), mastery: { toaster: 10, stove: 4, washer: 10, wifi: 10, aircon: 10 } };
    const g = game(p);
    const k = 1 + MASTERY.power * 10;
    const sk = 1 + MASTERY.support * 10;
    expect([k, sk]).toEqual([1.2, 1.1]);
    expect(g.levelStats('toaster', 0).damage).toBeCloseTo(12 * k);
    expect(g.levelStats('stove', 0).dot!.dps).toBeCloseTo(18 * (1 + MASTERY.power * 4));
    expect(g.levelStats('washer', 0).income).toBe(Math.round(40 * k));
    expect(g.levelStats('wifi', 0).buff).toBeCloseTo(0.15 * sk);
    expect(g.levelStats('aircon', 0).globalSlow).toBeCloseTo(0.2 * sk);
    expect(g.levelStats('microwave', 0).damage).toBe(30);
    // 사거리와 공격 속도는 그대로
    expect(g.levelStats('toaster', 0).range).toBe(150);
    expect(g.levelStats('toaster', 0).cooldown).toBe(0.7);
  });

  it('★강화와 곱해지고, 실제 피해에 반영된다', () => {
    const g = game({ ...emptyProgress(), mastery: { toaster: 10 } });
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

describe('강화 화면에 보여 주는 항목', () => {
  it('실제로 오르는 항목과 같다: 선풍기·세탁기는 둘 다, 와이파이·배터리·에어컨은 지원만, 공격형은 공격만', () => {
    const kinds = (id: keyof typeof UNITS) => enhanceKinds(UNITS[id]);
    expect(kinds('toaster')).toEqual({ power: true, support: false });
    expect(kinds('stove')).toEqual({ power: true, support: false });
    expect(kinds('fan')).toEqual({ power: true, support: true });
    expect(kinds('washer')).toEqual({ power: true, support: true });
    expect(kinds('wifi')).toEqual({ power: false, support: true });
    expect(kinds('battery')).toEqual({ power: false, support: true });
    expect(kinds('aircon')).toEqual({ power: false, support: true });
  });

  it('공격만 오르는 가전은 강화해도 지원 효과가 없고, 지원만 오르는 가전은 공격력이 없다', () => {
    const p = { ...emptyProgress(), mastery: Object.fromEntries(Object.keys(UNITS).map((id) => [id, 10])) };
    const g = game(p);
    const plain = game();
    for (const id of Object.keys(UNITS) as (keyof typeof UNITS)[]) {
      const { power, support } = enhanceKinds(UNITS[id]);
      const levels = UNITS[id].levels.map((_, lv) => [g.levelStats(id, lv), plain.levelStats(id, lv)] as const);
      const powerUp = levels.some(([a, b]) => a.damage > b.damage || (a.income ?? 0) > (b.income ?? 0) || (a.dot?.dps ?? 0) > (b.dot?.dps ?? 0));
      const supportUp = levels.some(([a, b]) => (a.buff ?? 0) > (b.buff ?? 0) || (a.dmgBuff ?? 0) > (b.dmgBuff ?? 0) || (a.globalSlow ?? 0) > (b.globalSlow ?? 0) || (a.slowDuration ?? 0) > (b.slowDuration ?? 0));
      if (!power) expect(powerUp, id).toBe(false);
      if (!support) expect(supportUp, id).toBe(false);
      expect(powerUp || supportUp, id).toBe(true);
    }
  });
});
