import { baseMods, type CardDef, type CardRarity, type Mods } from './cards';
import { dist, Path } from './path';
import { makeRng } from './rng';
import type {
  AbilityDef, AbilityId, Enemy, EnemyDef, EnemyId, MapDef, TargetMode, Unit, UnitDef, UnitId, UnitLevel, Vec,
} from './types';

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
  units: Record<UnitId, UnitDef>;
  abilities: Record<AbilityId, AbilityDef>;
  waves: WaveDef[];
  startHp: number;
  startMoney: number;
  /** 판매 시 투자금 환불 비율 */
  sellRate: number;
  /** 웨이브 사이 대기 시간(초). 끝나면 다음 웨이브가 자동으로 시작된다. */
  intermission: number;
  /** 대기 시간을 남기고 일찍 시작하면 남은 1초당 받는 돈 */
  earlyBonusPerSec: number;
  /** n번째 웨이브를 클리어하면 받는 보너스 */
  waveBonus: (wave: number) => number;
  /** 공격이 크리티컬로 터질 확률과 배율 */
  critChance: number;
  critMul: number;
  /** 난이도 배율 (적 체력, 적 속도, 처치 보상) */
  enemyHpMul: number;
  enemySpeedMul: number;
  rewardMul: number;
  seed?: number;
  /** 보상 카드 목록. 비어 있으면 카드가 나오지 않는다 */
  cards?: CardDef[];
  /** 몇 웨이브마다 카드를 고르는지 */
  cardEvery?: number;
  /** 카드를 건너뛰면 받는 돈 */
  cardSkipMoney?: number;
  /** 무한 모드: 정해진 웨이브가 끝나도 extraWave로 계속 만든다 */
  endless?: boolean;
  /** 정해진 웨이브 이후의 웨이브를 만드는 함수 (무한 모드용) */
  extraWave?: (n: number) => WaveDef;
}

/**
 * ready: 첫 웨이브 시작 전 (무제한 대기)
 * wave: 웨이브 진행 중
 * intermission: 웨이브 사이 카운트다운
 * over / won: 패배 / 승리
 */
export type Phase = 'ready' | 'wave' | 'intermission' | 'over' | 'won';

export type GameEvent =
  | { type: 'leak'; x: number; y: number; damage: number }
  | { type: 'shot'; unit: number; kind: UnitId; branch: string | null; from: Vec; to: Vec; color: number }
  | { type: 'blast'; x: number; y: number; r: number; color: number }
  | { type: 'pulse'; unit: number; x: number; y: number; r: number; color: number; branch: string | null }
  | { type: 'hit'; enemy: number; x: number; y: number; amount: number; crit: boolean }
  | { type: 'ability'; id: AbilityId; x: number; y: number; r: number }
  | { type: 'waveStart'; wave: number; boss: boolean }
  | { type: 'kill'; enemy: EnemyId; x: number; y: number; reward: number }
  | { type: 'income'; x: number; y: number; amount: number }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'earlyBonus'; amount: number }
  | { type: 'gameOver' }
  | { type: 'cardOffer' }
  | { type: 'cardPicked'; id: string }
  | { type: 'chain'; x: number; y: number; r: number }
  | { type: 'blocked'; x: number; y: number }
  | { type: 'victory' };

/** 유저 조작. 멀티플레이를 붙일 때는 이 명령을 서버로 보내면 된다. */
export type Command =
  | { type: 'place'; unit: UnitId; x: number; y: number }
  | { type: 'upgrade'; uid: number; branch?: 0 | 1 }
  | { type: 'sell'; uid: number }
  | { type: 'setTarget'; uid: number; mode: TargetMode }
  | { type: 'startWave' }
  | { type: 'continueEndless' }
  | { type: 'pickCard'; index: number }
  | { type: 'skipCard' }
  | { type: 'ability'; id: AbilityId; x?: number; y?: number };

export type PlaceError = 'money' | 'path' | 'overlap' | 'bounds' | 'limit';

