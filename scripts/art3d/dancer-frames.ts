// 까불이 왕자 춤 동작 확인용 프레임. render.html?set=dancer
import type * as THREE from 'three';
import { MODELS } from '../../src/view3d/models';

const frame = (t: number, sinceTaunt = -99) => () => {
  const m = MODELS.dancer() as THREE.Object3D;
  (m.userData.animate as (t: number, s: number) => void)(t, sinceTaunt);
  return m;
};
export const DANCER_FRAMES: Record<string, () => THREE.Object3D> = {
  '1_춤_0': frame(0.0),
  '2_춤_1': frame(0.2),
  '3_춤_2': frame(0.4),
  '4_춤_3': frame(0.6),
  '5_L포즈': frame(0.1, 0.6),
};
