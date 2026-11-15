// 움직이는 몬스터의 동작 시트(도감·소개 카드에서 반복 재생). scripts/render3d.cjs가 public/sprites/<이름>_anim.png로 렌더링한다.
// 시트는 ANIM_COLS열 격자, 한 칸 ANIM_FRAME px.

export const ANIM_FRAME = 192;
export const ANIM_COLS = 8;

/** 한 프레임의 자세: 모델 animate(t, sinceTaunt, { weighMode })에 넘길 값 */
export interface AnimPose {
  t: number;
  since: number;
  mode: 0 | 6 | 7;
}

export const MODEL_ANIMS: Record<string, { frames: number; fps: number; pose: (i: number) => AnimPose }> = {
  // 까불이 왕자: 옆차기 두 번(1.6초) → L 포즈(1.2초)
  dancer: {
    frames: 42,
    fps: 15,
    pose: (i) => (i < 24 ? { t: i / 15, since: -99, mode: 0 } : { t: i / 15, since: ((i - 24) / 18) * 1.2, mode: 0 }),
  },
  // 식스세븐: 저울질(약 1.2초) → 6 고름 → 7 고름
  sixseven: {
    frames: 34,
    fps: 12,
    pose: (i) => ({ t: i / 12, since: -99, mode: i < 14 ? 0 : i < 24 ? 6 : 7 }),
  },
};
