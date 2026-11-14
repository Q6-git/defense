import type { Grid, MapDef, Vec } from '../core/types';

/** 타일 격자: 52px 칸 20×12. 배수관 폭(52)이 정확히 한 칸 */
export const GRID: Grid = { size: 52, x: 0, y: 72, cols: 20, rows: 12 };
/** c열 r행 칸의 가운데 좌표. c = -1이면 맵 왼쪽 바깥(배수구 입구) */
export function tile(c: number, r: number): Vec {
  return { x: c < 0 ? -30 : GRID.x + c * GRID.size + GRID.size / 2, y: GRID.y + r * GRID.size + GRID.size / 2 };
}

/** 맵 1: 주방 배수구 → 거실 콘센트(기지) */
export const MAP_KITCHEN: MapDef = {
  id: 'kitchen',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [[tile(-1, 1), tile(16, 1), tile(16, 5), tile(3, 5), tile(3, 9), tile(13, 9), tile(13, 11), tile(18, 11)]],
  pathHalfWidth: 26,
  grid: GRID,
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

/** 맵 4: 세탁실. 바깥에서 안쪽으로 빙글빙글 도는 긴 나선, 콘센트는 한가운데. 안쪽 자리는 여러 바퀴를 한꺼번에 덮는다 */
export const MAP_LAUNDRY: MapDef = {
  id: 'laundry',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [[
    { x: -30, y: 110 }, { x: 960, y: 110 }, { x: 960, y: 660 }, { x: 80, y: 660 }, { x: 80, y: 240 },
    { x: 830, y: 240 }, { x: 830, y: 530 }, { x: 210, y: 530 }, { x: 210, y: 385 }, { x: 650, y: 385 },
  ]],
  pathHalfWidth: 26,
  enemyHpMul: 1.45,
};

/** 맵 5: 거실. 배수관이 자기 자신과 세 번 엇갈린다. 교차점 근처 가전은 같은 적을 두 번 만난다 */
export const MAP_LIVING: MapDef = {
  id: 'living',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [[
    { x: -30, y: 210 }, { x: 760, y: 210 }, { x: 760, y: 570 }, { x: 380, y: 570 }, { x: 380, y: 110 },
    { x: 920, y: 110 }, { x: 920, y: 400 }, { x: 560, y: 400 }, { x: 560, y: 682 }, { x: 980, y: 682 },
  ]],
  pathHalfWidth: 26,
  enemyHpMul: 1.5,
};

export const MAP_ORDER = ['kitchen', 'bathroom', 'balcony', 'laundry', 'living'] as const;
export type MapId = (typeof MAP_ORDER)[number];
export const MAPS: Record<MapId, MapDef> = {
  kitchen: MAP_KITCHEN, bathroom: MAP_BATHROOM, balcony: MAP_BALCONY, laundry: MAP_LAUNDRY, living: MAP_LIVING,
};
