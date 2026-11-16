// 배경음 악보. 음원 파일 없이 sfx.ts가 Web Audio로 합성해서 연주한다.
// 여기는 순수 데이터와 악보 읽기만 있어서 테스트할 수 있다 (소리 내는 코드는 sfx.ts).

export type TrackId = 'menu' | 'wave' | 'boss' | 'dancer';

/** 한 음: 시작 칸(16분음표 단위), MIDI 음높이, 길이(칸) */
export interface Note {
  step: number;
  midi: number;
  len: number;
}

export interface Track {
  /** 분당 박자 수 (4분음표 기준) */
  bpm: number;
  /** 전체 길이 (16분음표 칸 수). 끝나면 처음으로 돌아간다 */
  steps: number;
  lead: Note[];
  leadWave: OscillatorType;
  bass: Note[];
  /** 화음 분산음 (잔잔하게 깔린다) */
  arp: Note[];
  /** 드럼이 울리는 칸 */
  kick: number[];
  snare: number[];
  hat: number[];
}

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C4' → 60, 'F#3' → 54, 'Bb4' → 70 */
export function midiOf(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`음 이름이 아니다: ${name}`);
  return NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}

export function freqOf(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 악보 한 줄을 읽는다. 마디는 '|'로, 칸은 공백으로 나눈다.
 * 음 이름(C4)은 새 음, '-'는 앞 음을 늘이기, '.'은 쉼표. 한 마디의 칸 수는 16의 약수(보통 8 = 8분음표).
 */
export function parseLine(line: string): Note[] {
  const out: Note[] = [];
  let last: Note | null = null;
  line.split('|').forEach((bar, b) => {
    const tokens = bar.trim().split(/\s+/);
    if (16 % tokens.length !== 0) throw new Error(`마디 ${b + 1}: 칸 수 ${tokens.length}는 16의 약수가 아니다`);
    const size = 16 / tokens.length;
    tokens.forEach((t, i) => {
      if (t === '-') {
        if (last) last.len += size;
      } else if (t === '.') last = null;
      else {
        last = { step: b * 16 + i * size, midi: midiOf(t), len: size };
        out.push(last);
      }
    });
  });
  return out;
}

/** 드럼 한 줄: 마디마다 16글자, 'x'가 치는 칸 */
export function parseDrums(line: string): number[] {
  const out: number[] = [];
  line.split('|').forEach((bar, b) => {
    const s = bar.trim();
    if (s.length !== 16) throw new Error(`드럼 마디 ${b + 1}: 16칸이어야 한다 (${s.length})`);
    [...s].forEach((c, i) => c === 'x' && out.push(b * 16 + i));
  });
  return out;
}

/** 화음: 근음 이름과 종류 → 세 음 */
function chord(root: string, kind: 'M' | 'm'): number[] {
  const r = midiOf(root);
  return [r, r + (kind === 'M' ? 4 : 3), r + 7];
}

/** 마디마다 화음 하나를 8분음표로 펼친다. pattern은 화음 음 번호(0·1·2), -1은 쉼표 */
function arpeggio(chords: number[][], pattern: number[]): Note[] {
  return chords.flatMap((c, b) => pattern.flatMap((p, i) => (p < 0 ? [] : [{ step: b * 16 + i * 2, midi: c[p], len: 2 }])));
}

/** 마디마다 근음으로 베이스를 깐다. pattern은 근음에서 올리는 반음 수, null은 쉼표 */
function bassline(chords: number[][], pattern: (number | null)[], octave: number): Note[] {
  return chords.flatMap((c, b) => pattern.flatMap((p, i) => (p === null ? [] : [{ step: b * 16 + i * 2, midi: c[0] + octave + p, len: 2 }])));
}

const repeat = (bar: string, n: number) => Array.from({ length: n }, () => bar).join('|');

// ── 시작 화면: 느긋한 다장조
const MENU_CHORDS = [chord('C4', 'M'), chord('A3', 'm'), chord('F3', 'M'), chord('G3', 'M'), chord('C4', 'M'), chord('A3', 'm'), chord('F3', 'M'), chord('G3', 'M')];
// ── 웨이브: 통통 튀는 가단조
const WAVE_CHORDS = [chord('A3', 'm'), chord('F3', 'M'), chord('C4', 'M'), chord('G3', 'M'), chord('A3', 'm'), chord('F3', 'M'), chord('G3', 'M'), chord('E3', 'M')];
// ── 보스(막힌 배수구 대왕): 몰아치는 라단조
const BOSS_CHORDS = [chord('D3', 'm'), chord('D3', 'm'), chord('Bb2', 'M'), chord('A2', 'M'), chord('D3', 'm'), chord('D3', 'm'), chord('G3', 'm'), chord('A2', 'M')];
// ── 「L을 가져가!」: 약 올리는 바장조 춤곡. 150bpm이라 두 박(0.8초)이 이 보스의 춤 한 박자와 같다.
//    가락은 아이들이 놀릴 때 부르는 솔-미-라-솔-미 음형(전래 놀림 가락)으로 지은 것
const DANCER_CHORDS = [chord('F3', 'M'), chord('F3', 'M'), chord('Bb3', 'M'), chord('C4', 'M'), chord('F3', 'M'), chord('F3', 'M'), chord('Bb3', 'M'), chord('C4', 'M')];

export const TRACKS: Record<TrackId, Track> = {
  menu: {
    bpm: 92,
    steps: 128,
    leadWave: 'triangle',
    lead: parseLine(
      'E5 - G5 - C6 - G5 - | A5 - E5 - C5 - E5 - | F5 - A5 - C6 - A5 - | G5 - D5 - B4 - D5 - |'
      + 'E5 G5 C6 - B5 - G5 - | A5 - C6 A5 E5 - - - | F5 A5 G5 F5 E5 - D5 - | D5 - G5 - B4 - . .',
    ),
    bass: bassline(MENU_CHORDS, [0, null, 7, null, 0, null, 7, null], -12),
    arp: arpeggio(MENU_CHORDS, [0, 1, 2, 1, 0, 1, 2, 1]),
    kick: parseDrums(repeat('x.......x.......', 8)),
    snare: [],
    hat: parseDrums(repeat('..x...x...x...x.', 8)),
  },
  wave: {
    bpm: 126,
    steps: 128,
    leadWave: 'square',
    lead: parseLine(
      'A4 C5 E5 C5 A4 C5 E5 - | F5 E5 C5 A4 C5 - A4 - | G4 C5 E5 C5 G5 - E5 - | D5 B4 G4 B4 D5 - - . |'
      + 'A4 C5 E5 A5 G5 E5 C5 - | F5 A5 F5 C5 F5 - C5 - | G5 B5 G5 D5 G5 - D5 - | E5 - G#5 - B5 - E5 .',
    ),
    bass: bassline(WAVE_CHORDS, [0, 0, 12, 0, 0, 0, 12, 0], -12),
    arp: arpeggio(WAVE_CHORDS, [0, 2, 1, 2, 0, 2, 1, 2]),
    kick: parseDrums(repeat('x...x...x...x...', 8)),
    snare: parseDrums(repeat('....x.......x...', 8)),
    hat: parseDrums(repeat('..x...x...x...x.', 8)),
  },
  boss: {
    bpm: 138,
    steps: 128,
    leadWave: 'sawtooth',
    lead: parseLine(
      'D5 - - F5 - - A5 - | D5 - - F5 - - E5 - | D5 - - F5 - - Bb5 - | A5 - - E5 - - C#5 - |'
      + 'D5 F5 A5 D6 - - A5 - | D6 - C6 - A5 - F5 - | G5 - Bb5 - D6 - Bb5 - | A5 - E5 - C#5 - A4 .',
    ),
    bass: bassline(BOSS_CHORDS, [0, 0, 0, 0, 0, 0, 12, 0], -12),
    arp: arpeggio(BOSS_CHORDS, [0, 1, 2, 1, 0, 1, 2, 1]),
    kick: parseDrums(repeat('x..x..x.x..x..x.', 8)),
    snare: parseDrums(repeat('....x.......x..x', 8)),
    hat: parseDrums(repeat('x.x.x.x.x.x.x.x.', 8)),
  },
  dancer: {
    bpm: 150,
    steps: 128,
    leadWave: 'square',
    lead: parseLine(
      'C5 - A4 - D5 C5 A4 - | C5 - A4 - D5 C5 A4 . | D5 - Bb4 - F5 D5 Bb4 - | E5 - C5 - G5 E5 C5 . |'
      + 'C5 - A4 - D5 C5 A4 - | F5 - C5 - A5 F5 C5 . | D5 F5 Bb5 F5 D5 F5 Bb5 - | C6 - G5 - E5 - C5 .',
    ),
    bass: bassline(DANCER_CHORDS, [0, null, 12, null, 0, 0, 12, null], -12),
    arp: arpeggio(DANCER_CHORDS, [-1, 1, -1, 2, -1, 1, -1, 2]),
    kick: parseDrums(repeat('x...x...x...x...', 8)),
    snare: parseDrums(repeat('....x.......x...', 8)),
    hat: parseDrums(repeat('x.x.x.x.x.x.x.x.', 8)),
  },
};

/** 한 칸(16분음표)의 길이(초) */
export function stepSeconds(track: Track): number {
  return 60 / track.bpm / 4;
}
