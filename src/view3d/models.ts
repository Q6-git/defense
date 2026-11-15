// 가전과 적의 3D 모델. 게임의 3D 화면(src/view3d/board.ts)과 그림 렌더링(scripts/render3d.cjs)이 같이 쓴다.
// 모델은 원점(발바닥 가운데)에 서 있고 앞(+z)을 본다.
import * as THREE from 'three';
import { at, cyl, face, group, limbs, metal, plastic, plugTail, rbox, sphere, torus, tube } from './kit';

type Model = () => THREE.Object3D;

// ───────── 가전 (2등신: 큰 가전 머리 + 짧은 몸과 다리)

const toaster: Model = () => {
  const body = plastic(0xf08a3c);
  const cream = plastic(0xfff1dc);
  const bread = plastic(0xf2c27b, 0.7);
  const crust = plastic(0xb8702e, 0.7);
  const head = group(
    rbox(1.3, 0.95, 0.85, 0.22, body),
    at(rbox(1.1, 0.12, 0.6, 0.05, metal(0xd8dde6)), 0, 0.42, 0), // 윗면 금속판
    at(rbox(0.12, 0.3, 0.14, 0.05, plastic(0x555060)), 0.7, 0.1, 0), // 레버
    at(face(1.15), 0, -0.02, 0.44),
  );
  // 식빵 두 장
  for (const x of [-0.24, 0.24]) {
    head.add(at(rbox(0.36, 0.42, 0.1, 0.08, crust), x, 0.55, 0));
    head.add(at(rbox(0.3, 0.36, 0.11, 0.07, bread), x, 0.57, 0));
  }
  return group(at(rbox(0.7, 0.32, 0.5, 0.12, cream), 0, 0.4, 0), limbs(cream, { width: 0.22 }), at(head, 0, 1.05, 0), plugTail());
};

const fan: Model = () => {
  const white = plastic(0x3f8fd0);
  const blue = plastic(0x5fb7e8);
  const blade = new THREE.MeshStandardMaterial({ color: 0xa9dcf5, roughness: 0.3, transparent: true, opacity: 0.85 });
  const head = group(at(torus(0.62, 0.06, white), 0, 0, 0), at(sphere(0.36, plastic(0xf4f7fb), 1, 1, 0.7), 0, 0, 0.05), at(face(1.05, { spread: 0.2 }), 0, 0, 0.3));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    head.add(at(sphere(0.3, blade, 1.25, 0.55, 0.12), Math.cos(a) * 0.36, Math.sin(a) * 0.36, -0.05, 0, 0, a));
  }
  // 망 (가로 세로 몇 줄)
  for (const r of [0.45]) head.add(torus(r, 0.02, white));
  return group(
    at(cyl(0.07, 0.07, 0.4, white), 0, 0.72, 0),
    at(rbox(0.6, 0.28, 0.45, 0.12, blue), 0, 0.38, 0),
    limbs(blue, { width: 0.2 }),
    at(head, 0, 1.3, 0),
    plugTail(),
  );
};

const microwave: Model = () => {
  const shell = plastic(0xe9eaf0);
  const glass = new THREE.MeshStandardMaterial({ color: 0x2c3442, roughness: 0.15, metalness: 0.3 });
  const head = group(
    rbox(1.45, 0.95, 0.9, 0.18, shell),
    at(rbox(0.88, 0.7, 0.06, 0.1, glass), -0.2, 0, 0.44),
    at(face(1.05, { light: true }), -0.2, 0.02, 0.48),
    at(rbox(0.32, 0.7, 0.05, 0.06, plastic(0xc9cbd6)), 0.5, 0, 0.44),
  );
  for (const y of [0.2, 0, -0.2]) head.add(at(cyl(0.06, 0.06, 0.05, plastic(0x7a7f8f)), 0.5, y, 0.48, Math.PI / 2));
  return group(at(rbox(0.75, 0.3, 0.5, 0.12, shell), 0, 0.4, 0), limbs(plastic(0xb9bccb), { width: 0.24 }), at(head, 0, 1.05, 0), plugTail());
};

