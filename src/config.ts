import type { GameConfig } from './core/game';
import { ENEMIES } from './data/enemies';
import { MAP_KITCHEN } from './data/map';
import { UNITS } from './data/units';
import { WAVES } from './data/waves';

export function defaultConfig(): GameConfig {
  return {
    map: MAP_KITCHEN, enemies: ENEMIES, units: UNITS, waves: WAVES, startHp: 1000, startMoney: 400, sellRate: 0.6,
    intermission: 15,
    earlyBonusPerSec: 2,
    waveBonus: (w) => 40 + w * 10,
  };
}
