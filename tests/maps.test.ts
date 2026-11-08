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
