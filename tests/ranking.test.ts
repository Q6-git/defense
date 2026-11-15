import { describe, expect, it } from 'vitest';
import { addRank, RANK_KEEP, rankList, topUnits, type RankEntry } from '../src/ranking';

const entry = (wave: number, extra: Partial<RankEntry> = {}): RankEntry => ({
  name: '나', wave, kills: 0, map: 'kitchen', difficulty: 'normal', at: 0, units: [], ...extra,
});

describe('무한 모드 랭킹', () => {
  it('높은 웨이브가 위, 같으면 더 많이 잡은 쪽', () => {
    let list: RankEntry[] = [];
    for (const e of [entry(30), entry(45), entry(30, { kills: 900 })]) list = addRank(list, e).list;
    expect(rankList(list, 'normal').map((e) => [e.wave, e.kills])).toEqual([[45, 0], [30, 900], [30, 0]]);
  });

  it('난이도마다 상위 10개만 남기고, 밖으로 밀리면 순위 0', () => {
    let list: RankEntry[] = [entry(99, { difficulty: 'hell' })];
    for (let w = 21; w < 21 + RANK_KEEP; w++) list = addRank(list, entry(w)).list;
    const low = addRank(list, entry(20));
    expect(low.rank).toBe(0);
    const top = addRank(list, entry(50));
    expect(top.rank).toBe(1);
    expect(rankList(top.list, 'normal')).toHaveLength(RANK_KEEP);
    // 다른 난이도 기록은 그대로
    expect(rankList(top.list, 'hell')).toHaveLength(1);
  });

  it('가장 많이 설치한 가전 3종', () => {
    expect(topUnits(['fan', 'toaster', 'fan', 'ac', 'toaster', 'fan', 'wifi'])).toEqual(['fan', 'toaster', 'ac']);
  });
});