export type CommandResult = { ok: true } | { ok: false; reason: PlaceError | 'maxLevel' | 'notFound' | 'phase' | 'cooldown' | 'branch' };

/** 다음 업그레이드 선택지. 갈림길이면 두 개, 일반 업그레이드면 하나, 최대 레벨이면 없음 */
export interface UpgradeOption {
  branch: 0 | 1 | null;
  cost: number;
}

/** 전자레인지 해동 폭탄이 남기는 불 장판 */
export interface Zone {
  x: number;
  y: number;
  r: number;
  dps: number;
  time: number;
}

/** 시뮬레이션 1스텝의 최대 길이. 배속이 높아도 결과가 크게 달라지지 않게 쪼개서 돌린다. */
const MAX_STEP = 1 / 60;
/** 밀려난 적이 다시 밀리지 않는 시간(초) */
const KNOCK_IMMUNE = 3;
/** 연쇄 폭발 카드의 폭발 반경 */
const CHAIN_RADIUS = 70;
/** 얼었다 풀린 적이 다시 얼지 않는 시간(초) */
const FREEZE_IMMUNE = 2.5;

export class Game {
  readonly cfg: GameConfig;
  /** 맵의 길들. 첫 번째 길은 path로도 쓸 수 있다 */
  readonly paths: Path[];
  hp: number;
  money: number;
  /** 지금 진행 중이거나 마지막으로 시작한 웨이브 (1부터). 0이면 아직 시작 전. */
  wave = 0;
  phase: Phase = 'ready';
  /** intermission 남은 시간 */
  timer = 0;
  enemies: Enemy[] = [];
  units: Unit[] = [];
  events: GameEvent[] = [];
  /** 스킬별 남은 재사용 대기시간 */
  cooldowns: Record<AbilityId, number> = { plunger: 0, overload: 0 };
  /** 과부하 남은 시간 */
  overloadTime = 0;
  /** 무한 모드 여부. 20웨이브 승리 후 '계속 버티기'로 켤 수도 있다 */
  endless: boolean;
  zones: Zone[] = [];
  /** 이번 판에 고른 카드 id (고른 순서대로, 겹친 카드는 여러 번 들어 있다) */
  cards: string[] = [];
  /** 고른 카드가 반영된 수치 */
  mods: Mods = baseMods();
  /** 지금 고르라고 내민 카드. 있는 동안 게임은 멈춘다 */
  offer: CardDef[] | null = null;
  private breakerUsed = false;
  private modVersion = 0;
  private statCache = new WeakMap<Unit, { key: number; stats: UnitLevel }>();
  private rng: () => number;

  private nextUid = 1;
  private nextLane = 0;
  private waveTime = 0;
  private spawnQueue: { t: number; id: EnemyId }[] = [];

  constructor(cfg: GameConfig) {
    this.cfg = cfg;
    this.paths = cfg.map.paths.map((p) => new Path(p));
    this.hp = cfg.startHp;
    this.money = cfg.startMoney;
    this.rng = makeRng(cfg.seed ?? Date.now());
    this.endless = !!cfg.endless && !!cfg.extraWave;
  }

  /** 정해진 웨이브 수 (무한 모드에서도 20) */
  get totalWaves(): number {
    return this.cfg.waves.length;
  }

  /** n번째 웨이브 정의. 무한 모드면 정해진 웨이브 이후도 만든다 */
  waveDef(n: number): WaveDef | undefined {
    if (n < 1) return undefined;
    if (n <= this.cfg.waves.length) return this.cfg.waves[n - 1];
    return this.endless ? this.cfg.extraWave?.(n) : undefined;
  }

