// 3D 보드 시안: 주방 맵을 조리대 위 디오라마로 만들고 비스듬한 원근 카메라로 렌더링한다.
// 미리보기: npx vite --port 5199 후 http://localhost:5199/scripts/art3d/diorama.html
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MAP_KITCHEN } from '../../src/data/map';
import { at, cyl, face, group, metal, plastic, rbox, sphere } from '../../src/view3d/kit';
import { MODELS } from '../../src/view3d/models';

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
scene.fog = new THREE.Fog(0x3b3048, 34, 70);
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

// ── 높낮이: 몇몇 구역을 한두 단 쌓아 올린 고지대로 (배수관 칸은 항상 0)
const STEP = 0.5;
const height = (c: number, r: number): number => {
  if (isPath(c, r)) return 0;
  if (c >= 18 && r >= 3 && r <= 6) return 2; // 오른쪽 높은 언덕
  if (c >= 17 && r >= 2 && r <= 9) return 1;
  if (c <= 2 && r >= 6 && r <= 10) return 1; // 왼쪽 고지대
  if (c >= 7 && c <= 10 && r >= 6 && r <= 8) return 1; // 가운데 섬
  if (c >= 8 && c <= 9 && r === 7) return 2;
  if (c >= 11 && c <= 14 && r === 0) return 1; // 위쪽 둔덕
  return 0;
};
/** 칸 윗면 높이 */
const top = (c: number, r: number) => 0.3 + height(c, r) * STEP;

// ── 타일: 바닥 칸은 도톰한 블록, 배수관 칸은 한 단 낮은 물길
const tileGeo = new RoundedBoxGeometry(0.92, 0.5, 0.92, 3, 0.1);
const light = plastic(0xfbe7c6, 0.5), dark = plastic(0xeec08a, 0.5);
const side = plastic(0x9a6438, 0.6);
// 고지대 윗면은 나무 도마 색
const woodA = plastic(0xe0a868, 0.55), woodB = plastic(0xd09356, 0.55);
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
    // 높은 칸은 아래에 받침 블록을 쌓아 옆면이 보이게
    const h = height(c, r);
    for (let k = 0; k < h; k++) scene.add(shadowed(at(new THREE.Mesh(tileGeo, side), p.x, 0.05 + k * STEP, p.z)));
    const topMat = h > 0 ? ((r + c) % 2 ? woodB : woodA) : (r + c) % 2 ? dark : light;
    scene.add(shadowed(at(new THREE.Mesh(tileGeo, topMat), p.x, 0.05 + h * STEP, p.z)));
  }
}

// ── 배수구(입구)와 콘센트(기지)
const start = pos(0, 1);
scene.add(shadowed(group(at(cyl(0.55, 0.6, 0.3, plastic(0x4a4458, 0.3)), start.x - 1, 0, start.z), at(cyl(0.4, 0.4, 0.32, plastic(0x1e1a26, 0.6)), start.x - 1, 0.02, start.z))));
const end = pos(18, 11);
const outlet = group(rbox(1.3, 1.3, 0.5, 0.25, plastic(0xffffff, 0.3)), at(face(1.5), 0, 0, 0.26));
outlet.rotation.x = -0.25;
scene.add(shadowed(at(outlet, end.x + 1.1, 0.75, end.z)));

