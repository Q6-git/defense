import type { EnemyDef, EnemyId } from '../core/types';

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  goo: { id: 'goo', hp: 40, speed: 94, armor: 0, reward: 8, radius: 14, emoji: '🟢', color: 0x6fcf4a },
  rat: { id: 'rat', hp: 22, speed: 182, armor: 0, reward: 5, radius: 11, emoji: '🐀', color: 0x9a8f86 },
  grease: { id: 'grease', hp: 220, speed: 57, armor: 0, reward: 22, radius: 19, emoji: '🟤', color: 0x8a5a2b },
  roach: { id: 'roach', hp: 90, speed: 88, armor: 8, reward: 15, radius: 15, emoji: '🪳', color: 0x5b3a1e },
  splitter: {
    id: 'splitter', hp: 110, speed: 81, armor: 0, reward: 10, radius: 17, emoji: '🫧', color: 0x55c2d6,
    splitInto: { id: 'splitling', count: 2 },
  },
  splitling: { id: 'splitling', hp: 35, speed: 122, armor: 0, reward: 4, radius: 10, emoji: '💧', color: 0x7fd8e6 },
  boss: {
    id: 'boss', hp: 1700, speed: 35, armor: 12, reward: 800, radius: 34, emoji: '👹', color: 0x4b2a5e, boss: true,
    summon: { id: 'goo', count: 3, interval: 6 },
  },
  shield: { id: 'shield', hp: 45, speed: 70, armor: 0, reward: 14, radius: 15, emoji: '🛡️', color: 0x7aa0c8, shield: 4 },
  ghost: { id: 'ghost', hp: 60, speed: 100, armor: 0, reward: 10, radius: 14, emoji: '👻', color: 0xcfd3e6, phase: { every: 3, duration: 1.5 } },
  healer: { id: 'healer', hp: 120, speed: 70, armor: 0, reward: 18, radius: 15, emoji: '💉', color: 0xf08fb0, heal: { interval: 2, pct: 0.04, radius: 110 } },
  charger: { id: 'charger', hp: 55, speed: 75, armor: 0, reward: 12, radius: 15, emoji: '🏃', color: 0xe0703a, enrage: { below: 0.5, speedMul: 1.5 } },
};
