// 3D 소품. 1칸 = 1 크기 기준으로 만들고, 보드에서 칸 크기만큼 키운다.
// 칸 위 소품(decor)은 설치 불가 칸이 되고, 바깥 소품(outer)은 보드 둘레의 장식이다.
import * as THREE from 'three';
import type { DecorKind } from '../core/types';
import { at, cyl, face, group, metal, plastic, rbox, sphere, torus } from './kit';

const leaf = (color: number) => plastic(color, 0.7);

/** 허브 화분: 테라코타 화분 + 둥근 잎 덩어리 (tall이면 로즈메리처럼 길쭉하게) */
function herb(tall = false, size = 1): THREE.Group {
  const g = group(
    at(cyl(0.32, 0.24, 0.4, plastic(0xd2693c, 0.6)), 0, 0.2, 0),
    at(cyl(0.34, 0.34, 0.08, plastic(0xb85a30, 0.6)), 0, 0.42, 0),
    at(cyl(0.29, 0.29, 0.04, plastic(0x5a3a22, 0.9)), 0, 0.44, 0),
  );
  const blobs: [number, number, number, number][] = tall
    ? [[0, 0.95, 0, 0.26], [0.05, 1.35, 0.02, 0.22], [-0.02, 1.7, 0, 0.17], [0.15, 0.85, 0.1, 0.18], [-0.16, 1.1, -0.05, 0.17]]
    : [[0, 0.8, 0, 0.34], [0.22, 0.72, 0.12, 0.24], [-0.22, 0.7, 0.08, 0.24], [0.05, 1.05, -0.05, 0.24], [-0.1, 0.78, -0.2, 0.22]];
  blobs.forEach(([x, y, z, r], i) => g.add(at(sphere(r, leaf(i % 2 ? 0x5fae4a : 0x77c25a)), x, y, z)));
  g.scale.setScalar(size);
  return g;
}

function books(n: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xe0604a, 0x4f8fd0, 0xf2c230, 0x6abf69];
  for (let i = 0; i < n; i++) g.add(at(rbox(0.82 - i * 0.06, 0.16, 0.6, 0.03, plastic(colors[i % 4], 0.5)), (i % 2) * 0.04, 0.08 + i * 0.17, 0, 0, i * 0.18, 0));
  return g;
}

const cereal = () => group(at(rbox(0.7, 1.3, 0.32, 0.04, plastic(0xffb43a, 0.5)), 0, 0.65, 0), at(rbox(0.5, 0.45, 0.02, 0.02, plastic(0xffffff, 0.5)), 0, 0.75, 0.17), at(sphere(0.12, plastic(0xe0604a)), 0, 0.75, 0.19));
const shakers = () => group(
  at(cyl(0.13, 0.15, 0.5, plastic(0xffffff, 0.3)), -0.15, 0.25, 0), at(sphere(0.13, metal(0xcfd5df)), -0.15, 0.52, 0),
  at(cyl(0.13, 0.15, 0.5, plastic(0x3a3440, 0.3)), 0.17, 0.25, 0.05), at(sphere(0.13, metal(0xcfd5df)), 0.17, 0.52, 0.05),
);
const fruit = () => group(at(sphere(0.42, plastic(0xffffff, 0.3), 1, 0.45, 1), 0, 0.15, 0), at(sphere(0.17, plastic(0xff5a4a)), -0.12, 0.33, 0.05), at(sphere(0.16, plastic(0xffc23a)), 0.14, 0.33, -0.05), at(sphere(0.15, plastic(0x8ad04a)), 0, 0.38, 0.15));

export const DECOR: Record<DecorKind, () => THREE.Object3D> = {
  herb: () => herb(),
  herbTall: () => herb(true),
  books: () => books(3),
  cereal,
  shakers,
  fruit,
};

// ── 보드 바깥 장식 (캡처 화면의 바깥 나무·바위·언덕 역할): 크고 다양한 높이의 주방 물건

