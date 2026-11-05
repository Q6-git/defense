import { describe, expect, it } from 'vitest';
import { Path } from '../src/core/path';

describe('Path', () => {
  const p = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);

  it('전체 길이를 계산한다', () => {
    expect(p.length).toBe(150);
  });

  it('이동 거리로 위치를 구한다', () => {
    expect(p.pointAt(50)).toEqual({ x: 50, y: 0 });
    expect(p.pointAt(125)).toEqual({ x: 100, y: 25 });
    expect(p.pointAt(-10)).toEqual({ x: 0, y: 0 });
    expect(p.pointAt(999)).toEqual({ x: 100, y: 50 });
  });

  it('점과 경로 사이 최단 거리를 잰다', () => {
    expect(p.distanceTo({ x: 50, y: 20 })).toBe(20);
    expect(p.distanceTo({ x: 130, y: 25 })).toBe(30);
  });
});