/** 2등신 가전 공통 몸: 짧은 몸통 + 팔다리 + 머리 + 플러그 꼬리 */
function appliance(head: THREE.Object3D, bodyColor: number | string, headY = 1.05, limbColor?: number | string): THREE.Group {
  const body = plastic(bodyColor);
  return group(at(rbox(0.72, 0.3, 0.5, 0.12, body), 0, 0.4, 0), limbs(limbColor !== undefined ? plastic(limbColor) : body, { width: 0.22 }), at(head, 0, headY, 0), plugTail());
}

const vacuum: Model = () => {
  // 로봇청소기: 납작한 원반 머리 + 범퍼 + 위쪽 센서
  const shell = plastic(0x4a4d5c, 0.35);
  const head = group(
    cyl(0.75, 0.78, 0.42, shell, 40),
    at(torus(0.76, 0.06, plastic(0x2c2e38)), 0, -0.12, 0, Math.PI / 2),
    at(cyl(0.2, 0.24, 0.12, plastic(0x8a8fa3, 0.3)), 0.25, 0.26, -0.15),
    at(sphere(0.06, new THREE.MeshStandardMaterial({ color: 0x6aff8a, emissive: 0x3aff6a, emissiveIntensity: 1 })), -0.3, 0.23, -0.25),
    at(face(1.3, { light: true }), 0, 0.06, 0.76),
  );
  return appliance(head, 0x8a8fa3, 0.95);
};

const wifi: Model = () => {
  // 공유기: 납작한 상자 + 안테나 세 개 + 깜빡이는 불
  const shell = plastic(0x3fbf8f);
  const head = group(rbox(1.3, 0.55, 0.8, 0.16, shell), at(face(1.0), 0, 0.02, 0.41));
  for (const [x, rz] of [[-0.45, 0.25], [0, 0], [0.45, -0.25]] as const) {
    head.add(at(cyl(0.05, 0.06, 0.8, plastic(0x2f3a44)), x, 0.6, -0.2, 0, 0, rz));
    head.add(at(sphere(0.07, plastic(0x2f3a44)), x - Math.sin(rz) * 0.4, 1.0, -0.2));
  }
  for (const x of [-0.35, -0.2, 0.2, 0.35]) head.add(at(sphere(0.035, new THREE.MeshStandardMaterial({ color: 0xbfffd8, emissive: 0x7affb0, emissiveIntensity: 1 })), x, -0.18, 0.41));
  return appliance(head, 0xe8f6ef, 1.0, 0xe8f6ef);
};

const washer: Model = () => {
  // 동전 세탁기: 정육면체 + 둥근 유리문(안에 거품) + 동전 투입구와 금화
  const shell = plastic(0xf7f7fb);
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd3f5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 });
  const head = group(
    rbox(1.2, 1.2, 0.95, 0.16, shell),
    at(rbox(1.1, 0.24, 0.05, 0.05, plastic(0xe8c547)), 0, 0.45, 0.47),
    at(torus(0.36, 0.06, plastic(0xc9cbd6)), 0, -0.12, 0.48),
    at(cyl(0.34, 0.34, 0.04, glass, 32), 0, -0.12, 0.47, Math.PI / 2),
    at(sphere(0.1, plastic(0xffffff, 0.2)), -0.12, -0.22, 0.5), at(sphere(0.07, plastic(0xffffff, 0.2)), 0.1, -0.05, 0.5),
    at(face(0.75, { spread: 0.2 }), 0, -0.12, 0.52),
    at(cyl(0.18, 0.18, 0.05, metal(0xffcf3a)), 0.35, 0.68, 0, 0, 0, Math.PI / 2 - 0.3),
  );
  return appliance(head, 0xe8c547, 1.1, 0xf7f7fb);
};

const stove: Model = () => {
  // 가스레인지: 몸통 + 위에 화구 두 개(파란 불꽃) + 손잡이
  const shell = plastic(0xe8603a);
  const flame = new THREE.MeshStandardMaterial({ color: 0x4aa8ff, emissive: 0x2a6aff, emissiveIntensity: 1.4, transparent: true, opacity: 0.9 });
  const head = group(rbox(1.3, 0.85, 0.9, 0.18, shell), at(rbox(1.2, 0.08, 0.8, 0.04, plastic(0x3a3440)), 0, 0.45, 0), at(face(1.05), 0, -0.05, 0.46));
  for (const x of [-0.3, 0.3]) {
    head.add(at(torus(0.18, 0.04, metal(0x9aa0b4)), x, 0.52, 0, Math.PI / 2));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      head.add(at(sphere(0.06, flame, 1, 1.8, 1), x + Math.cos(a) * 0.15, 0.62, Math.sin(a) * 0.15));
    }
  }
  for (const x of [-0.45, 0.45]) head.add(at(cyl(0.07, 0.07, 0.06, plastic(0x3a3440)), x, -0.3, 0.46, Math.PI / 2));
  return appliance(head, 0xfff1dc, 1.05);
};