  apply(cmd: Command): CommandResult {
    switch (cmd.type) {
      case 'place':
        return this.place(cmd.unit, cmd.x, cmd.y);
      case 'upgrade':
        return this.upgrade(cmd.uid, cmd.branch);
      case 'sell':
        return this.sell(cmd.uid);
      case 'setTarget': {
        const u = this.findUnit(cmd.uid);
        if (!u) return { ok: false, reason: 'notFound' };
        u.target = cmd.mode;
        return { ok: true };
      }
      case 'startWave':
        return this.startWave() ? { ok: true } : { ok: false, reason: 'phase' };
      case 'continueEndless':
        if (this.phase !== 'won' || !this.cfg.extraWave) return { ok: false, reason: 'phase' };
        this.endless = true;
        this.phase = 'intermission';
        this.timer = this.cfg.intermission;
        return { ok: true };
      case 'ability':
        return this.useAbility(cmd.id, cmd.x ?? 0, cmd.y ?? 0);
      case 'pickCard':
        return this.pickCard(cmd.index);
      case 'skipCard':
        if (!this.offer) return { ok: false, reason: 'phase' };
        this.money += this.cfg.cardSkipMoney ?? 0;
        this.offer = null;
        return { ok: true };
    }
  }

  findUnit(uid: number): Unit | undefined {
    return this.units.find((u) => u.uid === uid);
  }

  /** 설치 가능 여부 (돈 제외한 위치 검사도 포함) */
  canPlace(id: UnitId, x: number, y: number): PlaceError | null {
    const def = this.cfg.units[id];
    const { area, pathHalfWidth } = this.cfg.map;
    const r = def.radius;
    if (x < area.x + r || x > area.x + area.w - r || y < area.y + r || y > area.y + area.h - r) return 'bounds';
    if (this.distanceToPath({ x, y }) < pathHalfWidth + r) return 'path';
    if (this.cfg.map.blocked?.some((b) => circleHitsRect(x, y, r, b))) return 'bounds';
    if (this.units.some((u) => dist(u, { x, y }) < u.def.radius + r)) return 'overlap';
    if (this.units.filter((u) => u.def.id === id).length >= this.maxCount(id)) return 'limit';
    if (this.money < this.placeCost(id)) return 'money';
    return null;
  }

  /** 설치 비용 (카드 할인 반영) */
  placeCost(id: UnitId): number {
    return Math.round(this.cfg.units[id].levels[0].cost * this.mods.placeCost);
  }

  /** 설치할 수 있는 최대 대수 (제한이 없으면 Infinity) */
  maxCount(id: UnitId): number {
    const max = this.cfg.units[id].maxCount;
    if (max === undefined) return Infinity;
    return max + (id === 'washer' ? this.mods.washerMax : 0);
  }

  /** 유닛의 현재 스탯. 갈림길을 골랐으면 그 갈래 스탯이고, 카드 효과가 반영돼 있다 */
  stats(u: Unit): UnitLevel {
    const key = this.modVersion * 100 + u.level * 10 + (u.branch ?? 9);
    const hit = this.statCache.get(u);
    if (hit && hit.key === key) return hit.stats;
    const base = u.branch !== null && u.def.branches ? u.def.branches[u.branch] : u.def.levels[u.level];
    const m = this.mods;
    const id = u.def.id;
    const stats: UnitLevel = {
      ...base,
      damage: base.damage * m.damage[id] * m.allDamage,
      range: base.range * m.allRange * (id === 'fan' ? m.fanRange : 1),
      cooldown: id === 'vacuum' ? base.cooldown / m.vacuumSpeed : base.cooldown,
    };
    if (base.splash) stats.splash = base.splash * m.splash;
    if (base.buff) stats.buff = base.buff + m.wifiBuff;
    this.statCache.set(u, { key, stats });
    return stats;
  }

  /** 스킬의 현재 수치 (카드 효과 반영) */
  abilityStats(id: AbilityId): AbilityDef {
    const d = this.cfg.abilities[id];
    const m = this.mods;
    return {
      ...d,
      cooldown: d.cooldown * (id === 'plunger' ? m.plungerCooldown : m.overloadCooldown),
      radius: d.radius === undefined ? undefined : d.radius * m.plungerRadius,
      duration: d.duration === undefined ? undefined : d.duration + m.overloadDuration,
    };
  }

