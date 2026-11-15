import { describe, expect, it } from 'vitest';
import { BESTIARY, firstWave } from '../src/bestiary';
import { ENEMIES } from '../src/data/enemies';
import { STR } from '../src/strings.ko';

describe('몬스터 도감', () => {
  it('모든 몬스터가 도감에 한 번씩 있고, 이름·특징·대응 팁이 있다', () => {
    expect([...BESTIARY].sort()).toEqual(Object.keys(ENEMIES).sort());
    for (const id of BESTIARY) {
      const info = STR.enemies[id];
      expect(info, id).toBeDefined();
      expect(info.name.length, id).toBeGreaterThan(0);
      expect(info.desc.length, id).toBeGreaterThan(5);
      expect(info.tip.length, id).toBeGreaterThan(5);
    }
  });

  it('처음 나오는 웨이브: 초록 점액 1, 식스세븐 7, 까불이 왕자 15, 대왕 20, 작은 방울은 분열 슬라임과 같다', () => {
    expect(firstWave('goo')).toBe(1);
    expect(firstWave('sixseven')).toBe(7);
    expect(firstWave('dancer')).toBe(15);
    expect(firstWave('boss')).toBe(20);
    expect(firstWave('splitling')).toBe(firstWave('splitter'));
    for (const id of BESTIARY) expect(firstWave(id), id).not.toBeNull();
  });
});
