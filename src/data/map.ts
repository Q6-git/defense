import type { MapDef } from '../core/types';

/** 맵 1: 주방 배수구 → 거실 콘센트(기지) */
export const MAP_KITCHEN: MapDef = {
  id: 'kitchen',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [[
    { x: -30, y: 150 },
    { x: 860, y: 150 },
    { x: 860, y: 330 },
    { x: 170, y: 330 },
    { x: 170, y: 530 },
    { x: 700, y: 530 },
    { x: 700, y: 650 },
    { x: 960, y: 650 },
  ]],
  pathHalfWidth: 26,
};

/** 맵 2: 욕실. 위아래 배수구 두 곳에서 나온 적이 가운데서 합류한다 */
export const MAP_BATHROOM: MapDef = {
  id: 'bathroom',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [
    [
      { x: -30, y: 130 }, { x: 420, y: 130 }, { x: 420, y: 370 },
      { x: 640, y: 370 }, { x: 640, y: 230 }, { x: 870, y: 230 }, { x: 870, y: 560 }, { x: 980, y: 560 },
    ],
    [
      { x: -30, y: 650 }, { x: 420, y: 650 }, { x: 420, y: 370 },
      { x: 640, y: 370 }, { x: 640, y: 230 }, { x: 870, y: 230 }, { x: 870, y: 560 }, { x: 980, y: 560 },
    ],
  ],
  pathHalfWidth: 26,
  blocked: [{ x: 480, y: 470, w: 330, h: 200, emoji: '🛁' }],
  enemyHpMul: 1,
};

/** 맵 3: 베란다. 길은 길게 굽이치지만 화분과 빨래 바구니 때문에 설치 자리가 귀하다 */
export const MAP_BALCONY: MapDef = {
  id: 'balcony',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [[
    { x: -30, y: 120 }, { x: 940, y: 120 }, { x: 940, y: 280 }, { x: 100, y: 280 },
    { x: 100, y: 440 }, { x: 940, y: 440 }, { x: 940, y: 600 }, { x: 140, y: 600 },
  ]],
  pathHalfWidth: 26,
  blocked: [
    { x: 150, y: 172, w: 110, h: 56, emoji: '🪴' },
    { x: 470, y: 172, w: 130, h: 56, emoji: '🧺' },
    { x: 790, y: 172, w: 110, h: 56, emoji: '🪴' },
    { x: 250, y: 332, w: 130, h: 56, emoji: '👕' },
    { x: 620, y: 332, w: 140, h: 56, emoji: '🪴' },
    { x: 180, y: 492, w: 120, h: 56, emoji: '🧺' },
    { x: 500, y: 492, w: 140, h: 56, emoji: '🪴' },
    { x: 820, y: 492, w: 90, h: 56, emoji: '👕' },
  ],
  enemyHpMul: 1.08,
};

export const MAP_ORDER = ['kitchen', 'bathroom', 'balcony'] as const;
export type MapId = (typeof MAP_ORDER)[number];
export const MAPS: Record<MapId, MapDef> = { kitchen: MAP_KITCHEN, bathroom: MAP_BATHROOM, balcony: MAP_BALCONY };
