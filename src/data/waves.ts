import type { WaveDef } from '../core/game';

// 임시 웨이브 (4단계에서 20개로 확장)
export const WAVES: WaveDef[] = [
  { hpMul: 1, groups: [{ enemy: 'goo', count: 8, interval: 1.2, delay: 0 }] },
  { hpMul: 1, groups: [{ enemy: 'goo', count: 6, interval: 1, delay: 0 }, { enemy: 'rat', count: 6, interval: 0.6, delay: 4 }] },
];
