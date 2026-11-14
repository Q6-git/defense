// 장난감 같은 2등신 캐릭터를 만드는 공용 부품.
// 단위: 캐릭터 키가 대략 2 (머리 ≈ 1.2, 몸+다리 ≈ 0.8). 앞쪽이 +z, 위쪽이 +y.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Part = THREE.Object3D;

/** 반짝이는 플라스틱 재질 */
export function plastic(color: number | string, roughness = 0.38): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}
/** 금속 느낌 (토스터 몸통 등) */
export function metal(color: number | string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.55 });
}

export function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), mat);
}
export function sphere(r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat);
  m.scale.set(sx, sy, sz);
  return m;
}
export function cyl(rt: number, rb: number, h: number, mat: THREE.Material, seg = 24): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}
export function torus(r: number, tube: number, mat: THREE.Material, arc = Math.PI * 2): THREE.Mesh {
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 16, 48, arc), mat);
}
/** 점들을 잇는 둥근 관 (더듬이, 꼬리 등) */
export function tube(points: [number, number, number][], r: number, mat: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 32, r, 12, false), mat);
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
}
export function group(...parts: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const p of parts) g.add(p);
  return g;
}

const INK = plastic(0x2a2230, 0.25);
const WHITE = plastic(0xffffff, 0.2);
const CHEEK = new THREE.MeshStandardMaterial({ color: 0xff8fa3, roughness: 0.6, transparent: true, opacity: 0.85 });

/**
 * 얼굴: 반짝이는 큰 눈 두 개 + 볼터치 + 작은 입. 앞(+z)을 본다.
 * s: 크기, spread: 눈 사이 간격, light: 어두운 바탕 위라 눈을 흰색으로
 */
export function face(s = 1, opts: { spread?: number; light?: boolean; mouth?: 'smile' | 'o' | 'grr' } = {}): THREE.Group {
  const spread = (opts.spread ?? 0.26) * s;
  const eyeMat = opts.light ? WHITE : INK;
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const eye = at(sphere(0.1 * s, eyeMat, 1, 1.25, 0.45), side * spread, 0.02 * s, 0);
    const shine = at(sphere(0.035 * s, opts.light ? INK : WHITE, 1, 1, 0.5), side * spread - 0.03 * s, 0.07 * s, 0.04 * s);
    const cheek = at(sphere(0.07 * s, CHEEK, 1.3, 0.8, 0.3), side * (spread + 0.12 * s), -0.12 * s, -0.01 * s);
    g.add(eye, shine, cheek);
  }
  const mouth = opts.mouth ?? 'smile';
  if (mouth === 'smile') g.add(at(torus(0.07 * s, 0.018 * s, eyeMat, Math.PI), 0, -0.1 * s, 0.01 * s, 0, 0, Math.PI));
  if (mouth === 'o') g.add(at(sphere(0.045 * s, eyeMat, 1, 1.2, 0.4), 0, -0.13 * s, 0.01 * s));
  if (mouth === 'grr') {
    g.add(at(torus(0.07 * s, 0.018 * s, eyeMat, Math.PI), 0, -0.15 * s, 0.01 * s));
    // 화난 눈썹
    for (const side of [-1, 1]) g.add(at(rbox(0.16 * s, 0.035 * s, 0.03 * s, 0.015 * s, eyeMat), side * spread, 0.17 * s, 0.02 * s, 0, 0, side * 0.35));
  }
  return g;
}

/** 짧은 팔다리: 2등신 몸통 아래 뭉툭한 발 두 개와 옆의 동그란 손 */
export function limbs(mat: THREE.Material, opts: { width?: number; arms?: boolean; y?: number } = {}): THREE.Group {
  const w = opts.width ?? 0.28;
  const y = opts.y ?? 0;
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    g.add(at(cyl(0.08, 0.09, 0.22, mat), side * w, y + 0.12, 0));
    g.add(at(sphere(0.13, mat, 1, 0.6, 1.3), side * w, y + 0.03, 0.05));
    if (opts.arms !== false) g.add(at(sphere(0.1, mat), side * (w + 0.3), y + 0.42, 0.05));
  }
  return g;
}

/**
 * 가전 수비대 표식: 몸 뒤에서 나와 바닥에 늘어진 전선 꼬리 + 콘센트 플러그.
 * 3/4 시점(오른쪽 앞에서 봄)에서 보이도록 오른쪽 뒤로 휘어진다. lit이면 플러그에 초록 불(레벨업 표시용)
 */
export function plugTail(opts: { y?: number; z?: number; lit?: boolean } = {}): THREE.Group {
  const y = opts.y ?? 0.42, z = opts.z ?? -0.22;
  const cord = plastic(0x3a3440, 0.35);
  const g = group(tube([[0, y, z], [0.12, y - 0.18, z - 0.25], [0.38, 0.07, z - 0.38], [0.62, 0.06, z - 0.22]], 0.045, cord));
  const plug = group(
    rbox(0.24, 0.17, 0.2, 0.06, plastic(0xffffff, 0.3)),
    at(rbox(0.04, 0.035, 0.12, 0.01, new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.25, metalness: 0.8 })), -0.05, 0, 0.14),
    at(rbox(0.04, 0.035, 0.12, 0.01, new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.25, metalness: 0.8 })), 0.05, 0, 0.14),
  );
  if (opts.lit) plug.add(at(sphere(0.04, new THREE.MeshStandardMaterial({ color: 0x6aff8a, emissive: 0x3aff6a, emissiveIntensity: 1.2 })), 0, 0.09, 0));
  g.add(at(plug, 0.72, 0.09, z - 0.12, 0, 1.2, 0));
  return g;
}

/** 하수구 군단 표식: 머리에 쓴 작은 배수구 뚜껑 모자 (동그란 쇠 격자) */
export function drainCap(size = 1): THREE.Group {
  const iron = new THREE.MeshStandardMaterial({ color: 0x6a6878, roughness: 0.35, metalness: 0.6 });
  const slot = plastic(0x1e1a26, 0.8);
  const g = group(cyl(0.3, 0.32, 0.07, iron, 32), at(torus(0.3, 0.035, iron), 0, 0.03, 0, Math.PI / 2));
  for (const x of [-0.14, 0, 0.14]) g.add(at(rbox(0.05, 0.02, 0.38 - Math.abs(x) * 1.2, 0.01, slot), x, 0.04, 0));
  g.scale.setScalar(size);
  g.rotation.z = -0.25; // 살짝 삐딱하게
  return g;
}
