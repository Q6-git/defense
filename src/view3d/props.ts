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

// ── 욕실
const glossy = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.05 });
const duck = () => group(
  at(sphere(0.3, glossy(0xffd23a), 1.2, 0.85, 1), 0, 0.26, 0),
  at(sphere(0.2, glossy(0xffd23a)), 0.18, 0.55, 0),
  at(sphere(0.09, glossy(0xff8a2a), 1.4, 0.6, 1), 0.38, 0.52, 0),
  at(sphere(0.04, plastic(0x2a2230)), 0.25, 0.62, 0.12), at(sphere(0.04, plastic(0x2a2230)), 0.25, 0.62, -0.12),
);
const bubbles = (n: number, spread: number, y: number) => {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.05, transparent: true, opacity: 0.75 });
  for (let i = 0; i < n; i++) {
    const a = i * 2.4;
    g.add(at(sphere(0.08 + (i % 3) * 0.04, m), Math.cos(a) * spread * ((i % 4) / 4 + 0.3), y + (i % 3) * 0.06, Math.sin(a) * spread * ((i % 5) / 5 + 0.2)));
  }
  return g;
};
/** 욕조: w×h 칸 크기의 하얀 욕조 + 물 + 거품 + 수도꼭지 + 오리 */
const bathtub = (w: number, h: number) => {
  const W = w * 0.94, D = h * 0.9;
  const g = group(
    at(rbox(W, 0.9, D, 0.3, glossy(0xffffff)), 0, 0.5, 0),
    // 물: 욕조 테두리 바로 위에 안쪽 크기로 깔아 테두리 안이 물로 찬 것처럼
    at(rbox(W - 0.35, 0.04, D - 0.35, 0.15, new THREE.MeshStandardMaterial({ color: 0x6fc3ea, roughness: 0.05, metalness: 0.1, emissive: 0x2a7fb0, emissiveIntensity: 0.2 })), 0, 0.96, 0),
    at(bubbles(16, W * 0.35, 1.0), 0, 0, 0),
    at(cyl(0.06, 0.06, 0.6, metal(0xcfd5df)), -W / 2 + 0.3, 1.15, -D / 2 + 0.2),
    at(cyl(0.06, 0.06, 0.5, metal(0xcfd5df)), -W / 2 + 0.5, 1.42, -D / 2 + 0.2, 0, 0, Math.PI / 2),
    at(duck(), W * 0.15, 0.92, 0.1, 0, -0.6, 0),
  );
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(sphere(0.12, metal(0xd8b04a)), x * (W / 2 - 0.3), 0.05, z * (D / 2 - 0.2)));
  return g;
};
const shampoo = () => group(
  at(rbox(0.42, 0.8, 0.3, 0.12, glossy(0xff8fb0)), 0, 0.4, 0),
  at(rbox(0.3, 0.3, 0.02, 0.05, plastic(0xffffff, 0.5)), 0, 0.42, 0.16),
  at(cyl(0.08, 0.08, 0.15, plastic(0xffffff)), 0, 0.88, 0),
  at(rbox(0.25, 0.06, 0.08, 0.03, plastic(0xffffff)), 0.08, 0.97, 0),
);
const toothCup = () => group(
  at(cyl(0.22, 0.18, 0.5, glossy(0x7ac0ff)), 0, 0.25, 0),
  at(rbox(0.05, 0.75, 0.05, 0.02, plastic(0xff6a6a)), -0.06, 0.6, 0, 0, 0, 0.2), at(rbox(0.12, 0.1, 0.06, 0.03, plastic(0xffffff)), -0.14, 0.97, 0),
  at(rbox(0.05, 0.75, 0.05, 0.02, plastic(0x6abf69)), 0.06, 0.6, 0, 0, 0, -0.2), at(rbox(0.12, 0.1, 0.06, 0.03, plastic(0xffffff)), 0.14, 0.97, 0),
);
const soap = () => group(at(rbox(0.6, 0.22, 0.4, 0.1, glossy(0xbfeccf)), 0, 0.11, 0), bubbles(7, 0.35, 0.28));

