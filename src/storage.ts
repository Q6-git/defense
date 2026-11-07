// 최고 기록(난이도별 도달 웨이브)과 마지막으로 고른 난이도만 브라우저에 저장한다.
// 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 조용히 무시한다.
import type { DifficultyId } from './core/types';

const PREFIX = 'appliance-defense.v2.';

function get(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* 무시 */
  }
}

export function loadBest(d: DifficultyId): number {
  return Number(get(`best.${d}`)) || 0;
}

/** 새 기록이면 저장하고 true를 돌려준다 */
export function saveBest(d: DifficultyId, wave: number): boolean {
  if (wave <= loadBest(d)) return false;
  set(`best.${d}`, String(wave));
  return true;
}

export function loadDifficulty(): DifficultyId | null {
  const v = get('difficulty');
  return v === 'easy' || v === 'normal' || v === 'hard' || v === 'hell' ? v : null;
}

export function saveDifficulty(d: DifficultyId): void {
  set('difficulty', d);
}
