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
    expect(g.money).toBe(money + 25);
    expect(g.timer).toBeCloseTo(15, 0);
  });

  it('대기 시간이 끝나면 다음 웨이브가 자동으로 시작된다', () => {
    const g = new Game(cfg());
    g.apply({ type: 'startWave' });
    killAll(g);
    g.update(15.1);
    expect(g.wave).toBe(2);
    expect(g.phase).toBe('wave');
  });

  it('일찍 부르면 남은 시간만큼 보너스를 받는다', () => {
    const g = new Game(cfg());
    g.apply({ type: 'startWave' });
    killAll(g);
    g.update(5);
    const money = g.money;
    const expected = Math.floor(g.timer * 2);
    g.apply({ type: 'startWave' });
    expect(g.money).toBe(money + expected);
    expect(expected).toBeGreaterThan(15);
  });

  it('동전 세탁기는 웨이브가 끝날 때마다 돈을 번다', () => {
    const g = new Game(cfg());
    g.apply({ type: 'place', unit: 'washer', x: 500, y: 240 });
    g.apply({ type: 'startWave' });
    const money = g.money;
    killAll(g);
    expect(g.money).toBe(money + 25 + 30);
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
