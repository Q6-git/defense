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

describe('3D 주방', () => {
  it('소품이 놓인 칸에는 설치할 수 없고, 바로 옆 칸에는 설치할 수 있다', () => {
    const g = new Game({ ...defaultConfig('normal', false, 'kitchen'), startMoney: 1e4 });
    const grid = MAPS.kitchen.grid!;
    const center = (c: number, r: number) => ({ x: grid.x + (c + 0.5) * grid.size, y: grid.y + (r + 0.5) * grid.size });
    for (const d of MAPS.kitchen.decor!) {
      const p = center(d.c, d.r);
      expect(g.canPlace('toaster', p.x, p.y), `${d.kind} ${d.c},${d.r}`).toBe('bounds');
    }
    const herb = MAPS.kitchen.decor!.find((d) => d.kind === 'herb' && d.c === 9)!;
    const side = center(herb.c - 1, herb.r);
    expect(g.canPlace('toaster', side.x, side.y)).toBeNull();
  });

  it('모든 맵: 격자가 있고, 길 꼭짓점은 칸 가운데, 소품이 차지한 칸은 배수관 위에 있지 않다', () => {
    for (const id of MAP_ORDER) {
      const m = MAPS[id];
      const grid = m.grid!;
      expect(grid, id).toBeDefined();
      for (const path of m.paths) {
        for (const p of path.slice(1)) {
          expect(((p.x - grid.x) / grid.size - 0.5) % 1, `${id} x`).toBeCloseTo(0);
          expect(((p.y - grid.y) / grid.size - 0.5) % 1, `${id} y`).toBeCloseTo(0);
        }
      }
      const g = new Game(defaultConfig('normal', false, id));
      for (const d of m.decor ?? []) {
        for (let c = d.c; c < d.c + (d.w ?? 1); c++) {
          for (let r = d.r; r < d.r + (d.h ?? 1); r++) {
            expect(g.distanceToPath({ x: grid.x + (c + 0.5) * grid.size, y: grid.y + (r + 0.5) * grid.size }), `${id} ${d.kind} ${c},${r}`).toBeGreaterThan(m.pathHalfWidth);
          }
        }
      }
    }
  });

  it('여러 칸 소품(욕조)은 차지한 칸 전체가 설치 불가', () => {
    const g = new Game({ ...defaultConfig('normal', false, 'bathroom'), startMoney: 1e4 });
    const tub = MAPS.bathroom.decor!.find((d) => d.kind === 'bathtub')!;
    const grid = MAPS.bathroom.grid!;
    for (let c = tub.c; c < tub.c + tub.w!; c++) {
      for (let r = tub.r; r < tub.r + tub.h!; r++) expect(g.canPlace('toaster', grid.x + (c + 0.5) * grid.size, grid.y + (r + 0.5) * grid.size)).toBe('bounds');
    }
  });

  it('콘센트가 서는 칸(길 끝 바로 다음 칸)에는 설치할 수 없다', () => {
    for (const id of MAP_ORDER) {
      const g = new Game({ ...defaultConfig('normal', false, id), startMoney: 1e4 });
      const p = g.paths[0];
      const end = p.pointAt(p.length), before = p.pointAt(p.length - 10);
      const x = end.x + Math.sign(end.x - before.x) * 52, y = end.y + Math.sign(end.y - before.y) * 52;
      expect(g.canPlace('toaster', x, y), id).not.toBeNull();
    }
  });

  it('화면 투영과 역투영은 서로 되돌리고, 원근이라 앞쪽 칸이 더 크게 보인다', async () => {
    const { makeCamera, project, unproject } = await import('../src/view3d/board');
    const cam = makeCamera(MAPS.kitchen);
    for (const [x, y, h] of [[100, 200, 0], [520, 400, 26], [990, 690, 52]]) {
      const s = project(cam, x, y, h);
      const back = unproject(cam, s.x, s.y, h);
      expect(back.x).toBeCloseTo(x, 3);
      expect(back.y).toBeCloseTo(y, 3);
    }
    // 보드 네 귀퉁이가 맵 영역(가로 0~1040, 세로 56~720) 안에 들어온다
    const g = MAPS.kitchen.grid!;
    for (const [x, y] of [[g.x, g.y], [g.x + g.cols * g.size, g.y], [g.x, g.y + g.rows * g.size], [g.x + g.cols * g.size, g.y + g.rows * g.size]]) {
      const s = project(cam, x, y);
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1040);
      expect(s.y).toBeGreaterThan(56);
      expect(s.y).toBeLessThan(720);
    }
    // 원근: 맨 아랫줄 칸 너비가 맨 윗줄 칸 너비보다 넓다
    const width = (r: number) => project(cam, g.x + 5 * g.size, g.y + r * g.size).x - project(cam, g.x + 4 * g.size, g.y + r * g.size).x;
    expect(width(g.rows)).toBeGreaterThan(width(0) * 1.1);
  });
});
