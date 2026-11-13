import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, emptyProgress, evaluate, type RunStats } from '../src/achievements';

const run = (over: Partial<RunStats> = {}): RunStats => ({
  map: 'kitchen', difficulty: 'normal', endless: false, cleared: 20,
  placed: ['toaster', 'fan', 'washer'], usedSkill: true, leaked: true, cards: 3, ...over,
});
const ids = (r: RunStats, p = emptyProgress()) => evaluate(r, p).map((a) => a.id);

describe('업적', () => {
  it('맵을 클리어하면 그 맵의 업적만 달성된다', () => {
    expect(ids(run())).toEqual(['clear_kitchen']);
    expect(ids(run({ map: 'balcony' }))).toEqual(['clear_balcony']);
    expect(ids(run({ cleared: 19 }))).toEqual([]);
  });

  it('지옥을 깨면 어려움 업적도 함께 달성된다', () => {
    expect(ids(run({ difficulty: 'hell' }))).toEqual(['clear_kitchen', 'clear_hard', 'clear_hell']);
  });

  it('제한형 업적은 조건을 지켜야 하고, 쉬움에서는 달성되지 않는다', () => {
    const clean = { placed: ['toaster', 'fan'], usedSkill: false, leaked: false, cards: 0 };
    expect(ids(run(clean))).toEqual(['clear_kitchen', 'no_washer', 'flawless', 'no_skill', 'no_cards']);
    expect(ids(run({ ...clean, difficulty: 'easy' }))).toEqual(['clear_kitchen']);
  });

  it('토스터만으로 10웨이브, 무한 30웨이브', () => {
    expect(ids(run({ cleared: 10, placed: ['toaster'] }))).toEqual(['toaster_only']);
    expect(ids(run({ cleared: 10, placed: ['toaster', 'fan'] }))).toEqual([]);
    expect(ids(run({ cleared: 30, endless: true }))).toContain('endless_30');
    expect(ids(run({ cleared: 30, endless: false }))).not.toContain('endless_30');
  });

  it('누적형 업적과 진행도', () => {
    const p = { ...emptyProgress(), kills: 999, legends: ['a', 'b', 'c', 'd', 'e'] };
    expect(ids(run({ cleared: 0 }), p)).toEqual(['legends_5']);
    p.kills = 1000;
    expect(ids(run({ cleared: 0 }), p)).toEqual(['kills_1000']);
    expect(ACHIEVEMENTS.find((a) => a.id === 'branches_12')!.progress!(p)).toEqual([0, 12]);
  });

  it('한 번 달성한 업적은 다시 달성되지 않고, 보상 부품이 쌓인다', () => {
    const p = emptyProgress();
    evaluate(run(), p);
    expect(p.parts).toBe(50);
    expect(evaluate(run(), p)).toEqual([]);
    expect(p.parts).toBe(50);
  });

  it('업적은 14개이고 id가 겹치지 않는다', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(14);
  });
});
