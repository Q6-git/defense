// 3D 화면: 격자 맵을 조리대 위 디오라마로 그리고, 가전과 적을 3D 모델로 움직인다.
// Phaser 캔버스(투명) 뒤에 three.js 캔버스를 깔고, 같은 카메라로 2D 이펙트·UI 위치를 맞춘다.
//
// 좌표: 3D의 X = 게임 x, Z = 게임 y, Y = 높이 (단위는 모두 게임 px)
// 카메라는 보드를 앞쪽 위에서 비스듬히 내려다보는 원근 카메라. 바닥 표시(사거리, 배치 칸, 후광)는
// 원근에 맞게 3D 안에서 그리고, 점 하나로 정해지는 것(체력바, 숫자, 이펙트)은 project()로 화면 좌표를 구해 Phaser가 그린다.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Game } from '../core/game';
import type { Enemy, Grid, MapDef, Unit } from '../core/types';
import { face, group, at, plastic, rbox, cyl } from './kit';
import { MODELS } from './models';
import { DECOR, KITCHEN_OUTER, OUTER } from './props';

const W = 1280, H = 720;
/** 맵 영역(가로 0~1040) 가운데에 보드가 오도록 화면 중심을 왼쪽으로 옮기는 양 */
const SHIFT_X = 120;

/** 보드를 앞쪽 위에서 비스듬히 내려다보는 원근 카메라 (게임 화면 1280×720 기준) */
export function makeCamera(map: MapDef): THREE.PerspectiveCamera {
  const g = map.grid!;
  const cx = g.x + (g.cols * g.size) / 2, cz = g.y + (g.rows * g.size) / 2;
  // 위로 50° 기울여 내려다보고, 시야각을 좁혀(24°) 원근이 과하지 않게 (앞줄이 뒷줄보다 1.2배쯤 넓다)
  const cam = new THREE.PerspectiveCamera(24, W / H, 10, 8000);
  cam.setViewOffset(W, H, SHIFT_X, 0, W, H);
  cam.position.set(cx, 1600, cz + 1350);
  cam.lookAt(cx, -40, cz - 20);
  cam.updateMatrixWorld();
  return cam;
}

/** 3D 점(바닥 x,y와 높이 h) → 화면 좌표 */
export function project(cam: THREE.Camera, x: number, y: number, h = 0): { x: number; y: number } {
  const v = new THREE.Vector3(x, h, y).project(cam);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
}

/** 화면 좌표 → 높이 h 평면 위 바닥 좌표 */
export function unproject(cam: THREE.Camera, sx: number, sy: number, h = 0): { x: number; y: number } {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((sx / W) * 2 - 1, 1 - (sy / H) * 2), cam);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), hit)) return { x: -9999, y: -9999 };
  return { x: hit.x, y: hit.z };
}

/** 바닥에 눕혀 그리는 표시 (사거리 원, 배치 칸, 후광, 불 장판) */
export interface Mark {
  shape: 'disc' | 'ring' | 'square';
  x: number;
  y: number;
  /** 원은 반지름, 사각형은 한 변의 절반 */
  r: number;
  color: number;
  alpha: number;
  /** 고리 두께(px) */
  width?: number;
}

const STEP = 26; // 고지대 한 단 높이(px)
const TILE_T = 24; // 타일 두께

/** 칸(c, r)의 고지대 단수 */
function levelAt(map: MapDef, c: number, r: number): number {
  let lv = 0;
  for (const h of map.hills ?? []) if (c >= h.c && c < h.c + h.w && r >= h.r && r < h.r + h.h) lv = Math.max(lv, h.level);
  return lv;
}

/** base: 모델 배율(모델 1 = base px), 빌보드면 그림 한 변(px) */
type Actor = { obj: THREE.Object3D; mats: THREE.MeshStandardMaterial[]; sprite: boolean; base: number; yaw: number; lastX: number; lastY: number };

/** 모델 배율: 반지름(px) × 이 값. 가전은 한 칸을 거의 채우게 */
const UNIT_SCALE = 1.9;
const ENEMY_SCALE = 1.85;

export class Board3D {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  /** 바닥 표시 메시 풀 */
  private marks: THREE.Mesh[] = [];
  private markGeo = {
    disc: new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    square: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
  };
  private grid: Grid;
  private units = new Map<number, Actor>();
  private enemies = new Map<number, Actor>();
  private pathCell: (c: number, r: number) => boolean;
  /** 가전이 마지막으로 쏜 방향 (uid → 목표 좌표) */
  private aim = new Map<number, { x: number; y: number }>();

