// 최고 기록만 브라우저에 저장한다. 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 조용히 무시한다.
const KEY = 'appliance-defense.bestWave';

export function loadBest(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

/** 새 기록이면 저장하고 true를 돌려준다 */
export function saveBest(wave: number): boolean {
  if (wave <= loadBest()) return false;
  try {
    localStorage.setItem(KEY, String(wave));
  } catch {
    /* 무시 */
  }
  return true;
}
