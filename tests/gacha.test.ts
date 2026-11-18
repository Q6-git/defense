import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../src/achievements';
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import type { UnitId } from '../src/core/types';
import { GACHA_UNITS } from '../src/data/units';
import { STR } from '../src/strings.ko';
import { GACHA, GACHA_POOL, pull, waveReward } from '../src/gacha';

/** 정해진 값을 차례로 돌려주는 난수 */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('뽑기', () => {
  it('부품이 모자라면 뽑을 수 없고, 뽑으면 부품이 줄고 가전을 얻는다', () => {
    const p = { ...emptyProgress(), parts: 99 };
    expect(pull(p, 1, seq(0.5, 0))).toBeNull();
    p.parts = 100;
    const r = pull(p, 1, seq(0.5, 0))!;
    expect(r[0]).toEqual({ unit: 'stove', rarity: 'rare', duplicate: false, refund: 0 });
    expect(p.parts).toBe(0);
    expect(p.owned).toEqual(['stove']);
  });

  it('난수 구간에 따라 등급이 정해진다 (전설 5%, 영웅 25%, 희귀 70%)', () => {
    const rarity = (r: number) => pull({ ...emptyProgress(), parts: 100 }, 1, seq(r, 0))![0].rarity;
    expect(rarity(0.04)).toBe('legend');
    expect(rarity(0.06)).toBe('hero');
    expect(rarity(0.29)).toBe('hero');
    expect(rarity(0.31)).toBe('rare');
  });

  it('이미 가진 가전이 나오면 부품으로 환급된다', () => {
    const p = { ...emptyProgress(), parts: 200, owned: ['stove'] };
    const r = pull(p, 1, seq(0.5, 0))!;
    expect(r[0]).toMatchObject({ duplicate: true, refund: GACHA.refund.rare });
    expect(p.parts).toBe(200 - 100 + GACHA.refund.rare);
    expect(p.owned).toEqual(['stove']);
    expect(p.mastery).toEqual({});
  });

  it('30회 안에 전설이 안 나오면 30회째는 전설 확정이고, 전설이 나오면 횟수가 초기화된다', () => {
    const p = { ...emptyProgress(), parts: 100000 };
    const rng = seq(0.9, 0); // 항상 희귀
    const results = [...pull(p, 10, rng)!, ...pull(p, 10, rng)!, ...pull(p, 10, rng)!];
    expect(results.slice(0, 29).every((r) => r.rarity === 'rare')).toBe(true);
    expect(results[29].rarity).toBe('legend');
    expect(p.pity).toBe(0);
  });

  it('10회 뽑기는 900 부품', () => {
    const p = { ...emptyProgress(), parts: 900 };
    expect(pull(p, 10, seq(0.9, 0))!.length).toBe(10);
    expect(p.parts).toBe(9 * GACHA.refund.rare); // 첫 장만 새 가전, 나머지 9장은 환급
  });

  it('뽑기 대상은 7종이고, 판 보상은 난이도 배율을 따른다', () => {
    expect(Object.keys(GACHA_POOL).length).toBe(7);
    expect(Object.keys(GACHA_POOL).sort()).toEqual([...GACHA_UNITS].sort());
    expect(waveReward(10, 'normal')).toBe(50);
    expect(waveReward(10, 'hell')).toBe(100);
    expect(waveReward(10, 'easy')).toBe(35);
  });
});