  constructor(
    private map: MapDef,
    sim: Game,
    /** 3D 모델이 없는 가전·적은 이 그림을 세워서(빌보드) 그린다 */
    private image: (key: string) => CanvasImageSource | null,
  ) {
    this.grid = map.grid!;
    const g = this.grid;
    this.pathCell = (c, r) => sim.distanceToPath({ x: g.x + (c + 0.5) * g.size, y: g.y + (r + 0.5) * g.size }) < map.pathHalfWidth;

    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = makeCamera(map);

    this.buildScene(sim);
  }

  /** 칸 윗면 높이(px). 배수관은 0보다 낮은 물길 */
  heightAt(x: number, y: number): number {
    const g = this.grid;
    const c = Math.floor((x - g.x) / g.size), r = Math.floor((y - g.y) / g.size);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || this.pathCell(c, r)) return 0;
    return levelAt(this.map, c, r) * STEP;
  }

  private buildScene(sim: Game): void {
    const sc = this.scene;
    const g = this.grid;
    const S = g.size;
    sc.background = new THREE.Color(0x3b3048);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    sc.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    sc.environmentIntensity = 0.35;
    sc.add(new THREE.HemisphereLight(0xfff4e6, 0x6a5470, 0.7));
    const cx = g.x + (g.cols * S) / 2, cz = g.y + (g.rows * S) / 2;
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
    sun.position.set(cx - 520, 720, cz + 300);
    sun.target.position.set(cx, 0, cz);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 700, bottom: -700, near: 10, far: 2500 });
    sun.shadow.bias = -0.0004;
    sc.add(sun, sun.target);

    const shadowed = <T extends THREE.Object3D>(o: T): T => {
      o.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true;
      });
      return o;
    };
    const W = g.cols * S, H = g.rows * S;
    const mid = (n: number, start: number) => start + n / 2;

    // 조리대: 상판 두께 + 문짝 달린 하부장 + 바닥
    const counterTop = -TILE_T;
    sc.add(shadowed(at(rbox(W + 3.6 * S, 26, H + 3.6 * S, 10, plastic(0xb9784a, 0.6)), mid(W, g.x), counterTop - 13, mid(H, g.y))));
    sc.add(at(new THREE.Mesh(new THREE.BoxGeometry(W, 4, H), plastic(0xa88a6a, 0.8)), mid(W, g.x), counterTop + 2, mid(H, g.y)));
    const cab = at(rbox(W + 3.2 * S, 170, H + 3.2 * S, 6, plastic(0xf3e6d3, 0.5)), mid(W, g.x), counterTop - 26 - 85, mid(H, g.y));
    sc.add(shadowed(cab));
    const frontZ = g.y + H + 1.6 * S;
    for (let i = 0; i < 6; i++) {
      const x = g.x - 1.4 * S + ((W + 2.8 * S) * (i + 0.5)) / 6;
      sc.add(at(rbox((W + 2.6 * S) / 6 - 8, 140, 6, 6, plastic(0xe9d7bd, 0.45)), x, counterTop - 110, frontZ + 2));
      sc.add(at(rbox(40, 7, 7, 3, plastic(0xb08a5a, 0.3)), x, counterTop - 52, frontZ + 6));
    }
    const floor = at(new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), plastic(0x6b5a72, 0.9)), mid(W, g.x), counterTop - 200, mid(H, g.y), -Math.PI / 2);
    floor.receiveShadow = true;
    sc.add(floor);

    // 뒤쪽 벽: 벽돌 타일 무늬 + 창문
    const wallTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 256;
      const x = cv.getContext('2d')!;
      x.fillStyle = '#efe4d2';
      x.fillRect(0, 0, 512, 256);
      x.strokeStyle = '#d8c8ae';
      x.lineWidth = 6;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) x.strokeRect(c * 64 - (r % 2) * 32, r * 32, 64, 32);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(8, 3);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const backZ = g.y - 2.6 * S;
    const wall = at(new THREE.Mesh(new THREE.PlaneGeometry(3000, 900), new THREE.MeshStandardMaterial({ color: 0xd9ccb8, map: wallTex, roughness: 0.8 })), mid(W, g.x), 300, backZ);
    wall.receiveShadow = true;
    sc.add(wall);
    sc.add(at(rbox(380, 170, 14, 6, plastic(0xffffff, 0.4)), g.x + W * 0.3, 150, backZ + 6));
    sc.add(at(new THREE.Mesh(new THREE.PlaneGeometry(350, 140), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x9fd8ff, emissiveIntensity: 0.6 })), g.x + W * 0.3, 150, backZ + 14));

    // 타일
    const tileGeo = new RoundedBoxGeometry(S * 0.92, TILE_T, S * 0.92, 3, 5);
    const light = plastic(0xfbe7c6, 0.5), dark = plastic(0xeec08a, 0.5);
    const side = plastic(0x9a6438, 0.6), woodA = plastic(0xe0a868, 0.55), woodB = plastic(0xd09356, 0.55);
    const water = new THREE.MeshStandardMaterial({ color: 0x3fa6d8, roughness: 0.1, metalness: 0.1, emissive: 0x1a5f80, emissiveIntensity: 0.25 });
    const trough = plastic(0xb5c7d3, 0.5);
    const waterGeo = new THREE.BoxGeometry(S, 3, S), troughGeo = new THREE.BoxGeometry(S, 4, S);
    // 같은 모양·재질끼리 모아 인스턴싱으로 한 번에 그린다 (칸이 수백 개라 휴대폰에서도 가볍게)
    const batches = new Map<THREE.Material, { geo: THREE.BufferGeometry; at: THREE.Vector3[]; shadow: boolean }>();
    const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
      let b = batches.get(mat);
      if (!b) batches.set(mat, (b = { geo, at: [], shadow }));
      b.at.push(new THREE.Vector3(x, y, z));
    };
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const x = g.x + (c + 0.5) * S, z = g.y + (r + 0.5) * S;
        if (this.pathCell(c, r)) {
          put(troughGeo, trough, x, -16, z, false);
          put(waterGeo, water, x, -12, z, false);
          continue;
        }
        const lv = levelAt(this.map, c, r);
        for (let i = 0; i < lv; i++) put(tileGeo, side, x, -TILE_T / 2 + i * STEP, z);
        const topMat = lv > 0 ? ((r + c) % 2 ? woodB : woodA) : (r + c) % 2 ? dark : light;
        put(tileGeo, topMat, x, -TILE_T / 2 + lv * STEP, z);
      }
    }
    const m4 = new THREE.Matrix4();
    for (const [mat, b] of batches) {
      const inst = new THREE.InstancedMesh(b.geo, mat, b.at.length);
      b.at.forEach((v, i) => inst.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z)));
      inst.receiveShadow = true;
      inst.castShadow = b.shadow;
      sc.add(inst);
    }

    // 배수구와 콘센트
    const path = sim.paths[0];
    const start = path.pointAt(0), end = path.pointAt(path.length);
    sc.add(shadowed(group(at(cyl(30, 32, 16, plastic(0x4a4458, 0.3)), g.x - 20, -8, start.y), at(cyl(21, 21, 17, plastic(0x1e1a26, 0.6)), g.x - 20, -7, start.y))));
    const outlet = group(rbox(66, 66, 26, 13, plastic(0xffffff, 0.3)), at(face(78), 0, 0, 14));
    outlet.rotation.x = -0.25;
    sc.add(shadowed(at(outlet, end.x + 56, 34, end.y)));

    // 칸 위 소품과 보드 둘레 장식
    for (const d of this.map.decor ?? []) {
      const o = DECOR[d.kind]();
      o.scale.multiplyScalar(S);
      sc.add(shadowed(at(o, g.x + (d.c + 0.5) * S, levelAt(this.map, d.c, d.r) * STEP, g.y + (d.r + 0.5) * S, 0, d.rot ?? 0, 0)));
    }
    if (this.map.id === 'kitchen') {
      for (const [kind, c, r, ry] of KITCHEN_OUTER) {
        const o = OUTER[kind]();
        o.scale.multiplyScalar(S);
        sc.add(shadowed(at(o, g.x + c * S, -TILE_T, g.y + r * S, 0, ry, 0)));
      }
    }
  }

  // ───────── 캐릭터

  /** radius: 게임 속 반지름(px), scale: 모델 배율 계수 */
  private makeActor(key: string, radius: number, scale: number): Actor {
    let obj: THREE.Object3D;
    const mats: THREE.MeshStandardMaterial[] = [];
    let sprite = false;
    const build = MODELS[key];
    let base: number;
    if (build) {
      obj = build();
      base = radius * scale;
      obj.scale.setScalar(base);
      obj.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) {
          m.castShadow = true;
          const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat.isMeshStandardMaterial && !mats.includes(mat)) mats.push(mat);
        }
      });
    } else {
      // 3D 모델이 아직 없는 캐릭터: 그림을 세운 판
      const img = this.image(key);
      const tex = img ? new THREE.Texture(img as HTMLImageElement) : null;
      if (tex) {
        tex.needsUpdate = true;
        tex.colorSpace = THREE.SRGBColorSpace;
      }
      const mat = new THREE.SpriteMaterial({ map: tex, color: tex ? 0xffffff : 0x999999, transparent: true });
      const sp = new THREE.Sprite(mat);
      sp.center.set(0.5, 0.18);
      base = radius * scale * 2.2;
      sp.scale.set(base, base, 1);
      obj = sp;
      sprite = true;
    }
    this.scene.add(obj);
    return { obj, mats, sprite, base, yaw: 0, lastX: NaN, lastY: NaN };
  }

  /** 화면 좌표 (h: 칸 높이 위로 더 올릴 양) */
  project(x: number, y: number, lift = 0): { x: number; y: number } {
    return project(this.camera, x, y, this.heightAt(x, y) + lift);
  }

  /** 화면 좌표 → 바닥 좌표 (높은 칸을 누르면 그 칸으로) */
  unproject(sx: number, sy: number): { x: number; y: number } {
    let p = unproject(this.camera, sx, sy);
    for (let i = 0; i < 3; i++) p = unproject(this.camera, sx, sy, this.heightAt(p.x, p.y));
    return p;
  }

  /** 이번 프레임의 바닥 표시들. 칸 높이 위에 살짝 띄워 그린다 */
  setMarks(list: Mark[]): void {
    while (this.marks.length < list.length) {
      const m = new THREE.Mesh(this.markGeo.disc, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false }));
      m.renderOrder = 10;
      this.scene.add(m);
      this.marks.push(m);
    }
    this.marks.forEach((m, i) => {
      const d = list[i];
      m.visible = !!d;
      if (!d) return;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(d.color);
      mat.opacity = d.alpha;
      // 고리는 테두리만: 매번 새로 만들지 않도록 반지름·두께별로 캐시
      if (d.shape === 'ring') {
        const key = `ring:${Math.round(d.r)}:${d.width ?? 3}`;
        m.geometry = (this.ringCache.get(key) ?? this.ringCache.set(key, new THREE.RingGeometry(d.r - (d.width ?? 3), d.r, 64).rotateX(-Math.PI / 2)).get(key))!;
        m.scale.set(1, 1, 1);
      } else {
        m.geometry = this.markGeo[d.shape];
        m.scale.set(d.r, 1, d.r);
      }
      m.position.set(d.x, this.heightAt(d.x, d.y) + 2, d.y);
    });
  }
  private ringCache = new Map<string, THREE.BufferGeometry>();

  /** 가전이 쐈다: 그쪽으로 몸을 돌린다 */
  onShot(uid: number, to: { x: number; y: number }): void {
    this.aim.set(uid, to);
  }

  /**
   * 게임 상태에 맞춰 3D 캐릭터를 옮기고 그린다.
   * punch: 반동/움찔 배율, flash: 방금 맞은 적, born: 설치된 시각
   */
  render(sim: Game, t: number, dt: number, fx: { punch: Map<number, number>; flash: Set<number>; born: Map<number, number>; levelScale: (u: Unit) => number }): void {
    // 가전
    const alive = new Set<number>();
    for (const u of sim.units) {
      alive.add(u.uid);
      let a = this.units.get(u.uid);
      if (!a) {
        a = this.makeActor(u.def.id, u.def.radius, UNIT_SCALE);
        this.units.set(u.uid, a);
      }
      const h = this.heightAt(u.x, u.y);
      a.obj.position.set(u.x, h, u.y);
      const age = t - (fx.born.get(u.uid) ?? -1);
      const appear = age < 0.3 ? 0.2 + 0.8 * easeOutBack(age / 0.3) : 1;
      const breathe = 0.03 * Math.sin(t * 3 + u.uid);
      const k = fx.levelScale(u) * appear * (fx.punch.get(u.uid) ?? 1);
      this.scaleActor(a, k * (1 - breathe), k * (1 + breathe));
      const aim = this.aim.get(u.uid);
      if (aim && !a.sprite) a.yaw = turn(a.yaw, Math.atan2(aim.x - u.x, aim.y - u.y), dt * 10);
      a.obj.rotation.y = a.yaw;
    }
    this.prune(this.units, alive);

    // 적: 통통 튀며 가는 방향을 보고, 맞으면 붉게
    const seen = new Set<number>();
    for (const e of sim.enemies) {
      seen.add(e.uid);
      let a = this.enemies.get(e.uid);
      if (!a) {
        a = this.makeActor(e.def.id, e.def.radius, ENEMY_SCALE * (e.def.radius < 13 ? 1.25 : 1));
        this.enemies.set(e.uid, a);
      }
      const hop = e.stunTime <= 0 ? Math.abs(Math.sin(t * 9 + e.uid)) : 0;
      a.obj.position.set(e.x, -10 + hop * 6, e.y);
      const squash = e.stunTime > 0 ? 0 : (hop - 0.5) * 0.16;
      const k = fx.punch.get(e.uid) ?? 1;
      this.scaleActor(a, k * (1 - squash), k * (1 + squash));
      if (!Number.isNaN(a.lastX) && Math.hypot(e.x - a.lastX, e.y - a.lastY) > 0.3) {
        if (a.sprite) (a.obj as THREE.Sprite).material.rotation = 0;
        else a.yaw = turn(a.yaw, Math.atan2(e.x - a.lastX, e.y - a.lastY), dt * 12);
      }
      a.lastX = e.x;
      a.lastY = e.y;
      a.obj.rotation.y = a.yaw;
      this.tintEnemy(a, e, fx.flash.has(e.uid));
    }
    this.prune(this.enemies, seen);
    this.renderer.render(this.scene, this.camera);
  }

  private scaleActor(a: Actor, sx: number, sy: number): void {
    if (a.sprite) a.obj.scale.set(a.base * sx, a.base * sy, 1);
    else a.obj.scale.set(a.base * sx, a.base * sy, a.base * sx);
  }

  private tintEnemy(a: Actor, e: Enemy, flash: boolean): void {
    const enraged = !!e.def.enrage && e.hp <= e.maxHp * e.def.enrage.below;
    const color = flash ? 0xff3030 : enraged ? 0xff7050 : 0x000000;
    const strength = flash ? 0.55 : enraged ? 0.3 : 0;
    const alpha = e.hidden ? 0.3 : 1;
    if (a.sprite) {
      const m = (a.obj as THREE.Sprite).material;
      m.color.set(flash ? 0xff8080 : enraged ? 0xffb0a0 : 0xffffff);
      m.opacity = alpha;
      return;
    }
    for (const m of a.mats) {
      m.emissive.set(color);
      m.emissiveIntensity = strength;
      if (alpha < 1 || m.userData.fade) {
        m.userData.fade = true;
        m.transparent = true;
        m.opacity = alpha * (m.userData.baseOpacity ??= m.opacity);
      }
    }
  }

  private prune(pool: Map<number, Actor>, alive: Set<number>): void {
    for (const [uid, a] of pool) {
      if (alive.has(uid)) continue;
      this.scene.remove(a.obj);
      pool.delete(uid);
      this.aim.delete(uid);
    }
  }

  /** Phaser 캔버스와 같은 크기·위치로 맞춘다 */
  fit(target: HTMLCanvasElement): void {
    const r = target.getBoundingClientRect();
    const parent = this.canvas.parentElement?.getBoundingClientRect();
    if (!parent) return;
    const st = this.canvas.style;
    st.position = 'absolute';
    st.left = `${r.left - parent.left}px`;
    st.top = `${r.top - parent.top}px`;
    st.width = `${r.width}px`;
    st.height = `${r.height}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) this.renderer.setSize(w, h, false);
  }

  dispose(): void {
    this.renderer.dispose();
    this.canvas.remove();
  }
}

function easeOutBack(x: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 각도를 목표 쪽으로 부드럽게 돌린다 */
function turn(from: number, to: number, k: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}