// ── 베란다
/** 긴 화단: w칸 너비 테라코타 상자 + 잎과 꽃 */
const plantPot = (w: number) => {
  const W = w * 0.92;
  const g = group(at(rbox(W, 0.45, 0.7, 0.08, plastic(0xc8643a, 0.6)), 0, 0.22, 0), at(rbox(W - 0.12, 0.05, 0.58, 0.03, plastic(0x5a3a22, 0.9)), 0, 0.45, 0));
  const n = Math.round(w * 2);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + 0.3 + (i * (W - 0.6)) / Math.max(1, n - 1);
    g.add(at(sphere(0.26, leaf(i % 2 ? 0x5fae4a : 0x77c25a)), x, 0.72 + (i % 2) * 0.12, (i % 3) * 0.08 - 0.08));
    if (i % 2 === 0) g.add(at(sphere(0.09, plastic([0xff6a8a, 0xffd23a, 0xff9a4a][i % 3])), x + 0.1, 1.0 + (i % 2) * 0.1, 0.12));
  }
  return g;
};
/** 빨래 바구니: w칸 너비 + 위로 삐져나온 옷 */
const basket = (w: number) => {
  const W = Math.min(w * 0.85, 1.6);
  const wicker = plastic(0xc8945a, 0.8);
  const g = group(at(rbox(W, 0.6, 0.75, 0.12, wicker), 0, 0.3, 0));
  for (let i = 0; i < 3; i++) g.add(at(rbox(W + 0.02, 0.04, 0.77, 0.02, plastic(0xa8743a, 0.8)), 0, 0.12 + i * 0.18, 0));
  const cloth = [0x7ac0ff, 0xff8fb0, 0xffffff, 0xffd23a];
  for (let i = 0; i < 4; i++) g.add(at(sphere(0.24, plastic(cloth[i], 0.7), 1.3, 0.6, 1), -W / 3 + (i * W) / 4.5, 0.65, (i % 2) * 0.15 - 0.07));
  return g;
};
/** 갠 옷 더미 */
const shirts = (w: number) => {
  const g = new THREE.Group();
  const cloth = [0x7ac0ff, 0xff8fb0, 0xffffff, 0x6abf69, 0xffd23a];
  const stacks = Math.max(1, Math.round(w));
  for (let s = 0; s < stacks; s++) {
    for (let i = 0; i < 3; i++) g.add(at(rbox(0.7, 0.14, 0.55, 0.06, plastic(cloth[(s * 2 + i) % 5], 0.7)), (s - (stacks - 1) / 2) * 0.9, 0.07 + i * 0.15, 0, 0, i * 0.15 - 0.1, 0));
  }
  return g;
};

// ── 세탁실
const detergent = () => group(
  at(rbox(0.55, 0.8, 0.4, 0.14, glossy(0x3a8ad0)), 0, 0.4, 0),
  at(rbox(0.36, 0.35, 0.02, 0.05, plastic(0xffffff, 0.5)), 0, 0.42, 0.21),
  at(cyl(0.12, 0.12, 0.14, plastic(0xff4a4a)), -0.12, 0.87, 0),
  at(torus(0.14, 0.04, glossy(0x3a8ad0), Math.PI), 0.12, 0.8, 0),
);
const clothesPile = () => {
  const g = new THREE.Group();
  const cloth = [0x7ac0ff, 0xff8fb0, 0xffffff, 0x6abf69, 0xffd23a, 0xb08ae0];
  for (let i = 0; i < 7; i++) {
    const a = i * 1.9;
    g.add(at(sphere(0.25, plastic(cloth[i % 6], 0.75), 1.4, 0.55, 1.1), Math.cos(a) * 0.18, 0.15 + (i % 3) * 0.12, Math.sin(a) * 0.15, 0, a, 0));
  }
  return g;
};

// ── 거실
const lamp = () => group(
  at(cyl(0.22, 0.25, 0.1, plastic(0x6a5a72)), 0, 0.05, 0),
  at(cyl(0.04, 0.04, 0.7, metal(0xd8b04a)), 0, 0.42, 0),
  at(cyl(0.18, 0.34, 0.38, new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd88a, emissiveIntensity: 0.5, roughness: 0.6 })), 0, 0.88, 0),
);
const toyBlocks = () => group(
  at(rbox(0.32, 0.32, 0.32, 0.05, plastic(0xff6a6a)), -0.18, 0.16, 0.05),
  at(rbox(0.32, 0.32, 0.32, 0.05, plastic(0x4f8fd0)), 0.18, 0.16, -0.05, 0, 0.3, 0),
  at(rbox(0.32, 0.32, 0.32, 0.05, plastic(0xffd23a)), 0, 0.48, 0, 0, 0.6, 0),
);
const remote = () => {
  const g = group(at(rbox(0.3, 0.1, 0.75, 0.06, plastic(0x3a3440, 0.4)), 0, 0.05, 0));
  for (const [x, z, c] of [[0, -0.25, 0xff4a4a], [-0.07, 0, 0x6aff8a], [0.07, 0, 0x7ac0ff], [-0.07, 0.15, 0xffffff], [0.07, 0.15, 0xffffff]] as const) g.add(at(cyl(0.035, 0.035, 0.04, plastic(c)), x, 0.11, z));
  return g;
};

