// 기름때 새 디자인 후보. render.html?set=grease 로 렌더링
import * as THREE from 'three';
import { at, face, group, sphere } from '../../src/view3d/kit';

const gloss = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.3, ...opts });

/** 공통 몸: 넓고 납작한 웅덩이 덩어리 + 가장자리로 번진 자국 */
function blob(body: THREE.Material, puddle: THREE.Material, extra: THREE.Object3D[], faceLight = true): THREE.Object3D {
  const g = group(
    at(sphere(1.0, puddle, 1.25, 0.08, 1.05), 0, 0.03, 0.05), // 바닥에 번진 기름
    at(sphere(0.78, body, 1.25, 0.62, 1.05), 0, 0.42, 0), // 납작한 몸
    at(sphere(0.2, body, 1.4, 0.5, 1.2), -0.82, 0.12, 0.3), // 흘러내린 자국
    at(sphere(0.16, body, 1.4, 0.5, 1.2), 0.8, 0.1, 0.4),
    at(face(1.45, { mouth: 'grr', light: faceLight, spread: 0.27 }), 0, 0.5, 0.74),
    ...extra,
  );
  return g;
}

export const GREASE_SAMPLES: Record<string, () => THREE.Object3D> = {
  // 거무튀튀한 올리브색 기름때 + 위에 노란 식용유 방울
  '1_올리브': () => {
    const oilDrop = gloss(0xffc93a, { transparent: true, opacity: 0.85, emissive: 0x8a5a00, emissiveIntensity: 0.25 });
    return blob(gloss(0x4a4a2e), gloss(0x2f2f1e, { transparent: true, opacity: 0.8 }), [
      at(sphere(0.18, oilDrop, 1.3, 0.45, 1), -0.25, 0.85, -0.1), at(sphere(0.13, oilDrop, 1.3, 0.45, 1), 0.3, 0.82, 0.05), at(sphere(0.1, oilDrop, 1.3, 0.45, 1), 0.05, 0.86, -0.35),
    ]);
  },
  // 노란 식용유 덩어리(반투명) + 검은 때 얼룩
  '2_식용유': () => {
    const speck = gloss(0x3a2a18, { metalness: 0.1 });
    return blob(gloss(0xe8a822, { transparent: true, opacity: 0.88, emissive: 0x6a4000, emissiveIntensity: 0.2, metalness: 0.1 }), gloss(0xc88a12, { transparent: true, opacity: 0.6 }), [
      at(sphere(0.12, speck, 1.3, 0.3, 1), -0.35, 0.8, 0.1), at(sphere(0.09, speck, 1.3, 0.3, 1), 0.35, 0.74, -0.2), at(sphere(0.07, speck, 1.3, 0.3, 1), 0.1, 0.84, -0.4),
    ], false);
  },
  // 검은 타르 + 무지갯빛 기름 얼룩
  '3_타르': () => {
    const sheen = (c: number) => gloss(c, { transparent: true, opacity: 0.55, emissive: c, emissiveIntensity: 0.25 });
    return blob(gloss(0x24232e, { metalness: 0.45 }), gloss(0x18171f, { transparent: true, opacity: 0.85 }), [
      at(sphere(0.2, sheen(0x8a5aff), 1.4, 0.15, 1.1), -0.25, 0.83, -0.1), at(sphere(0.16, sheen(0x3ad0ff), 1.4, 0.15, 1.1), 0.25, 0.82, 0.0), at(sphere(0.13, sheen(0xffd23a), 1.4, 0.15, 1.1), 0.0, 0.84, -0.32),
    ]);
  },
};
