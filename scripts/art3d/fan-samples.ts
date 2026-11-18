// 선풍기 디자인 후보 (게임 모델은 그대로). render.html?set=fan 으로 렌더링
import * as THREE from 'three';
import { MODELS } from '../../src/view3d/models';
import { at, cyl, face, group, limbs, plastic, plugTail, rbox, sphere, torus } from '../../src/view3d/kit';

const soft = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, transparent: true, opacity: 0.9 });

/** 날개 n장: 동그란 잎 모양 */
function blades(n: number, mat: THREE.Material, r = 0.36, w = 0.3, offset = 0.4): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + offset;
    g.add(at(sphere(w, mat, 1.25, 0.6, 0.12), Math.cos(a) * r, Math.sin(a) * r, -0.05, 0, 0, a));
  }
  return g;
}

/** 머리(망 + 날개 + 얼굴)를 받침에 올린다 */
function stand(head: THREE.Object3D, base: number, limb: number, headY = 1.35, neck = 0.42): THREE.Group {
  return group(at(cyl(0.07, 0.07, neck, plastic(base)), 0, 0.72, 0), at(rbox(0.6, 0.28, 0.45, 0.12, plastic(base)), 0, 0.38, 0), limbs(plastic(limb), { width: 0.2 }), at(head, 0, headY, 0), plugTail());
}

/** 2. 파스텔 꽃: 분홍 꽃잎 날개 다섯 장, 크림색 큰 얼굴 */
const flower = () => {
  const mint = plastic(0x6fd3bd);
  // 꽃잎은 얼굴 둘레로 앞에 보이게 (뒤에 두면 얼굴에 가려 안 보인다)
  const petals = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + Math.PI / 2;
    petals.add(at(sphere(0.2, plastic(0xffa8c0), 1, 1.35, 0.35), Math.cos(t) * 0.42, Math.sin(t) * 0.42, 0.08, 0, 0, t - Math.PI / 2));
  }
  const head = group(
    torus(0.66, 0.07, mint),
    petals,
    at(sphere(0.32, plastic(0xffe27a), 1, 1, 0.7), 0, 0, 0.1),
    at(face(0.95, { spread: 0.2 }), 0, 0, 0.32),
  );
  return stand(head, 0x6fd3bd, 0xfff3dc);
};

/** 3. 토끼 귀: 지금 선풍기를 하늘색 파스텔로, 망 위에 귀 두 개 */
const bunny = () => {
  const sky = plastic(0x7cc7f0);
  const pink = plastic(0xffb3c7);
  const head = group(
    torus(0.62, 0.07, sky),
    blades(3, soft(0xd6efff)),
    at(sphere(0.38, plastic(0xffffff), 1, 1, 0.7), 0, 0, 0.05),
    at(face(1.1, { spread: 0.2 }), 0, 0, 0.32),
  );
  for (const s of [-1, 1]) {
    head.add(at(sphere(0.16, sky, 0.75, 1.7, 0.6), s * 0.32, 0.78, 0, 0, 0, -s * 0.25));
    head.add(at(sphere(0.09, pink, 0.7, 1.5, 0.4), s * 0.32, 0.78, 0.06, 0, 0, -s * 0.25));
  }
  return stand(head, 0x7cc7f0, 0xffffff);
};

/** 4. 큰 머리 + 구름 받침: 머리를 키우고(2등신 강조) 받침을 뭉게구름으로 */
const cloud = () => {
  const blue = plastic(0x5fb7e8);
  const head = group(
    torus(0.74, 0.08, blue),
    blades(4, soft(0xbfe6ff), 0.42, 0.34),
    at(sphere(0.48, plastic(0xffffff), 1, 1, 0.7), 0, 0, 0.06),
    at(face(1.35, { spread: 0.2 }), 0, 0, 0.38),
  );
  const white = plastic(0xffffff);
  const puff = group(...[[-0.28, 0], [0.28, 0], [0, 0.12], [-0.12, -0.05], [0.14, -0.05]].map(([x, y]) => at(sphere(0.24, white), x, 0.38 + y, 0)));
  return group(at(cyl(0.07, 0.07, 0.42, blue), 0, 0.78, 0), puff, limbs(white, { width: 0.22 }), at(head, 0, 1.45, 0), plugTail());
};

/** 5. 네모 박스 선풍기: 둥근 사각 틀 + 날개 넷, 노란색 */
const box = () => {
  const yellow = plastic(0xffcf4a);
  const frame = group(
    at(rbox(1.35, 0.14, 0.3, 0.07, yellow), 0, 0.62, 0),
    at(rbox(1.35, 0.14, 0.3, 0.07, yellow), 0, -0.62, 0),
    at(rbox(0.14, 1.35, 0.3, 0.07, yellow), 0.62, 0, 0),
    at(rbox(0.14, 1.35, 0.3, 0.07, yellow), -0.62, 0, 0),
  );
  const head = group(frame, blades(4, soft(0xfff1b8), 0.34, 0.3, Math.PI / 4), at(sphere(0.36, plastic(0xffffff), 1, 1, 0.7), 0, 0, 0.05), at(face(1.05, { spread: 0.2 }), 0, 0, 0.3));
  return group(at(rbox(0.72, 0.3, 0.5, 0.12, yellow), 0, 0.4, 0), limbs(plastic(0xffffff), { width: 0.22 }), at(head, 0, 1.25, 0), plugTail());
};

export const FAN_SAMPLES: Record<string, () => THREE.Object3D> = {
  '1_지금': MODELS.fan,
  '2_파스텔꽃': flower,
  '3_토끼귀': bunny,
  '4_큰머리구름': cloud,
  '5_네모박스': box,
};
