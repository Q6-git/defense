import type { GameConfig } from './core/game';
import { ABILITIES } from './data/abilities';
import { ENEMIES } from './data/enemies';
import { MAP_KITCHEN } from './data/map';
import { UNITS } from './data/units';
import { WAVES } from './data/waves';

export function defaultConfig(): GameConfig {
  return {
    map: MAP_KITCHEN,
    enemies: ENEMIES,
    units: UNITS,
    abilities: ABILITIES,
    waves: WAVES,
    startHp: 1000,
    startMoney: 400,
    sellRate: 0.6,
    intermission: 8,
    earlyBonusPerSec: 4,
    waveBonus: (w) => 40 + w * 10,
    critChance: 0.1,
    critMul: 2.5,
  };
}
