// 맵별 3D 테마: 타일·고지대 색, 보드 받침, 뒤 배경, 보드 둘레 장식.
import type { OuterKind } from './props';

export interface Theme {
  /** 화면 배경(보드 밖 먼 곳) */
  bg: number;
  /** 바닥 타일 두 색(체크), 고지대 윗면 두 색, 고지대 옆면 */
  tileA: number;
  tileB: number;
  hillA: number;
  hillB: number;
  hillSide: number;
  /** 보드 받침: 윗면(테두리)과 옆면. cabinets면 주방 하부장 문짝을 단다 */
  base: { top: number; side: number; cabinets?: boolean };
  /** 받침 아래 바닥 */
  floor: number;
  /** 뒤 배경: brick 벽돌 타일, square 정사각 타일, wallpaper 줄무늬 벽지, sky 하늘과 난간 */
  wall: { kind: 'brick' | 'square' | 'wallpaper' | 'sky'; fill: string; line: string };
  /** 벽에 창문을 단다 */
  window?: boolean;
  /** 둘레 장식: [종류, x(칸), z(칸), 회전]. 보드 왼쪽 위가 (0,0), 바깥은 음수이거나 20/12 이상 */
  outer: [OuterKind, number, number, number][];
}

export const THEMES: Record<string, Theme> = {
  kitchen: {
    bg: 0x3b3048, tileA: 0xfbe7c6, tileB: 0xeec08a, hillA: 0xe0a868, hillB: 0xd09356, hillSide: 0x9a6438,
    base: { top: 0xb9784a, side: 0xf3e6d3, cabinets: true }, floor: 0x6b5a72,
    wall: { kind: 'brick', fill: '#efe4d2', line: '#d8c8ae' }, window: true,
    outer: [
      ['tallHerb', -1.2, 2.0, 0], ['kettle', -1.3, 5.6, 0.6], ['mugRed', -1.1, 8.6, 0.3], ['bigHerb', -1.3, 11.4, 0],
      ['jars', 21.2, 1.4, 0], ['cuttingBoard', 21.4, 5.2, 1.5], ['plates', 21.2, 8.6, 0], ['boxes', 21.3, 11.5, 0.2],
      ['bigHerb', 2.5, -1.4, 0], ['boxes', 8.5, -1.5, -0.3], ['mugBlue', 12.8, -1.2, 0.6], ['tallHerb', 16.5, -1.4, 0],
    ],
  },
  bathroom: {
    // 하늘색·흰색 타일 바닥, 고지대는 분홍 수건 더미 색
    bg: 0x2f4058, tileA: 0xeaf6fc, tileB: 0xb4dcef, hillA: 0xffc8d8, hillB: 0xffb0c8, hillSide: 0xe88aa8,
    base: { top: 0x9cc8de, side: 0xdcecf4 }, floor: 0x5a7088,
    wall: { kind: 'square', fill: '#e8f4fa', line: '#c4dce8' }, window: true,
    outer: [
      ['towelStack', -1.3, 2.0, 0.2], ['bathBombs', -1.2, 5.5, 0], ['bigDuck', -1.3, 8.5, 0.8], ['toiletRolls', -1.2, 11.2, 0],
      ['sinkCabinet', 21.5, 2.0, -1.57], ['towelStack', 21.3, 6.0, -0.3], ['bathBombs', 21.2, 9.0, 0], ['bigHerb', 21.3, 11.5, 0],
      ['bigHerb', 2.5, -1.4, 0], ['towelStack', 8.0, -1.5, 0.1], ['toiletRolls', 13.0, -1.4, 0], ['bigDuck', 17.0, -1.4, -0.4],
    ],
  },
  balcony: {
    // 나무 데크 바닥, 고지대는 벽돌 화단, 뒤는 하늘과 난간
    bg: 0x8fc8ea, tileA: 0xe8c99a, tileB: 0xd9b07a, hillA: 0xc8643a, hillB: 0xb8582f, hillSide: 0x8a3f22,
    base: { top: 0xa87850, side: 0xc89a6a }, floor: 0x7a9a6a,
    wall: { kind: 'sky', fill: '#bfe6ff', line: '#ffffff' },
    outer: [
      ['tallHerb', -1.2, 2.0, 0], ['wateringCan', -1.3, 5.5, 0.5], ['bigHerb', -1.3, 8.6, 0], ['bucket', -1.1, 11.3, 0],
      ['potsStack', 21.2, 1.6, 0], ['bigHerb', 21.3, 5.0, 0], ['tallHerb', 21.2, 8.4, 0], ['wateringCan', 21.3, 11.4, -2.4],
      ['bigPlanter', 3.5, -1.4, 0], ['bigHerb', 9.5, -1.5, 0], ['bigPlanter', 15.5, -1.4, 0],
    ],
  },
  laundry: {
    // 연보라·회색 타일, 고지대는 빨래 더미 색
    bg: 0x3a3a52, tileA: 0xeeedf8, tileB: 0xc8c4e2, hillA: 0xb8d8f8, hillB: 0xa8c8f0, hillSide: 0x7a98c8,
    base: { top: 0x9a96b8, side: 0xdcd9ec }, floor: 0x55556e,
    wall: { kind: 'square', fill: '#ecebf6', line: '#cfcde2' },
    outer: [
      ['bigBasket', -1.3, 2.2, 0.3], ['bigClothes', -1.3, 5.5, 0], ['shelf', -1.4, 9.0, 1.57], ['bigHerb', -1.3, 11.5, 0],
      ['washerBig', 21.6, 2.2, -0.4], ['dryerBig', 21.6, 6.2, -0.4], ['bigBasket', 21.3, 9.5, 0], ['bigClothes', 21.2, 11.6, 0],
      ['washerBig', 3.5, -1.8, 0], ['dryerBig', 7.0, -1.8, 0], ['shelf', 12.0, -1.6, 0], ['bigHerb', 16.5, -1.5, 0],
    ],
  },
  living: {
    // 따뜻한 원목 바닥, 고지대는 폭신한 쿠션 색
    bg: 0x3e3044, tileA: 0xf3e2d3, tileB: 0xe6c9ad, hillA: 0xf6b8a8, hillB: 0xf0a898, hillSide: 0xc87a6a,
    base: { top: 0xa8744a, side: 0xc8946a }, floor: 0x6a5060,
    wall: { kind: 'wallpaper', fill: '#f6ead8', line: '#ecd8bc' }, window: true,
    outer: [
      ['floorLamp', -1.3, 2.0, 0], ['bigBlocks', -1.2, 5.5, 0.3], ['bigHerb', -1.3, 8.8, 0], ['bigHerb', -1.2, 11.4, 0],
      ['bookshelf', 21.4, 2.0, -1.57], ['floorLamp', 21.3, 5.8, 0], ['bigBlocks', 21.2, 9.0, -0.4], ['tallHerb', 21.3, 11.4, 0],
      ['sofa', 5.0, -1.9, 0], ['tvStand', 13.5, -1.7, 0], ['tallHerb', 18.0, -1.4, 0],
    ],
  },
};
