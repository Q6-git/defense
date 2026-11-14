import type { Grid, MapDef, Rect, Vec } from '../core/types';

/** 타일 격자: 52px 칸 20×12. 배수관 폭(52)이 정확히 한 칸 */
export const GRID: Grid = { size: 52, x: 0, y: 72, cols: 20, rows: 12 };
/** c열 r행 칸의 가운데 좌표. c = -1이면 맵 왼쪽 바깥(배수구 입구) */
export function tile(c: number, r: number): Vec {
  return { x: c < 0 ? -30 : GRID.x + c * GRID.size + GRID.size / 2, y: GRID.y + r * GRID.size + GRID.size / 2 };
}

/** 소품이 놓인 칸을 설치 불가 영역으로 */
function decorBlocked(decor: NonNullable<MapDef['decor']>): (Rect & { emoji: string })[] {
  return decor.map(({ c, r, w = 1, h = 1 }) => ({ x: GRID.x + c * GRID.size, y: GRID.y + r * GRID.size, w: w * GRID.size, h: h * GRID.size, emoji: '' }));
}

/** 콘센트(기지)가 서는 칸: 길 끝에서 길이 가던 방향으로 한 칸. 3D 화면에서 콘센트가 이 칸에 선다 */
function outletBlocked(path: Vec[]): Rect & { emoji: string } {
  const [a, b] = path.slice(-2);
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  return { x: b.x + dx * GRID.size - GRID.size / 2, y: b.y + dy * GRID.size - GRID.size / 2, w: GRID.size, h: GRID.size, emoji: '' };
}

const KITCHEN_DECOR: NonNullable<MapDef['decor']> = [
  { kind: 'herbTall', c: 18, r: 0 }, { kind: 'shakers', c: 4, r: 0 }, { kind: 'books', c: 12, r: 7, rot: 0.3 },
  { kind: 'cereal', c: 19, r: 4, rot: -0.3 }, { kind: 'herb', c: 9, r: 7, rot: 0.3 }, { kind: 'herb', c: 15, r: 8, rot: 0.5 },
  { kind: 'books', c: 0, r: 8, rot: 0.2 }, { kind: 'herbTall', c: 19, r: 10 }, { kind: 'fruit', c: 6, r: 10 }, { kind: 'herb', c: 0, r: 11 },
];

/** 맵 1: 주방 배수구 → 거실 콘센트(기지). 조리대 위, 나무 도마 고지대와 허브 화분 */
const MAP_KITCHEN_PATH = [tile(-1, 1), tile(16, 1), tile(16, 5), tile(3, 5), tile(3, 9), tile(13, 9), tile(13, 11), tile(18, 11)];
export const MAP_KITCHEN: MapDef = {
  id: 'kitchen',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [MAP_KITCHEN_PATH],
  pathHalfWidth: 26,
  grid: GRID,
  hills: [
    { c: 17, r: 2, w: 3, h: 8, level: 1 }, { c: 18, r: 3, w: 2, h: 4, level: 2 }, { c: 0, r: 6, w: 3, h: 5, level: 1 },
    { c: 7, r: 6, w: 4, h: 3, level: 1 }, { c: 8, r: 7, w: 2, h: 1, level: 2 }, { c: 11, r: 0, w: 4, h: 1, level: 1 },
  ],
  decor: KITCHEN_DECOR,
  blocked: [...decorBlocked(KITCHEN_DECOR), outletBlocked(MAP_KITCHEN_PATH)],
};

/** 맵 2: 욕실. 위아래 배수구 두 곳에서 나온 적이 가운데서 합류한다. 아래쪽에 큰 욕조 */
const BATH_DECOR: NonNullable<MapDef['decor']> = [
  { kind: 'bathtub', c: 9, r: 7, w: 6, h: 4 }, { kind: 'duck', c: 4, r: 3, rot: 0.4 }, { kind: 'shampoo', c: 14, r: 0 },
  { kind: 'toothCup', c: 19, r: 2 }, { kind: 'soap', c: 2, r: 8, rot: 0.3 }, { kind: 'duck', c: 18, r: 11, rot: -0.5 },
];
const MAP_BATHROOM_PATH = [tile(-1, 1), tile(8, 1), tile(8, 5), tile(12, 5), tile(12, 2), tile(16, 2), tile(16, 9), tile(18, 9)];
export const MAP_BATHROOM: MapDef = {
  id: 'bathroom',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [MAP_BATHROOM_PATH, [tile(-1, 11), tile(8, 11), tile(8, 5), tile(12, 5), tile(12, 2), tile(16, 2), tile(16, 9), tile(18, 9)]],
  pathHalfWidth: 26,
  enemyHpMul: 1,
  grid: GRID,
  hills: [{ c: 0, r: 3, w: 3, h: 4, level: 1 }, { c: 0, r: 4, w: 2, h: 2, level: 2 }, { c: 17, r: 3, w: 3, h: 4, level: 1 }, { c: 9, r: 0, w: 2, h: 2, level: 1 }],
  decor: BATH_DECOR,
  blocked: [...decorBlocked(BATH_DECOR), outletBlocked(MAP_BATHROOM_PATH)],
};

