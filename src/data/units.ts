import type { UnitDef, UnitId } from '../core/types';

export const UNIT_ORDER: UnitId[] = ['toaster', 'fan', 'microwave', 'vacuum', 'wifi', 'washer'];

export const UNITS: Record<UnitId, UnitDef> = {
  toaster: {
    id: 'toaster', kind: 'single', emoji: '🍞', color: 0xd9893b, radius: 18,
    levels: [
      { cost: 100, damage: 12, range: 150, cooldown: 0.7 },
      { cost: 120, damage: 22, range: 165, cooldown: 0.6 },
      { cost: 220, damage: 40, range: 180, cooldown: 0.5 },
    ],
  },
  fan: {
    id: 'fan', kind: 'slow', emoji: '🌀', color: 0x5fb7e8, radius: 18,
    levels: [
      { cost: 150, damage: 2, range: 110, cooldown: 1.0, slow: 0.6, slowDuration: 1.2 },
      { cost: 150, damage: 4, range: 125, cooldown: 1.0, slow: 0.5, slowDuration: 1.3 },
      { cost: 250, damage: 7, range: 140, cooldown: 0.9, slow: 0.4, slowDuration: 1.4 },
    ],
  },
  microwave: {
    id: 'microwave', kind: 'splash', emoji: '📦', color: 0xc9c9d6, radius: 20,
    levels: [
      { cost: 220, damage: 30, range: 140, cooldown: 1.4, splash: 60 },
      { cost: 220, damage: 55, range: 150, cooldown: 1.25, splash: 68 },
      { cost: 380, damage: 100, range: 165, cooldown: 1.1, splash: 78 },
    ],
  },
  vacuum: {
    id: 'vacuum', kind: 'single', emoji: '🤖', color: 0x6c6f7d, radius: 19,
    levels: [
      { cost: 200, damage: 16, range: 85, cooldown: 0.3 },
      { cost: 200, damage: 30, range: 90, cooldown: 0.27 },
      { cost: 350, damage: 55, range: 100, cooldown: 0.24 },
    ],
  },
  wifi: {
    id: 'wifi', kind: 'buff', emoji: '📶', color: 0x3fbf8f, radius: 17,
    levels: [
      { cost: 200, damage: 0, range: 120, cooldown: 0, buff: 0.15 },
      { cost: 200, damage: 0, range: 140, cooldown: 0, buff: 0.25 },
      { cost: 300, damage: 0, range: 160, cooldown: 0, buff: 0.35 },
    ],
  },
  washer: {
    id: 'washer', kind: 'income', emoji: '🪙', color: 0xe8c547, radius: 20, maxCount: 3,
    levels: [
      { cost: 150, damage: 0, range: 0, cooldown: 0, income: 40 },
      { cost: 150, damage: 0, range: 0, cooldown: 0, income: 75 },
      { cost: 250, damage: 0, range: 0, cooldown: 0, income: 120 },
    ],
  },
};
