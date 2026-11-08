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
  return 1 + 0.12 * w + 0.025 * w * w;
}

export const WAVES: WaveDef[] = TABLE.map((groups, i) => ({
  hpMul: hpMulFor(i + 1),
  groups: groups.map(([enemy, count, interval, delay]): SpawnGroup => ({ enemy, count, interval, delay })),
}));

/** 무한 모드에서 순서대로 돌아가며 나오는 적 */
const ENDLESS_POOL: EnemyId[] = ['goo', 'roach', 'splitter', 'rat', 'grease'];

/**
 * 21웨이브부터 쓰는 자동 생성 웨이브. 난수 없이 웨이브 번호만으로 정해져서 매번 같다(기록 경쟁이 공정하도록).
 * - 적 두 종류가 번갈아 나오고, 마릿수는 천천히, 체력은 빠르게 늘어난다 (범위 공격만 쌓으면 이기지 않도록)
 * - 10웨이브마다 보스: 30에 1마리, 40에 2마리 …
 */
export function endlessWave(n: number): WaveDef {
  const k = n - WAVES.length;
  const a = ENDLESS_POOL[n % ENDLESS_POOL.length];
  const b = ENDLESS_POOL[(n + 2) % ENDLESS_POOL.length];
  const size = 16 + k;
  const interval = Math.max(0.25, 0.55 - k * 0.006);
  const groups: SpawnGroup[] = [
    { enemy: a, count: size, interval, delay: 0 },
    { enemy: b, count: Math.round(size * 0.7), interval: interval * 1.2, delay: 4 },
  ];
  if (n % 10 === 0) groups.push({ enemy: 'boss', count: n / 10 - 2, interval: 4, delay: 6 });
  // 정해진 웨이브 이후에는 웨이브마다 체력이 6%씩 추가로 복리 증가한다
  return { hpMul: hpMulFor(n) * Math.pow(1.06, k), groups };
}
