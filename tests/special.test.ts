import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import { WAVE_MODS } from '../src/data/waves';

function game(seed = 3) {
  const g = new Game({ ...defaultConfig(), seed, startMoney: 1e6, critChance: 0, cards: [] });
  g.apply({ type: 'startWave' });
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  return g;
}

const mod = (id: string) => WAVE_MODS.find((m) => m.id === id)!;

describe('새로운 적', () => {
  it('방패병: 피해량과 상관없이 한 번에 한 겹씩 벗겨지고, 다 벗겨져야 피해를 받는다', () => {
    const g = game();
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const e = g.spawnEnemy('shield', 560);
    e.def = { ...e.def, speed: 0 };
    const hp = e.hp;
    g.update(1 / 60);
    expect(e.shield).toBe(3);
    expect(e.hp).toBe(hp);
    g.update(0.7 * 3 + 0.1);
    expect(e.shield).toBe(0);
    expect(e.hp).toBe(hp);
    g.update(0.7);
    expect(e.hp).toBeLessThan(hp);
  });

  it('유령: 투명할 때는 조준되지 않지만 범위 공격(선풍기)은 맞는다', () => {
    const g = game();
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const e = g.spawnEnemy('ghost', 560);
    e.def = { ...e.def, speed: 0 };
    e.hidden = true;
    e.phaseTimer = 99;
    const hp = e.hp;
    g.update(1);
    expect(e.hp).toBe(hp);
    expect(g.apply({ type: 'place', unit: 'fan', x: 490, y: 220 }).ok).toBe(true);
    g.update(1 / 60);
    expect(e.hp).toBeLessThan(hp);
  });

  it('유령은 정해진 주기로 보였다 안 보였다 한다', () => {
    const g = game();
    const e = g.spawnEnemy('ghost', 0);
    expect(e.hidden).toBe(false);
    g.update(3.1);
    expect(e.hidden).toBe(true);
    g.update(1.5);
    expect(e.hidden).toBe(false);
  });

  it('치유사: 주변 적을 회복시키지만 자신과 보스, 멀리 있는 적은 회복시키지 않는다', () => {
    const g = game();
    const healer = g.spawnEnemy('healer', 500);
    const near = g.spawnEnemy('grease', 520);
    const far = g.spawnEnemy('grease', 1500);
    const boss = g.spawnEnemy('boss', 510);
    for (const e of [healer, near, far, boss]) {
      e.def = { ...e.def, speed: 0, summon: undefined };
      e.hp = e.maxHp * 0.5;
    }
    g.update(2.05);
    expect(near.hp).toBeCloseTo(near.maxHp * 0.54);
    expect(healer.hp).toBe(healer.maxHp * 0.5);
    expect(far.hp).toBe(far.maxHp * 0.5);
    expect(boss.hp).toBe(boss.maxHp * 0.5);
  });

  it('치유사가 여럿이어도 회복은 겹치지 않고, 치유사끼리는 서로 고치지 않는다', () => {
    const g = game();
    const healers = [500, 505, 510, 515].map((d) => g.spawnEnemy('healer', d));
    const near = g.spawnEnemy('grease', 520);
    for (const e of [...healers, near]) {
      e.def = { ...e.def, speed: 0 };
      e.hp = e.maxHp * 0.5;
    }
    g.update(2.05);
    // 치유사 넷이 같이 있어도 한 번(4%)만
    expect(near.hp).toBeCloseTo(near.maxHp * 0.54);
    for (const h of healers) expect(h.hp).toBe(h.maxHp * 0.5);
    // 2초 뒤에는 다시 회복받는다
    g.update(2.05);
    expect(near.hp).toBeCloseTo(near.maxHp * 0.58);
  });

  it('돌격병: 체력이 절반 이하가 되면 2배로 빨라진다', () => {
    const g = game();
    const a = g.spawnEnemy('charger', 100);
    const b = g.spawnEnemy('charger', 100);
    b.hp = b.maxHp * 0.5;
    g.update(1);
    expect(b.dist - 100).toBeCloseTo((a.dist - 100) * 1.5, 0);
  });
});

