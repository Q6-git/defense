// 뽑기와 판 보상. 엔진·화면에 의존하지 않는 순수 로직이다.
import type { Progress } from './achievements';

export type GachaRarity = 'rare' | 'hero' | 'legend';

export const GACHA = {
  cost: 100,
  cost10: 900,
  /** 이 횟수 안에 전설이 안 나오면 그 회차에 전설 확정 */
  pity: 30,
  rates: { rare: 0.7, hero: 0.25, legend: 0.05 } as Record<GachaRarity, number>,
  /** 이미 가진 가전이 나오면 돌려받는 부품 */
  refund: { rare: 30, hero: 60, legend: 150 } as Record<GachaRarity, number>,
};

/** 뽑기로 얻는 가전과 등급 */
export const GACHA_POOL: Record<string, GachaRarity> = {
  stove: 'rare', strip: 'rare', battery: 'rare', iron: 'hero', aircon: 'hero', dishwasher: 'legend',
};

export interface PullResult {
  unit: string;
  rarity: GachaRarity;
  /** 이미 가진 가전이라 부품으로 환급됐는지 */
  duplicate: boolean;
  refund: number;
}

/** 한 번 뽑는다. 부품 차감은 하지 않는다 (pull에서 한다) */
function roll(p: Progress, rng: () => number): PullResult {
  let rarity: GachaRarity;
  if (p.pity + 1 >= GACHA.pity) rarity = 'legend';
  else {
    const r = rng();
    rarity = r < GACHA.rates.legend ? 'legend' : r < GACHA.rates.legend + GACHA.rates.hero ? 'hero' : 'rare';
  }
  p.pity = rarity === 'legend' ? 0 : p.pity + 1;
  const options = Object.keys(GACHA_POOL).filter((u) => GACHA_POOL[u] === rarity);
  const unit = options[Math.floor(rng() * options.length)];
  const duplicate = p.owned.includes(unit);
  const refund = duplicate ? GACHA.refund[rarity] : 0;
  if (duplicate) p.parts += refund;
  else p.owned.push(unit);
  return { unit, rarity, duplicate, refund };
}

/** n회(1 또는 10) 뽑는다. 부품이 모자라면 null */
export function pull(p: Progress, n: 1 | 10, rng: () => number = Math.random): PullResult[] | null {
  const cost = n === 10 ? GACHA.cost10 : GACHA.cost;
  if (p.parts < cost) return null;
  p.parts -= cost;
  return Array.from({ length: n }, () => roll(p, rng));
}

const DIFFICULTY_MUL: Record<string, number> = { easy: 0.7, normal: 1, hard: 1.5, hell: 2 };

/** 클리어한 웨이브 수에 따른 부품 보상 (웨이브당 5 × 난이도 배율) */
export function waveReward(waves: number, difficulty: string): number {
  return Math.round(waves * 5 * (DIFFICULTY_MUL[difficulty] ?? 1));
}

/** 20웨이브 승리 보너스 */
export const WIN_BONUS = 50;

/** wave번째 웨이브를 깨면 받는 부품 (웨이브 보상 + 마지막 정규 웨이브면 승리 보너스) */
export function clearParts(wave: number, totalWaves: number, difficulty: string): number {
  return waveReward(1, difficulty) + (wave === totalWaves ? WIN_BONUS : 0);
}
