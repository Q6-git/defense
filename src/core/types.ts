// 게임 로직 전반에서 쓰는 타입. 이 디렉터리(src/core)는 Phaser에 의존하지 않는다.

export interface Vec {
  x: number;
  y: number;
}

export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export const TARGET_MODES: readonly TargetMode[] = ['first', 'last', 'strong', 'close'];

export type EnemyId = 'goo' | 'rat' | 'grease' | 'roach' | 'splitter' | 'splitling' | 'boss';

export interface EnemyDef {
  id: EnemyId;
  hp: number;
  /** px/초 */
  speed: number;
  /** 고정 방어력: 받는 피해에서 빼지만 최소 25%는 들어간다. */
  armor: number;
  reward: number;
  radius: number;
  emoji: string;
  color: number;
  boss?: boolean;
  splitInto?: { id: EnemyId; count: number };
  summon?: { id: EnemyId; count: number; interval: number };
}

export interface MapDef {
  width: number;
  height: number;
  /** 배치 가능한 맵 영역 (상단 바·우측 패널 제외) */
  area: { x: number; y: number; w: number; h: number };
  path: Vec[];
  pathHalfWidth: number;
}

export interface Enemy {
  uid: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  /** 경로 시작점부터 이동한 거리 */
  dist: number;
  x: number;
  y: number;
  slowMul: number;
  slowTime: number;
  summonTimer: number;
}
