// 무한 모드 랭킹: 이 기기에서 한 판들의 기록. (나중에 온라인 랭킹을 붙여도 같은 기록 모양을 쓴다)
import type { DifficultyId } from './core/types';

export interface RankEntry {
  /** 이름 (기본 '나') */
  name: string;
  wave: number;
  kills: number;
  map: string;
  difficulty: DifficultyId;
  /** 기록한 시각 (ms) */
  at: number;
  /** 가장 많이 쓴 가전 (최대 3종) */
  units: string[];
}

/** 난이도마다 남기는 기록 수 */
export const RANK_KEEP = 10;

/** 높은 웨이브가 위, 같으면 더 많이 잡은 쪽, 그것도 같으면 먼저 세운 기록 */
export function compareRank(a: RankEntry, b: RankEntry): number {
  return b.wave - a.wave || b.kills - a.kills || a.at - b.at;
}

/** 그 난이도 기록만 순서대로 */
export function rankList(all: RankEntry[], difficulty: DifficultyId): RankEntry[] {
  return all.filter((e) => e.difficulty === difficulty).sort(compareRank);
}

/**
 * 기록을 넣고, 난이도마다 상위 RANK_KEEP개만 남긴다.
 * rank: 그 난이도에서 몇 위인지 (1부터). 순위 밖이면 0
 */
export function addRank(all: RankEntry[], entry: RankEntry): { list: RankEntry[]; rank: number } {
  const same = rankList([...all, entry], entry.difficulty).slice(0, RANK_KEEP);
  const rank = same.indexOf(entry) + 1;
  const list = [...all.filter((e) => e.difficulty !== entry.difficulty), ...same];
  return { list, rank };
}

/** 이번 판에서 가장 많이 설치한 가전 3종 */
export function topUnits(placed: string[]): string[] {
  const n = new Map<string, number>();
  for (const u of placed) n.set(u, (n.get(u) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u]) => u);
}

/** 이름 글자 수 상한 (firestore.rules와 같게) */
export const NAME_MAX = 8;

/** 앞뒤 공백을 지우고 사이 공백은 하나로, 최대 NAME_MAX글자 (이모지가 반으로 잘리지 않게 글자 단위) */
export function cleanName(s: string): string {
  return Array.from(s.trim().replace(/\s+/g, ' ')).slice(0, NAME_MAX).join('').trim();
}

/** 이름을 안 정했을 때 쓰는 이름: 수비대 + 숫자 4개 */
export function randomName(rand: () => number = Math.random): string {
  return `수비대${String(Math.floor(rand() * 10000)).padStart(4, '0')}`;
}
