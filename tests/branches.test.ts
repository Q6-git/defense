import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import type { UnitId } from '../src/core/types';

function game() {
  const g = new Game({ ...defaultConfig(), seed: 1, startMoney: 1e6, critChance: 0 });
  g.apply({ type: 'startWave' });
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  return g;
}

/** 설치하고 Lv3(갈림길 직전)까지 올린다 */
function lv3(g: Game, unit: UnitId, x: number, y: number) {
  g.apply({ type: 'place', unit, x, y });
  const u = g.units[g.units.length - 1];
  g.apply({ type: 'upgrade', uid: u.uid });
  g.apply({ type: 'upgrade', uid: u.uid });
  return u;
}

describe('갈림길 업그레이드', () => {
  it('Lv3에서는 두 갈래가 나오고, 갈래 없이 업그레이드하면 거절된다', () => {
    const g = game();
    const u = lv3(g, 'toaster', 560, 240);
    expect(g.upgradeOptions(u).map((o) => o.branch)).toEqual([0, 1]);
    expect(g.apply({ type: 'upgrade', uid: u.uid })).toEqual({ ok: false, reason: 'branch' });
  });

  it('갈래를 고르면 스탯이 바뀌고 더는 업그레이드할 수 없다', () => {
    const g = game();
    const u = lv3(g, 'toaster', 560, 240);
    const before = g.money;
    expect(g.apply({ type: 'upgrade', uid: u.uid, branch: 1 }).ok).toBe(true);
    expect(g.money).toBe(before - u.def.branches![1].cost);
    expect(u.branch).toBe(1);
    expect(g.stats(u).range).toBe(u.def.branches![1].range);
    expect(g.upgradeOptions(u)).toEqual([]);
  });

  it('저격 토스터는 고르는 순간 타겟이 "가장 강한"이 된다', () => {
    const g = game();
    const u = lv3(g, 'toaster', 560, 240);
    g.apply({ type: 'upgrade', uid: u.uid, branch: 1 });
    expect(u.target).toBe('strong');
  });

  it('방어 무시(분쇄)는 방어력을 빼지 않는다', () => {
    const g = game();
    const u = lv3(g, 'vacuum', 560, 210);
    g.apply({ type: 'upgrade', uid: u.uid, branch: 1 });
    const e = g.spawnEnemy('roach', 560);
    const hp = e.hp;
    g.update(1 / 60);
    expect(hp - e.hp).toBeCloseTo(g.stats(u).damage);
  });

  it('흡입 모드는 사거리 안 적을 모두 때린다', () => {
    const g = game();
    const u = lv3(g, 'vacuum', 560, 210);
    g.apply({ type: 'upgrade', uid: u.uid, branch: 0 });
    const es = [540, 560, 580].map((d) => g.spawnEnemy('grease', d));
    const hps = es.map((e) => e.hp);
    g.update(1 / 60);
    es.forEach((e, i) => expect(e.hp).toBeLessThan(hps[i]));
  });

  it('태풍은 적을 길 뒤로 밀어내고, 냉풍은 얼려서 피해를 키운다', () => {
    const g = game();
    const fan = lv3(g, 'fan', 540, 220);
    g.apply({ type: 'upgrade', uid: fan.uid, branch: 0 });
    const e = g.spawnEnemy('grease', 560);
    g.update(1 / 60);
    expect(e.dist).toBeLessThan(560);

    const g2 = game();
    const f2 = lv3(g2, 'fan', 540, 220);
    g2.apply({ type: 'upgrade', uid: f2.uid, branch: 1 });
    const e2 = g2.spawnEnemy('grease', 560);
    g2.update(1 / 60);
    expect(e2.stunTime).toBeGreaterThan(0);
    expect(e2.frozenVuln).toBeCloseTo(1.4);
  });

  it('해동 폭탄은 불 장판을 남기고, 그릴은 같은 적을 지질수록 세진다', () => {
    const g = game();
    const m = lv3(g, 'microwave', 560, 240);
    g.apply({ type: 'upgrade', uid: m.uid, branch: 0 });
    g.spawnEnemy('grease', 560);
    g.update(1 / 60);
    expect(g.zones.length).toBe(1);

    const g2 = game();
    const m2 = lv3(g2, 'microwave', 560, 240);
    g2.apply({ type: 'upgrade', uid: m2.uid, branch: 1 });
    const e = g2.spawnEnemy('boss', 560);
    e.def = { ...e.def, speed: 0, summon: undefined };
    g2.update(2);
    expect(m2.rampMul).toBeGreaterThan(1.5);
  });

  it('해킹은 주변 적 방어력을 없애고 피해를 키운다', () => {
    const g = game();
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const w = lv3(g, 'wifi', 500, 240);
    g.apply({ type: 'upgrade', uid: w.uid, branch: 1 });
    const e = g.spawnEnemy('roach', 530);
    const hp = e.hp;
    g.update(1 / 60);
    expect(hp - e.hp).toBeCloseTo(12 * 1.25);
  });

  it('이자형 세탁기는 보유 돈에 비례해 더 번다 (최대치 있음)', () => {
    const g = game();
    const w = lv3(g, 'washer', 60, 240);
    g.apply({ type: 'upgrade', uid: w.uid, branch: 0 });
    g.money = 500;
    g.update(0.1); // 적이 없으므로 웨이브 클리어
    // 이자는 클리어 보너스를 받은 뒤의 보유 돈 기준
    const m = 500 + g.cfg.waveBonus(1);
    expect(g.money).toBe(m + 120 + Math.min(120, Math.floor(m * 0.1)));
  });

  it('동전 분수 근처에서 처치하면 보상이 늘어난다', () => {
    const g = game();
    const w = lv3(g, 'washer', 560, 240);
    g.apply({ type: 'upgrade', uid: w.uid, branch: 1 });
    g.apply({ type: 'place', unit: 'toaster', x: 620, y: 240 });
    const e = g.spawnEnemy('goo', 560);
    e.hp = 1;
    g.spawnEnemy('grease', 0); // 웨이브가 끝나지 않도록 하나 더
    const money = g.money;
    g.update(1 / 60);
    expect(g.money - money).toBe(Math.round(e.def.reward * g.cfg.rewardMul * 1.5));
  });
});