describe('뽑기로 얻는 가전', () => {
  function game() {
    const g = new Game({ ...defaultConfig(), seed: 1, startMoney: 1e6, critChance: 0, cards: [] });
    g.apply({ type: 'startWave' });
    g.enemies = [];
    (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    return g;
  }
  const place = (g: Game, unit: UnitId, x = 560, y = 240) => expect(g.apply({ type: 'place', unit, x, y }).ok).toBe(true);
  const still = (g: Game, id: 'grease' | 'roach', d: number) => {
    const e = g.spawnEnemy(id, d);
    e.def = { ...e.def, speed: 0 };
    return e;
  };

  it('가스레인지: 맞은 적이 불타서 계속 피해를 받는다', () => {
    const g = game();
    place(g, 'stove', 560, 210);
    const e = still(g, 'grease', 560);
    g.update(1 / 60);
    expect(e.burnTime).toBeGreaterThan(0);
    g.units = []; // 가전을 치워도 불은 계속 탄다
    const hp = e.hp;
    g.update(1);
    expect(hp - e.hp).toBeCloseTo(g.cfg.units.stove.levels[0].dot!.dps, 0);
  });

  it('멀티탭: 번개가 가까운 적으로 튕기며 피해가 30%씩 줄어든다', () => {
    const g = game();
    place(g, 'strip');
    const a = still(g, 'grease', 560);
    const b = still(g, 'grease', 500);
    const c = still(g, 'grease', 440);
    const far = still(g, 'grease', 2000);
    const hp = a.hp;
    g.update(1 / 60);
    expect(hp - a.hp).toBeCloseTo(20);
    expect(hp - b.hp).toBeCloseTo(20 * 0.7);
    expect(hp - c.hp).toBeCloseTo(20 * 0.49);
    expect(far.hp).toBe(hp);
  });

  it('보조배터리: 주변 가전의 공격력을 올린다', () => {
    const g = game();
    place(g, 'toaster');
    place(g, 'battery', 500, 240);
    const e = still(g, 'grease', 560);
    const hp = e.hp;
    g.update(1 / 60);
    expect(hp - e.hp).toBeCloseTo(12 * 1.2);
  });

  it('다리미: 맞힐 때마다 방어력을 깎는다', () => {
    const g = game();
    place(g, 'iron');
    const e = still(g, 'roach', 560);
    const hp = e.hp;
    g.update(1 / 60);
    expect(hp - e.hp).toBeCloseTo(g.cfg.units.iron.levels[0].damage - 8);
    expect(e.shred).toBe(2);
  });

  it('에어컨: 맵 전체 적이 느려지고, 한 대만 설치할 수 있다', () => {
    const g = game();
    const a = g.spawnEnemy('grease', 100);
    g.update(1);
    const plain = a.dist - 100;
    place(g, 'aircon', 60, 300);
    expect(g.canPlace('aircon', 60, 400)).toBe('limit');
    const d = a.dist;
    g.update(1);
    expect(a.dist - d).toBeCloseTo(plain * (1 - g.cfg.units.aircon.levels[0].globalSlow!), 0);
  });

  it('식기세척기: 물줄기 위의 적을 모두 맞힌다', () => {
    const g = game();
    place(g, 'dishwasher', 200, 200);
    // 가장 앞의 적을 향해 쏘고, 그 선 가까이 있는 적도 맞는다. 뒤쪽에 있는 적은 맞지 않는다
    const front = still(g, 'grease', 430);
    const near = still(g, 'grease', 330);
    const behind = still(g, 'grease', 100);
    const hp = front.hp;
    g.update(1 / 60);
    expect(front.hp).toBeLessThan(hp);
    expect(near.hp).toBeLessThan(hp);
    expect(behind.hp).toBe(hp);
  });
});

describe('뽑기 가전 Lv4 갈림길', () => {
  function game() {
    const g = new Game({ ...defaultConfig(), seed: 1, startMoney: 1e6, critChance: 0, cards: [] });
    g.apply({ type: 'startWave' });
    g.enemies = [];
    (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    return g;
  }
  /** 설치하고 Lv3까지 올린 뒤 갈래를 고른다 */
  const lv4 = (g: Game, unit: UnitId, branch: 0 | 1, x = 560, y = 240) => {
    expect(g.apply({ type: 'place', unit, x, y }).ok).toBe(true);
    const u = g.units[g.units.length - 1];
    g.apply({ type: 'upgrade', uid: u.uid });
    g.apply({ type: 'upgrade', uid: u.uid });
    expect(g.apply({ type: 'upgrade', uid: u.uid, branch }).ok).toBe(true);
    return u;
  };
  const still = (g: Game, id: 'grease' | 'roach', d: number) => {
    const e = g.spawnEnemy(id, d);
    e.def = { ...e.def, speed: 0 };
    return e;
  };

  it('뽑기 가전은 모기채만 빼고 갈래가 두 개 있고, 이름과 설명이 있다', () => {
    for (const id of GACHA_UNITS) {
      expect(STR.units[id].name, id).toBeTruthy();
      if (id === 'swatter') continue;
      const br = defaultConfig().units[id].branches;
      expect(br?.length, id).toBe(2);
      for (const b of br!) expect(STR.branches[b.id], b.id).toBeDefined();
    }
  });

  it('화염 방사: 사거리 안 모든 적에게 불을 붙인다', () => {
    const g = game();
    lv4(g, 'stove', 0, 560, 210);
    const a = still(g, 'grease', 520);
    const b = still(g, 'grease', 600);
    g.update(1 / 60);
    expect(a.burnTime).toBeGreaterThan(0);
    expect(b.burnTime).toBeGreaterThan(0);
  });

  it('스팀 다리미: 물줄기에 맞은 적 모두 방어력이 깎인다', () => {
    const g = game();
    lv4(g, 'iron', 0, 200, 200);
    const front = still(g, 'roach', 430);
    const near = still(g, 'roach', 330);
    g.update(1 / 60);
    expect(front.shred).toBe(3);
    expect(near.shred).toBe(3);
  });

  it('제습 에어컨: 모든 적이 받는 피해가 늘어난다', () => {
    const g = game();
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const e = still(g, 'grease', 560);
    let hp = e.hp;
    g.update(1 / 60);
    const plain = hp - e.hp;
    lv4(g, 'aircon', 1, 60, 300);
    g.units[0].cooldown = 0;
    hp = e.hp;
    g.update(1 / 60);
    expect(hp - e.hp).toBeCloseTo(plain * (1 + g.cfg.units.aircon.branches![1].globalVuln!));
  });

  it('강적용 갈래는 고르는 순간 타겟이 "가장 강한"이 된다', () => {
    const g = game();
    expect(lv4(g, 'iron', 1).target).toBe('strong');
  });
});

describe('전기 모기채', () => {
  const setup = () => {
    const g = new Game({ ...defaultConfig(), seed: 1, startMoney: 1e6, critChance: 0, cards: [] });
    g.apply({ type: 'startWave' });
    g.enemies = [];
    (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    return g;
  };

  it('싸다: 설치 60, Lv2까지만 있고 갈림길·★강화가 없다', () => {
    const g = setup();
    expect(g.placeCost('swatter')).toBe(60);
    expect(g.apply({ type: 'place', unit: 'swatter', x: 560, y: 240 }).ok).toBe(true);
    const u = g.units[0];
    expect(g.upgradeOptions(u)).toEqual([{ branch: null, cost: 60 }]);
    expect(g.apply({ type: 'upgrade', uid: u.uid }).ok).toBe(true);
    expect(u.level).toBe(1);
    expect(g.upgradeOptions(u)).toEqual([]);
    expect(g.apply({ type: 'upgrade', uid: u.uid })).toEqual({ ok: false, reason: 'maxLevel' });
  });

  it('사거리 안 모든 적을 한꺼번에 지진다', () => {
    const g = setup();
    g.apply({ type: 'place', unit: 'swatter', x: 560, y: 240 });
    const near = g.units[0];
    // 배수관에서 모기채에 가장 가까운 지점에 적 셋을 세워 둔다
    let best = 0;
    for (let d = 0; d < g.path.length; d += 5) if (Math.hypot(g.path.pointAt(d).x - near.x, g.path.pointAt(d).y - near.y) < Math.hypot(g.path.pointAt(best).x - near.x, g.path.pointAt(best).y - near.y)) best = d;
    const es = [-10, 0, 10].map((dd) => g.spawnEnemy('grease', best + dd));
    for (const e of es) e.def = { ...e.def, speed: 0 };
    const hp = es.map((e) => e.hp);
    g.update(1 / 60);
    es.forEach((e, i) => expect(hp[i] - e.hp).toBeCloseTo(8));
  });

  it('팔면 투자한 돈을 전부 돌려받는다 (중고 거래 카드·연구와 상관없이)', () => {
    const g = setup();
    g.apply({ type: 'place', unit: 'swatter', x: 560, y: 240 });
    g.apply({ type: 'upgrade', uid: g.units[0].uid });
    const money = g.money;
    expect(g.sellValue(g.units[0])).toBe(120);
    g.apply({ type: 'sell', uid: g.units[0].uid });
    expect(g.money).toBe(money + 120);
    // 다른 가전은 그대로 60%
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    expect(g.sellValue(g.units[0])).toBe(60);
  });
});