const strip: Model = () => {
  // 멀티탭: 길쭉한 막대 머리 + 구멍 세 개 + 번개 스위치
  const shell = plastic(0xfafafa);
  const head = group(rbox(1.5, 0.5, 0.6, 0.16, shell), at(face(0.85), -0.35, 0.0, 0.31));
  for (const x of [0.05, 0.4]) {
    head.add(at(rbox(0.26, 0.04, 0.26, 0.08, plastic(0xe0e0e8)), x, 0.26, 0));
    for (const dx of [-0.05, 0.05]) head.add(at(rbox(0.03, 0.03, 0.08, 0.01, plastic(0x2a2230)), x + dx, 0.28, 0));
  }
  head.add(at(rbox(0.18, 0.22, 0.08, 0.04, new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffa800, emissiveIntensity: 0.6 })), 0.6, 0, 0.3));
  return appliance(head, 0xf2c230, 1.0, 0xfafafa);
};

const battery: Model = () => {
  // 보조배터리: 둥근 직육면체 + 충전 막대 표시
  const shell = plastic(0x7ac74f);
  const bar = new THREE.MeshStandardMaterial({ color: 0xd8ff9a, emissive: 0x9aff4a, emissiveIntensity: 0.9 });
  const head = group(rbox(1.0, 1.25, 0.6, 0.2, shell), at(rbox(0.7, 0.32, 0.04, 0.06, plastic(0x2c3a26)), 0, 0.32, 0.31), at(face(0.95), 0, -0.2, 0.31), at(rbox(0.3, 0.08, 0.3, 0.03, plastic(0x4a5a40)), 0, 0.66, 0));
  for (let i = 0; i < 3; i++) head.add(at(rbox(0.16, 0.2, 0.03, 0.03, bar), -0.2 + i * 0.2, 0.32, 0.34));
  return appliance(head, 0x5aa83a, 1.15, 0xf0f7e8);
};

const iron: Model = () => {
  // 다리미: 앞코가 뾰족한 발바닥 모양을 위로 뽑은 몸 + 금속 바닥판 + 위쪽 손잡이. 얼굴은 옆면(앞쪽)
  const foot = (scale: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.7 * scale, -0.42 * scale);
    sh.lineTo(0.3 * scale, -0.42 * scale);
    sh.quadraticCurveTo(0.8 * scale, -0.2 * scale, 0.82 * scale, 0);
    sh.quadraticCurveTo(0.8 * scale, 0.2 * scale, 0.3 * scale, 0.42 * scale);
    sh.lineTo(-0.7 * scale, 0.42 * scale);
    sh.quadraticCurveTo(-0.8 * scale, 0, -0.7 * scale, -0.42 * scale);
    return sh;
  };
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(foot(1), { depth: 0.42, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 4 }).rotateX(-Math.PI / 2), plastic(0x8c9ab0));
  const sole = new THREE.Mesh(new THREE.ExtrudeGeometry(foot(1.06), { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }).rotateX(-Math.PI / 2), metal(0xd8dde6));
  const head = group(
    at(sole, 0, -0.4, 0),
    at(body, 0, -0.3, 0),
    at(torus(0.3, 0.075, plastic(0x3a6fd0), Math.PI), -0.15, 0.25, 0),
    at(rbox(0.7, 0.1, 0.16, 0.05, plastic(0x3a6fd0)), -0.15, 0.24, 0),
    at(face(0.95), -0.05, -0.05, 0.52),
  );
  return appliance(head, 0xdfe4ee, 1.05);
};

