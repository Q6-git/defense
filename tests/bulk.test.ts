import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { bulkGroup, forkAll, forkGroup, nextBulkStep } from '../src/core/bulk';
import { Game } from '../src/core/game';
import type { Unit } from '../src/core/types';

function setup(money: number, n = 4) {
  const g = new Game({ ...defaultConfig(), seed: 1, startMoney: 1e6, critChance: 0, cards: [] });
  for (let i = 0; i < n; i++) expect(g.apply({ type: 'place', unit: 'toaster', x: 560 + i * 80, y: 240 }).ok).toBe(true);
  g.money = money;
  return g;
}

/** Lv3까지 올리고 갈래를 고른다 */
function fork(g: Game, u: Unit, branch: 0 | 1) {
  g.apply({ type: 'upgrade', uid: u.uid });
  g.apply({ type: 'upgrade', uid: u.uid });
  expect(g.apply({ type: 'upgrade', uid: u.uid, branch }).ok).toBe(true);
}

/** '모두'를 한 번 누른 것처럼 끝까지 올린다 */
function bulk(g: Game, selected: Unit) {
  for (let i = 0; i < 500; i++) {
    const s = nextBulkStep(g, selected);
    if (!s) break;
    expect(g.apply({ type: 'upgrade', uid: s.unit.uid }).ok).toBe(true);
  }
}

describe("'모두' 업그레이드", () => {
  it('갈래 전 가전을 고르면 갈래 전 가전만 Lv3까지 오르고, 갈림길은 넘지 않는다', () => {
    const g = setup(1e6);
    const [a, b, c, d] = g.units;
    fork(g, a, 1);
    bulk(g, b);
    expect([b, c, d].every((u) => u.level === 2 && u.branch === null)).toBe(true);
    expect(a.stars).toBe(0);
    expect(nextBulkStep(g, b)).toBeNull();
  });

  it('갈래를 고른 가전을 고르면 같은 갈래끼리만 ★강화된다 (싼 것부터 고르게)', () => {
    const g = setup(1e6);
    const [a, b, c, d] = g.units;
    fork(g, a, 1);
    fork(g, b, 1);
    fork(g, c, 0);
    expect(bulkGroup(g, a)).toEqual([a, b]);
    g.money = g.starCost(a) * 2 + g.starCost(a) * 1.5 + 5;
    bulk(g, a);
    expect([a.stars, b.stars]).toEqual([2, 1]);
    expect(c.stars).toBe(0);
    expect(d.level).toBe(0);
  });

  it('돈이 모자라면 멈춘다', () => {
    const g = setup(1e6);
    const [a] = g.units;
    fork(g, a, 0);
    g.money = 0;
    expect(nextBulkStep(g, a)).toBeNull();
    expect(nextBulkStep(g, g.units[1])).toBeNull();
  });
});

describe("갈림길 '모두'", () => {
  /** Lv3까지만 올린다 (갈림길 앞) */
  const toFork = (g: Game, u: Unit) => {
    g.apply({ type: 'upgrade', uid: u.uid });
    g.apply({ type: 'upgrade', uid: u.uid });
  };

  it('고른 갈래가 갈림길에 와 있는 같은 종류 가전에만 적용된다', () => {
    const g = setup(1e6);
    const [a, b, c, d] = g.units;
    expect(g.apply({ type: 'place', unit: 'fan', x: 300, y: 240 }).ok).toBe(true);
    const fan = g.units[4];
    [a, b, c, fan].forEach((u) => toFork(g, u)); // d는 Lv1
    fork(g, c, 0); // c는 이미 다른 갈래
    expect(forkGroup(g, b)).toEqual([b, a]);
    expect(forkAll(g, b, 1)).toEqual([b, a]);
    expect([a.branch, b.branch, c.branch, d.branch, fan.branch]).toEqual([1, 1, 0, null, null]);
    expect(d.level).toBe(0);
  });

  it('돈이 모자라면 고른 가전부터 되는 만큼만', () => {
    const g = setup(1e6);
    const [a, b, c] = g.units;
    [a, b, c].forEach((u) => toFork(g, u));
    g.money = 450 * 2 + 10;
    expect(forkAll(g, c, 0)).toEqual([c, a]);
    expect(b.branch).toBeNull();
    expect(g.money).toBe(10);
    g.money = 0;
    expect(forkAll(g, b, 0)).toEqual([]);
  });

  it('갈림길에 있지 않은 가전을 고르면 아무 일도 없다', () => {
    const g = setup(1e6);
    const [a, b] = g.units;
    toFork(g, b);
    expect(forkGroup(g, a)).toEqual([]);
    expect(forkAll(g, a, 0)).toEqual([]);
    expect(b.branch).toBeNull();
  });
});

describe('지원형 가전의 ★강화', () => {
  const lv4 = (unit: 'fan' | 'aircon' | 'wifi' | 'washer' | 'battery', branch: 0 | 1, stars: number) => {
    const g = new Game({ ...defaultConfig(), seed: 1, startMoney: 1e9, critChance: 0, cards: [] });
    g.apply({ type: 'place', unit, x: 560, y: 240 });
    const u = g.units[0];
    fork(g, u, branch);
    for (let i = 0; i < stars; i++) g.apply({ type: 'upgrade', uid: u.uid });
    return { g, u, s: g.stats(u) };
  };

  it('선풍기: 밀어내기·얼리기·감속 지속이 별마다 10%씩 세진다', () => {
    expect(lv4('fan', 0, 2).s.knockback).toBeCloseTo(45 * 1.2);
    const frost = lv4('fan', 1, 5).s;
    expect(frost.freeze).toBeCloseTo(1.5);
    expect(frost.frozenVuln).toBeCloseTo(1.6);
    expect(frost.slowDuration).toBeCloseTo(1.4 * 1.5);
    expect(frost.slow).toBe(0.4);
  });

  it('와이파이·보조배터리·세탁기: 버프와 수입이 오른다', () => {
    expect(lv4('wifi', 0, 3).s.buff).toBeCloseTo(0.6 * 1.3);
    expect(lv4('wifi', 1, 4).s.hackVuln).toBeCloseTo(1.35);
    expect(lv4('battery', 1, 2).s.dmgBuff).toBeCloseTo(0.9 * 1.2);
    expect(lv4('washer', 0, 2).s.income).toBe(180);
    expect(lv4('washer', 0, 2).s.interest!.max).toBe(180);
    expect(lv4('washer', 1, 4).s.bounty!.mul).toBeCloseTo(1.7);
  });

  it('급냉 에어컨: 전체 감속 60% 한도에 닿으면 더 강화할 수 없다', () => {
    const { g, u, s } = lv4('aircon', 0, 10);
    expect(u.stars).toBe(4);
    expect(s.globalSlow).toBeCloseTo(0.6);
    expect(g.upgradeOptions(u)).toEqual([]);
    // 제습은 받는 피해 증가가 계속 올라서 끝까지 강화된다
    const d = lv4('aircon', 1, 10);
    expect(d.u.stars).toBe(10);
    expect(d.s.globalVuln).toBeCloseTo(0.5);
  });
});