  /** 카드 id별로 이번 판에 고른 횟수 */
  cardCount(id: string): number {
    return this.cards.filter((c) => c === id).length;
  }

  private pickCard(index: number): CommandResult {
    const card = this.offer?.[index];
    if (!card) return { ok: false, reason: 'phase' };
    this.cards.push(card.id);
    this.money += card.money ?? 0;
    this.hp += card.hp ?? 0;
    // 수치는 고른 카드를 처음부터 다시 적용해서 만든다
    const all = this.cfg.cards ?? [];
    this.mods = baseMods();
    for (const id of this.cards) all.find((c) => c.id === id)?.apply?.(this.mods);
    this.modVersion++;
    this.offer = null;
    this.events.push({ type: 'cardPicked', id: card.id });
    return { ok: true };
  }

  /** 카드 3장을 뽑는다. 뒤 웨이브일수록 희귀·전설이 잘 나온다 */
  private drawCards(): CardDef[] {
    const pool = (this.cfg.cards ?? []).filter(
      (c) => this.cardCount(c.id) < c.max && (c.hp === undefined || c.hp >= 0 || this.hp > -c.hp),
    );
    const weight: Record<CardRarity, number> = { common: 60, rare: 30 + this.wave, legend: 10 + this.wave * 0.5 };
    const out: CardDef[] = [];
    while (out.length < 3 && pool.length) {
      const rarities = (['common', 'rare', 'legend'] as CardRarity[]).filter((r) => pool.some((c) => c.rarity === r));
      let roll = this.rng() * rarities.reduce((a, r) => a + weight[r], 0);
      let rarity = rarities[rarities.length - 1];
      for (const r of rarities) {
        roll -= weight[r];
        if (roll < 0) {
          rarity = r;
          break;
        }
      }
      const options = pool.filter((c) => c.rarity === rarity);
      const card = options[Math.floor(this.rng() * options.length)];
      out.push(card);
      pool.splice(pool.indexOf(card), 1);
    }
    return out;
  }

  get path(): Path {
    return this.paths[0];
  }

  /** 가장 가까운 길까지의 거리 */
  distanceToPath(p: Vec): number {
    return Math.min(...this.paths.map((path) => path.distanceTo(p)));
  }

  upgradeOptions(u: Unit): UpgradeOption[] {
    const next = u.def.levels[u.level + 1];
    const m = this.mods;
    if (next) return [{ branch: null, cost: Math.round(next.cost * m.upgradeCost) }];
    if (u.branch === null && u.def.branches) {
      return u.def.branches.map((b, i) => ({ branch: i as 0 | 1, cost: Math.round(b.cost * m.upgradeCost * m.branchCost) }));
    }
    return [];
  }

  sellValue(u: Unit): number {
    return Math.floor(u.invested * Math.max(this.cfg.sellRate, this.mods.sellRate));
  }

  private place(id: UnitId, x: number, y: number): CommandResult {
    const err = this.canPlace(id, x, y);
    if (err) return { ok: false, reason: err };
    const def = this.cfg.units[id];
    const cost = this.placeCost(id);
    this.money -= cost;
    this.units.push({
      uid: this.nextUid++, def, level: 0, branch: null, x, y, cooldown: 0, target: 'first', invested: cost, buffMul: 1,
      rampTarget: 0, rampMul: 1,
    });
    return { ok: true };
  }

  private upgrade(uid: number, branch?: 0 | 1): CommandResult {
    const u = this.findUnit(uid);
    if (!u) return { ok: false, reason: 'notFound' };
    const opts = this.upgradeOptions(u);
    if (!opts.length) return { ok: false, reason: 'maxLevel' };
    const opt = opts.length === 1 ? opts[0] : opts.find((o) => o.branch === branch);
    if (!opt) return { ok: false, reason: 'branch' };
    if (this.money < opt.cost) return { ok: false, reason: 'money' };
    this.money -= opt.cost;
    u.invested += opt.cost;
    u.level++;
    if (opt.branch !== null) {
      u.branch = opt.branch;
      const t = u.def.branches![opt.branch].defaultTarget;
      if (t) u.target = t;
    }
    return { ok: true };
  }