/** 칸 위 소품: (차지하는 칸 수 w, h) → 모델. 1칸 = 1 크기 */
export const DECOR: Record<DecorKind, (w: number, h: number) => THREE.Object3D> = {
  herb: () => herb(),
  herbTall: () => herb(true),
  books: () => books(3),
  cereal,
  shakers,
  fruit,
  bathtub, duck, shampoo, toothCup, soap,
  plantPot: (w) => plantPot(w), basket: (w) => basket(w), shirts: (w) => shirts(w),
  detergent, clothesPile,
  lamp, toyBlocks, remote,
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

// 욕실 둘레
const towelStack = () => {
  const g = new THREE.Group();
  const c = [0xff9ab8, 0xffffff, 0x7ac0ff, 0xffe08a];
  for (let i = 0; i < 4; i++) g.add(at(rbox(1.3, 0.28, 0.9, 0.12, plastic(c[i], 0.85)), (i % 2) * 0.06, 0.14 + i * 0.29, 0));
  return g;
};
const sinkCabinet = () => group(
  at(rbox(1.8, 1.4, 1.1, 0.08, plastic(0xffffff, 0.4)), 0, 0.7, 0),
  at(rbox(0.8, 1.1, 0.04, 0.04, plastic(0xeef4f8, 0.4)), -0.42, 0.65, 0.56), at(rbox(0.8, 1.1, 0.04, 0.04, plastic(0xeef4f8, 0.4)), 0.42, 0.65, 0.56),
  at(cyl(0.6, 0.45, 0.25, glossy(0xffffff), 32), 0, 1.5, 0),
  at(cyl(0.05, 0.05, 0.4, metal(0xcfd5df)), 0, 1.75, -0.45), at(cyl(0.04, 0.04, 0.35, metal(0xcfd5df)), 0, 1.92, -0.3, Math.PI / 2),
);
const bathBombs = () => group(at(cyl(0.7, 0.5, 0.3, glossy(0xffffff), 32), 0, 0.15, 0), at(sphere(0.22, plastic(0xff9ab8)), -0.25, 0.42, 0), at(sphere(0.22, plastic(0xb08ae0)), 0.22, 0.42, 0.1), at(sphere(0.2, plastic(0x8fe0c8)), 0, 0.45, -0.25));
const toiletRolls = () => {
  const g = new THREE.Group();
  for (const [x, y, z] of [[-0.3, 0.3, 0], [0.3, 0.3, 0], [0, 0.3, 0.45], [0, 0.9, 0.2]]) g.add(at(cyl(0.3, 0.3, 0.6, plastic(0xffffff, 0.8)), x, y, z));
  return g;
};

// 베란다 둘레
const wateringCan = () => group(
  at(cyl(0.45, 0.5, 0.8, glossy(0x5fb7e8)), 0, 0.4, 0),
  at(torus(0.3, 0.07, glossy(0x5fb7e8), Math.PI), -0.15, 0.85, 0),
  at(cyl(0.06, 0.1, 0.9, glossy(0x5fb7e8)), 0.65, 0.65, 0, 0, 0, -0.9),
  at(cyl(0.14, 0.08, 0.1, glossy(0x5fb7e8)), 1.0, 0.92, 0, 0, 0, -0.9),
);
const potsStack = () => {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) g.add(at(cyl(0.45, 0.33, 0.45, plastic(0xc8643a, 0.6)), 0, 0.22 + i * 0.22, 0));
  return group(g, at(cyl(0.4, 0.3, 0.4, plastic(0xd2794a, 0.6)), 0.95, 0.2, 0.2));
};
const bucket = () => group(at(cyl(0.5, 0.4, 0.75, plastic(0xffd23a, 0.4)), 0, 0.37, 0), at(torus(0.42, 0.04, plastic(0x3a3440), Math.PI), 0, 0.75, 0), at(cyl(0.44, 0.44, 0.02, new THREE.MeshStandardMaterial({ color: 0x8fd3f5, roughness: 0.05 })), 0, 0.65, 0));

// 세탁실 둘레
const bigMachine = (color: number, door: number) => group(
  at(rbox(1.9, 2.0, 1.6, 0.14, plastic(color, 0.35)), 0, 1.0, 0),
  at(rbox(1.8, 0.3, 0.05, 0.05, plastic(0xdfe4ee, 0.4)), 0, 1.75, 0.8),
  at(torus(0.55, 0.09, plastic(0xc9cbd6)), 0, 0.85, 0.82),
  at(cyl(0.52, 0.52, 0.04, new THREE.MeshStandardMaterial({ color: door, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 }), 32), 0, 0.85, 0.81, Math.PI / 2),
  at(face(1.4, { light: false }), 0, 0.85, 0.86),
);
const shelf = () => {
  const g = group(at(rbox(1.8, 0.08, 0.7, 0.03, plastic(0xd9b08a, 0.6)), 0, 1.2, 0), at(rbox(1.8, 0.08, 0.7, 0.03, plastic(0xd9b08a, 0.6)), 0, 0.05, 0));
  for (const x of [-0.85, 0.85]) g.add(at(rbox(0.08, 1.25, 0.7, 0.03, plastic(0xc8a07a, 0.6)), x, 0.62, 0));
  for (const [x, c] of [[-0.5, 0x3a8ad0], [0, 0xff8fb0], [0.5, 0x6abf69]] as const) g.add(at(rbox(0.35, 0.6, 0.3, 0.1, glossy(c)), x, 0.4, 0), at(rbox(0.35, 0.6, 0.3, 0.1, glossy(c)), x, 1.55, 0));
  return g;
};

