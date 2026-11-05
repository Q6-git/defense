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

export type UnitId = 'toaster' | 'fan' | 'microwave' | 'vacuum' | 'wifi' | 'washer';

/**
 * 유닛 행동 방식
 * - single: 타겟 하나에 피해
 * - splash: 타겟 주변 범위 피해
 * - slow: 사거리 안 모든 적에게 피해 + 감속
 * - buff: 사거리 안 아군 유닛의 공격 속도 증가
 * - income: 공격하지 않고 웨이브가 끝날 때 돈을 번다
 */
export type UnitKind = 'single' | 'splash' | 'slow' | 'buff' | 'income';

export interface UnitLevel {
  /** Lv1은 설치 비용, 그 위는 해당 레벨로 올리는 업그레이드 비용 */
  cost: number;
  damage: number;
  range: number;
  /** 공격 간격(초) */
  cooldown: number;
  splash?: number;
  /** 감속 중 이동 속도 배율 (0.5 = 절반) */
  slow?: number;
  slowDuration?: number;
  /** 공격 속도 증가율 (0.25 = 25% 빠르게) */
  buff?: number;
  income?: number;
}

export interface UnitDef {
  id: UnitId;
  kind: UnitKind;
  emoji: string;
  color: number;
  radius: number;
  maxCount?: number;
  levels: UnitLevel[];
}

export interface Unit {
  uid: number;
  def: UnitDef;
  /** 0부터 시작하는 레벨 인덱스 */
  level: number;
  x: number;
  y: number;
  cooldown: number;
  target: TargetMode;
  invested: number;
  /** 이번 스텝에 받은 버프 배율 (렌더링용) */
  buffMul: number;
}
