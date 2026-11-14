// 최고 기록과 마지막으로 고른 설정(난이도, 무한 모드, 맵)만 브라우저에 저장한다.
// 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 조용히 무시한다.
import type { DifficultyId } from './core/types';
import { MAP_ORDER } from './data/map';

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

/** 판 하나의 설정 */
export interface RunSetup {
  difficulty: DifficultyId;
  endless: boolean;
  map: string;
}

const DIFFS: DifficultyId[] = ['easy', 'normal', 'hard', 'hell'];

/** 기록은 맵 × 난이도 × 모드별로 따로 둔다. 첫 맵은 예전 키와 호환되도록 맵 이름을 붙이지 않는다 */
function bestKey(s: RunSetup): string {
  const map = s.map === 'kitchen' ? '' : `${s.map}.`;
  return `best.${map}${s.endless ? 'endless.' : ''}${s.difficulty}`;
}

export function loadBest(s: RunSetup): number {
  return Number(get(bestKey(s))) || 0;
}

/** 새 기록이면 저장하고 true를 돌려준다 */
export function saveBest(s: RunSetup, wave: number): boolean {
  if (wave <= loadBest(s)) return false;
  set(bestKey(s), String(wave));
  return true;
}

export function loadSetup(): RunSetup {
  const d = get('difficulty');
  return {
    difficulty: DIFFS.includes(d as DifficultyId) ? (d as DifficultyId) : 'normal',
    endless: get('endless') === '1',
    map: (MAP_ORDER as readonly string[]).includes(get('map') ?? '') ? get('map')! : 'kitchen',
  };
}

export function saveSetup(s: RunSetup): void {
  set('difficulty', s.difficulty);
  set('endless', s.endless ? '1' : '0');
  set('map', s.map);
}

// ── 업적 진행 상황
import { emptyProgress, type Progress } from './achievements';

export function loadProgress(): Progress {
  try {
    return { ...emptyProgress(), ...(JSON.parse(get('progress') ?? '{}') as Partial<Progress>) };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  set('progress', JSON.stringify(p));
}

// ── 덱 (한 판에 들고 가는 가전, 최대 6종)
export function loadDeck(): string[] | null {
  try {
    const v = JSON.parse(get('deck') ?? 'null') as unknown;
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
  } catch {
    return null;
  }
}

export function saveDeck(deck: string[]): void {
  set('deck', JSON.stringify(deck));
}
