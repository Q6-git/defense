// 그림 파일 목록. 파일은 public/sprites/ 에 있다.
//
// 그림을 바꾸는 법: 같은 이름의 파일로 덮어쓰면 된다.
// PNG로 바꾸려면 파일을 넣고 아래 확장자만 .png로 고치면 된다 (정사각형, 256x256 이상 권장, 배경 투명).
// 파일이 없거나 못 읽으면 게임은 자동으로 이모지로 그린다.
export const SPRITES: Record<string, string> = {
  // 가전 (유닛 id와 같은 이름)
  toaster: 'toaster.svg',
  fan: 'fan.svg',
  microwave: 'microwave.svg',
  vacuum: 'vacuum.svg',
  wifi: 'wifi.svg',
  washer: 'washer.svg',
  // 하수구 군단 (적 id와 같은 이름)
  goo: 'goo.svg',
  rat: 'rat.svg',
  grease: 'grease.svg',
  roach: 'roach.svg',
  splitter: 'splitter.svg',
  splitling: 'splitling.svg',
  boss: 'boss.svg',
  shield: 'shield.svg',
  ghost: 'ghost.svg',
  healer: 'healer.svg',
  charger: 'charger.svg',
  // 지형
  outlet: 'outlet.svg',
  drain: 'drain.svg',
  // 투사체
  proj_toast: 'proj_toast.svg',
  proj_fire: 'proj_fire.svg',
  // 장애물
  ob_bathtub: 'ob_bathtub.svg',
  ob_plant: 'ob_plant.svg',
  ob_basket: 'ob_basket.svg',
  ob_shirt: 'ob_shirt.svg',
  // 스킬
  ab_plunger: 'ab_plunger.svg',
  ab_overload: 'ab_overload.svg',
};

/** 맵 데이터의 장애물 이모지 → 그림 이름 */
export const OBSTACLE_SPRITE: Record<string, string> = {
  '🛁': 'ob_bathtub',
  '🪴': 'ob_plant',
  '🧺': 'ob_basket',
  '👕': 'ob_shirt',
};

/** SVG는 이 크기로 래스터화한다 (화면에서 줄여 쓰므로 넉넉하게) */
export const SVG_RESOLUTION = 128;