const aircon: Model = () => {
  // 벽걸이 에어컨: 가로로 긴 몸 + 아래쪽 바람 날개 + 눈꽃 표시
  const shell = plastic(0xf4f9fd);
  const head = group(
    rbox(1.6, 0.7, 0.7, 0.2, shell),
    at(rbox(1.4, 0.08, 0.2, 0.04, plastic(0x9fd8f0)), 0, -0.3, 0.32, -0.4),
    at(face(0.95), -0.15, 0.05, 0.36),
    at(sphere(0.06, new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x5fd0ff, emissiveIntensity: 1 })), 0.6, 0.18, 0.36),
  );
  return appliance(head, 0x9fd8f0, 1.05, 0xf4f9fd);
};

const dishwasher: Model = () => {
  // 식기세척기: 정육면체 + 위쪽 조작부 + 비눗방울
  const shell = plastic(0xdfe9f2);
  const bubble = new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.05, transparent: true, opacity: 0.6 });
  const head = group(
    rbox(1.25, 1.2, 0.95, 0.16, shell),
    at(rbox(1.15, 0.22, 0.05, 0.05, plastic(0x4f9fe0)), 0, 0.42, 0.47),
    at(rbox(0.9, 0.05, 0.05, 0.02, metal(0xb8c2cc)), 0, 0.22, 0.5),
    at(face(1.0), 0, -0.15, 0.48),
    at(sphere(0.14, bubble), 0.35, 0.75, 0.1), at(sphere(0.1, bubble), 0.12, 0.85, -0.1), at(sphere(0.08, bubble), 0.5, 0.95, -0.05),
  );
  return appliance(head, 0x4f9fe0, 1.1, 0xdfe9f2);
};

// ───────── 하수구 군단

const goo: Model = () => {
  const slime = new THREE.MeshStandardMaterial({ color: 0x7ad04a, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.95 });
  return group(
    at(sphere(0.62, slime, 1.15, 0.85, 1), 0, 0.52, 0),
    at(sphere(0.22, slime), 0.15, 1.0, 0), // 위쪽 뾰족
    at(sphere(0.16, slime, 1, 0.7, 1), -0.62, 0.15, 0.25),
    at(sphere(0.13, slime, 1, 0.7, 1), 0.58, 0.12, 0.35),
    at(face(1.6, { mouth: 'o', spread: 0.24 }), 0.05, 0.62, 0.6),
  );
};

const rat: Model = () => {
  const fur = plastic(0x9a8f86, 0.6);
  const pink = plastic(0xf5a3b3, 0.5);
  const head = group(sphere(0.55, fur, 1.1, 1, 1), at(face(0.95, { mouth: 'grr' }), 0, 0.05, 0.52), at(sphere(0.09, pink), 0, -0.1, 0.57));
  for (const side of [-1, 1]) {
    head.add(at(sphere(0.3, fur, 1, 1, 0.35), side * 0.45, 0.42, -0.05));
    head.add(at(sphere(0.2, pink, 1, 1, 0.3), side * 0.45, 0.42, 0.02));
  }
  return group(
    at(sphere(0.38, fur, 1, 0.9, 1.1), 0, 0.45, -0.05),
    limbs(pink, { width: 0.2, arms: false }),
    at(tube([[0, 0.3, -0.4], [-0.15, 0.2, -0.8], [-0.45, 0.3, -1.0], [-0.6, 0.5, -0.95]], 0.05, pink), 0, 0, 0),
    at(head, 0, 1.15, 0.05),
  );
};

const roach: Model = () => {
  const shell = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.2, metalness: 0.15 });
  const dark = plastic(0x4a2c14, 0.4);
  const head = group(sphere(0.58, dark, 1.1, 1, 1), at(face(1.15, { mouth: 'grr', light: true }), 0, 0.02, 0.56));
  for (const side of [-1, 1]) {
    head.add(tube([[side * 0.2, 0.45, 0.1], [side * 0.35, 0.85, 0.05], [side * 0.65, 1.0, -0.2]], 0.03, dark));
  }
  const g = group(
    at(sphere(0.62, shell, 1, 0.6, 1.2), 0, 0.5, -0.25),
    at(rbox(0.04, 0.1, 1.2, 0.02, dark), 0, 0.82, -0.25), // 등껍질 가운데 줄
    at(head, 0, 1.05, 0.45),
  );
  for (const side of [-1, 1]) for (const z of [-0.6, -0.2, 0.2]) g.add(tube([[side * 0.4, 0.4, z], [side * 0.7, 0.3, z + 0.05], [side * 0.8, 0, z + 0.1]], 0.04, dark));
  return g;
};

