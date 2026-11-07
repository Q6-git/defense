import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';

function started() {
  const g = new Game({ ...defaultConfig(), seed: 1 });
  g.apply({ type: 'startWave' });
  g.enemies = [];
  return g;
}

describe('스킬', () => {
  it('첫 웨이브 시작 전에는 쓸 수 없다', () => {
    const g = new Game(defaultConfig());
    expect(g.apply({ type: 'ability', id: 'overload' })).toEqual({ ok: false, reason: 'phase' });
  });

  it('뚫어뻥은 범위 안 적에게 피해를 주고 기절시킨다', () => {
    const g = started();
    const near = g.spawnEnemy('grease', 400);
    const far = g.spawnEnemy('grease', 1500);
    const [hpNear, hpFar] = [near.hp, far.hp];
    expect(g.apply({ type: 'ability', id: 'plunger', x: near.x, y: near.y }).ok).toBe(true);
    expect(near.hp).toBeLessThan(hpNear);
    expect(far.hp).toBe(hpFar);
    const d = near.dist;
    g.update(1);
    expect(near.dist).toBe(d);
    g.update(1);
    expect(near.dist).toBeGreaterThan(d);
  });

  it('쓰고 나면 재사용 대기시간이 돈다', () => {
    const g = started();
    g.apply({ type: 'ability', id: 'plunger', x: 0, y: 0 });
    expect(g.apply({ type: 'ability', id: 'plunger', x: 0, y: 0 })).toEqual({ ok: false, reason: 'cooldown' });
    g.update(g.cfg.abilities.plunger.cooldown + 0.1);
    expect(g.apply({ type: 'ability', id: 'plunger', x: 0, y: 0 }).ok).toBe(true);
  });

  it('과부하 중에는 가전 공격 속도가 2배가 된다', () => {
    const shots = (overload: boolean) => {
      const g = started();
      g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
      const e = g.spawnEnemy('boss', 530);
      e.hp = e.maxHp = 1e9;
      e.def = { ...e.def, speed: 0, summon: undefined };
      if (overload) g.apply({ type: 'ability', id: 'overload' });
      g.drainEvents();
      g.update(3);
      return g.drainEvents().filter((ev) => ev.type === 'shot').length;
    };
    const normal = shots(false);
    expect(shots(true)).toBeGreaterThanOrEqual(normal * 2 - 1);
  });
});

describe('크리티컬과 미리보기', () => {
  it('크리티컬 확률이 1이면 모든 공격이 배율만큼 세진다', () => {
    const g = new Game({ ...defaultConfig(), seed: 1, critChance: 1 });
    g.apply({ type: 'startWave' });
    g.enemies = [];
    const e = g.spawnEnemy('grease', 530);
    g.apply({ type: 'place', unit: 'toaster', x: 560, y: 240 });
    const hp = e.hp;
    g.update(1 / 60);
    expect(hp - e.hp).toBeCloseTo(12 * g.cfg.critMul);
  });

  it('다음 웨이브 구성을 미리 볼 수 있다', () => {
    const g = new Game(defaultConfig());
    expect(g.wavePreview(2)).toEqual([{ id: 'goo', count: 10 }, { id: 'rat', count: 6 }]);
    expect(g.wavePreview(99)).toEqual([]);
  });
});
