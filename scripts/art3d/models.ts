// 가전과 적의 3D 모델. 렌더링: node scripts/render3d.cjs (결과는 public/sprites/<이름>.png)
// 모델은 원점(발바닥 가운데)에 서 있고 앞(+z)을 본다.
import * as THREE from 'three';
import { at, cyl, face, group, limbs, metal, plastic, rbox, sphere, torus, tube } from './kit';

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
  return group(at(rbox(0.7, 0.32, 0.5, 0.12, cream), 0, 0.4, 0), limbs(cream, { width: 0.22 }), at(head, 0, 1.05, 0));
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
  return group(at(rbox(0.75, 0.3, 0.5, 0.12, shell), 0, 0.4, 0), limbs(plastic(0xb9bccb), { width: 0.24 }), at(head, 0, 1.05, 0));
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

export const MODELS: Record<string, Model> = { toaster, fan, microwave, goo, rat, roach };
