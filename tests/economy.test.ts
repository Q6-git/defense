import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { Game, type GameConfig } from '../src/core/game';

/** 웨이브 2개짜리 짧은 설정 */
function cfg(): GameConfig {
  return {
    ...defaultConfig(),
    startMoney: 1000,
    waves: [
      { hpMul: 1, groups: [{ enemy: 'goo', count: 1, interval: 1, delay: 0 }] },
      { hpMul: 1, groups: [{ enemy: 'goo', count: 1, interval: 1, delay: 0 }] },
    ],
  };
}

/** 스폰된 적을 즉시 치워 웨이브를 끝낸다 */
function killAll(g: Game) {
  g.update(0.05);
  g.enemies = [];
  g.update(0.05);
}

describe('경제', () => {
  it('웨이브를 클리어하면 보너스를 받고 대기 시간이 시작된다', () => {
    const g = new Game(cfg());
    g.apply({ type: 'startWave' });
    const money = g.money;
    killAll(g);
    expect(g.phase).toBe('intermission');
    expect(g.money).toBe(money + g.cfg.waveBonus(1));
    expect(g.timer).toBeCloseTo(g.cfg.intermission, 0);
  });

  it('대기 시간이 끝나면 다음 웨이브가 자동으로 시작된다', () => {
    const g = new Game(cfg());
    g.apply({ type: 'startWave' });
    killAll(g);
    g.update(g.cfg.intermission + 0.1);
    expect(g.wave).toBe(2);
    expect(g.phase).toBe('wave');
  });

  it('일찍 부르면 남은 시간만큼 보너스를 받는다', () => {
    const g = new Game(cfg());
    g.apply({ type: 'startWave' });
    killAll(g);
    g.update(2);
    const money = g.money;
    const expected = Math.floor(g.timer * g.cfg.earlyBonusPerSec);
    g.apply({ type: 'startWave' });
    expect(g.money).toBe(money + expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('동전 세탁기는 웨이브가 끝날 때마다 돈을 번다', () => {
    const g = new Game(cfg());
    g.apply({ type: 'place', unit: 'washer', x: 500, y: 240 });
    g.apply({ type: 'startWave' });
    const money = g.money;
    killAll(g);
    expect(g.money).toBe(money + g.cfg.waveBonus(1) + 40);
    expect(g.drainEvents().some((e) => e.type === 'income')).toBe(true);
  });

  it('마지막 웨이브를 클리어하면 승리', () => {
    const g = new Game(cfg());
    g.apply({ type: 'startWave' });
    killAll(g);
    g.apply({ type: 'startWave' });
    killAll(g);
    expect(g.phase).toBe('won');
    expect(g.apply({ type: 'startWave' }).ok).toBe(false);
  });
});

describe('웨이브 데이터', () => {
  it('웨이브는 20개이고 마지막 웨이브에 보스가 있다', async () => {
    const { WAVES } = await import('../src/data/waves');
    expect(WAVES.length).toBe(20);
    expect(WAVES[19].groups.some((g) => g.enemy === 'boss')).toBe(true);
    // 체력 배율은 계속 늘어난다
    for (let i = 1; i < WAVES.length; i++) expect(WAVES[i].hpMul).toBeGreaterThan(WAVES[i - 1].hpMul);
  });

  it('보스는 주기적으로 졸개를 소환한다', () => {
    const g = new Game(cfg());
    g.apply({ type: 'startWave' });
    g.enemies = [];
    g.spawnEnemy('boss', 100);
    g.update(6.1);
    expect(g.enemies.filter((e) => e.def.id === 'goo').length).toBeGreaterThanOrEqual(3);
  });
});

describe('난이도', () => {
  it('어려울수록 적 체력이 높고 시작 자원이 적다', () => {
    const easy = new Game({ ...defaultConfig('easy'), seed: 1 });
    const hell = new Game({ ...defaultConfig('hell'), seed: 1 });
    expect(hell.spawnEnemy('goo').hp).toBeGreaterThan(easy.spawnEnemy('goo').hp);
    expect(hell.hp).toBeLessThan(easy.hp);
    expect(hell.money).toBeLessThanOrEqual(easy.money);
  });
});
