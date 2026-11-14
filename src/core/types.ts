// 게임 로직 전반에서 쓰는 타입. 이 디렉터리(src/core)는 Phaser에 의존하지 않는다.

export interface Vec {
  x: number;
  y: number;
}

export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export const TARGET_MODES: readonly TargetMode[] = ['first', 'last', 'strong', 'close'];

export type EnemyId =
  | 'goo' | 'rat' | 'grease' | 'roach' | 'splitter' | 'splitling' | 'boss'
  | 'shield' | 'ghost' | 'healer' | 'charger';

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
  /** 방패 겹 수. 피해량과 상관없이 한 번 맞을 때마다 한 겹 벗겨지고, 다 벗겨져야 피해를 받는다 */
  shield?: number;
  /** 유령: every초 보이다가 duration초 동안 투명해져 조준되지 않는다 (범위 공격은 맞는다) */
  phase?: { every: number; duration: number };
  /** 치유사: interval초마다 반경 안 다른 적(보스 제외)의 체력을 최대 체력의 pct만큼 회복 */
  heal?: { interval: number; pct: number; radius: number };
  /** 돌격병: 체력 비율이 below 이하가 되면 속도가 speedMul배 */
  enrage?: { below: number; speedMul: number };
}

export type WaveModId = 'rush' | 'fog' | 'haste' | 'steel' | 'gold';

/** 특수 웨이브의 변칙. 없는 값은 영향 없음 */
export interface WaveModDef {
  id: WaveModId;
  emoji: string;
  /** 적 마릿수 배율 (보스 제외) */
  countMul?: number;
  hpMul?: number;
  /** 모든 가전 사거리 배율 */
  rangeMul?: number;
  speedMul?: number;
  armorAdd?: number;
  rewardMul?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapDef {
  id: string;
  width: number;
  height: number;
  /** 배치 가능한 맵 영역 (상단 바·우측 패널 제외) */
  area: Rect;
  /** 적이 지나가는 길. 여러 개면 적이 번갈아 나눠 탄다 (끝은 모두 같은 기지) */
  paths: Vec[][];
  pathHalfWidth: number;
  /** 설치할 수 없는 장애물 */
  blocked?: (Rect & { emoji: string })[];
  /** 맵별 적 체력 배율 (길 길이와 설치 공간 차이를 보정) */
  enemyHpMul?: number;
}

export interface Enemy {
  uid: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  /** 경로 시작점부터 이동한 거리 */
  dist: number;
  /** 타고 있는 길 번호 (MapDef.paths 인덱스) */
  lane: number;
  /** 기지까지 남은 거리. 길이 여러 개일 때 '맨 앞' 판단에 쓴다 */
  left: number;
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
  /** 얼었다 풀린 뒤 다시 얼지 않는 남은 시간 (얼어 있는 시간 포함). 냉풍 여러 대로 영원히 얼려 두지 못하게 한다 */
  freezeImmune: number;
  /** 불붙은 상태: 초당 피해와 남은 시간 */
  burnDps: number;
  burnTime: number;
  /** 깎인 방어력 */
  shred: number;
  summonTimer: number;
  /** 남은 방패 겹 수 */
  shield: number;
  /** 유령이 지금 투명한지, 그리고 상태가 바뀔 때까지 남은 시간 */
  hidden: boolean;
  phaseTimer: number;
  healTimer: number;
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

export type UnitId =
  | 'toaster' | 'fan' | 'microwave' | 'vacuum' | 'wifi' | 'washer'
  | 'stove' | 'strip' | 'battery' | 'iron' | 'aircon' | 'dishwasher';

/**
 * 유닛 행동 방식
 * - single: 타겟 하나에 피해
 * - splash: 타겟 주변 범위 피해
 * - slow: 사거리 안 모든 적에게 피해 + 감속
 * - buff: 사거리 안 아군 유닛의 공격 속도 증가
 * - income: 공격하지 않고 웨이브가 끝날 때 돈을 번다
 */
export type UnitKind = 'single' | 'splash' | 'slow' | 'buff' | 'income' | 'aura';

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
  /** 선풍기 펄스가 적을 경로 뒤로 밀어내는 거리(px). 보스는 30%만, 한 번 밀리면 3초간 면역 */
  knockback?: number;
  /** 선풍기 펄스가 적을 얼리는 시간(초). 풀린 뒤 2.5초간은 다시 얼지 않는다 */
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

  // ── 뽑기로 얻는 가전 전용 효과 ──
  /** 맞은 적에게 불을 붙인다 (초당 피해, 지속 시간) */
  dot?: { dps: number; duration: number };
  /** 번개가 맞히는 적의 수 (첫 대상 포함). 튕길 때마다 피해가 30%씩 줄어든다 */
  chainHits?: number;
  /** 사거리 안 가전의 공격력 증가율 (0.2 = +20%) */
  dmgBuff?: number;
  /** 맞힐 때마다 깎는 방어력 (적마다 최대 20까지 누적) */
  shred?: number;
  /** 맵 전체 적 이동 속도 감소율 (0.1 = -10%) */
  globalSlow?: number;
  /** 맵 전체 적이 받는 피해 증가율 (0.15 = +15%) */
  globalVuln?: number;
  /** 대상 방향 일직선 위의 적을 모두 맞힌다 (선의 반폭) */
  line?: number;
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
  /** 이번 스텝에 받은 공격력 버프 배율 */
  dmgMul: number;
}

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'hell';
