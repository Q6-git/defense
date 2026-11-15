// 식스세븐 동작 확인용 프레임. render.html?set=sixseven
import type * as THREE from 'three';
import { MODELS } from '../../src/view3d/models';

const frame = (t: number, mode: 0 | 6 | 7) => () => {
  const m = MODELS.sixseven() as THREE.Object3D;
  (m.userData.animate as (t: number, s: number, e: { weighMode: number }) => void)(t, -99, { weighMode: mode });
  return m;
};
export const SIXSEVEN_FRAMES: Record<string, () => THREE.Object3D> = {
  '1_저울질_a': frame(0.15, 0),
  '2_저울질_b': frame(0.45, 0),
  '3_6_단단': frame(0.1, 6),
  '4_7_빠름': frame(0.1, 7),
};