// 거실 둘레
const sofa = () => group(
  at(rbox(3.4, 0.6, 1.4, 0.25, plastic(0x7a9fd8, 0.8)), 0, 0.4, 0),
  at(rbox(3.4, 1.0, 0.4, 0.2, plastic(0x6a8fc8, 0.8)), 0, 0.85, -0.55),
  at(rbox(0.4, 0.85, 1.4, 0.2, plastic(0x6a8fc8, 0.8)), -1.6, 0.6, 0), at(rbox(0.4, 0.85, 1.4, 0.2, plastic(0x6a8fc8, 0.8)), 1.6, 0.6, 0),
  at(rbox(0.7, 0.6, 0.25, 0.2, plastic(0xffd23a, 0.85)), -0.8, 0.95, -0.25, 0.2), at(rbox(0.7, 0.6, 0.25, 0.2, plastic(0xff8fb0, 0.85)), 0.9, 0.95, -0.25, 0.2, -0.2),
);
const tvStand = () => group(
  at(rbox(2.6, 0.7, 0.9, 0.08, plastic(0xc89a6a, 0.6)), 0, 0.35, 0),
  at(rbox(2.2, 1.3, 0.12, 0.08, plastic(0x2a2a34, 0.2)), 0, 1.4, 0),
  at(rbox(2.0, 1.1, 0.02, 0.06, new THREE.MeshStandardMaterial({ color: 0x5fb7e8, emissive: 0x3a8ad0, emissiveIntensity: 0.5 })), 0, 1.4, 0.07),
);
const floorLamp = () => group(at(cyl(0.35, 0.4, 0.1, plastic(0x3a3440)), 0, 0.05, 0), at(cyl(0.05, 0.05, 2.2, metal(0xd8b04a)), 0, 1.15, 0), at(cyl(0.35, 0.6, 0.6, new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd88a, emissiveIntensity: 0.6 })), 0, 2.3, 0));
const bookshelf = () => {
  const g = group(at(rbox(1.6, 2.4, 0.7, 0.06, plastic(0xd9b08a, 0.6)), 0, 1.2, 0));
  const c = [0xe0604a, 0x4f8fd0, 0xf2c230, 0x6abf69, 0xb08ae0];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) g.add(at(rbox(0.22, 0.55, 0.5, 0.03, plastic(c[(i + r) % 5], 0.5)), -0.55 + i * 0.27, 0.45 + r * 0.75, 0.12));
  return g;
};

export type OuterKind =
  | 'kettle' | 'cuttingBoard' | 'plates' | 'jars' | 'boxes' | 'bigHerb' | 'tallHerb' | 'mugRed' | 'mugBlue'
  | 'towelStack' | 'sinkCabinet' | 'bathBombs' | 'toiletRolls' | 'bigDuck'
  | 'wateringCan' | 'potsStack' | 'bucket' | 'bigPlanter'
  | 'washerBig' | 'dryerBig' | 'shelf' | 'bigBasket' | 'bigClothes'
  | 'sofa' | 'tvStand' | 'floorLamp' | 'bookshelf' | 'bigBlocks';
export const OUTER: Record<OuterKind, () => THREE.Object3D> = {
  kettle, cuttingBoard, plates, jars, boxes,
  bigHerb: () => herb(false, 2.2),
  tallHerb: () => herb(true, 2.0),
  mugRed: () => mug(0xff8a6a),
  mugBlue: () => mug(0x7ac0ff),
  towelStack, sinkCabinet, bathBombs, toiletRolls,
  bigDuck: () => { const d = duck(); d.scale.setScalar(2.4); return d; },
  wateringCan, potsStack, bucket,
  bigPlanter: () => plantPot(3),
  washerBig: () => bigMachine(0xf7f7fb, 0x8fd3f5),
  dryerBig: () => bigMachine(0xe8e0f4, 0x3a3440),
  shelf,
  bigBasket: () => { const b = basket(2); b.scale.setScalar(1.4); return b; },
  bigClothes: () => { const c = clothesPile(); c.scale.setScalar(2.2); return c; },
  sofa, tvStand, floorLamp, bookshelf,
  bigBlocks: () => { const b = toyBlocks(); b.scale.setScalar(2.4); return b; },
};
