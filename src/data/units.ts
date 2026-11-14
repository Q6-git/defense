import type { UnitDef, UnitId } from '../core/types';

/** 처음부터 가진 가전 (기본 덱) */
export const UNIT_ORDER: UnitId[] = ['toaster', 'fan', 'microwave', 'vacuum', 'wifi', 'washer'];
/** 뽑기로 얻는 가전 */
export const GACHA_UNITS: UnitId[] = ['stove', 'strip', 'battery', 'iron', 'aircon', 'dishwasher'];

export const UNITS: Record<UnitId, UnitDef> = {
  toaster: {
    id: 'toaster', kind: 'single', emoji: '🍞', color: 0xd9893b, radius: 18,
    levels: [
      { cost: 100, damage: 12, range: 150, cooldown: 0.7 },
      { cost: 120, damage: 22, range: 165, cooldown: 0.6 },
      { cost: 220, damage: 40, range: 180, cooldown: 0.5 },
    ],
    branches: [
      { id: 'rapid', emoji: '🔫', cost: 450, damage: 32, range: 200, cooldown: 0.1 },
      { id: 'sniper', emoji: '🎯', cost: 450, damage: 260, range: 320, cooldown: 1.6, pierceArmor: true, defaultTarget: 'strong' },
    ],
  },
  fan: {
    id: 'fan', kind: 'slow', emoji: '🌀', color: 0x5fb7e8, radius: 18,
    levels: [
      { cost: 150, damage: 2, range: 110, cooldown: 1.0, slow: 0.6, slowDuration: 1.2 },
      { cost: 150, damage: 4, range: 125, cooldown: 1.0, slow: 0.5, slowDuration: 1.3 },
      { cost: 250, damage: 7, range: 140, cooldown: 0.9, slow: 0.4, slowDuration: 1.4 },
    ],
    branches: [
      { id: 'typhoon', emoji: '🌪️', cost: 400, damage: 10, range: 150, cooldown: 1.8, slow: 0.4, slowDuration: 1.4, knockback: 45 },
      { id: 'frost', emoji: '❄️', cost: 400, damage: 10, range: 150, cooldown: 1.8, slow: 0.4, slowDuration: 1.4, freeze: 1.0, frozenVuln: 1.4 },
    ],
  },
  microwave: {
    id: 'microwave', kind: 'splash', emoji: '📦', color: 0xc9c9d6, radius: 20,
    levels: [
      { cost: 220, damage: 30, range: 140, cooldown: 1.4, splash: 60 },
      { cost: 220, damage: 55, range: 150, cooldown: 1.25, splash: 68 },
      { cost: 380, damage: 100, range: 165, cooldown: 1.1, splash: 78 },
    ],
    branches: [
      { id: 'nuke', emoji: '☢️', cost: 600, damage: 150, range: 175, cooldown: 1.2, splash: 105, burn: { dps: 40, duration: 3 } },
      { id: 'grill', emoji: '🍳', cost: 600, damage: 34, range: 190, cooldown: 0.1, ramp: { step: 0.05, max: 4 }, defaultTarget: 'strong' },
    ],
  },
  vacuum: {
    id: 'vacuum', kind: 'single', emoji: '🤖', color: 0x6c6f7d, radius: 19,
    levels: [
      { cost: 200, damage: 16, range: 85, cooldown: 0.3 },
      { cost: 200, damage: 30, range: 90, cooldown: 0.27 },
      { cost: 350, damage: 55, range: 100, cooldown: 0.24 },
    ],
    branches: [
      { id: 'suction', emoji: '💨', cost: 550, damage: 40, range: 110, cooldown: 0.3, hitAll: true },
      { id: 'crusher', emoji: '🦾', cost: 550, damage: 200, range: 100, cooldown: 0.35, pierceArmor: true },
    ],
  },
  wifi: {
    id: 'wifi', kind: 'buff', emoji: '📶', color: 0x3fbf8f, radius: 17,
    levels: [
      { cost: 200, damage: 0, range: 120, cooldown: 0, buff: 0.15 },
      { cost: 200, damage: 0, range: 140, cooldown: 0, buff: 0.25 },
      { cost: 300, damage: 0, range: 160, cooldown: 0, buff: 0.35 },
    ],
    branches: [
      { id: 'fiveg', emoji: '📡', cost: 500, damage: 0, range: 240, cooldown: 0, buff: 0.6 },
      { id: 'hack', emoji: '🛰️', cost: 500, damage: 0, range: 180, cooldown: 0, buff: 0.35, hackVuln: 1.25 },
    ],
  },
  washer: {
    id: 'washer', kind: 'income', emoji: '🪙', color: 0xe8c547, radius: 20, maxCount: 3,
    levels: [
      { cost: 150, damage: 0, range: 0, cooldown: 0, income: 40 },
      { cost: 150, damage: 0, range: 0, cooldown: 0, income: 75 },
      { cost: 250, damage: 0, range: 0, cooldown: 0, income: 120 },
    ],
    branches: [
      { id: 'interest', emoji: '🏦', cost: 400, damage: 0, range: 0, cooldown: 0, income: 120, interest: { rate: 0.1, max: 120 } },
      { id: 'bounty', emoji: '⛲', cost: 400, damage: 0, range: 160, cooldown: 0, income: 120, bounty: { radius: 160, mul: 1.5 } },
    ],
  },
  // ── 뽑기로 얻는 가전 (Lv3 다음 갈림길: A 떼거리용 / B 강적용)
  stove: {
    id: 'stove', kind: 'single', emoji: '🔥', color: 0xe8603a, radius: 19,
    levels: [
      { cost: 140, damage: 6, range: 100, cooldown: 0.5, dot: { dps: 18, duration: 3 } },
      { cost: 160, damage: 10, range: 110, cooldown: 0.5, dot: { dps: 34, duration: 3 } },
      { cost: 300, damage: 16, range: 120, cooldown: 0.45, dot: { dps: 58, duration: 3 } },
    ],
    branches: [
      { id: 'flamer', emoji: '🌋', cost: 500, damage: 14, range: 130, cooldown: 0.5, hitAll: true, dot: { dps: 35, duration: 3 } },
      { id: 'pressure', emoji: '🍲', cost: 500, damage: 60, range: 135, cooldown: 1.4, dot: { dps: 150, duration: 4 }, defaultTarget: 'strong' },
    ],
  },
  strip: {
    id: 'strip', kind: 'single', emoji: '⚡', color: 0xf2c230, radius: 18,
    levels: [
      { cost: 200, damage: 20, range: 150, cooldown: 1.0, chainHits: 4 },
      { cost: 200, damage: 38, range: 160, cooldown: 0.9, chainHits: 4 },
      { cost: 340, damage: 68, range: 170, cooldown: 0.8, chainHits: 5 },
    ],
    branches: [
      { id: 'surge', emoji: '🌩️', cost: 500, damage: 110, range: 185, cooldown: 0.5, chainHits: 10 },
      { id: 'highvolt', emoji: '🔌', cost: 500, damage: 280, range: 190, cooldown: 1.0, chainHits: 2, pierceArmor: true, defaultTarget: 'strong' },
    ],
  },
  battery: {
    id: 'battery', kind: 'buff', emoji: '🔋', color: 0x7ac74f, radius: 17,
    levels: [
      { cost: 220, damage: 0, range: 110, cooldown: 0, dmgBuff: 0.2 },
      { cost: 220, damage: 0, range: 125, cooldown: 0, dmgBuff: 0.3 },
      { cost: 320, damage: 0, range: 140, cooldown: 0, dmgBuff: 0.4 },
    ],
    branches: [
      { id: 'bigcell', emoji: '🔆', cost: 450, damage: 0, range: 230, cooldown: 0, dmgBuff: 0.5 },
      { id: 'overcharge', emoji: '💥', cost: 450, damage: 0, range: 150, cooldown: 0, dmgBuff: 0.9 },
    ],
  },
  iron: {
    id: 'iron', kind: 'single', emoji: '👔', color: 0x8c9ab0, radius: 19,
    levels: [
      { cost: 200, damage: 80, range: 140, cooldown: 2.0, shred: 2 },
      { cost: 220, damage: 170, range: 150, cooldown: 1.8, shred: 3 },
      { cost: 380, damage: 340, range: 160, cooldown: 1.6, shred: 4 },
    ],
    branches: [
      { id: 'steam', emoji: '💨', cost: 550, damage: 170, range: 230, cooldown: 1.0, line: 34, shred: 3 },
      { id: 'press', emoji: '🗜️', cost: 550, damage: 750, range: 165, cooldown: 1.7, shred: 6, defaultTarget: 'strong' },
    ],
  },
  aircon: {
    id: 'aircon', kind: 'aura', emoji: '❄️', color: 0x9fd8f0, radius: 20, maxCount: 1,
    levels: [
      { cost: 180, damage: 0, range: 0, cooldown: 0, globalSlow: 0.2 },
      { cost: 200, damage: 0, range: 0, cooldown: 0, globalSlow: 0.3 },
      { cost: 300, damage: 0, range: 0, cooldown: 0, globalSlow: 0.35 },
    ],
    branches: [
      { id: 'deepfreeze', emoji: '🧊', cost: 450, damage: 0, range: 0, cooldown: 0, globalSlow: 0.45 },
      { id: 'dehumid', emoji: '💧', cost: 450, damage: 0, range: 0, cooldown: 0, globalSlow: 0.35, globalVuln: 0.25 },
    ],
  },
  dishwasher: {
    id: 'dishwasher', kind: 'single', emoji: '🚿', color: 0x4f9fe0, radius: 20,
    levels: [
      { cost: 260, damage: 36, range: 260, cooldown: 1.5, line: 24 },
      { cost: 280, damage: 65, range: 280, cooldown: 1.4, line: 24 },
      { cost: 460, damage: 115, range: 300, cooldown: 1.3, line: 26 },
    ],
    branches: [
      { id: 'jet', emoji: '🌊', cost: 650, damage: 130, range: 300, cooldown: 1.0, line: 56 },
      { id: 'sterilize', emoji: '🧪', cost: 650, damage: 600, range: 340, cooldown: 1.6, pierceArmor: true, defaultTarget: 'strong' },
    ],
  },
};
