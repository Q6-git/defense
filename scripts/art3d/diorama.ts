// 3D 보드 시안: 주방 맵을 조리대 위 디오라마로 만들고 비스듬한 원근 카메라로 렌더링한다.
// 미리보기: npx vite --port 5199 후 http://localhost:5199/scripts/art3d/diorama.html
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MAP_KITCHEN } from '../../src/data/map';
import { at, cyl, face, group, plastic, rbox, sphere } from './kit';
import { MODELS } from './models';

const W = 1600, H = 900;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMappingExposure = 0.85;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3b3048);
scene.fog = new THREE.Fog(0x3b3048, 30, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6a5470, 0.7));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
sun.position.set(-10, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const grid = MAP_KITCHEN.grid!;
const COLS = grid.cols, ROWS = grid.rows;
/** 격자 칸 → 3D 좌표 (1칸 = 1, 보드 가운데가 원점) */
const pos = (c: number, r: number) => new THREE.Vector3(c - COLS / 2 + 0.5, 0, r - ROWS / 2 + 0.5);
const px2cell = (x: number, y: number) => ({ c: (x - grid.x) / grid.size - 0.5, r: (y - grid.y) / grid.size - 0.5 });

// 어느 칸이 배수관인지: 길 꼭짓점 사이를 칸 단위로 채운다
const pathCells = new Set<string>();
const pts = MAP_KITCHEN.paths[0].map((p) => px2cell(Math.max(p.x, grid.x + grid.size / 2), p.y));
for (let i = 1; i < pts.length; i++) {
  const a = pts[i - 1], b = pts[i];
  const n = Math.round(Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r)));
  for (let k = 0; k <= n; k++) pathCells.add(`${Math.round(a.c + ((b.c - a.c) * k) / n)},${Math.round(a.r + ((b.r - a.r) * k) / n)}`);
}
const isPath = (c: number, r: number) => pathCells.has(`${c},${r}`);

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

// ── 조리대(보드 받침): 나무 상판 두께 + 문짝이 달린 옆면
const counter = group(
  at(rbox(COLS + 1.2, 0.5, ROWS + 1.2, 0.15, plastic(0xb9784a, 0.6)), 0, -0.55, 0),
  at(new THREE.Mesh(new THREE.BoxGeometry(COLS, 0.3, ROWS), plastic(0xa88a6a, 0.8)), 0, -0.35, 0), // 줄눈
  at(rbox(COLS + 0.8, 2.2, ROWS + 0.8, 0.1, plastic(0xf3e6d3, 0.5)), 0, -1.8, 0),
);
for (let i = 0; i < 6; i++) {
  const x = -COLS / 2 + 1.8 + i * 3.3;
  counter.add(at(rbox(3.0, 1.8, 0.1, 0.08, plastic(0xe9d7bd, 0.45)), x, -1.75, ROWS / 2 + 0.42));
  counter.add(at(rbox(0.7, 0.12, 0.12, 0.05, plastic(0xb08a5a, 0.3)), x, -1.1, ROWS / 2 + 0.5));
}
scene.add(shadowed(counter));

// ── 타일: 바닥 칸은 도톰한 블록, 배수관 칸은 한 단 낮은 물길
const tileGeo = new RoundedBoxGeometry(0.92, 0.5, 0.92, 3, 0.1);
const light = plastic(0xfbe7c6, 0.5), dark = plastic(0xeec08a, 0.5);
const water = new THREE.MeshStandardMaterial({ color: 0x3fa6d8, roughness: 0.1, metalness: 0.1, emissive: 0x1a5f80, emissiveIntensity: 0.25 });
const trough = plastic(0xb5c7d3, 0.5);
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const p = pos(c, r);
    if (isPath(c, r)) {
      scene.add(shadowed(at(new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), trough), p.x, -0.3, p.z)));
      const w = at(new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), water), p.x, -0.22, p.z);
      w.receiveShadow = true;
      scene.add(w);
      continue;
    }
    scene.add(shadowed(at(new THREE.Mesh(tileGeo, (r + c) % 2 ? dark : light), p.x, 0.05, p.z)));
  }
}

// ── 배수구(입구)와 콘센트(기지)
const start = pos(0, 1);
scene.add(shadowed(group(at(cyl(0.55, 0.6, 0.3, plastic(0x4a4458, 0.3)), start.x - 1, 0, start.z), at(cyl(0.4, 0.4, 0.32, plastic(0x1e1a26, 0.6)), start.x - 1, 0.02, start.z))));
const end = pos(18, 11);
const outlet = group(rbox(1.3, 1.3, 0.5, 0.25, plastic(0xffffff, 0.3)), at(face(1.5), 0, 0, 0.26));
outlet.rotation.x = -0.25;
scene.add(shadowed(at(outlet, end.x + 1.1, 0.75, end.z)));

// ── 소품: 빈 가장자리 칸에 주방 물건 (설치 자리 위가 아니라 보드 바깥 테두리)
const mug = (color: number) => group(at(cyl(0.28, 0.25, 0.55, plastic(color)), 0, 0.27, 0), at(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 20), plastic(color)), 0.3, 0.3, 0, 0, 0, 0));
const jar = group(at(cyl(0.3, 0.3, 0.7, new THREE.MeshStandardMaterial({ color: 0xbfe6d8, roughness: 0.1, transparent: true, opacity: 0.7 })), 0, 0.35, 0), at(cyl(0.32, 0.32, 0.15, plastic(0xe0604a)), 0, 0.75, 0));
const props: [THREE.Object3D, number, number, number][] = [
  [mug(0xff8a6a), -COLS / 2 - 0.3, -ROWS / 2 + 3, 0.3], [jar, COLS / 2 + 0.2, -ROWS / 2 + 1, 0], [mug(0x7ac0ff), COLS / 2 + 0.25, ROWS / 2 - 4, 1.2],
  [group(at(sphere(0.35, plastic(0xffd23f)), 0, 0.3, 0), at(cyl(0.04, 0.04, 0.2, plastic(0x6a8a3a)), 0, 0.68, 0)), -COLS / 2 - 0.2, ROWS / 2 - 1.5, 0],
];
for (const [o, x, z, ry] of props) {
  o.rotation.y = ry;
  scene.add(shadowed(at(o, x, 0.15, z, 0, ry, 0)));
}

// ── 캐릭터: 가전은 타일 위, 적은 물길 위
const place = (name: string, c: number, r: number, onPath = false, scale = 0.78) => {
  const m = shadowed(MODELS[name]());
  m.scale.setScalar(scale);
  const p = pos(c, r);
  m.position.set(p.x, onPath ? -0.2 : 0.3, p.z);
  m.rotation.y = onPath ? -Math.PI / 2 + 0.3 : 0.2;
  scene.add(m);
};
for (const [n, c, r] of [['toaster', 6, 3], ['fan', 10, 3], ['microwave', 8, 7], ['toaster', 14, 7], ['fan', 5, 10], ['microwave', 15, 10], ['toaster', 9, 2]] as const) place(n, c, r);
for (const [n, c, r] of [['goo', 4, 1], ['rat', 7, 1], ['roach', 11, 1], ['goo', 16, 3], ['rat', 12, 5], ['roach', 6, 5], ['goo', 3, 7]] as const) place(n, c, r, true, 0.6);

// ── 카메라: 보드를 앞쪽 위에서 비스듬히 (원근)
const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
cam.position.set(0, 20.5, 17.5);
cam.lookAt(0, -1.6, 1.2);
renderer.render(scene, cam);
(window as unknown as { shot: () => string }).shot = () => renderer.domElement.toDataURL('image/png');
