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
    id: 'boss', hp: 5000, speed: 35, armor: 12, reward: 800, radius: 34, emoji: '👹', color: 0x4b2a5e, boss: true,
    summon: { id: 'goo', count: 3, interval: 6 },
  },
};
