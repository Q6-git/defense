import { describe, expect, it } from 'vitest';
import { freqOf, midiOf, parseDrums, parseLine, stepSeconds, TRACKS, type TrackId } from '../src/music';
import { ENEMIES } from '../src/data/enemies';

describe('악보 읽기', () => {
  it('음 이름을 MIDI 번호와 주파수로 바꾼다', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('F#3')).toBe(54);
    expect(midiOf('Bb4')).toBe(70);
    expect(freqOf(69)).toBe(440);
    expect(freqOf(81)).toBeCloseTo(880);
    expect(() => midiOf('H4')).toThrow();
  });

  it("음 이름은 새 음, '-'는 늘이기, '.'은 쉼표", () => {
    expect(parseLine('C4 - E4 . G4 - - -')).toEqual([
      { step: 0, midi: 60, len: 4 },
      { step: 4, midi: 64, len: 2 },
      { step: 8, midi: 67, len: 8 },
    ]);
    // 둘째 마디는 16칸 뒤에서 시작하고, 쉼표 뒤의 '-'는 아무것도 늘이지 않는다
    expect(parseLine('C4 . . . | . - D4 -')).toEqual([{ step: 0, midi: 60, len: 4 }, { step: 24, midi: 62, len: 8 }]);
    expect(() => parseLine('C4 D4 E4')).toThrow();
  });

  it("드럼은 마디마다 16칸, 'x'가 치는 칸", () => {
    expect(parseDrums('x...x...x...x...|....x.......x...')).toEqual([0, 4, 8, 12, 20, 28]);
    expect(() => parseDrums('x...')).toThrow();
  });
});

describe('배경음 4곡', () => {
  const ids = Object.keys(TRACKS) as TrackId[];

  it('시작 화면, 웨이브, 보스, 「L을 가져가!」', () => {
    expect(ids.sort()).toEqual(['boss', 'dancer', 'menu', 'wave']);
  });

  it.each(ids)('%s: 모든 음이 곡 길이 안에 있고, 들리는 음역이다', (id) => {
    const t = TRACKS[id];
    expect(t.steps % 16).toBe(0);
    expect(t.lead.length).toBeGreaterThan(20);
    expect(t.bass.length).toBeGreaterThan(8);
    for (const n of [...t.lead, ...t.bass, ...t.arp]) {
      expect(n.step).toBeGreaterThanOrEqual(0);
      expect(n.step + n.len).toBeLessThanOrEqual(t.steps);
      expect(n.midi).toBeGreaterThanOrEqual(33); // A1
      expect(n.midi).toBeLessThanOrEqual(96); // C7
    }
    for (const s of [...t.kick, ...t.snare, ...t.hat]) expect(s).toBeLessThan(t.steps);
    // 가락은 한 번에 한 음 (겹치지 않는다)
    const lead = [...t.lead].sort((a, b) => a.step - b.step);
    for (let i = 1; i < lead.length; i++) expect(lead[i].step).toBeGreaterThanOrEqual(lead[i - 1].step + lead[i - 1].len);
  });

  it('「L을 가져가!」 곡의 두 박이 보스의 춤 한 박자(0.8초)와 같다', () => {
    const twoBeats = stepSeconds(TRACKS.dancer) * 8;
    expect(twoBeats).toBeCloseTo(ENEMIES.dancer.dance!.beat);
  });

  it('보스 곡이 웨이브 곡보다 빠르고, 시작 화면 곡이 가장 느리다', () => {
    expect(TRACKS.boss.bpm).toBeGreaterThan(TRACKS.wave.bpm);
    expect(TRACKS.wave.bpm).toBeGreaterThan(TRACKS.menu.bpm);
  });
});
