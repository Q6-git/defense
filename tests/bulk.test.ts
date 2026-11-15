import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { bulkBranch, nextBulkStep } from '../src/core/bulk';
import { Game } from '../src/core/game';

function setup(money: number) {
  const g = new Game({ ...defaultConfig(), seed: 1, startMoney: 1e6, critChance: 0, cards: [] });
  for (const [x, y] of [[560, 240], [640, 240], [720, 240]]) expect(g.apply({ type: 'place', unit: 'toaster', x, y }).ok).toBe(true);
  g.money = money;
  return g;
}

/** '모두'를 한 번 누른 것처럼 끝까지 올린다 */
function bulk(g: Game, branch: 0 | 1 | null) {
  for (let i = 0; i < 500; i++) {
    const s = nextBulkStep(g, 'toaster', branch);
    if (!s) break;
    expect(g.apply({ type: 'upgrade', uid: s.unit.uid, branch: s.branch }).ok).toBe(true);
  }
}

describe("'모두' 업그레이드 순서", () => {
  it('기본 Lv3을 먼저 모두 채운다', () => {
    const g = setup(1e6);
    const [a] = g.units;
    // 한 대만 갈래·★까지 올려 둔다
    g.apply({ type: 'upgrade', uid: a.uid });
    g.apply({ type: 'upgrade', uid: a.uid });
    g.apply({ type: 'upgrade', uid: a.uid, branch: 1 });
    const first = nextBulkStep(g, 'toaster', 1)!;
    expect(first.star).toBe(false);
    expect(first.unit).not.toBe(a);
  });

  it('모두 Lv3이 되면 고른 갈래로 갈림길을 넘고, 그다음 ★강화', () => {
    const g = setup(1e6);
    const [a, b, c] = g.units;
    g.apply({ type: 'upgrade', uid: a.uid });
    g.apply({ type: 'upgrade', uid: a.uid });
    g.apply({ type: 'upgrade', uid: a.uid, branch: 1 });
    expect(bulkBranch(g, b)).toBe(1);
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      const s = nextBulkStep(g, 'toaster', 1)!;
      order.push(s.star ? 'star' : s.branch !== undefined ? 'fork' : 'base');
      g.apply({ type: 'upgrade', uid: s.unit.uid, branch: s.branch });
    }
    expect(order).toEqual(['base', 'base', 'base', 'base', 'fork', 'fork']);
    expect([b.branch, c.branch]).toEqual([1, 1]);
    expect(nextBulkStep(g, 'toaster', 1)!.star).toBe(true);
  });

  it('앞 순위가 남았는데 돈이 모자라면 ★강화로 넘어가지 않는다', () => {
    const g = setup(1e6);
    const [a] = g.units;
    g.apply({ type: 'upgrade', uid: a.uid });
    g.apply({ type: 'upgrade', uid: a.uid });
    g.apply({ type: 'upgrade', uid: a.uid, branch: 0 });
    g.money = 0;
    expect(nextBulkStep(g, 'toaster', 0)).toBeNull();
  });

  it('갈래를 아무도 안 골랐으면 Lv3에서 멈춘다', () => {
    const g = setup(1e6);
    bulk(g, bulkBranch(g, g.units[0]));
    expect(g.units.every((u) => u.level === 2 && u.branch === null)).toBe(true);
  });
});
