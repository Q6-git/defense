// 에어컨·유령 디자인 후보 (게임 모델은 그대로). render.html?set=misc 로 렌더링
import * as THREE from 'three';
import { MODELS } from '../../src/view3d/models';
import { at, cyl, face, group, limbs, plastic, plugTail, rbox, sphere, tube } from '../../src/view3d/kit';

const glow = (color: number, emissive: number, k = 1) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: k });
const body = (head: THREE.Object3D, color: number, limb: number, headY = 1.05) =>
  group(at(rbox(0.72, 0.3, 0.5, 0.12, plastic(color)), 0, 0.4, 0), limbs(plastic(limb), { width: 0.22 }), at(head, 0, headY, 0), plugTail());

/** 눈꽃 무늬: 가는 막대 세 개를 60도씩 */
function snowflake(size: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    g.add(at(rbox(size, size * 0.14, 0.03, size * 0.05, mat), 0, 0, 0, 0, 0, (i * Math.PI) / 3));
    for (const s of [-1, 1]) {
      const a = (i * Math.PI) / 3;
      const x = Math.cos(a) * size * 0.32 * s, y = Math.sin(a) * size * 0.32 * s;
      for (const t of [-1, 1]) g.add(at(rbox(size * 0.28, size * 0.1, 0.03, size * 0.04, mat), x, y, 0.005, 0, 0, a + t * 0.8));
    }
  }
  return g;
}
const mist = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcff2ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.2 });

/** A2. 눈꽃 에어컨: 연하늘 몸 + 빛나는 큰 눈꽃 + 바람 날개 아래 냉기 */
const snowAircon = () => {
  const head = group(
    rbox(1.6, 0.72, 0.7, 0.2, plastic(0x9fd6f7)),
    at(rbox(1.42, 0.1, 0.22, 0.04, plastic(0xffffff)), 0, -0.3, 0.32, -0.4),
    at(face(0.95), -0.25, 0.04, 0.36),
    at(snowflake(0.42, glow(0x6fdcff, 0x2fb8ff, 1.3)), 0.48, 0.06, 0.36),
  );
  for (const [x, y, r] of [[-0.4, -0.55, 0.1], [0, -0.62, 0.13], [0.42, -0.56, 0.09], [-0.15, -0.75, 0.07], [0.22, -0.78, 0.06]]) head.add(at(sphere(r, mist()), x, y, 0.38));
  return body(head, 0x8fd0f5, 0xffffff, 1.15);
};

/** A3. 펭귄 에어컨: 남색 등 + 흰 배(앞면) + 주황 부리·발, 머리에 눈꽃 */
const penguinAircon = () => {
  const navy = plastic(0x27406e);
  const head = group(
    rbox(1.55, 0.78, 0.72, 0.24, navy),
    at(rbox(1.25, 0.58, 0.06, 0.2, plastic(0xffffff)), 0, -0.02, 0.35),
    at(face(0.95, { spread: 0.24 }), 0, 0.06, 0.39),
    at(sphere(0.07, plastic(0xff9f2a), 1.4, 0.7, 1), 0, -0.04, 0.42),
    at(rbox(1.3, 0.08, 0.2, 0.04, plastic(0xcfeaff)), 0, -0.33, 0.33, -0.4),
    at(snowflake(0.2, glow(0xffffff, 0x9fe8ff, 0.9)), 0.55, 0.47, 0, -Math.PI / 2),
  );
  return group(at(rbox(0.72, 0.3, 0.5, 0.12, navy), 0, 0.4, 0), limbs(plastic(0xff9f2a), { width: 0.22 }), at(head, 0, 1.08, 0), plugTail());
};

/** A4. 스탠드 에어컨: 세로로 긴 탑 모양 + 세로 바람구멍 + 파란 표시창 (가로로 긴 상자들과 실루엣이 다르다) */
const towerAircon = () => {
  const shell = plastic(0xf4f9fd);
  const head = group(
    rbox(0.8, 1.5, 0.7, 0.22, shell),
    at(rbox(0.5, 0.26, 0.05, 0.08, glow(0x2a7fd0, 0x2a8fff, 0.6)), 0, 0.42, 0.35),
    at(face(0.8, { light: true }), 0, 0.42, 0.39),
    at(snowflake(0.16, glow(0xffffff, 0x9fe8ff, 0.9)), 0, 0.1, 0.36),
  );
  for (const x of [-0.18, 0, 0.18]) head.add(at(rbox(0.06, 0.55, 0.05, 0.03, plastic(0x9fd8f0)), x, -0.35, 0.35));
  for (const [x, y, r] of [[-0.12, -0.75, 0.08], [0.14, -0.8, 0.1], [0, -0.95, 0.06]]) head.add(at(sphere(r, mist()), x, y, 0.4));
  return body(head, 0x9fd8f0, 0xf4f9fd, 1.3);
};

