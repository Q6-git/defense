import type { GameConfig } from './core/game';
import type { DifficultyId } from './core/types';
import { ABILITIES } from './data/abilities';
import { CARDS } from './data/cards';
import { DIFFICULTIES } from './data/difficulty';
import { ENEMIES } from './data/enemies';
import { MAPS, type MapId } from './data/map';
import { UNITS } from './data/units';
import { endlessWave, WAVE_MODS, WAVES } from './data/waves';

export function defaultConfig(difficulty: DifficultyId = 'normal', endless = false, map: MapId = 'kitchen'): GameConfig {
  const d = DIFFICULTIES[difficulty];
  return {
    map: MAPS[map] ?? MAPS.kitchen,
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
    endless,
    extraWave: endlessWave,
    waveMods: WAVE_MODS,
    specialEvery: 5,
    specialFrom: 10,
    cards: CARDS,
    cardEvery: 3,
    cardSkipMoney: 50,
  };
}
