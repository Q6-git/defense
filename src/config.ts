import type { GameConfig } from './core/game';
import { ENEMIES } from './data/enemies';
import { MAP_KITCHEN } from './data/map';
import { WAVES } from './data/waves';

export function defaultConfig(): GameConfig {
  return { map: MAP_KITCHEN, enemies: ENEMIES, waves: WAVES, startHp: 100, startMoney: 300 };
}