const kettle = () => group(
  at(sphere(0.9, plastic(0xe85d5d, 0.3), 1, 0.85, 1), 0, 0.8, 0),
  at(cyl(0.55, 0.75, 0.25, plastic(0xe85d5d, 0.3)), 0, 0.12, 0),
  at(torus(0.5, 0.08, plastic(0x3a3440), Math.PI), 0, 1.45, 0),
  at(cyl(0.12, 0.2, 0.7, plastic(0xe85d5d, 0.3)), 0.95, 0.9, 0, 0, 0, -0.9),
  at(sphere(0.12, plastic(0x3a3440)), 0, 1.55, 0),
  at(face(1.3), 0, 0.85, 0.86),
);
const cuttingBoard = () => group(
  rbox(2.4, 0.18, 1.4, 0.08, plastic(0xd9a066, 0.7)),
  at(sphere(0.32, plastic(0xff7a2a), 1.6, 0.8, 0.8), -0.5, 0.25, 0.1, 0, 0.4, 0), // 당근
  at(sphere(0.3, plastic(0x7ac04a), 1, 1, 1), 0.45, 0.35, -0.15), // 양배추
  at(sphere(0.18, plastic(0xff4a4a)), 0.7, 0.22, 0.35), // 방울토마토
);
const plates = () => {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) g.add(at(cyl(0.7, 0.62, 0.1, plastic(i % 2 ? 0xffffff : 0xe8f2fb, 0.25), 32), 0, 0.05 + i * 0.11, 0));
  return g;
};
const jars = () => group(
  at(cyl(0.38, 0.38, 1.2, new THREE.MeshStandardMaterial({ color: 0xcfeee2, roughness: 0.1, transparent: true, opacity: 0.75 })), 0, 0.6, 0),
  at(cyl(0.4, 0.4, 0.18, plastic(0x6abf69)), 0, 1.25, 0),
  at(cyl(0.3, 0.3, 0.8, new THREE.MeshStandardMaterial({ color: 0xffe2b8, roughness: 0.1, transparent: true, opacity: 0.75 })), 0.75, 0.4, 0.2),
  at(cyl(0.32, 0.32, 0.15, plastic(0xe0604a)), 0.75, 0.85, 0.2),
);
const boxes = () => group(
  at(rbox(1.4, 0.9, 1.0, 0.06, plastic(0xc9a27a, 0.8)), 0, 0.45, 0),
  at(rbox(1.0, 0.7, 0.8, 0.06, plastic(0xd8b58c, 0.8)), 0.1, 1.25, 0.05, 0, 0.3, 0),
  at(rbox(0.6, 0.5, 0.5, 0.05, plastic(0xe7c9a2, 0.8)), -0.1, 1.85, 0, 0, -0.2, 0),
);
const mug = (color: number) => group(at(cyl(0.38, 0.34, 0.75, plastic(color)), 0, 0.37, 0), at(torus(0.2, 0.07, plastic(color)), 0.42, 0.4, 0));

export type OuterKind = 'kettle' | 'cuttingBoard' | 'plates' | 'jars' | 'boxes' | 'bigHerb' | 'tallHerb' | 'mugRed' | 'mugBlue';
export const OUTER: Record<OuterKind, () => THREE.Object3D> = {
  kettle, cuttingBoard, plates, jars, boxes,
  bigHerb: () => herb(false, 2.2),
  tallHerb: () => herb(true, 2.0),
  mugRed: () => mug(0xff8a6a),
  mugBlue: () => mug(0x7ac0ff),
};

/** 주방 보드 둘레 장식 배치: [종류, x(칸), z(칸), 회전]. 보드 왼쪽 위가 (0,0), 보드 바깥은 음수이거나 cols/rows 이상 */
export const KITCHEN_OUTER: [OuterKind, number, number, number][] = [
  ['tallHerb', -1.2, 2.0, 0], ['kettle', -1.3, 5.6, 0.6], ['mugRed', -1.1, 8.6, 0.3], ['bigHerb', -1.3, 11.4, 0],
  ['jars', 21.2, 1.4, 0], ['cuttingBoard', 21.4, 5.2, 1.5], ['plates', 21.2, 8.6, 0], ['boxes', 21.3, 11.5, 0.2],
  ['bigHerb', 2.5, -1.4, 0], ['boxes', 8.5, -1.5, -0.3], ['mugBlue', 12.8, -1.2, 0.6], ['tallHerb', 16.5, -1.4, 0],
];
