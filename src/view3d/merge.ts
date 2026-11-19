// 캐릭터 모형의 부품 메시를 합쳐 그리기 횟수를 줄인다.
// 모형 하나가 부품 20~40개라 적이 수백 마리인 후반(무한 모드 80웨이브 이후)에는 한 화면에 그리기 호출이
// 수천 번이 되어 크게 끊겼다. 색만 다른 부품은 색을 꼭짓점 색으로 옮겨 한 메시로 합치면 모형당 몇 번이면 된다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 합치지 않고 그대로 두는 부품 (Board3D가 이름으로 찾아 색을 바꾼다) */
const KEEP = new Set(['plugLed', 'plugBody']);

type Recipe = {
  /** 합친 부품: 기하(모형 기준 좌표, 꼭짓점 색 포함) + 재질 견본 */
  merged: { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }[];
};

/** 모형 이름별로 한 번만 합치고, 기하는 같은 모형끼리 함께 쓴다 */
const RECIPES = new Map<string, Recipe>();

/** 색을 뺀 재질 성질이 같으면 한 메시로 합칠 수 있다 */
function matKey(m: THREE.MeshStandardMaterial): string {
  return [
    m.roughness, m.metalness, m.emissive.getHex(), m.emissiveIntensity, m.transparent, m.opacity, m.side,
    m.depthWrite, !!m.userData.keepEmissive,
  ].join('|');
}

/** 부품 기하를 복사해 matrix로 옮기고 색을 꼭짓점에 넣는다 (world: toRoot × 부품의 월드 행렬, 아니면 matrix 그대로) */
function bake(mesh: THREE.Mesh, toRoot: THREE.Matrix4, color: THREE.Color, world = true): THREE.BufferGeometry {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position').clone());
  geo.setAttribute('normal', src.getAttribute('normal').clone());
  const m = world ? new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld) : toRoot;
  geo.applyMatrix4(m);
  // 거울상(음수 배율) 부품은 면 방향이 뒤집히므로 삼각형 꼭짓점 순서를 바꿔 되돌린다
  if (m.determinant() < 0) {
    for (const name of ['position', 'normal']) {
      const a = geo.getAttribute(name) as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i += 3) {
        const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1);
        a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
        a.setXYZ(i + 2, x, y, z);
      }
    }
  }
  const n = geo.getAttribute('position').count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  src.dispose();
  return geo;
}

/** 꼭짓점 색을 쓰는 재질 (색은 꼭짓점에 있으므로 흰색) */
function vertexColored(mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const m = mat.clone();
  m.vertexColors = true;
  m.color.set(0xffffff);
  return m;
}

/**
 * 매 프레임 부품을 움직이는 모형(userData.animate: 춤, 저울질): 움직이는 단위가 그룹이므로
 * 그룹마다 바로 아래 자식 메시(자식이 없는 것)만 합친다. 애니메이션이 직접 빛을 바꾸는 재질(keepEmissive)은
 * 원래 재질 객체를 그대로 써서 계속 반영되게 한다.
 */
function mergeAnimated(root: THREE.Object3D): THREE.Object3D {
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) nodes.push(o);
  });
  for (const node of nodes) {
    const groups = new Map<string, { mat: THREE.MeshStandardMaterial; meshes: THREE.Mesh[] }>();
    for (const c of node.children) {
      const m = c as THREE.Mesh;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!m.isMesh || m.children.length || KEEP.has(m.name) || !mat.isMeshStandardMaterial || mat.map || Array.isArray(m.material)) continue;
      const k = matKey(mat) + (mat.userData.keepEmissive ? `#${mat.uuid}` : '');
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { mat, meshes: [] }));
      g.meshes.push(m);
    }
    for (const { mat, meshes } of groups.values()) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        return bake(m, m.matrix, mat.color, false);
      });
      const geo = mergeGeometries(geos);
      for (const g of geos) g.dispose();
      let out: THREE.MeshStandardMaterial;
      if (mat.userData.keepEmissive) {
        out = mat;
        out.vertexColors = true;
        out.color.set(0xffffff);
      } else out = vertexColored(mat);
      for (const m of meshes) m.removeFromParent();
      node.add(new THREE.Mesh(geo, out));
    }
  }
  return root;
}

/**
 * 모형을 재질 성질별로 합친다.
 * 반환하는 모형의 재질은 이 인스턴스 전용이라 맞았을 때 붉게 물들이기·투명도를 따로 바꿀 수 있다.
 */
export function mergeModel(key: string, root: THREE.Object3D): THREE.Object3D {
  if (root.userData.animate) return mergeAnimated(root);
  root.updateMatrixWorld(true);
  // 부품 위치는 모형 기준 좌표로 (모형 자체의 위치·회전·배율은 새 모형에 그대로 옮긴다)
  const toRoot = root.matrixWorld.clone().invert();
  let recipe = RECIPES.get(key);
  const kept: THREE.Mesh[] = [];
  const groups = new Map<string, { mat: THREE.MeshStandardMaterial; geos: THREE.BufferGeometry[] }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (KEEP.has(m.name) || !mat.isMeshStandardMaterial || mat.map || Array.isArray(m.material)) {
      kept.push(m);
      return;
    }
    if (recipe) return;
    const k = matKey(mat);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { mat, geos: [] }));
    g.geos.push(bake(m, toRoot, mat.color));
  });
  if (!recipe) {
    recipe = { merged: [] };
    for (const { mat, geos } of groups.values()) {
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos);
      if (geos.length > 1) for (const g of geos) g.dispose();
      recipe.merged.push({ geo, mat: vertexColored(mat) });
    }
    RECIPES.set(key, recipe);
  }
  const out = new THREE.Group();
  out.position.copy(root.position);
  out.quaternion.copy(root.quaternion);
  out.scale.copy(root.scale);
  for (const { geo, mat } of recipe.merged) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.userData.merged = true;
    out.add(mesh);
  }
  // 이름으로 찾는 부품은 원래 자리(모형 기준 좌표)에 따로 붙인다
  for (const m of kept) {
    m.removeFromParent();
    new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld).decompose(m.position, m.quaternion, m.scale);
    out.add(m);
  }
  return out;
}