// ── 소품: 나무 역할의 허브 화분, 바위 역할의 책·상자·양념통 (이 칸들은 게임에서 설치 불가 칸이 된다)
const leaf = (color: number) => plastic(color, 0.7);
/** 허브 화분: 테라코타 화분 + 둥근 잎 덩어리 몇 개 (키 큰 것은 로즈메리처럼 길쭉하게) */
const herb = (tall = false) => {
  const g = group(at(cyl(0.32, 0.24, 0.4, plastic(0xd2693c, 0.6)), 0, 0.2, 0), at(cyl(0.34, 0.34, 0.08, plastic(0xb85a30, 0.6)), 0, 0.42, 0), at(cyl(0.29, 0.29, 0.04, plastic(0x5a3a22, 0.9)), 0, 0.44, 0));
  const blobs: [number, number, number, number][] = tall
    ? [[0, 0.95, 0, 0.26], [0.05, 1.35, 0.02, 0.22], [-0.02, 1.7, 0, 0.17], [0.15, 0.85, 0.1, 0.18], [-0.16, 1.1, -0.05, 0.17]]
    : [[0, 0.8, 0, 0.34], [0.22, 0.72, 0.12, 0.24], [-0.22, 0.7, 0.08, 0.24], [0.05, 1.05, -0.05, 0.24], [-0.1, 0.78, -0.2, 0.22]];
  blobs.forEach(([x, y, z, r], i) => g.add(at(sphere(r, leaf(i % 2 ? 0x5fae4a : 0x77c25a)), x, y, z)));
  return g;
};
const books = (n: number) => {
  const g = new THREE.Group();
  const colors = [0xe0604a, 0x4f8fd0, 0xf2c230, 0x6abf69];
  for (let i = 0; i < n; i++) g.add(at(rbox(0.82 - i * 0.06, 0.16, 0.6, 0.03, plastic(colors[i % 4], 0.5)), (i % 2) * 0.04, 0.08 + i * 0.17, 0, 0, i * 0.18, 0));
  return g;
};
const cereal = () => group(at(rbox(0.7, 1.3, 0.32, 0.04, plastic(0xffb43a, 0.5)), 0, 0.65, 0), at(rbox(0.5, 0.45, 0.02, 0.02, plastic(0xffffff, 0.5)), 0, 0.75, 0.17), at(sphere(0.12, plastic(0xe0604a)), 0, 0.75, 0.19));
const shakers = () => group(
  at(cyl(0.13, 0.15, 0.5, plastic(0xffffff, 0.3)), -0.15, 0.25, 0), at(sphere(0.13, metal(0xcfd5df)), -0.15, 0.52, 0),
  at(cyl(0.13, 0.15, 0.5, plastic(0x3a3440, 0.3)), 0.17, 0.25, 0.05), at(sphere(0.13, metal(0xcfd5df)), 0.17, 0.52, 0.05),
);
const fruitBowl = () => group(at(sphere(0.42, plastic(0xffffff, 0.3), 1, 0.45, 1), 0, 0.15, 0), at(sphere(0.17, plastic(0xff5a4a)), -0.12, 0.33, 0.05), at(sphere(0.16, plastic(0xffc23a)), 0.14, 0.33, -0.05), at(sphere(0.15, plastic(0x8ad04a)), 0, 0.38, 0.15));
const props: [THREE.Object3D, number, number, number][] = [
  [herb(), 0, 3, 0], [herb(true), 19, 10, 0], [herb(), 15, 8, 0.5], [herb(true), 18, 0, 0], [herb(), 9, 7, 0.3],
  [books(3), 11, 3, 0.3], [books(2), 1, 7, 0.2], [cereal(), 19, 4, -0.3], [shakers(), 4, 0, 0], [fruitBowl(), 6, 10, 0], [herb(), 0, 11, 0],
];
for (const [o, c, r, ry] of props) {
  const p = pos(c, r);
  scene.add(shadowed(at(o, p.x, top(c, r), p.z, 0, ry, 0)));
}

// ── 배경: 보드 뒤 주방 벽 (타일 벽 + 창문 + 상부장)
const wallTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const x = cv.getContext('2d')!;
  x.fillStyle = '#efe4d2'; x.fillRect(0, 0, 512, 256);
  x.strokeStyle = '#d8c8ae'; x.lineWidth = 6;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) x.strokeRect(c * 64 - (r % 2) * 32, r * 32, 64, 32);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const backZ = -ROWS / 2 - 1.2;
const wall = at(new THREE.Mesh(new THREE.PlaneGeometry(44, 14), new THREE.MeshStandardMaterial({ color: 0xd9ccb8, map: wallTex, roughness: 0.8 })), 0, 4, backZ);
wall.receiveShadow = true;
scene.add(wall);
// 창문: 밝은 하늘 + 나무 창틀
scene.add(at(rbox(7, 3.0, 0.3, 0.1, plastic(0xffffff, 0.4)), -4, 2.0, backZ + 0.1));
scene.add(at(new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.5), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x9fd8ff, emissiveIntensity: 0.6 })), -4, 2.0, backZ + 0.27));
scene.add(at(rbox(0.12, 2.5, 0.1, 0.03, plastic(0xffffff, 0.4)), -4, 2.0, backZ + 0.3));
// 상부장
for (const x of [6, 10.5]) {
  scene.add(shadowed(at(rbox(4.2, 2.6, 1.2, 0.12, plastic(0xf6efe2, 0.5)), x, 5.6, backZ + 0.6)));
  scene.add(at(rbox(0.6, 0.12, 0.12, 0.05, plastic(0xb08a5a, 0.3)), x, 4.6, backZ + 1.25));
}

// ── 캐릭터: 가전은 타일 위, 적은 물길 위
const place = (name: string, c: number, r: number, onPath = false, scale = 0.78) => {
  const m = shadowed(MODELS[name]());
  m.scale.setScalar(scale);
  const p = pos(c, r);
  m.position.set(p.x, onPath ? -0.2 : top(c, r), p.z);
  m.rotation.y = onPath ? -Math.PI / 2 + 0.3 : 0.2;
  scene.add(m);
};
for (const [n, c, r] of [['toaster', 6, 3], ['fan', 10, 3], ['microwave', 8, 6], ['toaster', 14, 7], ['fan', 5, 10], ['microwave', 15, 10], ['toaster', 18, 5], ['toaster', 1, 9]] as const) place(n, c, r);
for (const [n, c, r] of [['goo', 4, 1], ['rat', 7, 1], ['roach', 11, 1], ['goo', 16, 3], ['rat', 12, 5], ['roach', 6, 5], ['goo', 3, 7]] as const) place(n, c, r, true, 0.6);

// ── 카메라: 보드를 앞쪽 위에서 비스듬히 (원근)
const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
cam.position.set(0, 17.5, 19.5);
cam.lookAt(0, -1.2, 0.4);
renderer.render(scene, cam);
(window as unknown as { shot: () => string }).shot = () => renderer.domElement.toDataURL('image/png');
