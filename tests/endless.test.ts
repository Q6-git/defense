import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import { endlessWave, WAVES } from '../src/data/waves';

/** 스폰된 적을 즉시 치워 웨이브를 끝낸다 */
function clear(g: Game) {
  g.update(0.05);
  g.enemies = [];
  (g as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
  g.update(0.05);
}

describe('무한 모드', () => {
  it('일반 모드는 20웨이브에서 끝난다', () => {
    const g = new Game({ ...defaultConfig('normal'), seed: 1 });
    g.wave = 19;
    g.apply({ type: 'startWave' });
    clear(g);
    expect(g.phase).toBe('won');
    expect(g.wavePreview(21)).toEqual([]);
  });

  it('무한 모드는 20웨이브 뒤에도 계속된다', () => {
    const g = new Game({ ...defaultConfig('normal', true), seed: 1 });
    g.wave = 19;
    g.apply({ type: 'startWave' });
    clear(g);
    expect(g.phase).toBe('intermission');
    expect(g.apply({ type: 'startWave' }).ok).toBe(true);
    expect(g.wave).toBe(21);
  });

  it('승리 화면에서 계속 버티기를 누르면 무한 모드로 이어진다', () => {
    const g = new Game({ ...defaultConfig('normal'), seed: 1 });
    expect(g.apply({ type: 'continueEndless' }).ok).toBe(false); // 이기기 전에는 안 됨
    g.wave = 19;
    g.apply({ type: 'startWave' });
    clear(g);
    expect(g.apply({ type: 'continueEndless' }).ok).toBe(true);
    expect(g.endless).toBe(true);
    expect(g.phase).toBe('intermission');
    g.update(g.cfg.intermission + 0.1);
    expect(g.wave).toBe(21);
  });

  it('생성 웨이브는 매번 같고, 점점 세지고, 10웨이브마다 보스가 늘어난다', () => {
    expect(endlessWave(27)).toEqual(endlessWave(27));
    expect(endlessWave(30).hpMul).toBeGreaterThan(WAVES[19].hpMul);
    const bosses = (n: number) => endlessWave(n).groups.filter((x) => x.enemy === 'boss').reduce((a, x) => a + x.count, 0);
    expect(bosses(29)).toBe(0);
    expect(bosses(30)).toBe(1);
    expect(bosses(40)).toBe(2);
    const size = (n: number) => endlessWave(n).groups.reduce((a, x) => a + x.count, 0);
    expect(size(35)).toBeGreaterThan(size(25));
  });
});
