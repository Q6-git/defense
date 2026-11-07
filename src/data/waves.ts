import type { SpawnGroup, WaveDef } from '../core/game';
import type { EnemyId } from '../core/types';

/** 그룹 축약: [적, 마릿수, 간격(초), 시작 시점(초)] */
type G = [EnemyId, number, number, number];

const TABLE: G[][] = [
  /* 1 */ [['goo', 8, 1.2, 0]],
  /* 2 */ [['goo', 10, 1.0, 0], ['rat', 6, 0.6, 6]],
  /* 3 */ [['goo', 12, 0.8, 0], ['rat', 10, 0.5, 4]],
  /* 4 */ [['goo', 10, 0.8, 0], ['grease', 3, 2.5, 5]],
  /* 5 */ [['roach', 6, 1.5, 0], ['goo', 10, 0.7, 3]],
  /* 6 */ [['splitter', 6, 1.6, 0], ['rat', 12, 0.4, 5]],
  /* 7 */ [['goo', 22, 0.45, 0], ['grease', 4, 2.0, 6]],
  /* 8 */ [['roach', 10, 1.0, 0], ['rat', 16, 0.35, 4]],
  /* 9 */ [['splitter', 10, 1.1, 0], ['grease', 5, 2.0, 4]],
  /* 10 */ [['grease', 10, 1.4, 0], ['roach', 8, 1.0, 3]],
  /* 11 */ [['rat', 30, 0.25, 0], ['splitter', 8, 1.0, 4]],
  /* 12 */ [['roach', 14, 0.8, 0], ['grease', 6, 1.5, 5]],
  /* 13 */ [['goo', 30, 0.3, 0], ['splitter', 12, 0.8, 3], ['rat', 15, 0.3, 8]],
  /* 14 */ [['grease', 14, 1.0, 0], ['roach', 12, 0.7, 4]],
  /* 15 */ [['splitter', 18, 0.6, 0], ['roach', 12, 0.7, 5], ['rat', 20, 0.25, 10]],
  /* 16 */ [['grease', 18, 0.8, 0], ['goo', 30, 0.25, 4]],
  /* 17 */ [['roach', 22, 0.5, 0], ['splitter', 14, 0.6, 5]],
  /* 18 */ [['grease', 20, 0.7, 0], ['roach', 18, 0.5, 3], ['rat', 30, 0.2, 8]],
  /* 19 */ [['splitter', 24, 0.45, 0], ['grease', 16, 0.7, 4], ['roach', 16, 0.5, 8]],
  /* 20 */ [['roach', 12, 0.6, 0], ['boss', 1, 1, 6], ['grease', 10, 1.0, 12]],
];

/** 웨이브가 올라갈수록 적 체력이 늘어난다 */
export function hpMulFor(wave: number): number {
  const w = wave - 1;
  return 1 + 0.14 * w + 0.008 * w * w;
}

export const WAVES: WaveDef[] = TABLE.map((groups, i) => ({
  hpMul: hpMulFor(i + 1),
  groups: groups.map(([enemy, count, interval, delay]): SpawnGroup => ({ enemy, count, interval, delay })),
}));
