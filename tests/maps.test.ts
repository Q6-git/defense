import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { Game, pickTarget } from '../src/core/game';
import { MAP_ORDER, MAPS } from '../src/data/map';

describe('맵', () => {
  it('모든 맵의 길은 맵 영역 안을 지나고, 장애물은 길과 겹치지 않는다', () => {
    for (const id of MAP_ORDER) {
      const g = new Game(defaultConfig('normal', false, id));
      const { area, pathHalfWidth, blocked } = g.cfg.map;
      for (const path of g.paths) {
        for (let d = 60; d < path.length - 60; d += 10) {
          const p = path.pointAt(d);
          expect(p.x).toBeGreaterThanOrEqual(area.x);
          expect(p.y).toBeGreaterThanOrEqual(area.y + pathHalfWidth);
          expect(p.y).toBeLessThanOrEqual(area.y + area.h - pathHalfWidth);
          for (const b of blocked ?? []) {
            const inside = p.x > b.x - pathHalfWidth && p.x < b.x + b.w + pathHalfWidth && p.y > b.y - pathHalfWidth && p.y < b.y + b.h + pathHalfWidth;
            expect(inside, `${id}: 장애물이 길을 덮음`).toBe(false);
          }
        }
      }
    }
  });

  it('세탁실은 주방보다 훨씬 긴 길이고, 콘센트는 맵 가운데 쪽에 있다', () => {
    const kitchen = new Game(defaultConfig('normal', false, 'kitchen')).paths[0].length;
    const g = new Game(defaultConfig('normal', false, 'laundry'));
    expect(g.paths[0].length).toBeGreaterThan(kitchen * 1.5);
    const end = g.paths[0].pointAt(g.paths[0].length);
    const { area } = g.cfg.map;
    expect(Math.abs(end.x - (area.x + area.w / 2))).toBeLessThan(area.w * 0.25);
    expect(Math.abs(end.y - (area.y + area.h / 2))).toBeLessThan(area.h * 0.25);
  });

  it('거실 배수관은 자기 자신과 세 번 엇갈린다', () => {
    const pts = MAPS.living.paths[0];
    const segs = pts.slice(1).map((p, i) => [pts[i], p] as const);
    let crossings = 0;
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 2; j < segs.length; j++) {
        const [a, b] = segs[i];
        const [c, d] = segs[j];
        // 가로·세로 선분끼리만 있으므로 하나는 가로, 하나는 세로일 때 교차를 본다
        const h = a.y === b.y ? [a, b] : c.y === d.y ? [c, d] : null;
        const v = a.x === b.x ? [a, b] : c.x === d.x ? [c, d] : null;
        if (!h || !v || h[0] === v[0]) continue;
        const x = v[0].x, y = h[0].y;
        const inH = x > Math.min(h[0].x, h[1].x) && x < Math.max(h[0].x, h[1].x);
        const inV = y > Math.min(v[0].y, v[1].y) && y < Math.max(v[0].y, v[1].y);
        if (inH && inV) crossings++;
      }
    }
    expect(crossings).toBe(3);
  });

  it('길이 두 개인 욕실에서는 적이 번갈아 두 길로 나온다', () => {
    const g = new Game({ ...defaultConfig('normal', false, 'bathroom'), seed: 1 });
    expect(g.paths.length).toBe(2);
    const lanes = [0, 1, 2, 3].map(() => g.spawnEnemy('goo').lane);
    expect(lanes).toEqual([0, 1, 0, 1]);
    // 두 길 모두 같은 기지로 간다
    const ends = g.paths.map((p) => p.pointAt(p.length));
    expect(ends[0]).toEqual(ends[1]);
  });

  it('분열한 슬라임은 부모와 같은 길을 탄다', () => {
    const g = new Game({ ...defaultConfig('normal', false, 'bathroom'), seed: 1, critChance: 0, startMoney: 1e4 });
    g.apply({ type: 'startWave' });
    g.enemies = [];
    (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    g.spawnEnemy('goo'); // 0번 길 차례를 소모
    const s = g.spawnEnemy('splitter', 300);
    expect(s.lane).toBe(1);
    s.hp = 0;
    g.update(1 / 60);
    const kids = g.enemies.filter((e) => e.def.id === 'splitling');
    expect(kids.length).toBe(2);
    expect(kids.every((k) => k.lane === 1)).toBe(true);
  });

  it('맨 앞 타겟은 길이 달라도 기지에 가장 가까운 적을 고른다', () => {
    const g = new Game(defaultConfig('normal', false, 'bathroom'));
    const a = g.spawnEnemy('goo', 100, 0);
    const b = g.spawnEnemy('goo', 300, 1);
    expect(pickTarget([a, b], 'first', { x: 0, y: 0 }).uid).toBe(b.uid);
  });

  it('장애물 위에는 설치할 수 없다', () => {
    const g = new Game(defaultConfig('normal', false, 'balcony'));
    const b = MAPS.balcony.blocked![0];
    expect(g.canPlace('toaster', b.x + b.w / 2, b.y + b.h / 2)).toBe('bounds');
  });
});