/** 말랑한 점액 몸 (슬라임 계열 공통) */
const slimeMat = (color: number, opacity = 0.95) => new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0, transparent: opacity < 1, opacity });

const grease: Model = () => {
  // 기름때: 거무튀튀한 올리브색으로 번들거리는 넓고 납작한 덩어리 + 위에 노란 식용유 방울 + 바닥에 번진 기름
  const gloss = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.3, ...opts });
  const body = gloss(0x4a4a2e);
  const drop = gloss(0xffc93a, { transparent: true, opacity: 0.85, emissive: 0x8a5a00, emissiveIntensity: 0.25 });
  return group(
    at(sphere(1.0, gloss(0x2f2f1e, { transparent: true, opacity: 0.8 }), 1.25, 0.08, 1.05), 0, 0.03, 0.05),
    at(sphere(0.78, body, 1.25, 0.62, 1.05), 0, 0.42, 0),
    at(sphere(0.2, body, 1.4, 0.5, 1.2), -0.82, 0.12, 0.3),
    at(sphere(0.16, body, 1.4, 0.5, 1.2), 0.8, 0.1, 0.4),
    at(sphere(0.2, drop, 1.3, 0.45, 1), -0.28, 0.85, -0.12), at(sphere(0.15, drop, 1.3, 0.45, 1), 0.3, 0.82, 0.02), at(sphere(0.11, drop, 1.3, 0.45, 1), 0.05, 0.86, -0.38),
    at(face(1.75, { mouth: 'grr', light: true, spread: 0.3 }), 0, 0.52, 0.76),
  );
};

const splitter: Model = () => {
  // 분열 슬라임: 하늘색 몸 안에 작은 덩어리 둘이 비친다
  const outer = slimeMat(0x55c2d6, 0.75);
  return group(
    at(sphere(0.62, outer, 1.2, 0.85, 1), 0, 0.52, 0),
    at(sphere(0.2, slimeMat(0x2a8aa6)), -0.25, 0.45, 0),
    at(sphere(0.2, slimeMat(0x2a8aa6)), 0.25, 0.45, 0),
    at(rbox(0.04, 0.5, 0.04, 0.02, plastic(0x2a8aa6)), 0, 0.85, 0.3, 0.4), // 가운데 갈라질 금
    at(face(1.4, { mouth: 'o', spread: 0.3 }), 0, 0.62, 0.6),
  );
};

const splitling: Model = () => {
  // 작은 분열 방울: 물방울 모양 + 큰 눈
  const m = slimeMat(0x7fd8e6, 0.9);
  return group(at(sphere(0.5, m, 1, 0.85, 1), 0, 0.42, 0), at(sphere(0.2, m, 1, 1.5, 1), 0, 0.85, 0), at(face(1.3, { spread: 0.22 }), 0, 0.45, 0.48));
};

const boss: Model = () => {
  // 하수구 대왕: 커다란 보라 점액 + 뿔 + 이빨 + 넘치는 점액 망토
  const body = slimeMat(0x5e3478);
  const horn = plastic(0xf3e6d3, 0.4);
  const g = group(
    at(sphere(0.9, body, 1.1, 0.95, 1), 0, 0.85, 0),
    at(sphere(0.55, body, 1.6, 0.4, 1.4), 0, 0.12, 0), // 바닥에 퍼진 점액
    at(face(1.9, { mouth: 'grr', light: true, spread: 0.3 }), 0, 0.95, 0.86),
  );
  for (const side of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 16), horn), side * 0.5, 1.75, 0, 0, 0, -side * 0.45));
  for (const x of [-0.18, 0, 0.18]) g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), horn), x, 0.58, 0.88, Math.PI));
  for (const [x, z] of [[-0.75, 0.4], [0.8, 0.3], [0.3, 0.75]]) g.add(at(sphere(0.18, body, 1, 0.6, 1.2), x, 0.08, z));
  return g;
};