  private sell(uid: number): CommandResult {
    const u = this.findUnit(uid);
    if (!u) return { ok: false, reason: 'notFound' };
    this.money += this.sellValue(u);
    this.units = this.units.filter((x) => x !== u);
    return { ok: true };
  }

  get finished(): boolean {
    return this.phase === 'over' || this.phase === 'won';
  }

  /** 지금 다음 웨이브를 부르면 받는 조기 호출 보너스 */
  get earlyBonus(): number {
    return this.phase === 'intermission' ? Math.floor(this.timer * this.cfg.earlyBonusPerSec) : 0;
  }

  /** n번째 웨이브에 나오는 적 종류별 마릿수 (미리보기용) */
  wavePreview(n: number): { id: EnemyId; count: number }[] {
    const def = this.waveDef(n);
    if (!def) return [];
    const counts = new Map<EnemyId, number>();
    for (const g of def.groups) counts.set(g.enemy, (counts.get(g.enemy) ?? 0) + g.count);
    return [...counts].map(([id, count]) => ({ id, count }));
  }

  private useAbility(id: AbilityId, x: number, y: number): CommandResult {
    if (this.finished || this.phase === 'ready' || this.offer) return { ok: false, reason: 'phase' };
    if (this.cooldowns[id] > 0) return { ok: false, reason: 'cooldown' };
    const def = this.abilityStats(id);
    this.cooldowns[id] = def.cooldown;
    if (def.radius) {
      const dmg = ((def.damage ?? 0) + (def.damagePerWave ?? 0) * this.wave) * this.mods.plungerDamage;
      for (const e of this.enemies) {
        if (dist(e, { x, y }) > def.radius + e.def.radius) continue;
        // 보스는 기절 시간이 짧다
        e.stunTime = Math.max(e.stunTime, (def.stun ?? 0) * (e.def.boss ? 0.3 : 1));
        this.damage(e, dmg);
      }
      this.removeDead();
      this.events.push({ type: 'ability', id, x, y, r: def.radius });
    } else {
      this.overloadTime = def.duration ?? 0;
      this.events.push({ type: 'ability', id, x: 0, y: 0, r: 0 });
    }
    return { ok: true };
  }

  private startWave(): boolean {
    if ((this.phase !== 'ready' && this.phase !== 'intermission') || this.offer || !this.waveDef(this.wave + 1)) return false;
    this.breakerUsed = false;
    const bonus = this.earlyBonus;
    if (bonus > 0) {
      this.money += bonus;
      this.events.push({ type: 'earlyBonus', amount: bonus });
    }
    this.wave++;
    this.phase = 'wave';
    this.waveTime = 0;
    const def = this.waveDef(this.wave)!;
    this.events.push({ type: 'waveStart', wave: this.wave, boss: def.groups.some((g) => this.cfg.enemies[g.enemy].boss) });
    this.spawnQueue = [];
    for (const g of def.groups) {
      for (let i = 0; i < g.count; i++) this.spawnQueue.push({ t: g.delay + i * g.interval, id: g.enemy });
    }
    this.spawnQueue.sort((a, b) => a.t - b.t);
    return true;
  }

