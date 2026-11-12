import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import type { CardDef } from '../src/core/cards';
import { Game } from '../src/core/game';
import { CARDS } from '../src/data/cards';

const card = (id: string) => CARDS.find((c) => c.id === id)!;

function game(cards: CardDef[] = CARDS) {
  const g = new Game({ ...defaultConfig(), seed: 5, startMoney: 1e6, critChance: 0, cards });
  g.apply({ type: 'startWave' });
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  return g;
}

/** 지금 웨이브를 바로 끝낸다 */
function clear(g: Game) {
  g.update(0.05);
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  g.update(0.05);
}

/** 원하는 카드를 바로 고른 상태로 만든다 */
function give(g: Game, id: string) {
  g.offer = [card(id)];
  expect(g.apply({ type: 'pickCard', index: 0 }).ok).toBe(true);
}

describe('보상 카드', () => {
  it('3웨이브마다 서로 다른 카드 3장이 나오고, 고를 때까지 게임이 멈춘다', () => {
    const g = game();
    clear(g); // 1웨이브
    expect(g.offer).toBeNull();
    g.apply({ type: 'startWave' });
    clear(g); // 2웨이브
    g.apply({ type: 'startWave' });
    clear(g); // 3웨이브
    expect(g.offer?.length).toBe(3);
    expect(new Set(g.offer!.map((c) => c.id)).size).toBe(3);
    const timer = g.timer;
    g.update(5);
    expect(g.timer).toBe(timer);
    expect(g.apply({ type: 'startWave' }).ok).toBe(false);
    expect(g.apply({ type: 'pickCard', index: 0 }).ok).toBe(true);
    expect(g.offer).toBeNull();
    expect(g.cards.length).toBe(1);
    g.update(1);
    expect(g.timer).toBeLessThan(timer);
  });

  it('건너뛰면 돈을 받는다', () => {
    const g = game();
    g.offer = [card('toast')];
    const money = g.money;
    g.apply({ type: 'skipCard' });
    expect(g.money).toBe(money + 50);
    expect(g.cards).toEqual([]);
  });

  it('수치형 카드는 겹치고, 최대 횟수를 채우면 더 나오지 않는다', () => {
    const g = game([card('toast')]);
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const base = g.stats(g.units[0]).damage;
    give(g, 'toast');
    expect(g.stats(g.units[0]).damage).toBeCloseTo(base * 1.2);
    give(g, 'toast');
    give(g, 'toast');
    expect(g.stats(g.units[0]).damage).toBeCloseTo(base * 1.2 ** 3);
    // 카드가 toast 한 장뿐인 게임에서 3번을 채웠으니 더는 제안이 없다
    g.wave = 2;
    g.phase = 'intermission';
    g.apply({ type: 'startWave' });
    clear(g);
    expect(g.offer).toBeNull();
  });

  it('HP가 모자라면 HP를 깎는 카드는 나오지 않는다', () => {
    const g = game([card('debt')]);
    g.hp = 150;
    g.wave = 2;
    g.phase = 'intermission';
    g.apply({ type: 'startWave' });
    clear(g);
    expect(g.offer).toBeNull();
  });

  it('즉시 효과: 용돈, 보강 콘센트, 빚', () => {
    const g = game();
    const [money, hp] = [g.money, g.hp];
    give(g, 'allowance');
    give(g, 'outlet');
    expect([g.money, g.hp]).toEqual([money + 150, hp + 100]);
    give(g, 'debt');
    expect([g.money, g.hp]).toEqual([money + 550, hp - 50]);
  });

  it('할인 카드는 설치비, 업그레이드비, 갈림길 비용에 반영된다', () => {
    const g = game();
    give(g, 'coupon');
    expect(g.placeCost('toaster')).toBe(90);
    const before = g.money;
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    expect(g.money).toBe(before - 90);
    give(g, 'upsale');
    expect(g.upgradeOptions(g.units[0])[0].cost).toBe(Math.round(120 * 0.85));
    give(g, 'forksale');
    g.apply({ type: 'upgrade', uid: g.units[0].uid });
    g.apply({ type: 'upgrade', uid: g.units[0].uid });
    expect(g.upgradeOptions(g.units[0])[0].cost).toBe(Math.round(450 * 0.85 * 0.5));
  });

  it('세탁기 증설은 최대 대수를 1 늘린다', () => {
    const g = game();
    for (let i = 0; i < 3; i++) g.apply({ type: 'place', unit: 'washer', x: 300 + i * 60, y: 240 });
    expect(g.canPlace('washer', 600, 240)).toBe('limit');
    give(g, 'morewasher');
    expect(g.canPlace('washer', 600, 240)).toBeNull();
  });

  it('스킬 카드는 대기시간과 범위, 지속 시간을 바꾼다', () => {
    const g = game();
    give(g, 'quickhand');
    give(g, 'bigplunger');
    give(g, 'longload');
    expect(g.abilityStats('plunger').cooldown).toBeCloseTo(20 * 0.8);
    expect(g.abilityStats('plunger').radius).toBeCloseTo(90 * 1.2);
    expect(g.abilityStats('overload').duration).toBe(9);
    g.apply({ type: 'ability', id: 'overload' });
    expect(g.overloadTime).toBe(9);
  });

  it('연쇄 폭발: 죽은 적이 주변 적에게 피해를 준다', () => {
    const g = game();
    give(g, 'chain');
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    // 토스터는 맨 앞 적(a)을 노린다
    const a = g.spawnEnemy('grease', 570);
    const b = g.spawnEnemy('grease', 540);
    const far = g.spawnEnemy('grease', 30); // 사거리 밖
    a.hp = 1;
    const [hpB, hpFar] = [b.hp, far.hp];
    g.update(1 / 60);
    expect(g.enemies.includes(a)).toBe(false);
    expect(hpB - b.hp).toBeCloseTo(a.maxHp * 0.15);
    expect(far.hp).toBe(hpFar);
  });

  it('차단기: 웨이브마다 처음 닿는 적 하나만 막고, 보스는 못 막는다', () => {
    const g = game();
    give(g, 'breaker');
    const hp = g.hp;
    const a = g.spawnEnemy('goo', g.path.length - 1);
    g.spawnEnemy('grease', 0); // 웨이브가 끝나지 않도록
    g.update(0.1);
    expect(g.enemies.includes(a)).toBe(false);
    expect(g.hp).toBe(hp);
    const b = g.spawnEnemy('goo', g.path.length - 1);
    b.hp = 7;
    g.update(0.1);
    expect(g.hp).toBe(hp - 7);
  });

  it('카드 29장: id가 겹치지 않고 등급별 장수가 맞다', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(29);
    const count = (f: (c: CardDef) => boolean) => CARDS.filter(f).length;
    expect(count((c) => c.rarity === 'common')).toBe(11);
    expect(count((c) => c.rarity === 'rare' && !c.risk)).toBe(7);
    expect(count((c) => !!c.risk)).toBe(5);
    expect(count((c) => c.rarity === 'legend')).toBe(6);
  });
});
