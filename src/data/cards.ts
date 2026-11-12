import type { CardDef } from '../core/cards';

/** 보상 카드 29장. 이름과 설명은 strings.ko.ts의 cards에 있다 */
export const CARDS: CardDef[] = [
  // ── 일반 (3번까지 겹침)
  { id: 'toast', emoji: '🍞', rarity: 'common', max: 3, apply: (m) => (m.damage.toaster *= 1.2) },
  { id: 'gale', emoji: '🌀', rarity: 'common', max: 3, apply: (m) => (m.fanRange *= 1.15) },
  { id: 'highpower', emoji: '📦', rarity: 'common', max: 3, apply: (m) => (m.splash *= 1.15) },
  { id: 'turbo', emoji: '🤖', rarity: 'common', max: 3, apply: (m) => (m.vacuumSpeed *= 1.15) },
  { id: 'signal', emoji: '📶', rarity: 'common', max: 3, apply: (m) => (m.wifiBuff += 0.1) },
  { id: 'coins', emoji: '🪙', rarity: 'common', max: 3, apply: (m) => (m.reward *= 1.1) },
  { id: 'coupon', emoji: '🏷️', rarity: 'common', max: 3, apply: (m) => (m.placeCost *= 0.9) },
  { id: 'outlet', emoji: '🔌', rarity: 'common', max: 3, hp: 100 },
  { id: 'quickhand', emoji: '🪠', rarity: 'common', max: 3, apply: (m) => (m.plungerCooldown *= 0.8) },
  { id: 'cord', emoji: '📏', rarity: 'common', max: 3, apply: (m) => (m.allRange *= 1.08) },
  { id: 'allowance', emoji: '💰', rarity: 'common', max: 3, money: 150 },
  // ── 희귀
  { id: 'sharpeye', emoji: '👁️', rarity: 'rare', max: 3, apply: (m) => (m.critChance += 0.08) },
  { id: 'lethal', emoji: '💥', rarity: 'rare', max: 3, apply: (m) => (m.critDamage += 0.75) },
  { id: 'upsale', emoji: '🔧', rarity: 'rare', max: 3, apply: (m) => (m.upgradeCost *= 0.85) },
  { id: 'longload', emoji: '⚡', rarity: 'rare', max: 3, apply: (m) => (m.overloadDuration += 3) },
  { id: 'bigplunger', emoji: '🪠', rarity: 'rare', max: 3, apply: (m) => { m.plungerDamage *= 1.5; m.plungerRadius *= 1.2; } },
  { id: 'resale', emoji: '♻️', rarity: 'rare', max: 1, apply: (m) => (m.sellRate = 0.85) },
  { id: 'bonus', emoji: '🎁', rarity: 'rare', max: 3, apply: (m) => (m.waveBonus *= 1.5) },
  // ── 위험 (희귀 등급, 1번)
  { id: 'greed', emoji: '🤑', rarity: 'rare', risk: true, max: 1, hp: -100, apply: (m) => (m.reward *= 1.3) },
  { id: 'glass', emoji: '🔮', rarity: 'rare', risk: true, max: 1, apply: (m) => { m.allDamage *= 1.25; m.allRange *= 0.9; } },
  { id: 'rush', emoji: '🏃', rarity: 'rare', risk: true, max: 1, apply: (m) => { m.reward *= 1.25; m.enemySpeed *= 1.15; } },
  { id: 'allin', emoji: '🍞', rarity: 'rare', risk: true, max: 1, apply: (m) => { m.damage.toaster *= 1.5; m.damage.microwave *= 0.85; m.damage.vacuum *= 0.85; } },
  { id: 'debt', emoji: '💳', rarity: 'rare', risk: true, max: 1, money: 400, hp: -150 },
  // ── 전설 (1번, 규칙을 바꿈)
  { id: 'morewasher', emoji: '🪙', rarity: 'legend', max: 1, apply: (m) => (m.washerMax += 1) },
  { id: 'doublecrit', emoji: '🎯', rarity: 'legend', max: 1, apply: (m) => (m.critChanceMul *= 2) },
  { id: 'chain', emoji: '💣', rarity: 'legend', max: 1, apply: (m) => (m.chain = 0.15) },
  { id: 'forksale', emoji: '🛤️', rarity: 'legend', max: 1, apply: (m) => (m.branchCost *= 0.5) },
  { id: 'skillmaster', emoji: '🧙', rarity: 'legend', max: 1, apply: (m) => { m.plungerCooldown *= 0.6; m.overloadCooldown *= 0.6; } },
  { id: 'breaker', emoji: '🧯', rarity: 'legend', max: 1, apply: (m) => (m.breaker = true) },
];