const sheetMat = (color: number, opacity: number, emissive = 0x000000, k = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: k, roughness: 0.35, transparent: true, opacity });

/** G2. 이불 유령: 위가 둥글고 아래로 갈수록 넓어지는 천 + 들쭉날쭉 물결 끝단 + 양팔을 든 '왁!' 자세, 연보라 */
const sheetGhost = () => {
  const m = sheetMat(0xe2d6ff, 0.93, 0xb49cff, 0.3);
  const g = group(
    at(sphere(0.55, m, 1, 1.05, 1), 0, 1.0, 0),
    at(cyl(0.55, 0.72, 0.75, m, 32), 0, 0.52, 0),
    at(face(1.2, { mouth: 'o', spread: 0.22 }), 0, 1.02, 0.52),
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(at(sphere(0.16, m, 1, i % 2 ? 1.5 : 0.9, 1), Math.cos(a) * 0.62, i % 2 ? 0.1 : 0.2, Math.sin(a) * 0.62));
  }
  for (const s of [-1, 1]) g.add(at(sphere(0.15, m, 1, 1.6, 1), s * 0.66, 1.0, 0.1, 0, 0, -s * 0.6));
  return g;
};

/** G3. 꼬리 유령: 둥둥 떠 있는 머리 + 아래로 휘어 사라지는 꼬리, 푸른빛이 은은하게 */
const wispGhost = () => {
  const m = sheetMat(0xcfeeff, 0.93, 0x7fcfff, 0.55);
  const g = group(
    at(sphere(0.6, m, 1, 0.95, 1), 0, 1.15, 0),
    at(face(1.25, { spread: 0.22 }), 0, 1.15, 0.56),
    at(sphere(0.06, plastic(0xff8fb0), 1.2, 0.6, 0.5), 0, 1.0, 0.6), // 혀
    at(tube([[0, 0.75, 0], [0.18, 0.5, -0.05], [-0.1, 0.25, -0.12], [0.2, 0.05, -0.2]], 0.26, m), 0, 0, 0),
    at(sphere(0.16, m), 0.2, 0.05, -0.2),
  );
  for (const s of [-1, 1]) g.add(at(sphere(0.14, m, 1, 1.4, 1), s * 0.62, 1.0, 0.15, 0, 0, -s * 0.4));
  return g;
};

/** G4. 비눗방울 유령: 하수구 거품으로 만들어진 유령. 물빛 반투명 + 몸에 작은 거품 */
const bubbleGhost = () => {
  const m = sheetMat(0xaef0f5, 0.9, 0x5fe0e8, 0.4);
  const b = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.6 });
  const g = group(
    at(sphere(0.58, m, 1, 1.05, 1), 0, 1.0, 0),
    at(cyl(0.58, 0.66, 0.6, m, 32), 0, 0.55, 0),
    at(face(1.2, { mouth: 'o', spread: 0.22 }), 0, 1.02, 0.55),
  );
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(at(sphere(0.2, m), Math.cos(a) * 0.55, 0.24, Math.sin(a) * 0.55));
  }
  for (const [x, y, z, r] of [[0.4, 1.35, 0.3, 0.1], [-0.45, 0.8, 0.35, 0.08], [0.5, 0.7, 0.3, 0.06], [-0.2, 1.55, 0.1, 0.07], [0.7, 1.2, 0, 0.09]]) g.add(at(sphere(r, b), x, y, z));
  return g;
};

export const MISC_SAMPLES: Record<string, () => THREE.Object3D> = {
  a1_에어컨지금: MODELS.aircon,
  a2_눈꽃: snowAircon,
  a3_펭귄: penguinAircon,
  a4_스탠드: towerAircon,
  g1_유령지금: MODELS.ghost,
  g2_이불: sheetGhost,
  g3_꼬리: wispGhost,
  g4_거품: bubbleGhost,
};
