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
