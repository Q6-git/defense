import { Path } from './path';
import type { Enemy, EnemyDef, EnemyId, MapDef } from './types';

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** 같은 그룹 안에서 다음 적이 나오기까지 간격(초) */
  interval: number;
  /** 웨이브 시작 후 이 그룹이 시작되는 시점(초) */
  delay: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
  /** 이 웨이브 적들의 체력 배율 */
  hpMul: number;
}

export interface GameConfig {
  map: MapDef;
  enemies: Record<EnemyId, EnemyDef>;
  waves: WaveDef[];
  startHp: number;
  startMoney: number;
}

export type Phase = 'ready' | 'wave' | 'over';

export type GameEvent =
  | { type: 'leak'; x: number; y: number; damage: number }
  | { type: 'gameOver' };

/** 시뮬레이션 1스텝의 최대 길이. 배속이 높아도 결과가 크게 달라지지 않게 쪼개서 돌린다. */
const MAX_STEP = 1 / 60;

export class Game {
  readonly cfg: GameConfig;
  readonly path: Path;
  hp: number;
  money: number;
  /** 지금 진행 중이거나 마지막으로 시작한 웨이브 (1부터). 0이면 아직 시작 전. */
  wave = 0;
  phase: Phase = 'ready';
  enemies: Enemy[] = [];
  events: GameEvent[] = [];

  private nextUid = 1;
  private waveTime = 0;
  private spawnQueue: { t: number; id: EnemyId }[] = [];

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.path = new Path(cfg.map.path);
    this.hp = cfg.startHp;
    this.money = cfg.startMoney;
  }

  get totalWaves(): number {
    return this.cfg.waves.length;
  }

  startWave(): boolean {
    if (this.phase !== 'ready' || this.wave >= this.totalWaves) return false;
    this.wave++;
    this.phase = 'wave';
    this.waveTime = 0;
    const def = this.cfg.waves[this.wave - 1];
    this.spawnQueue = [];
    for (const g of def.groups) {
      for (let i = 0; i < g.count; i++) this.spawnQueue.push({ t: g.delay + i * g.interval, id: g.enemy });
    }
    this.spawnQueue.sort((a, b) => a.t - b.t);
    return true;
  }

  update(dt: number): void {
    while (dt > 0 && this.phase !== 'over') {
      const step = Math.min(dt, MAX_STEP);
      this.step(step);
      dt -= step;
    }
  }

  /** 렌더러가 매 프레임 가져가는 이벤트 */
  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  spawnEnemy(id: EnemyId, dist = 0): Enemy {
    const def = this.cfg.enemies[id];
    const hpMul = this.wave > 0 ? this.cfg.waves[this.wave - 1].hpMul : 1;
    const hp = Math.round(def.hp * hpMul);
    const p = this.path.pointAt(dist);
    const e: Enemy = {
      uid: this.nextUid++, def, hp, maxHp: hp, dist, x: p.x, y: p.y,
      slowMul: 1, slowTime: 0, summonTimer: def.summon?.interval ?? 0,
    };
    this.enemies.push(e);
    return e;
  }

  private step(dt: number): void {
    if (this.phase === 'wave') {
      this.waveTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveTime) {
        this.spawnEnemy(this.spawnQueue.shift()!.id);
      }
    }
    this.moveEnemies(dt);
    if (this.phase === 'wave' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.phase = 'ready';
    }
  }

  private moveEnemies(dt: number): void {
    const survivors: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.slowTime > 0) {
        e.slowTime -= dt;
        if (e.slowTime <= 0) e.slowMul = 1;
      }
      e.dist += e.def.speed * e.slowMul * dt;
      if (e.dist >= this.path.length) {
        // 기지에 도착한 적은 남은 체력만큼 피해를 준다.
        const damage = Math.ceil(e.hp);
        this.hp = Math.max(0, this.hp - damage);
        this.events.push({ type: 'leak', x: e.x, y: e.y, damage });
        continue;
      }
      const p = this.path.pointAt(e.dist);
      e.x = p.x;
      e.y = p.y;
      survivors.push(e);
    }
    this.enemies = survivors;
    if (this.hp <= 0) {
      this.phase = 'over';
      this.events.push({ type: 'gameOver' });
    }
  }
}