const shield: Model = () => {
  // 방패병: 파란 점액 + 냄비 뚜껑 방패를 앞에 든다
  const body = slimeMat(0x7aa0c8);
  const lid = metal(0xc9d2e0);
  return group(
    at(sphere(0.55, body, 1.05, 0.95, 1), 0, 0.6, 0),
    at(face(1.15, { mouth: 'grr', spread: 0.24 }), 0, 0.82, 0.52),
    at(cyl(0.48, 0.5, 0.08, lid, 40), 0.15, 0.45, 0.62, Math.PI / 2 - 0.15),
    at(torus(0.48, 0.04, metal(0x9aa6b8)), 0.15, 0.45, 0.65),
    at(sphere(0.09, plastic(0x3a3440)), 0.15, 0.45, 0.72), // 뚜껑 손잡이
    limbs(body, { width: 0.2, arms: false }),
  );
};

const ghost: Model = () => {
  // 유령: 반투명 하얀 천 + 물결 치는 아랫단
  const sheet = new THREE.MeshStandardMaterial({ color: 0xeef0fa, roughness: 0.4, transparent: true, opacity: 0.82 });
  const g = group(at(sphere(0.6, sheet, 1, 1.1, 1), 0, 0.95, 0), at(cyl(0.6, 0.66, 0.6, sheet, 32), 0, 0.5, 0), at(face(1.2, { mouth: 'o', spread: 0.24 }), 0, 1.0, 0.56));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(at(sphere(0.18, sheet, 1, 1.2, 1), Math.cos(a) * 0.55, 0.22, Math.sin(a) * 0.55));
  }
  return g;
};

const healer: Model = () => {
  // 치유사: 분홍 점액 + 간호모(빨간 십자) + 반짝이는 하트
  const body = slimeMat(0xf08fb0);
  const heart = new THREE.MeshStandardMaterial({ color: 0xff5a7a, emissive: 0xff3a6a, emissiveIntensity: 0.6 });
  return group(
    at(sphere(0.58, body, 1.1, 0.9, 1), 0, 0.55, 0),
    at(face(1.3, { spread: 0.24 }), 0, 0.6, 0.56),
    at(rbox(0.6, 0.26, 0.38, 0.08, plastic(0xffffff, 0.4)), 0, 1.08, 0),
    at(rbox(0.2, 0.06, 0.02, 0.02, plastic(0xff4a5a)), 0, 1.1, 0.2), at(rbox(0.06, 0.2, 0.02, 0.02, plastic(0xff4a5a)), 0, 1.1, 0.2),
    at(sphere(0.1, heart), 0.62, 0.95, 0.2), at(sphere(0.07, heart), -0.6, 1.05, 0.1),
  );
};

const charger: Model = () => {
  // 돌격병: 주황 점액 + 작은 뿔 + 앞으로 숙인 자세 + 먼지 꼬리
  const body = slimeMat(0xe0703a);
  const g = group(
    at(sphere(0.55, body, 1, 0.85, 1.2), 0, 0.5, 0, 0.25),
    at(face(1.2, { mouth: 'grr', spread: 0.23 }), 0, 0.5, 0.62),
    limbs(body, { width: 0.2, arms: false }),
    at(sphere(0.18, plastic(0xd8c4a8, 0.9)), -0.2, 0.15, -0.65), at(sphere(0.13, plastic(0xd8c4a8, 0.9)), 0.15, 0.1, -0.8),
  );
  for (const side of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 12), plastic(0xfff1dc, 0.4)), side * 0.28, 0.98, 0.25, 0.5, 0, -side * 0.3));
  return g;
};

