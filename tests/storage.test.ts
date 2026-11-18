import { beforeEach, describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { Game } from '../src/core/game';
import { UNIT_ORDER } from '../src/data/units';
import { applyMeta, enhance, enhanceChance } from '../src/meta';
import { loadDeck, loadLang, loadProgress, saveProgress } from '../src/storage';

/** 브라우저 저장소 대신 쓰는 메모리 저장소 */
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});
const KEY = 'appliance-defense.v2.progress';

describe('예전 버전 저장 데이터', () => {
  beforeEach(() => store.clear());

  it('강화·연구가 없던 시절의 진행 상황도 그대로 읽히고, 새 기능에 바로 쓸 수 있다', () => {
    // 언어·강화·연구가 생기기 전의 저장 모양
    store.set(KEY, JSON.stringify({ kills: 1234, legends: ['chain'], branches: ['rapid'], done: ['clear_kitchen'], parts: 500, owned: ['stove'], pity: 7, sixseven: 3, seen: ['goo'], killsBy: { goo: 10 }, placedBy: { toaster: 4 } }));
    const p = loadProgress();
    expect([p.kills, p.parts, p.owned, p.pity]).toEqual([1234, 500, ['stove'], 7]);
    expect([p.mastery, p.masteryFail, p.research]).toEqual([{}, {}, {}]);
    // 판 설정과 강화가 오류 없이 동작한다
    const cfg = applyMeta(defaultConfig(), p, [...UNIT_ORDER]);
    expect(new Game(cfg).levelStats('toaster', 0).damage).toBe(12);
    expect(enhanceChance(p, 'toaster')).toBe(1);
    // 난수를 정해 둔다 (그냥 두면 10% 확률로 대성공이 나와 +2가 된다)
    expect(enhance(p, 'toaster', () => 0.5)?.level).toBe(1);
    saveProgress(p);
    expect(loadProgress().mastery.toaster).toBe(1);
  });

  it('저장된 값이 깨져 있으면 처음 상태로 시작한다', () => {
    store.set(KEY, '{깨진 데이터');
    expect(loadProgress().parts).toBe(0);
    store.set('appliance-defense.v2.deck', '"toaster"');
    expect(loadDeck()).toBeNull();
  });

  it('범위를 벗어난 강화 단계는 0~10으로 다룬다', () => {
    store.set(KEY, JSON.stringify({ parts: 100, mastery: { toaster: 99, fan: -3 } }));
    const p = loadProgress();
    const g = new Game(applyMeta(defaultConfig(), p, [...UNIT_ORDER]));
    expect(g.levelStats('toaster', 0).damage).toBeCloseTo(12 * 1.2);
    expect(g.levelStats('fan', 0).damage).toBe(2);
    expect(enhance(p, 'toaster', () => 0.5)).toBeNull();
  });

  it('언어를 고른 적이 없으면 빈 값 (브라우저 언어를 따른다)', () => {
    expect(loadLang()).toBe('');
  });
});
