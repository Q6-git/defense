import type { GameConfig } from './core/game';
import type { DifficultyId } from './core/types';
import { ABILITIES } from './data/abilities';
import { DIFFICULTIES } from './data/difficulty';
import { ENEMIES } from './data/enemies';
import { MAP_KITCHEN } from './data/map';
import { UNITS } from './data/units';
import { WAVES } from './data/waves';

export function defaultConfig(difficulty: DifficultyId = 'normal'): GameConfig {
  const d = DIFFICULTIES[difficulty];
  return {
    map: MAP_KITCHEN,
    enemies: ENEMIES,
    units: UNITS,
    abilities: ABILITIES,
    waves: WAVES,
    startHp: d.startHp,
    startMoney: d.startMoney,
    sellRate: 0.6,
    intermission: 8,
    earlyBonusPerSec: 4,
    waveBonus: (w) => 30 + w * 6,
    critChance: 0.1,
    critMul: 2.5,
    enemyHpMul: d.hpMul,
    enemySpeedMul: d.speedMul,
    rewardMul: d.rewardMul,
  };
}