const dancer: Model = () => {
  // 까불이 왕자: 팔다리 달린 청록 점액 왕자. 한 손을 이마에 대고 L자를 만든 채 몸을 흔들며 걷는다
  const slime = slimeMat(0x5fd0b0);
  const dark = slimeMat(0x3aa88a);
  const glove = plastic(0xffffff, 0.4);
  const finger = plastic(0xff4f8b, 0.35);
  const gold = metal(0xffc93a);

  // 몸과 머리 (body 그룹을 흔든다)
  const head = group(
    at(sphere(0.55, slime, 1.05, 0.95, 1), 0, 0, 0),
    at(sphere(0.14, slime, 1, 1.6, 1), 0.3, -0.42, 0.25), // 흘러내리는 방울
    at(face(1.25, { mouth: 'smile', spread: 0.23 }), 0, -0.02, 0.52),
  );
  // 삐딱한 왕관
  const crown = group(at(cyl(0.26, 0.28, 0.16, gold, 6), 0, 0, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    crown.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), gold), Math.cos(a) * 0.22, 0.14, Math.sin(a) * 0.22));
  }
  head.add(at(crown, -0.1, 0.55, 0, 0, 0, 0.25));

  // L 손: 이마 앞에 댄 장갑 + 노란 손가락 두 개(세로 검지 + 가로 엄지) → 보는 쪽에서 L자로 읽힌다
  const lHand = group(
    at(sphere(0.13, glove), 0.02, -0.02, -0.04),
    at(rbox(0.11, 0.46, 0.09, 0.045, finger), -0.07, 0.24, 0.02), // 검지 (세로)
    at(rbox(0.34, 0.11, 0.09, 0.045, finger), 0.08, 0.0, 0.03), // 엄지 (가로)
  );
  head.add(at(lHand, 0.16, 0.36, 0.6, 0, 0.35, 0));
  // 이마로 올린 팔 (어깨 → L 손)
  const armUp = group(tube([[0.42, -0.55, 0.05], [0.56, -0.1, 0.35], [0.26, 0.3, 0.58]], 0.07, slime));
  head.add(armUp);

  // 반대 팔: 흔든다
  const armSwing = group(tube([[0, 0, 0], [-0.2, -0.25, 0.05], [-0.3, -0.5, 0.1]], 0.07, slime), at(sphere(0.11, glove), -0.3, -0.52, 0.1));
  armSwing.name = 'armSwing';

  const body = group(
    at(sphere(0.42, slime, 1, 1.05, 0.9), 0, 0, 0),
    at(rbox(0.5, 0.08, 0.5, 0.04, dark), 0, -0.05, 0), // 허리띠
    at(sphere(0.05, gold), 0, -0.05, 0.27),
    at(head, 0, 0.8, 0.02),
    at(armSwing, -0.38, 0.2, 0),
  );
  body.name = 'body';

  // 다리: 엉덩이에서 축을 잡고 번갈아 찬다
  const leg = (side: number) => {
    const g = group(at(cyl(0.09, 0.1, 0.4, slime), 0, -0.2, 0), at(sphere(0.15, dark, 1, 0.6, 1.4), 0, -0.42, 0.06));
    g.name = side < 0 ? 'legL' : 'legR';
    return at(g, side * 0.2, 0.5, 0);
  };
  // rig: 춤으로 움직이는 부분. root의 위치·회전은 게임이 정하므로 건드리지 않는다
  const rig = group(at(body, 0, 0.9, 0), leg(-1), leg(1));
  const root = group(rig);
  const legL = root.getObjectByName('legL')!, legR = root.getObjectByName('legR')!;
  const baseY = body.position.y;

  // 매 프레임 춤: 다리를 양옆으로 높이 번갈아 차고(최대 약 70°), 찬 반대쪽으로 몸을 기울이며 통통 뛴다.
  // L 포즈 직후 1.2초는 크게 뛰며 L을 내민다
  root.userData.animate = (t: number, sinceTaunt: number) => {
    const beat = t * Math.PI * 2 / 0.8;
    const s = Math.sin(beat);
    const big = sinceTaunt >= 0 && sinceTaunt < 1.2 ? Math.sin((sinceTaunt / 1.2) * Math.PI) : 0;
    const kick = 1.5; // 옆차기 높이(라디안, 약 85°)
    legR.rotation.z = Math.max(0, s) * kick; // 오른다리를 오른쪽(+x)으로
    legL.rotation.z = -Math.max(0, -s) * kick; // 왼다리를 왼쪽(-x)으로
    rig.position.x = -s * 0.12; // 찬 반대쪽으로 무게 중심 이동
    body.rotation.z = s * 0.25; // 찬 반대쪽으로 몸을 기울임
    body.position.y = baseY + Math.abs(s) * 0.12 + big * 0.35;
    armSwing.rotation.z = Math.sin(beat + 1) * 0.6;
    lHand.scale.setScalar(1 + big * 0.6);
    lHand.position.z = 0.6 + big * 0.25;
  };
  return root;
};

export const MODELS: Record<string, Model> = {
  toaster, fan, microwave, vacuum, wifi, washer, stove, strip, battery, iron, aircon, dishwasher,
  goo, rat, roach, grease, splitter, splitling, boss, shield, ghost, healer, charger, dancer,
};