describe('특수 웨이브', () => {
  it('5의 배수 웨이브 중 보스가 없는 웨이브에만 변칙이 붙고, 한 판 안에서는 항상 같다', () => {
    const g = new Game({ ...defaultConfig('normal', true), seed: 11 });
    expect(g.waveMod(4)).toBeNull();
    expect(g.waveMod(5)).toBeNull(); // 초반은 제외 (10웨이브부터)
    expect(g.waveMod(15)).toBeNull(); // 까불이 왕자 (중간 보스)
    expect(g.waveMod(10)).not.toBeNull();
    expect(g.waveMod(20)).toBeNull(); // 보스 웨이브
    expect(g.waveMod(25)).not.toBeNull();
    expect(g.waveMod(30)).toBeNull();
    expect(g.waveMod(10)).toBe(g.waveMod(10));
    // 같은 시드면 같은 변칙
    expect(new Game({ ...defaultConfig('normal', true), seed: 11 }).waveMod(25)).toBe(g.waveMod(25));
  });

  it('판(시드)마다 변칙이 달라진다', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) seen.add(new Game({ ...defaultConfig(), seed }).waveMod(10)!.id);
    expect(seen.size).toBe(WAVE_MODS.length);
  });

  /** 5웨이브를 원하는 변칙으로 시작한다 */
  function wave5(id: string) {
    const g = new Game({ ...defaultConfig(), seed: 3, startMoney: 1e6, critChance: 0, cards: [], waveMods: [mod(id)], specialFrom: 0 });
    g.wave = 4;
    g.apply({ type: 'startWave' });
    return g;
  }

  it('러시: 적이 많아지고 약해진다 (미리보기에도 반영)', () => {
    const plain = new Game({ ...defaultConfig(), seed: 3, waveMods: [] });
    const g = wave5('rush');
    const count = (x: Game) => x.wavePreview(5).reduce((a, c) => a + c.count, 0);
    expect(count(g)).toBe(Math.round(6 * 1.5) + Math.round(10 * 1.5));
    expect(count(plain)).toBe(16);
    g.update(0.05);
    plain.wave = 5;
    // 반올림 순서 차이로 1까지는 어긋날 수 있다
    expect(Math.abs(g.enemies[0].maxHp - plain.spawnEnemy(g.enemies[0].def.id).maxHp * 0.65)).toBeLessThanOrEqual(1);
  });

  it('안개: 사거리가 줄고, 웨이브가 끝나면 돌아온다', () => {
    const g = wave5('fog');
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    expect(g.stats(g.units[0]).range).toBeCloseTo(150 * 0.88);
    g.update(0.05);
    g.enemies = [];
    (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    g.update(0.05);
    expect(g.activeMod).toBeNull();
    expect(g.stats(g.units[0]).range).toBe(150);
  });

  it('폭주는 속도를, 강철은 방어력을, 황금은 보상과 체력을 올린다', () => {
    const base = wave5('fog');
    base.enemies = [];
    const b0 = base.spawnEnemy('goo', 100);
    base.update(1);

    const haste = wave5('haste');
    haste.enemies = [];
    const h0 = haste.spawnEnemy('goo', 100);
    haste.update(1);
    expect(h0.dist - 100).toBeCloseTo((b0.dist - 100) * 1.2, 0);

    const steel = wave5('steel');
    steel.enemies = [];
    (steel as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    steel.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const s0 = steel.spawnEnemy('goo', 560);
    const hp = s0.hp;
    steel.update(1 / 60);
    expect(hp - s0.hp).toBeCloseTo(12 - 3);

    const gold = wave5('gold');
    gold.enemies = [];
    (gold as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    gold.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const g0 = gold.spawnEnemy('goo', 560);
    gold.spawnEnemy('grease', 0);
    expect(Math.abs(g0.maxHp - b0.maxHp * 1.2)).toBeLessThanOrEqual(1);
    g0.hp = 1;
    const money = gold.money;
    gold.update(1 / 60);
    expect(gold.money - money).toBe(Math.round(g0.def.reward * gold.cfg.rewardMul * 2));
  });
});

describe('군중 제어 겹치기', () => {
  /** 입구 근처 태풍 선풍기 8대 + 급냉 에어컨 ★5 아래에서 20초 동안 전진한 거리 / 방해 없이 간 거리 */
  function advanceRatio(enemy: 'grease' | 'boss'): number {
    const g = new Game({ ...defaultConfig('hell'), seed: 3, startMoney: 1e9, cards: [] });
    const T = (c: number, r: number) => ({ x: c * 52 + 26, y: 72 + r * 52 + 26 });
    const lv4 = (unit: 'fan' | 'aircon', c: number, r: number, stars: number) => {
      expect(g.apply({ type: 'place', unit, ...T(c, r) }).ok).toBe(true);
      const u = g.units[g.units.length - 1];
      g.apply({ type: 'upgrade', uid: u.uid });
      g.apply({ type: 'upgrade', uid: u.uid });
      g.apply({ type: 'upgrade', uid: u.uid, branch: 0 });
      for (let i = 0; i < stars; i++) g.apply({ type: 'upgrade', uid: u.uid });
    };
    for (const [c, r] of [[1, 0], [2, 0], [3, 0], [5, 0], [6, 0], [2, 2], [4, 2], [6, 2]]) lv4('fan', c, r, 0);
    lv4('aircon', 19, 6, 5);
    g.apply({ type: 'startWave' });
    g.enemies = [];
    (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    const e = g.spawnEnemy(enemy, 100);
    e.hp = e.maxHp = 1e12;
    for (let t = 0; t < 20; t += 0.05) g.update(0.05);
    return (e.dist - 100) / (e.def.speed * g.cfg.enemySpeedMul * 20);
  }

  it('느린 적(기름때)도 감속·밀어내기에 갇히지 않고 계속 전진한다', () => {
    expect(advanceRatio('grease')).toBeGreaterThan(0.2);
  });

  it('보스는 더 덜 묶인다', () => {
    expect(advanceRatio('boss')).toBeGreaterThan(0.35);
  });
});

describe('까불이 왕자 (춤추는 보스)', () => {
  function setup() {
    const g = new Game({ ...defaultConfig('normal'), seed: 1, startMoney: 1e6, critChance: 0, cards: [] });
    g.apply({ type: 'startWave' });
    g.enemies = [];
    (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    return g;
  }

  it('15웨이브에 중간 보스로 나오고, 무한 모드에서는 하수구 대왕과 번갈아 나온다', async () => {
    const { WAVES, endlessWave } = await import('../src/data/waves');
    expect(WAVES[14].groups.some((gr) => gr.enemy === 'dancer')).toBe(true);
    const bossOf = (n: number) => endlessWave(n).groups.find((gr) => gr.enemy === 'boss' || gr.enemy === 'dancer')?.enemy;
    expect([bossOf(30), bossOf(40), bossOf(50)]).toEqual(['dancer', 'boss', 'dancer']);
  });

  it('L 포즈: 8초마다 반경 안 가전이 3초 동안 공격 속도 -40%', () => {
    const g = setup();
    expect(g.apply({ type: 'place', unit: 'toaster', x: 500, y: 240 }).ok).toBe(true);
    expect(g.apply({ type: 'place', unit: 'toaster', x: 858, y: 410 }).ok).toBe(true);
    const [near, far] = g.units;
    const d = g.spawnEnemy('dancer', 420);
    d.def = { ...d.def, speed: 0 };
    d.hp = d.maxHp = 1e9;
    g.update(7.9);
    expect(near.tauntTime).toBe(0);
    g.drainEvents();
    g.update(0.2);
    const ev = g.drainEvents().find((e) => e.type === 'taunt');
    expect(ev).toBeDefined();
    expect(near.tauntTime).toBeGreaterThan(2.5);
    expect(near.tauntSlow).toBe(0.4);
    expect(far.tauntTime).toBe(0);
    g.update(3.1);
    expect(near.tauntTime).toBeLessThanOrEqual(0);
  });

  it('춤추며 걷기: 속도가 오르내려도 평균 속도는 그대로', () => {
    const g = setup();
    const d = g.spawnEnemy('dancer', 0);
    d.hp = d.maxHp = 1e9;
    for (let t = 0; t < 8; t += 1 / 60) g.update(1 / 60);
    const expected = d.def.speed * g.cfg.enemySpeedMul * 8;
    expect(d.dist / expected).toBeGreaterThan(0.9);
    expect(d.dist / expected).toBeLessThan(1.1);
  });
});
