import type { Vec } from './types';

/** 꺾은선 경로. 이동 거리로 위치를 구하고, 임의 점과 경로 사이 거리를 잰다. */
export class Path {
  readonly points: Vec[];
  readonly length: number;
  private readonly cum: number[];

  constructor(points: Vec[]) {
    if (points.length < 2) throw new Error('경로는 점이 2개 이상이어야 한다');
    this.points = points;
    this.cum = [0];
    for (let i = 1; i < points.length; i++) {
      this.cum.push(this.cum[i - 1] + dist(points[i - 1], points[i]));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  pointAt(d: number): Vec {
    if (d <= 0) return { ...this.points[0] };
    if (d >= this.length) return { ...this.points[this.points.length - 1] };
    let i = 1;
    while (this.cum[i] < d) i++;
    const a = this.points[i - 1];
    const b = this.points[i];
    const t = (d - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1]);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  distanceTo(p: Vec): number {
    let best = Infinity;
    for (let i = 1; i < this.points.length; i++) {
      best = Math.min(best, distToSegment(p, this.points[i - 1], this.points[i]));
    }
    return best;
  }
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
