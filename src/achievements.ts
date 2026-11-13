// 업적. 게임 엔진과 화면에 의존하지 않는 순수 로직이라 테스트할 수 있다.

/** 한 판의 기록 */
export interface RunStats {
  map: string;
  difficulty: string;
  endless: boolean;
  /** 클리어한 웨이브 수 */
  cleared: number;
  /** 이번 판에 설치한 가전 종류 */
  placed: string[];
  usedSkill: boolean;
  /** 적이 기지에 닿아 피해를 준 적이 있는지 */
  leaked: boolean;
  /** 고른 카드 장수 */
  cards: number;
}

/** 판을 넘어 쌓이는 진행 상황 (브라우저에 저장) */
export interface Progress {
  kills: number;
  /** 한 번이라도 고른 전설 카드 */
  legends: string[];
  /** 한 번이라도 고른 Lv4 갈래 */
  branches: string[];
  /** 달성한 업적 id */
  done: string[];
  /** 업적 보상으로 모은 부품 (뽑기에 쓸 재화) */
  parts: number;
}

export function emptyProgress(): Progress {
  return { kills: 0, legends: [], branches: [], done: [], parts: 0 };
}

export interface AchievementDef {
  id: string;
  emoji: string;
  /** 보상 부품 */
  reward: number;
  check: (run: RunStats, p: Progress) => boolean;
  /** 누적형 업적의 진행도 (목록 화면에 표시) */
  progress?: (p: Progress) => [number, number];
}

/** 정해진 20웨이브를 모두 깼는지 (무한 모드에서 20웨이브를 넘긴 것도 포함) */
const FULL = 20;
const won = (r: RunStats) => r.cleared >= FULL;
/** 쉬움은 제한형 업적에서 제외한다 */
const notEasy = (r: RunStats) => r.difficulty !== 'easy';

export const ACHIEVEMENTS: AchievementDef[] = [
  // 클리어형
  { id: 'clear_kitchen', emoji: '🍳', reward: 50, check: (r) => won(r) && r.map === 'kitchen' },
  { id: 'clear_bathroom', emoji: '🛁', reward: 50, check: (r) => won(r) && r.map === 'bathroom' },
  { id: 'clear_balcony', emoji: '🪴', reward: 50, check: (r) => won(r) && r.map === 'balcony' },
  { id: 'clear_hard', emoji: '🔥', reward: 100, check: (r) => won(r) && (r.difficulty === 'hard' || r.difficulty === 'hell') },
  { id: 'clear_hell', emoji: '💀', reward: 200, check: (r) => won(r) && r.difficulty === 'hell' },
  { id: 'endless_30', emoji: '♾️', reward: 150, check: (r) => r.endless && r.cleared >= 30 },
  // 제한형 (보통 이상)
  { id: 'no_washer', emoji: '🪙', reward: 100, check: (r) => won(r) && notEasy(r) && !r.placed.includes('washer') },
  { id: 'toaster_only', emoji: '🍞', reward: 100, check: (r) => r.cleared >= 10 && notEasy(r) && r.placed.every((u) => u === 'toaster') },
  { id: 'flawless', emoji: '🛡️', reward: 150, check: (r) => won(r) && notEasy(r) && !r.leaked },
  { id: 'no_skill', emoji: '🪠', reward: 100, check: (r) => won(r) && notEasy(r) && !r.usedSkill },
  { id: 'no_cards', emoji: '🃏', reward: 100, check: (r) => won(r) && notEasy(r) && r.cards === 0 },
  // 누적형
  { id: 'kills_1000', emoji: '⚔️', reward: 100, check: (_r, p) => p.kills >= 1000, progress: (p) => [Math.min(p.kills, 1000), 1000] },
  { id: 'legends_5', emoji: '🌟', reward: 100, check: (_r, p) => p.legends.length >= 5, progress: (p) => [Math.min(p.legends.length, 5), 5] },
  { id: 'branches_12', emoji: '🛤️', reward: 150, check: (_r, p) => p.branches.length >= 12, progress: (p) => [Math.min(p.branches.length, 12), 12] },
];

/** 새로 달성한 업적을 찾아 기록하고(보상 포함) 그 목록을 돌려준다 */
export function evaluate(run: RunStats, p: Progress): AchievementDef[] {
  const fresh = ACHIEVEMENTS.filter((a) => !p.done.includes(a.id) && a.check(run, p));
  for (const a of fresh) {
    p.done.push(a.id);
    p.parts += a.reward;
  }
  return fresh;
}
