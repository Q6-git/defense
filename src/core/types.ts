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
  /** 기절 남은 시간 (0보다 크면 멈춤) */
  stunTime: number;
  /** 냉풍으로 얼어 있는 동안 받는 피해 배율 */
  frozenVuln: number;
  /** 이번 스텝 해킹 배율 (1이면 해킹 안 됨) */
  hackMul: number;
  /** 밀려난 뒤 다시 밀리지 않는 남은 시간. 태풍 여러 대로 적을 영원히 붙잡지 못하게 한다 */
  knockImmune: number;
  summonTimer: number;
}

export type AbilityId = 'plunger' | 'overload';

/** 플레이어가 웨이브 중에 직접 쓰는 스킬 */
export interface AbilityDef {
  id: AbilityId;
  emoji: string;
  cooldown: number;
  /** 대상 지점이 필요한 스킬의 범위 */
  radius?: number;
  damage?: number;
  /** 웨이브마다 늘어나는 피해량 */
  damagePerWave?: number;
  stun?: number;
  duration?: number;
  speedMul?: number;
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

  // ── Lv4 갈림길 전용 효과 ──
  /** 방어력을 무시한다 */
  pierceArmor?: boolean;
  /** 사거리 안 모든 적을 동시에 때린다 */
  hitAll?: boolean;
  /** 선풍기 펄스가 적을 경로 뒤로 밀어내는 거리(px). 보스는 30%만, 한 번 밀리면 2초간 면역 */
  knockback?: number;
  /** 선풍기 펄스가 적을 얼리는 시간(초) */
  freeze?: number;
  /** 얼어 있는 적이 받는 피해 배율 */
  frozenVuln?: number;
  /** 폭발 자리에 남는 불 장판 */
  burn?: { dps: number; duration: number };
  /** 같은 적을 계속 맞출수록 피해가 오른다: 한 번 맞출 때마다 +step, 최대 max배 */
  ramp?: { step: number; max: number };
  /** 와이파이 해킹: 사거리 안 적의 방어력을 없애고 받는 피해를 늘린다 */
  hackVuln?: number;
  /** 세탁기 이자: 웨이브가 끝날 때 보유 돈의 rate만큼, 최대 max */
  interest?: { rate: number; max: number };
  /** 세탁기 동전 분수: 반경 안에서 처치된 적 보상 배율 */
  bounty?: { radius: number; mul: number };
}

/** Lv4 갈림길 한 갈래. 스탯은 Lv4의 최종 수치(UnitLevel)를 그대로 쓴다. */
export interface UnitBranch extends UnitLevel {
  id: string;
  emoji: string;
  /** 고르는 순간 바꿔 줄 기본 타겟 모드 */
  defaultTarget?: TargetMode;
}

export interface UnitDef {
  id: UnitId;
  kind: UnitKind;
  emoji: string;
  color: number;
  radius: number;
  maxCount?: number;
  levels: UnitLevel[];
  /** Lv3 다음에 고르는 두 갈래 */
  branches?: [UnitBranch, UnitBranch];
}

export interface Unit {
  uid: number;
  def: UnitDef;
  /** 0부터 시작하는 레벨 인덱스 (갈림길을 고르면 levels.length) */
  level: number;
  /** 고른 갈래 (0 또는 1), 아직이면 null */
  branch: 0 | 1 | null;
  /** 그릴 모드: 지금 지지고 있는 적과 쌓인 배율 */
  rampTarget: number;
  rampMul: number;
  x: number;
  y: number;
  cooldown: number;
  target: TargetMode;
  invested: number;
  /** 이번 스텝에 받은 버프 배율 (렌더링용) */
  buffMul: number;
}

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'hell';
