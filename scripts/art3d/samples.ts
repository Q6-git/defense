// 캐릭터 포인트 샘플: 디지털 얼굴(표정)과 머리 위 안테나. render.html?set=samples 로 렌더링
import type * as THREE from 'three';
import { antenna, at, face, group, limbs, metal, plastic, plugTail, rbox, screenFace, type Expression } from '../../src/view3d/kit';

/** 토스터 몸통에 얼굴만 바꿔 끼운다 */
function toaster(faceOf: () => THREE.Object3D, extra?: THREE.Object3D): THREE.Object3D {
  const body = plastic(0xf08a3c), cream = plastic(0xfff1dc), bread = plastic(0xf2c27b, 0.7), crust = plastic(0xb8702e, 0.7);
  const head = group(rbox(1.3, 0.95, 0.85, 0.22, body), at(rbox(1.1, 0.12, 0.6, 0.05, metal(0xd8dde6)), 0, 0.42, 0), at(rbox(0.12, 0.3, 0.14, 0.05, plastic(0x555060)), 0.7, 0.1, 0), at(faceOf(), 0, -0.02, 0.44));
  for (const x of [-0.24, 0.24]) {
    head.add(at(rbox(0.36, 0.42, 0.1, 0.08, crust), x, 0.55, 0));
    head.add(at(rbox(0.3, 0.36, 0.11, 0.07, bread), x, 0.57, 0));
  }
  if (extra) head.add(at(extra, -0.42, 0.47, 0));
  return group(at(rbox(0.7, 0.32, 0.5, 0.12, cream), 0, 0.4, 0), limbs(cream, { width: 0.22 }), at(head, 0, 1.05, 0), plugTail());
}
const lcd = (e: Expression) => () => screenFace(1.15, e);

export const SAMPLES: Record<string, () => THREE.Object3D> = {
  '1_지금': () => toaster(() => face(1.15)),
  '2_화면_보통': () => toaster(lcd('normal')),
  '3_화면_공격': () => toaster(lcd('angry')),
  '4_화면_레벨업': () => toaster(lcd('happy')),
  '5_화면_맞음': () => toaster(lcd('surprised')),
  '6_안테나': () => toaster(() => face(1.15), antenna()),
  '7_화면+안테나': () => toaster(lcd('normal'), antenna(0x6ff2ff)),
};
