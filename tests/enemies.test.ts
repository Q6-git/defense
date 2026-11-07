import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { defaultConfig } from '../src/config';

describe('적 이동과 기지 피해', () => {
  it('웨이브를 시작하면 적이 나와서 경로를 따라 움직인다', () => {
    const g = new Game(defaultConfig());
    expect(g.apply({ type: "startWave" }).ok).toBe(true);
    g.update(0.1);
    expect(g.enemies.length).toBe(1);
    const before = g.enemies[0].dist;
    g.update(1);
    expect(g.enemies[0].dist).toBeGreaterThan(before);
  });

  it('기지에 도착한 적은 남은 체력만큼 피해를 준다', () => {
    const g = new Game(defaultConfig());
    g.apply({ type: "startWave" });
    g.update(0.1);
    const e = g.enemies[0];
    e.hp = 17;
    e.dist = g.path.length - 1;
    g.update(0.1);
    expect(g.hp).toBe(g.cfg.startHp - 17);
    expect(g.enemies.includes(e)).toBe(false);
  });

  it('기지 HP가 0이 되면 게임 오버', () => {
    const g = new Game(defaultConfig());
    g.apply({ type: "startWave" });
    g.update(0.1);
    g.enemies[0].hp = g.cfg.startHp + 1;
    g.enemies[0].dist = g.path.length - 1;
    g.update(0.1);
    expect(g.phase).toBe('over');
    expect(g.drainEvents().some((ev) => ev.type === 'gameOver')).toBe(true);
  });
});
