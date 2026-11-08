import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { Game, pickTarget } from '../src/core/game';
import type { Enemy } from '../src/core/types';

const FREE = { x: 500, y: 240 }; // 경로 사이 빈 공간

function game(money = 5000) {
  const g = new Game({ ...defaultConfig(), startMoney: money, critChance: 0, seed: 1 });
  return g;
}

describe('유닛 배치', () => {
  it('빈 공간에 설치하면 돈이 빠진다', () => {
    const g = game(300);
    expect(g.apply({ type: 'place', unit: 'toaster', ...FREE })).toEqual({ ok: true });
    expect(g.money).toBe(200);
    expect(g.units.length).toBe(1);
  });

  it('경로 위, 다른 유닛 위, 맵 밖에는 설치할 수 없다', () => {
    const g = game();
    expect(g.canPlace('toaster', 400, 150)).toBe('path');
    g.apply({ type: 'place', unit: 'toaster', ...FREE });
    expect(g.canPlace('toaster', FREE.x + 10, FREE.y)).toBe('overlap');
    expect(g.canPlace('toaster', 1100, 300)).toBe('bounds');
    expect(g.canPlace('toaster', 500, 40)).toBe('bounds');
  });

  it('돈이 부족하면 설치할 수 없다', () => {
    const g = game(50);
    expect(g.apply({ type: 'place', unit: 'toaster', ...FREE })).toEqual({ ok: false, reason: 'money' });
  });

  it('세탁기는 3대까지만 설치된다', () => {
    const g = game();
    for (let i = 0; i < 3; i++) expect(g.apply({ type: 'place', unit: 'washer', x: 300 + i * 60, y: 240 }).ok).toBe(true);
    expect(g.canPlace('washer', 600, 240)).toBe('limit');
  });
});

describe('업그레이드와 판매', () => {
  it('업그레이드는 Lv3 → 갈림길 → 끝', () => {
    const g = game();
    g.apply({ type: 'place', unit: 'toaster', ...FREE });
    const u = g.units[0];
    expect(g.apply({ type: 'upgrade', uid: u.uid }).ok).toBe(true);
    expect(g.apply({ type: 'upgrade', uid: u.uid }).ok).toBe(true);
    expect(u.level).toBe(2);
    // Lv3 다음은 갈림길이라 갈래를 골라야 하고, 고른 뒤에는 더 올릴 수 없다
    expect(g.apply({ type: 'upgrade', uid: u.uid })).toEqual({ ok: false, reason: 'branch' });
    expect(g.apply({ type: 'upgrade', uid: u.uid, branch: 0 }).ok).toBe(true);
    expect(g.apply({ type: 'upgrade', uid: u.uid, branch: 0 })).toEqual({ ok: false, reason: 'maxLevel' });
  });

  it('판매하면 투자금의 60%를 돌려받는다', () => {
    const g = game(1000);
    g.apply({ type: 'place', unit: 'toaster', ...FREE }); // 100
    g.apply({ type: 'upgrade', uid: g.units[0].uid }); // +120
    g.apply({ type: 'sell', uid: g.units[0].uid });
    expect(g.money).toBe(1000 - 220 + 132);
    expect(g.units.length).toBe(0);
  });
});

describe('전투', () => {
  function withEnemy(id: 'goo' | 'roach' | 'splitter' = 'goo') {
    const g = game();
    g.apply({ type: 'startWave' });
    const e = g.spawnEnemy(id, 0);
    // 토스터 사거리 안(경로 첫 구간 y=150)에 적을 둔다
    e.dist = 530;
    return { g, e };
  }

  it('토스터가 사거리 안의 적을 공격하고, 처치하면 보상을 준다', () => {
    const { g, e } = withEnemy();
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const money = g.money;
    e.hp = 12;
    g.update(1 / 60);
    expect(g.enemies.includes(e)).toBe(false);
    expect(g.money).toBe(money + Math.round(e.def.reward * g.cfg.rewardMul));
  });

  it('방어력은 피해를 줄이지만 최소 25%는 들어간다', () => {
    const { g, e } = withEnemy('roach');
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const hp = e.hp;
    g.update(1 / 60);
    expect(hp - e.hp).toBeCloseTo(12 - 8);
  });

  it('분열 슬라임은 죽으면 작은 슬라임 2마리가 된다', () => {
    const { g, e } = withEnemy('splitter');
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    e.hp = 1;
    g.update(1 / 60);
    expect(g.enemies.filter((x) => x.def.id === 'splitling').length).toBe(2);
  });

  it('선풍기는 사거리 안 적을 느리게 만든다', () => {
    const { g, e } = withEnemy();
    g.apply({ type: 'place', unit: 'fan', x: 540, y: 220 });
    g.update(1 / 60);
    expect(e.slowMul).toBe(0.6);
  });

  it('전자레인지는 타겟 주변 적에게 모두 피해를 준다', () => {
    const { g, e } = withEnemy();
    const e2 = g.spawnEnemy('goo', 510);
    g.apply({ type: 'place', unit: 'microwave', x: 540, y: 240 });
    const [a, b] = [e.hp, e2.hp];
    g.update(1 / 60);
    expect(e.hp).toBeLessThan(a);
    expect(e2.hp).toBeLessThan(b);
  });

  it('와이파이 근처 유닛은 공격 속도가 빨라진다', () => {
    const g = game();
    g.apply({ type: 'place', unit: 'toaster', ...FREE });
    g.apply({ type: 'place', unit: 'wifi', x: FREE.x + 60, y: FREE.y });
    g.update(1 / 60);
    expect(g.units[0].buffMul).toBeCloseTo(1.15);
  });
});

describe('타겟팅 모드', () => {
  const mk = (uid: number, dist: number, hp: number, x: number): Enemy =>
    ({ uid, dist, hp, x, y: 0 }) as Enemy;
  const list = [mk(1, 100, 50, 0), mk(2, 300, 20, 100), mk(3, 200, 90, 400)];

  it('first / last / strong / close', () => {
    expect(pickTarget(list, 'first', { x: 0, y: 0 }).uid).toBe(2);
    expect(pickTarget(list, 'last', { x: 0, y: 0 }).uid).toBe(1);
    expect(pickTarget(list, 'strong', { x: 0, y: 0 }).uid).toBe(3);
    expect(pickTarget(list, 'close', { x: 390, y: 0 }).uid).toBe(3);
  });
});
