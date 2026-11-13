import type { SpawnGroup, WaveDef } from '../core/game';
import type { EnemyId, WaveModDef } from '../core/types';

/** 그룹 축약: [적, 마릿수, 간격(초), 시작 시점(초)] */
type G = [EnemyId, number, number, number];

const TABLE: G[][] = [
  /* 1 */ [['goo', 8, 1.2, 0]],
  /* 2 */ [['goo', 10, 1.0, 0], ['rat', 6, 0.6, 6]],
  /* 3 */ [['goo', 12, 0.8, 0], ['rat', 10, 0.5, 4]],
  /* 4 */ [['goo', 10, 0.8, 0], ['grease', 3, 2.5, 5]],
  /* 5 */ [['roach', 6, 1.5, 0], ['goo', 10, 0.7, 3]],
  /* 6 */ [['splitter', 5, 1.6, 0], ['rat', 10, 0.4, 5], ['shield', 3, 1.5, 3]],
  /* 7 */ [['goo', 18, 0.45, 0], ['grease', 4, 2.0, 6], ['ghost', 5, 0.8, 3]],
  /* 8 */ [['roach', 9, 1.0, 0], ['rat', 14, 0.35, 4], ['healer', 2, 3.0, 2]],
  /* 9 */ [['splitter', 8, 1.1, 0], ['grease', 5, 2.0, 4], ['charger', 4, 1.2, 2]],
  /* 10 */ [['grease', 9, 1.4, 0], ['roach', 7, 1.0, 3], ['shield', 5, 1.2, 5]],
  /* 11 */ [['rat', 26, 0.25, 0], ['splitter', 7, 1.0, 4], ['ghost', 8, 0.6, 2]],
  /* 12 */ [['roach', 12, 0.8, 0], ['grease', 6, 1.5, 5], ['healer', 3, 2.5, 3]],
  /* 13 */ [['goo', 26, 0.3, 0], ['splitter', 10, 0.8, 3], ['rat', 12, 0.3, 8], ['charger', 8, 0.7, 5]],
  /* 14 */ [['grease', 12, 1.0, 0], ['roach', 10, 0.7, 4], ['shield', 8, 0.9, 2]],
  /* 15 */ [['splitter', 13, 0.6, 0], ['roach', 9, 0.7, 5], ['rat', 16, 0.25, 10], ['healer', 2, 3.0, 4]],
  /* 16 */ [['grease', 16, 0.8, 0], ['goo', 26, 0.25, 4], ['ghost', 12, 0.5, 2]],
  /* 17 */ [['roach', 19, 0.5, 0], ['splitter', 12, 0.6, 5], ['charger', 12, 0.6, 3]],
  /* 18 */ [['grease', 17, 0.7, 0], ['roach', 15, 0.5, 3], ['rat', 26, 0.2, 8], ['shield', 9, 0.8, 2], ['healer', 3, 2.5, 6]],
  /* 19 */ [['splitter', 20, 0.45, 0], ['grease', 14, 0.7, 4], ['roach', 14, 0.5, 8], ['ghost', 10, 0.5, 2], ['charger', 10, 0.6, 6]],
  /* 20 */ [['roach', 12, 0.6, 0], ['boss', 1, 1, 6], ['grease', 9, 1.0, 12], ['healer', 2, 3.0, 8]],
];

/** 웨이브가 올라갈수록 적 체력이 늘어난다 */
export function hpMulFor(wave: number): number {
  const w = wave - 1;
  return 1 + 0.12 * w + 0.031 * w * w;
}

export const WAVES: WaveDef[] = TABLE.map((groups, i) => ({
  hpMul: hpMulFor(i + 1),
  groups: groups.map(([enemy, count, interval, delay]): SpawnGroup => ({ enemy, count, interval, delay })),
}));

/** 무한 모드에서 순서대로 돌아가며 나오는 적 */
const ENDLESS_POOL: EnemyId[] = ['goo', 'roach', 'shield', 'splitter', 'ghost', 'rat', 'charger', 'grease'];

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
  // 3웨이브에 한 번은 치유사가 따라온다
  if (n % 3 === 0) groups.push({ enemy: 'healer', count: 2 + Math.floor(k / 6), interval: 2.5, delay: 3 });
  if (n % 10 === 0) groups.push({ enemy: 'boss', count: n / 10 - 2, interval: 4, delay: 6 });
  // 정해진 웨이브 이후에는 웨이브마다 체력이 8%씩 추가로 복리 증가한다 (약 9웨이브마다 2배).
  // 가전을 놓을 자리는 한정돼 있으니, 아무리 잘 짜도 언젠가는 무너진다
  return { hpMul: hpMulFor(n) * Math.pow(1.08, k), groups };
}

/** 특수 웨이브 변칙. 5의 배수 웨이브 중 보스가 없는 웨이브에 판마다 무작위로 하나가 붙는다 */
export const WAVE_MODS: WaveModDef[] = [
  { id: 'rush', emoji: '🐀', countMul: 1.5, hpMul: 0.65 },
  { id: 'fog', emoji: '🌫️', rangeMul: 0.88 },
  { id: 'haste', emoji: '💨', speedMul: 1.2 },
  { id: 'steel', emoji: '🪨', armorAdd: 3 },
  { id: 'gold', emoji: '🥇', rewardMul: 2, hpMul: 1.2 },
];