  update(dt: number): void {
    // 카드를 고르는 동안에는 게임이 멈춘다
    while (dt > 0 && !this.finished && !this.offer) {
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

  /** lane을 안 주면 길을 번갈아 고른다 */
  spawnEnemy(id: EnemyId, dist = 0, lane?: number): Enemy {
    const def = this.cfg.enemies[id];
    if (lane === undefined) lane = this.nextLane++ % this.paths.length;
    const hpMul = this.waveDef(this.wave)?.hpMul ?? 1;
    const hp = Math.round(def.hp * hpMul * this.cfg.enemyHpMul * (this.cfg.map.enemyHpMul ?? 1));
    const path = this.paths[lane];
    const p = path.pointAt(dist);
    const e: Enemy = {
      uid: this.nextUid++, def, hp, maxHp: hp, dist, lane, left: path.length - dist, x: p.x, y: p.y,
      slowMul: 1, slowTime: 0, stunTime: 0, frozenVuln: 1, hackMul: 1, knockImmune: 0, freezeImmune: 0, summonTimer: def.summon?.interval ?? 0,
    };
    this.enemies.push(e);
    return e;
  }

  private step(dt: number): void {
    for (const k of Object.keys(this.cooldowns) as AbilityId[]) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.overloadTime = Math.max(0, this.overloadTime - dt);
    if (this.phase === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        this.startWave();
      }
    }
    if (this.phase === 'wave') {
      this.waveTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveTime) {
        this.spawnEnemy(this.spawnQueue.shift()!.id);
      }
    }
    this.summon(dt);
    this.moveEnemies(dt);
    this.burnZones(dt);
    this.unitsAct(dt);
    if (this.phase === 'wave' && this.spawnQueue.length === 0 && this.enemies.length === 0) this.clearWave();
  }

  private clearWave(): void {
    const bonus = Math.round(this.cfg.waveBonus(this.wave) * this.mods.waveBonus);
    this.money += bonus;
    this.events.push({ type: 'waveCleared', wave: this.wave, bonus });
    for (const u of this.units) {
      const lv = this.stats(u);
      let income = lv.income ?? 0;
      if (lv.interest) income += Math.min(lv.interest.max, Math.floor(this.money * lv.interest.rate));
      if (!income) continue;
      this.money += income;
      this.events.push({ type: 'income', x: u.x, y: u.y, amount: income });
    }
    if (!this.waveDef(this.wave + 1)) {
      this.phase = 'won';
      this.events.push({ type: 'victory' });
    } else {
      this.phase = 'intermission';
      this.timer = this.cfg.intermission;
      const every = this.cfg.cardEvery ?? 0;
      if (every > 0 && this.wave % every === 0) {
        const offer = this.drawCards();
        if (offer.length) {
          this.offer = offer;
          this.events.push({ type: 'cardOffer' });
        }
      }
    }
  }

