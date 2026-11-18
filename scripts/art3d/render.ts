// 모델을 3/4 시점(위에서 비스듬히)으로 렌더링하고 굵은 외곽선을 둘러 PNG(data URL)로 만든다.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ANIM_COLS, ANIM_FRAME, MODEL_ANIMS } from '../../src/view3d/anims';
import { KIT } from '../../src/view3d/kit';
import { MODELS as GAME_MODELS } from '../../src/view3d/models';
import { DANCER_FRAMES } from './dancer-frames';
import { GREASE_SAMPLES } from './grease-samples';
import { SAMPLES } from './samples';
import { FAN_SAMPLES } from './fan-samples';
import { DISH_SAMPLES } from './dish-samples';
import { SIXSEVEN_FRAMES } from './sixseven-frames';

// 그림은 크게 렌더링하므로 곡면을 가장 곱게
KIT.detail = 1;

// ?set=samples / grease / dancer / sixseven / fan / dish 이면 디자인 후보·동작 프레임을 렌더링한다
const SETS: Record<string, typeof GAME_MODELS> = { samples: SAMPLES, grease: GREASE_SAMPLES, dancer: DANCER_FRAMES, sixseven: SIXSEVEN_FRAMES, fan: FAN_SAMPLES, dish: DISH_SAMPLES };
const SET = new URLSearchParams(location.search).get('set') ?? '';
const MODELS = SETS[SET] ?? GAME_MODELS;

const SIZE = 256;
const OUTLINE = 7; // 외곽선 두께(px)
const OUTLINE_COLOR = '#3a2c3e';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0xb59c8a, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-2, 5, 4);
scene.add(sun);

/** 3/4 시점: 위로 35도, 옆으로 25도 돌아간 정사영 카메라 */
function camera(obj: THREE.Object3D): THREE.OrthographicCamera {
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.62;
  const cam = new THREE.OrthographicCamera(-r, r, r, -r, 0.1, 100);
  const elev = (35 * Math.PI) / 180;
  const yaw = (25 * Math.PI) / 180;
  cam.position.set(center.x + Math.sin(yaw) * Math.cos(elev) * 10, center.y + Math.sin(elev) * 10, center.z + Math.cos(yaw) * Math.cos(elev) * 10);
  cam.lookAt(center);
  return cam;
}

/** 알파 마스크를 원형으로 번지게 칠해 외곽선을 만든다 */
function withOutline(src: HTMLCanvasElement): string {
  return outlined(src).toDataURL('image/png');
}

function outlined(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const sil = document.createElement('canvas');
  sil.width = sil.height = SIZE;
  const sctx = sil.getContext('2d')!;
  sctx.drawImage(src, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = OUTLINE_COLOR;
  sctx.fillRect(0, 0, SIZE, SIZE);
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    ctx.drawImage(sil, Math.cos(t) * OUTLINE, Math.sin(t) * OUTLINE);
  }
  ctx.drawImage(src, 0, 0);
  return c;
}

/**
 * 움직이는 몬스터의 동작 시트: 프레임마다 자세를 잡아 렌더링하고 격자로 붙인다.
 * 카메라는 모든 프레임을 감싸는 상자로 고정한다 (프레임마다 맞추면 다리를 찰 때 크기가 출렁인다)
 */
function renderSheet(name: string): string {
  const spec = MODEL_ANIMS[name];
  const objs = Array.from({ length: spec.frames }, (_, i) => {
    const o = GAME_MODELS[name]();
    const p = spec.pose(i);
    (o.userData.animate as (t: number, s: number, e: { weighMode: number }) => void)(p.t, p.since, { weighMode: p.mode });
    o.updateMatrixWorld(true);
    return o;
  });
  const box = new THREE.Box3();
  for (const o of objs) box.union(new THREE.Box3().setFromObject(o));
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray()));
  proxy.position.copy(box.getCenter(new THREE.Vector3()));
  const cam = camera(proxy);
  const pad = 1 + (OUTLINE * 2.4) / SIZE;
  cam.left *= pad; cam.right *= pad; cam.top *= pad; cam.bottom *= pad;
  cam.updateProjectionMatrix();
  const sheet = document.createElement('canvas');
  sheet.width = ANIM_COLS * ANIM_FRAME;
  sheet.height = Math.ceil(spec.frames / ANIM_COLS) * ANIM_FRAME;
  const ctx = sheet.getContext('2d')!;
  objs.forEach((o, i) => {
    scene.add(o);
    renderer.render(scene, cam);
    scene.remove(o);
    ctx.drawImage(outlined(renderer.domElement), (i % ANIM_COLS) * ANIM_FRAME, Math.floor(i / ANIM_COLS) * ANIM_FRAME, ANIM_FRAME, ANIM_FRAME);
  });
  return sheet.toDataURL('image/png');
}

function render(name: string): string {
  const obj = MODELS[name]();
  scene.add(obj);
  // 외곽선이 잘리지 않게 여백을 두고 그린다
  const cam = camera(obj);
  const pad = 1 + (OUTLINE * 2.4) / SIZE;
  cam.left *= pad; cam.right *= pad; cam.top *= pad; cam.bottom *= pad;
  cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  scene.remove(obj);
  return withOutline(renderer.domElement);
}

(window as unknown as { renderAll: () => Record<string, string> }).renderAll = () => ({
  ...Object.fromEntries(Object.keys(MODELS).map((k) => [k, render(k)])),
  // 게임 모델을 렌더링할 때는 움직이는 몬스터의 동작 시트도 같이 (<이름>_anim)
  ...(SET ? {} : Object.fromEntries(Object.keys(MODEL_ANIMS).map((k) => [`${k}_anim`, renderSheet(k)]))),
});

// 브라우저에서 직접 열면 미리보기
const out = document.getElementById('out')!;
for (const [k, url] of Object.entries((window as unknown as { renderAll: () => Record<string, string> }).renderAll())) {
  const img = document.createElement('img');
  img.src = url;
  img.title = k;
  img.style.width = '160px';
  out.append(img);
}
