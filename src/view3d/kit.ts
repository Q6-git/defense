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

/**
 * 곡면을 몇 조각으로 나눌지 (1 = 그림 렌더링용 최고 품질).
 * 게임 화면에서는 캐릭터가 작아서 절반 정도면 충분하고, 적이 많을 때 휴대폰이 훨씬 가볍다.
 */
export const KIT = { detail: 0.5 };
const seg = (n: number, min: number) => Math.max(min, Math.round(n * KIT.detail));

/**
 * 같은 모양은 한 번만 만들어 함께 쓴다 (적 수십 마리가 같은 구·상자를 공유).
 * 공유하므로 기하 자체는 절대 고치지 않는다 — 크기·위치는 메시에서 바꾼다.
 */
const GEO = new Map<string, THREE.BufferGeometry>();
function shared<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  const k = `${key}@${KIT.detail}`;
  let g = GEO.get(k);
  if (!g) GEO.set(k, (g = make()));
  return g as T;
}

export function rbox(w: number, h: number, d: number, r: number, mat: THREE.Material): THREE.Mesh {
  const rr = Math.min(r, w / 2, h / 2, d / 2);
  return new THREE.Mesh(shared(`b${w},${h},${d},${rr}`, () => new RoundedBoxGeometry(w, h, d, seg(4, 2), rr)), mat);
}
export function sphere(r: number, mat: THREE.Material, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(shared(`s${r}`, () => new THREE.SphereGeometry(r, seg(32, 12), seg(24, 8))), mat);
  m.scale.set(sx, sy, sz);
  return m;
}
export function cyl(rt: number, rb: number, h: number, mat: THREE.Material, n = 24): THREE.Mesh {
  return new THREE.Mesh(shared(`c${rt},${rb},${h},${n}`, () => new THREE.CylinderGeometry(rt, rb, h, seg(n, Math.min(n, 8)))), mat);
}
export function torus(r: number, tube: number, mat: THREE.Material, arc = Math.PI * 2): THREE.Mesh {
  return new THREE.Mesh(shared(`t${r},${tube},${arc}`, () => new THREE.TorusGeometry(r, tube, seg(16, 6), seg(48, 16), arc)), mat);
}
/** 점들을 잇는 둥근 관 (더듬이, 꼬리 등) */
export function tube(points: [number, number, number][], r: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(shared(`u${r}:${points.join(';')}`, () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, seg(32, 12), r, seg(12, 6), false);
  }), mat);
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
 * 3/4 시점(오른쪽 앞에서 봄)에서 보이도록 오른쪽 뒤로 휘어진다. 플러그 위 작은 불(plugLed)이 레벨을 보여 준다
 */
export function plugTail(opts: { y?: number; z?: number; lit?: boolean } = {}): THREE.Group {
  const y = opts.y ?? 0.42, z = opts.z ?? -0.22;
  const cord = plastic(0x3a3440, 0.35);
  const g = group(tube([[0, y, z], [0.12, y - 0.18, z - 0.25], [0.38, 0.07, z - 0.38], [0.62, 0.06, z - 0.22]], 0.045, cord));
  const body = rbox(0.24, 0.17, 0.2, 0.06, plastic(0xffffff, 0.3));
  body.name = 'plugBody';
  const plug = group(
    body,
    at(rbox(0.04, 0.035, 0.12, 0.01, new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.25, metalness: 0.8 })), -0.05, 0, 0.14),
    at(rbox(0.04, 0.035, 0.12, 0.01, new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.25, metalness: 0.8 })), 0.05, 0, 0.14),
  );
  // 레벨 불빛: 게임에서는 Board3D가 이름(plugLed)으로 찾아 레벨에 맞게 색을 바꾼다
  const led = at(sphere(0.06, new THREE.MeshStandardMaterial({ color: opts.lit ? 0x6aff8a : 0x55525e, emissive: opts.lit ? 0x3aff6a : 0x000000, emissiveIntensity: 1.2, roughness: 0.3 })), 0, 0.1, 0);
  led.name = 'plugLed';
  plug.add(led);
  plug.scale.setScalar(1.35);
  g.add(at(plug, 0.74, 0.11, z - 0.12, 0, 1.2, 0));
  return g;
}

export type Expression = 'normal' | 'happy' | 'angry' | 'surprised';

/**
 * 디지털 얼굴: 어두운 화면 위에 빛나는 픽셀 눈. 표정을 바꿔 끼울 수 있다.
 * (가전 몸에 화면이 달린 느낌. face()와 같은 크기 기준으로 앞(+z)을 본다)
 */
export function screenFace(s = 1, expr: Expression = 'normal', color = 0x6ff2ff): THREE.Group {
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.3 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x1f2633, roughness: 0.15, metalness: 0.3 });
  const g = group(at(rbox(0.78 * s, 0.46 * s, 0.05 * s, 0.1 * s, panel), 0, 0, 0));
  const z = 0.035 * s;
  for (const side of [-1, 1]) {
    const x = side * 0.19 * s;
    if (expr === 'normal') g.add(at(rbox(0.11 * s, 0.17 * s, 0.03 * s, 0.04 * s, glow), x, 0.03 * s, z));
    if (expr === 'surprised') g.add(at(torus(0.07 * s, 0.022 * s, glow), x, 0.03 * s, z));
    if (expr === 'happy') g.add(at(torus(0.075 * s, 0.024 * s, glow, Math.PI), x, 0, z)); // ^ ^
    if (expr === 'angry') g.add(at(rbox(0.16 * s, 0.05 * s, 0.03 * s, 0.02 * s, glow), x, 0.03 * s, z, 0, 0, side * 0.45)); // > <
  }
  // 입: 작은 픽셀 줄
  if (expr === 'happy' || expr === 'normal') g.add(at(torus(0.06 * s, 0.018 * s, glow, Math.PI), 0, -0.1 * s, z, 0, 0, Math.PI));
  if (expr === 'angry') g.add(at(rbox(0.14 * s, 0.03 * s, 0.03 * s, 0.01 * s, glow), 0, -0.13 * s, z));
  if (expr === 'surprised') g.add(at(sphere(0.035 * s, glow, 1, 1, 0.4), 0, -0.13 * s, z));
  return g;
}

/** 머리 위 안테나: 휘청한 줄기 + 빛나는 공. 레벨에 따라 색을 바꿀 수 있다 */
export function antenna(color = 0xff5a7a, height = 0.45): THREE.Group {
  const tip = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3 });
  return group(
    tube([[0, 0, 0], [0.03, height * 0.5, 0], [0.1, height, 0.02]], 0.025, plastic(0x3a3440, 0.35)),
    at(sphere(0.09, tip), 0.1, height + 0.06, 0.02),
    at(cyl(0.07, 0.09, 0.05, plastic(0x3a3440, 0.35)), 0, 0.02, 0),
  );
}