/** 맵 3: 베란다. 길은 길게 굽이치지만 화분과 빨래 바구니 때문에 설치 자리가 귀하다 */
const BALCONY_DECOR: NonNullable<MapDef['decor']> = [
  { kind: 'plantPot', c: 3, r: 2, w: 2 }, { kind: 'basket', c: 9, r: 2, w: 2 }, { kind: 'plantPot', c: 15, r: 2, w: 2 },
  { kind: 'shirts', c: 5, r: 5, w: 2 }, { kind: 'plantPot', c: 12, r: 5, w: 3 },
  { kind: 'basket', c: 3, r: 8, w: 2 }, { kind: 'plantPot', c: 9, r: 8, w: 3 }, { kind: 'shirts', c: 15, r: 8, w: 2 },
];
const MAP_BALCONY_PATH = [tile(-1, 1), tile(18, 1), tile(18, 4), tile(1, 4), tile(1, 7), tile(18, 7), tile(18, 10), tile(2, 10)];
export const MAP_BALCONY: MapDef = {
  id: 'balcony',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [MAP_BALCONY_PATH],
  pathHalfWidth: 26,
  grid: GRID,
  hills: [{ c: 0, r: 11, w: 4, h: 1, level: 1 }, { c: 19, r: 2, w: 1, h: 4, level: 1 }, { c: 7, r: 3, w: 4, h: 1, level: 1 }],
  decor: BALCONY_DECOR,
  blocked: [...decorBlocked(BALCONY_DECOR), outletBlocked(MAP_BALCONY_PATH)],
  enemyHpMul: 1.08,
};

/** 맵 4: 세탁실. 바깥에서 안쪽으로 빙글빙글 도는 긴 나선, 콘센트는 한가운데. 안쪽 자리는 여러 바퀴를 한꺼번에 덮는다 */
const LAUNDRY_DECOR: NonNullable<MapDef['decor']> = [
  { kind: 'detergent', c: 19, r: 0 }, { kind: 'clothesPile', c: 0, r: 2, rot: 0.3 }, { kind: 'basket', c: 9, r: 9, w: 2 },
  { kind: 'detergent', c: 2, r: 7, rot: -0.4 }, { kind: 'clothesPile', c: 17, r: 6, rot: -0.2 },
];
const MAP_LAUNDRY_PATH = [tile(-1, 0), tile(18, 0), tile(18, 11), tile(1, 11), tile(1, 3), tile(15, 3), tile(15, 8), tile(4, 8), tile(4, 5), tile(12, 5)];
export const MAP_LAUNDRY: MapDef = {
  id: 'laundry',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [MAP_LAUNDRY_PATH],
  pathHalfWidth: 26,
  enemyHpMul: 1.45,
  grid: GRID,
  hills: [{ c: 5, r: 6, w: 9, h: 1, level: 1 }, { c: 8, r: 6, w: 3, h: 1, level: 2 }, { c: 16, r: 1, w: 2, h: 3, level: 1 }],
  decor: LAUNDRY_DECOR,
  blocked: [...decorBlocked(LAUNDRY_DECOR), outletBlocked(MAP_LAUNDRY_PATH)],
};

/** 맵 5: 거실. 배수관이 자기 자신과 세 번 엇갈린다. 교차점 근처 가전은 같은 적을 두 번 만난다 */
const LIVING_DECOR: NonNullable<MapDef['decor']> = [
  { kind: 'lamp', c: 0, r: 0 }, { kind: 'books', c: 4, r: 6, rot: 0.3 }, { kind: 'toyBlocks', c: 12, r: 3 },
  { kind: 'remote', c: 19, r: 3, rot: 0.6 }, { kind: 'herb', c: 2, r: 10 }, { kind: 'lamp', c: 19, r: 9 },
];
const MAP_LIVING_PATH = [tile(-1, 2), tile(14, 2), tile(14, 9), tile(7, 9), tile(7, 0), tile(17, 0), tile(17, 6), tile(10, 6), tile(10, 11), tile(18, 11)];
export const MAP_LIVING: MapDef = {
  id: 'living',
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  paths: [MAP_LIVING_PATH],
  pathHalfWidth: 26,
  enemyHpMul: 1.5,
  grid: GRID,
  hills: [{ c: 0, r: 4, w: 3, h: 3, level: 1 }, { c: 8, r: 3, w: 3, h: 2, level: 1 }, { c: 18, r: 4, w: 2, h: 4, level: 1 }, { c: 11, r: 7, w: 2, h: 1, level: 1 }],
  decor: LIVING_DECOR,
  blocked: [...decorBlocked(LIVING_DECOR), outletBlocked(MAP_LIVING_PATH)],
};

export const MAP_ORDER = ['kitchen', 'bathroom', 'balcony', 'laundry', 'living'] as const;
export type MapId = (typeof MAP_ORDER)[number];
export const MAPS: Record<MapId, MapDef> = {
  kitchen: MAP_KITCHEN, bathroom: MAP_BATHROOM, balcony: MAP_BALCONY, laundry: MAP_LAUNDRY, living: MAP_LIVING,
};
