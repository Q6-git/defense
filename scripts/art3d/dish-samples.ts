// 식기세척기(전설)·동전 세탁기 디자인 후보 (게임 모델은 그대로). render.html?set=dish 로 렌더링
import * as THREE from 'three';
import { MODELS } from '../../src/view3d/models';
import { at, cyl, face, group, limbs, metal, plastic, plugTail, rbox, sphere, torus } from '../../src/view3d/kit';

const glow = (color: number, emissive: number, k = 1) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: k });
const water = () => new THREE.MeshStandardMaterial({ color: 0x8fe0ff, emissive: 0x3fb0ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.05 });
const GOLD = () => metal(0xf5c542);
const body = (head: THREE.Object3D, color: number | THREE.Material, limb: number, headY = 1.1) =>
  group(at(rbox(0.74, 0.3, 0.52, 0.12, color instanceof THREE.Material ? color : plastic(color)), 0, 0.4, 0), limbs(plastic(limb), { width: 0.22 }), at(head, 0, headY, 0), plugTail());

/** 앞문 창으로 보이는 세워 둔 접시들 */
function platesWindow(): THREE.Group {
  const g = group(at(rbox(0.86, 0.5, 0.04, 0.08, new THREE.MeshStandardMaterial({ color: 0x1d3550, roughness: 0.1, metalness: 0.3 })), 0, 0, 0));
  for (const x of [-0.27, -0.09, 0.09, 0.27]) g.add(at(cyl(0.17, 0.17, 0.03, plastic(0xffffff, 0.2), 28), x, -0.04, 0.03, 0, Math.PI / 2 + 0.25, 0));
  return g;
}

/** 2. 크롬 아쿠아: 스테인리스 몸 + 접시 창 + 빛나는 물줄기 왕관 + 금테 */
const chrome = () => {
  const steel = metal(0xc6d0da);
  const head = group(
    rbox(1.3, 1.25, 0.95, 0.16, steel),
    at(rbox(1.2, 0.2, 0.05, 0.05, plastic(0x1f3f6a)), 0, 0.45, 0.48),
    at(rbox(0.9, 0.05, 0.03, 0.02, glow(0x9ff4ff, 0x4fe0ff, 1.4)), 0, 0.45, 0.51),
    at(platesWindow(), 0, 0.02, 0.48),
    at(face(0.85, { spread: 0.18, light: true }), 0, 0.02, 0.53),
    at(rbox(0.7, 0.06, 0.06, 0.03, GOLD()), 0, -0.35, 0.5),
    at(rbox(1.34, 0.05, 0.99, 0.03, GOLD()), 0, 0.6, 0),
  );
  // 물줄기 왕관: 위로 솟는 물방울 다섯 줄기
  for (let i = 0; i < 5; i++) {
    const x = -0.44 + i * 0.22, h = i === 2 ? 0.5 : i % 2 ? 0.38 : 0.28;
    head.add(at(cyl(0.035, 0.06, h, water()), x, 0.62 + h / 2, 0));
    head.add(at(sphere(0.08, water()), x, 0.65 + h, 0));
  }
  return body(head, 0x1f3f6a, 0xdfe6ee);
};

/** 3. 바다 기사: 남색 몸 + 하얀 문 + 금 손잡이, 위에 물보라 거품 */
const ocean = () => {
  const navy = plastic(0x2f5fa8);
  const bubble = new THREE.MeshStandardMaterial({ color: 0xdff6ff, roughness: 0.05, transparent: true, opacity: 0.75 });
  const head = group(
    rbox(1.3, 1.25, 0.95, 0.16, navy),
    at(rbox(1.08, 0.82, 0.05, 0.12, plastic(0xf4f8fc)), 0, -0.08, 0.48),
    at(rbox(0.5, 0.07, 0.07, 0.03, GOLD()), 0, 0.42, 0.52),
    at(face(1.0, { spread: 0.2 }), 0, -0.1, 0.52),
    at(sphere(0.07, glow(0x9ff4ff, 0x4fe0ff, 1.2)), 0.5, 0.45, 0.5),
  );
  for (const [x, y, z, r] of [[-0.35, 0.75, 0, 0.17], [0, 0.85, 0.1, 0.22], [0.35, 0.78, -0.05, 0.16], [0.18, 1.02, 0, 0.12], [-0.18, 0.98, -0.05, 0.1]]) head.add(at(sphere(r, bubble), x, y, z));
  return body(head, 0x2f5fa8, 0xf4f8fc);
};

/** 4. 접시 왕관: 머리 위에 금테 접시를 왕관처럼 세웠다. 하늘색 몸 */
const crown = () => {
  const sky = plastic(0x6fb6ee);
  const head = group(
    rbox(1.3, 1.2, 0.95, 0.16, sky),
    at(rbox(1.1, 0.78, 0.05, 0.12, plastic(0xf4f8fc)), 0, -0.1, 0.48),
    at(rbox(0.5, 0.07, 0.07, 0.03, GOLD()), 0, 0.38, 0.52),
    at(face(1.0, { spread: 0.2 }), 0, -0.12, 0.52),
  );
  // 접시 다섯 장을 부채꼴로 세운다 (가운데가 가장 크다), 테두리는 금
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.35, r = i === 2 ? 0.3 : 0.24;
    const plate = group(cyl(r, r, 0.04, plastic(0xffffff, 0.2), 32), at(torus(r, 0.025, GOLD()), 0, 0, 0, Math.PI / 2));
    head.add(at(plate, Math.sin(a) * 0.55, 0.62 + Math.cos(a) * 0.3, 0, Math.PI / 2, 0, -a));
  }
  return body(head, 0x6fb6ee, 0xf4f8fc);
};

/** 세탁기 후보: 금빛 코인 세탁기 (식기세척기와 확실히 구분). 노란 몸 + 동전 더미 */
const coinWasher = () => {
  const cream = plastic(0xffe08a);
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd3f5, roughness: 0.05, transparent: true, opacity: 0.85 });
  const head = group(
    rbox(1.2, 1.2, 0.95, 0.16, cream),
    at(rbox(1.1, 0.22, 0.05, 0.05, plastic(0xc9862a)), 0, 0.45, 0.47),
    at(rbox(0.22, 0.05, 0.04, 0.02, plastic(0x3a2a20)), 0.32, 0.45, 0.5),
    at(torus(0.36, 0.07, metal(0xd8dde6)), 0, -0.12, 0.48),
    at(cyl(0.34, 0.34, 0.04, glass, 32), 0, -0.12, 0.47, Math.PI / 2),
    at(face(0.75, { spread: 0.2 }), 0, -0.12, 0.52),
  );
  for (let i = 0; i < 4; i++) head.add(at(cyl(0.17, 0.17, 0.06, GOLD(), 28), -0.25 + (i % 2) * 0.04, 0.64 + i * 0.065, 0));
  head.add(at(cyl(0.17, 0.17, 0.06, GOLD(), 28), 0.25, 0.64, 0.05));
  return body(head, 0xc9862a, 0xfff6dc);
};

export const DISH_SAMPLES: Record<string, () => THREE.Object3D> = {
  'd1_지금': MODELS.dishwasher,
  'd2_크롬아쿠아': chrome,
  'd3_바다기사': ocean,
  'd4_접시왕관': crown,
  'w1_세탁기지금': MODELS.washer,
  'w2_금빛코인': coinWasher,
};