  private summon(dt: number): void {
    for (const e of [...this.enemies]) {
      const s = e.def.summon;
      if (!s) continue;
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) {
        e.summonTimer = s.interval;
        for (let i = 0; i < s.count; i++) this.spawnEnemy(s.id, Math.max(0, e.dist - 20 - i * 18), e.lane);
      }
    }
  }

  private burnZones(dt: number): void {
    if (!this.zones.length) return;
    for (const z of this.zones) {
      z.time -= dt;
      for (const e of this.enemies) if (dist(e, z) <= z.r + e.def.radius) this.damage(e, z.dps * dt, { silent: true });
    }
    this.zones = this.zones.filter((z) => z.time > 0);
    this.removeDead();
  }

  private unitsAct(dt: number): void {
    // 1) 와이파이 버프와 해킹 계산 (겹치면 가장 센 것 하나만)
    for (const u of this.units) u.buffMul = 1;
    for (const e of this.enemies) e.hackMul = 1;
    for (const b of this.units) {
      if (b.def.kind !== 'buff') continue;
      const lv = this.stats(b);
      for (const u of this.units) {
        if (u !== b && dist(u, b) <= lv.range) u.buffMul = Math.max(u.buffMul, 1 + (lv.buff ?? 0));
      }
      if (lv.hackVuln) {
        for (const e of this.enemies) if (dist(e, b) <= lv.range + e.def.radius) e.hackMul = Math.max(e.hackMul, lv.hackVuln);
      }
    }
    // 2) 공격
    for (const u of this.units) {
      const lv = this.stats(u);
      const branch = u.branch !== null ? u.def.branches![u.branch].id : null;
      if (u.def.kind === 'buff' || u.def.kind === 'income') continue;
      u.cooldown -= dt * u.buffMul * (this.overloadTime > 0 ? (this.cfg.abilities.overload.speedMul ?? 1) : 1);
      if (u.cooldown > 0) continue;
      const inRange = this.enemies.filter((e) => e.hp > 0 && dist(u, e) <= lv.range + e.def.radius);
      if (inRange.length === 0) {
        u.cooldown = 0;
        continue;
      }
      u.cooldown = lv.cooldown;
      if (u.def.kind === 'slow') {
        this.events.push({ type: 'pulse', unit: u.uid, x: u.x, y: u.y, r: lv.range, color: u.def.color, branch });
        for (const e of inRange) {
          const resist = e.def.boss ? 0.3 : 1;
          e.slowMul = Math.min(e.slowMul, lv.slow ?? 1);
          e.slowTime = Math.max(e.slowTime, lv.slowDuration ?? 0);
          if (lv.knockback && e.knockImmune <= 0) {
            e.knockImmune = KNOCK_IMMUNE;
            e.dist = Math.max(0, e.dist - lv.knockback * resist);
            const p = this.paths[e.lane].pointAt(e.dist);
            e.left = this.paths[e.lane].length - e.dist;
            e.x = p.x;
            e.y = p.y;
          }
          if (lv.freeze && e.freezeImmune <= 0) {
            const t = lv.freeze * resist;
            e.stunTime = Math.max(e.stunTime, t);
            e.frozenVuln = lv.frozenVuln ?? 1;
            e.freezeImmune = t + FREEZE_IMMUNE;
          }
          this.damage(e, lv.damage);
        }
      } else {
        const t = pickTarget(inRange, u.target, u);
        this.events.push({ type: 'shot', unit: u.uid, kind: u.def.id, branch, from: { x: u.x, y: u.y }, to: { x: t.x, y: t.y }, color: u.def.color });
        // 크리티컬은 한 번의 공격 단위로 굴린다 (범위 공격이면 맞은 적 모두에게 적용)
        const crit = this.rng() < Math.min(1, (this.cfg.critChance + this.mods.critChance) * this.mods.critChanceMul);
        let dmg = crit ? lv.damage * (this.cfg.critMul + this.mods.critDamage) : lv.damage;
        if (lv.ramp) {
          // 같은 적을 계속 지지면 배율이 쌓이고, 대상이 바뀌면 처음부터
          if (u.rampTarget === t.uid) u.rampMul = Math.min(lv.ramp.max, u.rampMul + lv.ramp.step);
          else {
            u.rampTarget = t.uid;
            u.rampMul = 1;
          }
          dmg *= u.rampMul;
        }
        const opts = { crit, pierce: lv.pierceArmor };
        if (u.def.kind === 'splash' && lv.splash) {
          const r = lv.splash;
          this.events.push({ type: 'blast', x: t.x, y: t.y, r, color: u.def.color });
          for (const e of this.enemies) if (e.hp > 0 && dist(e, t) <= r + e.def.radius) this.damage(e, dmg, opts);
          if (lv.burn) this.zones.push({ x: t.x, y: t.y, r: r * 0.8, dps: lv.burn.dps, time: lv.burn.duration });
        } else if (lv.hitAll) {
          this.events.push({ type: 'pulse', unit: u.uid, x: u.x, y: u.y, r: lv.range, color: u.def.color, branch });
          for (const e of inRange) this.damage(e, dmg, opts);
        } else {
          this.damage(t, dmg, opts);
        }
      }
    }
    this.removeDead();
  }

  private damage(e: Enemy, amount: number, opts: { crit?: boolean; pierce?: boolean; silent?: boolean } = {}): void {
    if (e.hp <= 0 || amount <= 0) return;
    const frozen = e.stunTime > 0 ? e.frozenVuln : 1;
    const amp = amount * e.hackMul * frozen;
    // 방어력 무시 공격이거나 해킹당한 적은 방어력이 0
    const armor = opts.pierce || e.hackMul > 1 ? 0 : e.def.armor;
    const dealt = Math.max(amp * 0.25, amp - armor);
    e.hp -= dealt;
    if (!opts.silent) this.events.push({ type: 'hit', enemy: e.uid, x: e.x, y: e.y, amount: Math.round(dealt), crit: !!opts.crit });
  }

  /** 처치 보상 배율: 근처 동전 분수 중 가장 센 것 */
  private bountyMul(e: Enemy): number {
    let mul = 1;
    for (const u of this.units) {
      const b = this.stats(u).bounty;
      if (b && dist(u, e) <= b.radius) mul = Math.max(mul, b.mul);
    }
    return mul;
  }

  private removeDead(): void {
    // 연쇄 폭발로 또 죽는 적이 생길 수 있어서 더 죽는 적이 없을 때까지 반복한다
    for (let pass = 0; pass < 50; pass++) {
      const dead = this.enemies.filter((e) => e.hp <= 0);
      if (!dead.length) return;
      this.enemies = this.enemies.filter((e) => e.hp > 0);
      for (const e of dead) {
        const reward = Math.max(1, Math.round(e.def.reward * this.cfg.rewardMul * this.mods.reward * this.bountyMul(e)));
        this.money += reward;
        this.events.push({ type: 'kill', enemy: e.def.id, x: e.x, y: e.y, reward });
        const sp = e.def.splitInto;
        if (sp) for (let i = 0; i < sp.count; i++) this.spawnEnemy(sp.id, Math.max(0, e.dist - i * 14), e.lane);
        if (this.mods.chain > 0) {
          const dmg = e.maxHp * this.mods.chain;
          for (const o of this.enemies) {
            if (o.hp > 0 && dist(o, e) <= CHAIN_RADIUS + o.def.radius) this.damage(o, dmg, { silent: true });
          }
          this.events.push({ type: 'chain', x: e.x, y: e.y, r: CHAIN_RADIUS });
        }
      }
    }
  }

  private moveEnemies(dt: number): void {
    const survivors: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.knockImmune > 0) e.knockImmune -= dt;
      if (e.freezeImmune > 0) e.freezeImmune -= dt;
      if (e.slowTime > 0) {
        e.slowTime -= dt;
        if (e.slowTime <= 0) e.slowMul = 1;
      }
      if (e.stunTime > 0) {
        e.stunTime -= dt;
        if (e.stunTime <= 0) e.frozenVuln = 1;
        survivors.push(e);
        continue;
      }
      e.dist += e.def.speed * this.cfg.enemySpeedMul * this.mods.enemySpeed * e.slowMul * dt;
      const path = this.paths[e.lane];
      e.left = path.length - e.dist;
      if (e.dist >= path.length) {
        // 차단기 카드: 웨이브마다 처음 닿는 적(보스 제외) 하나는 막아 낸다
        if (this.mods.breaker && !this.breakerUsed && !e.def.boss) {
          this.breakerUsed = true;
          this.events.push({ type: 'blocked', x: e.x, y: e.y });
          continue;
        }
        // 기지에 도착한 적은 남은 체력만큼 피해를 준다.
        const damage = Math.ceil(e.hp);
        this.hp = Math.max(0, this.hp - damage);
        this.events.push({ type: 'leak', x: e.x, y: e.y, damage });
        continue;
      }
      const p = path.pointAt(e.dist);
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

export function pickTarget(list: Enemy[], mode: TargetMode, from: Vec): Enemy {
  let best = list[0];
  for (const e of list) {
    switch (mode) {
      case 'first':
        if (e.left < best.left) best = e;
        break;
      case 'last':
        if (e.left > best.left) best = e;
        break;
      case 'strong':
        if (e.hp > best.hp) best = e;
        break;
      case 'close':
        if (dist(e, from) < dist(best, from)) best = e;
        break;
    }
  }
  return best;
}

function circleHitsRect(x: number, y: number, r: number, b: { x: number; y: number; w: number; h: number }): boolean {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  return Math.hypot(x - cx, y - cy) < r;
}
