import type { MapDef } from '../core/types';

/** 맵 1: 주방 배수구 → 거실 콘센트(기지) */
export const MAP_KITCHEN: MapDef = {
  width: 1280,
  height: 720,
  area: { x: 0, y: 56, w: 1040, h: 664 },
  path: [
    { x: -30, y: 150 },
    { x: 860, y: 150 },
    { x: 860, y: 330 },
    { x: 170, y: 330 },
    { x: 170, y: 530 },
    { x: 700, y: 530 },
    { x: 700, y: 650 },
    { x: 960, y: 650 },
  ],
  pathHalfWidth: 26,
};
