// 효과음과 배경음. 음원 파일 없이 Web Audio로 즉석에서 합성한다.
// 효과음: 여러 음과 잡음을 겹쳐 만든다. 같은 소리가 한 프레임에 수십 번 겹치지 않도록 소리마다 최소 간격을 둔다.
// 배경음: music.ts의 악보를 조금씩 앞서 예약해 가며 연주한다.
import { freqOf, stepSeconds, TRACKS, type Note, type Track, type TrackId } from './music';

type Wave = OscillatorType;

/** 음 하나: from → to로 미끄러지며 dur초 동안 울린다 */
interface Tone {
  wave: Wave;
  from: number;
  to: number;
  dur: number;
  vol: number;
  delay?: number;
  /** 소리가 차오르는 시간(초). 없으면 바로 난다 */
  attack?: number;
  /** 이 주파수 위를 깎아 부드럽게 한다 */
  lowpass?: number;
}

/** 잡음 한 덩이: 걸러서 바람·타격·폭발 느낌을 낸다 */
interface Burst {
  dur: number;
  vol: number;
  delay?: number;
  filter: BiquadFilterType;
  freq: number;
  /** 걸러 내는 주파수가 dur 동안 여기까지 움직인다 */
  freqTo?: number;
  q?: number;
}

interface Sound {
  /** 같은 소리를 다시 낼 수 있을 때까지의 최소 간격(초) */
  gap: number;
  tones?: Tone[];
  bursts?: Burst[];
}

/** 음 이름 대신 쓰는 주파수 */
const N = { G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, Fs5: 740, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568 };

/** 같은 길이의 음을 차례로 낸다 (짧은 가락) */
const tune = (wave: Wave, notes: number[], each: number, vol: number, hold = 1.1, lowpass?: number): Tone[] =>
  notes.map((f, i) => ({ wave, from: f, to: f, dur: each * hold, vol, delay: i * each, lowpass }));

const SOUNDS = {
  // ── 가전 공격
  shoot: { gap: 0.06, tones: [{ wave: 'triangle', from: 540, to: 190, dur: 0.07, vol: 0.09 }], bursts: [{ dur: 0.03, vol: 0.05, filter: 'bandpass', freq: 2200, q: 1 }] },
  vacuum: { gap: 0.09, tones: [{ wave: 'sawtooth', from: 190, to: 140, dur: 0.06, vol: 0.09, lowpass: 900 }], bursts: [{ dur: 0.06, vol: 0.06, filter: 'bandpass', freq: 1300, q: 2 }] },
  snipe: {
    gap: 0.1,
    tones: [{ wave: 'square', from: 1900, to: 160, dur: 0.16, vol: 0.06, lowpass: 3500 }, { wave: 'sine', from: 95, to: 40, dur: 0.18, vol: 0.16 }],
    bursts: [{ dur: 0.12, vol: 0.07, filter: 'highpass', freq: 2500 }],
  },
  beam: { gap: 0.15, tones: [{ wave: 'sawtooth', from: 96, to: 112, dur: 0.16, vol: 0.08, lowpass: 700 }, { wave: 'sine', from: 384, to: 448, dur: 0.16, vol: 0.035 }] },
  hit: { gap: 0.05, tones: [{ wave: 'triangle', from: 340, to: 130, dur: 0.05, vol: 0.1 }], bursts: [{ dur: 0.03, vol: 0.06, filter: 'bandpass', freq: 900, q: 1 }] },
  crit: {
    gap: 0.08,
    tones: [{ wave: 'square', from: 880, to: 1320, dur: 0.07, vol: 0.05, lowpass: 4000 }, { wave: 'triangle', from: 1760, to: 1760, dur: 0.12, vol: 0.05, delay: 0.03 }],
    bursts: [{ dur: 0.04, vol: 0.04, filter: 'highpass', freq: 4000 }],
  },
  blast: { gap: 0.1, tones: [{ wave: 'sine', from: 150, to: 35, dur: 0.3, vol: 0.22 }], bursts: [{ dur: 0.3, vol: 0.14, filter: 'lowpass', freq: 900, freqTo: 150 }] },
  pulse: { gap: 0.15, tones: [{ wave: 'sine', from: 400, to: 620, dur: 0.14, vol: 0.06 }], bursts: [{ dur: 0.18, vol: 0.08, filter: 'bandpass', freq: 400, freqTo: 1100, q: 1.5 }] },
  // ── 처치와 돈
  pop: { gap: 0.04, tones: [{ wave: 'sine', from: 480, to: 960, dur: 0.06, vol: 0.08 }, { wave: 'triangle', from: 1440, to: 1440, dur: 0.05, vol: 0.03, delay: 0.03 }] },
  coin: {
    gap: 0.08,
    tones: [
      { wave: 'square', from: N.B5, to: N.B5, dur: 0.05, vol: 0.06, lowpass: 5000 },
      { wave: 'square', from: N.E6, to: N.E6, dur: 0.16, vol: 0.06, delay: 0.05, lowpass: 5000 },
      { wave: 'sine', from: N.E6 * 2, to: N.E6 * 2, dur: 0.14, vol: 0.02, delay: 0.05 },
    ],
  },
  // ── 조작
  place: { gap: 0.05, tones: [{ wave: 'triangle', from: 220, to: 520, dur: 0.1, vol: 0.11 }, { wave: 'sine', from: 110, to: 70, dur: 0.09, vol: 0.14 }], bursts: [{ dur: 0.05, vol: 0.05, filter: 'lowpass', freq: 800 }] },
  upgrade: { gap: 0.05, tones: [...tune('triangle', [N.C5, N.E5, N.G5, N.C6], 0.07, 0.09, 1.6), ...tune('sine', [N.C6, N.E6, N.G6, N.C6 * 2], 0.07, 0.025, 1.6)] },
  sell: { gap: 0.05, tones: [{ wave: 'triangle', from: 520, to: 220, dur: 0.13, vol: 0.09 }, { wave: 'square', from: N.B5, to: N.B5, dur: 0.1, vol: 0.025, delay: 0.1, lowpass: 5000 }] },
  error: { gap: 0.15, tones: [{ wave: 'square', from: 150, to: 120, dur: 0.08, vol: 0.06, lowpass: 700 }, { wave: 'square', from: 130, to: 100, dur: 0.12, vol: 0.06, delay: 0.1, lowpass: 700 }] },
  // ── 판 흐름
  leak: { gap: 0.1, tones: [{ wave: 'sawtooth', from: 220, to: 55, dur: 0.4, vol: 0.13, lowpass: 1000 }], bursts: [{ dur: 0.3, vol: 0.08, filter: 'lowpass', freq: 500 }] },
  wave: { gap: 0.3, tones: tune('square', [N.G4, N.C5, N.E5], 0.09, 0.06, 1.8, 2400) },
  boss: {
    gap: 0.5,
    tones: [{ wave: 'sawtooth', from: 110, to: 55, dur: 0.9, vol: 0.15, lowpass: 900 }, { wave: 'sawtooth', from: 116, to: 58, dur: 0.9, vol: 0.1, lowpass: 900 }, { wave: 'sine', from: 55, to: 30, dur: 1.0, vol: 0.2 }],
    bursts: [{ dur: 0.8, vol: 0.08, filter: 'lowpass', freq: 400 }],
  },
  plunger: {
    gap: 0.1,
    tones: [{ wave: 'sine', from: 130, to: 28, dur: 0.4, vol: 0.3 }, { wave: 'triangle', from: 300, to: 620, dur: 0.12, vol: 0.08, delay: 0.1 }],
    bursts: [{ dur: 0.25, vol: 0.16, filter: 'lowpass', freq: 700, freqTo: 120 }],
  },
  overload: {
    gap: 0.1,
    tones: [{ wave: 'sawtooth', from: 200, to: 1400, dur: 0.5, vol: 0.06, lowpass: 3000 }, { wave: 'square', from: 400, to: 2800, dur: 0.5, vol: 0.02 }],
    bursts: [{ dur: 0.5, vol: 0.05, filter: 'highpass', freq: 800, freqTo: 6000 }],
  },
  clear: { gap: 0.3, tones: [...tune('triangle', [N.E5, N.A5, N.E6], 0.09, 0.09, 2.2), { wave: 'sine', from: N.A5 * 2, to: N.A5 * 2, dur: 0.3, vol: 0.02, delay: 0.18 }] },
  win: { gap: 1, tones: [...tune('triangle', [N.C5, N.E5, N.G5, N.C6], 0.15, 0.11, 1.9), ...tune('triangle', [N.E5, N.G5, N.C6, N.E6], 0.15, 0.06, 1.9), { wave: 'sine', from: 131, to: 131, dur: 0.9, vol: 0.12 }] },
  lose: { gap: 1, tones: [...tune('triangle', [392, 330, 262, 196], 0.2, 0.11, 1.6), { wave: 'sine', from: 98, to: 49, dur: 1.0, vol: 0.14, delay: 0.6 }] },
  // ── 밈
  /** 「L을 가져가!」의 L 포즈: 놀리는 가락 (솔-미-라-솔-미) */
  taunt: { gap: 0.6, tones: [...tune('square', [N.C5, N.A4, N.D5, N.C5, N.A4], 0.1, 0.06, 0.9, 3000), ...tune('triangle', [N.C6, N.A5, N.D5 * 2, N.C6, N.A5], 0.1, 0.03, 0.9)] },
  /** 67: 낮은 음(6)과 높은 음(7)이 번갈아, 화면의 숫자가 오르내리는 박자(0.23초)에 맞춘다. 끝은 둘이 함께 */
  sixseven: {
    gap: 1,
    tones: [
      ...tune('triangle', [N.A4, N.D5, N.A4, N.D5], 0.23, 0.11, 0.8),
      ...tune('square', [N.A4, N.D5, N.A4, N.D5], 0.23, 0.03, 0.8, 2500),
      { wave: 'triangle', from: N.A4, to: N.A4, dur: 0.5, vol: 0.08, delay: 0.92 },
      { wave: 'triangle', from: N.D5, to: N.D5, dur: 0.5, vol: 0.08, delay: 0.92 },
      { wave: 'triangle', from: N.Fs5, to: N.Fs5 * 1.5, dur: 0.5, vol: 0.06, delay: 0.92 },
    ],
  },
} satisfies Record<string, Sound>;

export type SoundId = keyof typeof SOUNDS;

const MUTE_KEY = 'appliance-defense.muted';
const VOLUME_KEY = { sfx: 'appliance-defense.sfxVol', bgm: 'appliance-defense.bgmVol' };
export type Channel = keyof typeof VOLUME_KEY;
/** 음량 단계 (설정 화면에서 한 칸씩 움직인다) */
export const VOLUME_STEPS = 5;
const DEFAULT_VOLUME: Record<Channel, number> = { sfx: 0.8, bgm: 0.6 };
/** 배경음은 효과음 뒤에 깔리도록 작게 */
const BGM_LEVEL = 0.5;
/** 악보를 이만큼 앞서 예약한다(초) */
const LOOKAHEAD = 0.25;
/** 곡이 바뀔 때 앞 곡이 잦아드는 시간(초) */
const FADE = 0.5;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: Record<Channel, GainNode> | null = null;
  private white: AudioBuffer | null = null;
  private last = new Map<SoundId, number>();
  muted = readFlag(MUTE_KEY);
  private volumes: Record<Channel, number> = { sfx: readVolume('sfx'), bgm: readVolume('bgm') };

  // 배경음 상태
  private want: TrackId | null = null;
  private calm = false;
  private playing: { id: TrackId; track: Track; out: GainNode; step: number; time: number } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** 브라우저 정책상 첫 터치/클릭 이후에만 소리를 낼 수 있다 */
  unlock(): void {
    if (!this.ctx) {
      try {
        const ctx = new AudioContext();
        this.ctx = ctx;
        // 소리가 겹쳐도 찢어지지 않게 마지막에 눌러 준다
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.ratio.value = 6;
        limiter.connect(ctx.destination);
        this.master = ctx.createGain();
        this.master.connect(limiter);
        this.bus = { sfx: ctx.createGain(), bgm: ctx.createGain() };
        this.bus.sfx.connect(this.master);
        this.bus.bgm.connect(this.master);
        this.white = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = this.white.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.applyVolumes();
        // 탭을 벗어나면 소리를 멈춘다 (배경음이 혼자 계속 나지 않게)
        document.addEventListener('visibilitychange', () => void (document.hidden ? ctx.suspend() : ctx.resume()));
        this.timer = setInterval(() => this.pump(), 60);
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    store(MUTE_KEY, this.muted ? '1' : '0');
    this.applyVolumes();
    return this.muted;
  }

  /** 음량 0~1 */
  volume(ch: Channel): number {
    return this.volumes[ch];
  }

  setVolume(ch: Channel, v: number): void {
    this.volumes[ch] = Math.min(1, Math.max(0, Math.round(v * VOLUME_STEPS) / VOLUME_STEPS));
    store(VOLUME_KEY[ch], String(this.volumes[ch]));
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.bus) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.02);
    this.bus.sfx.gain.setTargetAtTime(this.volumes.sfx, now, 0.02);
    this.bus.bgm.gain.setTargetAtTime(this.volumes.bgm * BGM_LEVEL, now, 0.02);
  }

  play(id: SoundId): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || !this.bus || ctx.state !== 'running' || this.volumes.sfx <= 0) return;
    const now = ctx.currentTime;
    const s: Sound = SOUNDS[id];
    if (now - (this.last.get(id) ?? -1) < s.gap) return;
    this.last.set(id, now);
    for (const t of s.tones ?? []) this.tone(t, now + (t.delay ?? 0), this.bus.sfx);
    for (const b of s.bursts ?? []) this.burst(b, now + (b.delay ?? 0), this.bus.sfx);
  }

  private tone(t: Tone, start: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const attack = t.attack ?? 0.004;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(t.vol, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(t.dur, attack + 0.01));
    const osc = ctx.createOscillator();
    osc.type = t.wave;
    osc.frequency.setValueAtTime(t.from, start);
    if (t.to !== t.from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.to), start + t.dur);
    let node: AudioNode = osc;
    if (t.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = t.lowpass;
      node.connect(f);
      node = f;
    }
    node.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + t.dur + 0.03);
  }

  private burst(b: Burst, start: number, out: AudioNode): void {
    const ctx = this.ctx!;
    if (!this.white) return;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = b.filter;
    f.frequency.setValueAtTime(b.freq, start);
    if (b.freqTo) f.frequency.exponentialRampToValueAtTime(b.freqTo, start + b.dur);
    if (b.q) f.Q.value = b.q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(b.vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + b.dur);
    src.connect(f).connect(gain).connect(out);
    // 잡음 버퍼의 아무 데서나 시작해 매번 조금씩 다르게 들리게 한다
    src.start(start, Math.random() * 0.9);
    src.stop(start + b.dur + 0.02);
  }

  // ───────────────────────── 배경음

  /**
   * 틀 곡을 정한다 (null이면 끈다). 같은 곡이면 이어서 연주한다.
   * calm: 드럼과 가락을 빼고 잔잔하게 (웨이브 사이 대기 중)
   */
  music(id: TrackId | null, calm = false): void {
    this.want = id;
    this.calm = calm;
  }

  /** 지금 연주 중인 곡 (테스트·디버그용) */
  get nowPlaying(): TrackId | null {
    return this.playing?.id ?? null;
  }

  /** 악보를 조금씩 앞서 예약한다. 일정 간격으로 불린다 */
  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (this.playing && this.playing.id !== this.want) {
      // 곡이 바뀌거나 꺼지면 지금 곡은 잦아든다
      const old = this.playing.out;
      old.gain.setTargetAtTime(0, now, FADE / 3);
      setTimeout(() => old.disconnect(), FADE * 1000 * 2);
      this.playing = null;
    }
    if (!this.playing && this.want) {
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, now);
      out.gain.exponentialRampToValueAtTime(1, now + 0.3);
      out.connect(this.bus.bgm);
      this.playing = { id: this.want, track: TRACKS[this.want], out, step: 0, time: now + 0.08 };
    }
    const p = this.playing;
    if (!p) return;
    // 탭이 멈췄다 돌아오면 밀린 만큼 한꺼번에 울리지 않게 지금 시각으로 당긴다
    if (p.time < now) p.time = now + 0.05;
    const dt = stepSeconds(p.track);
    while (p.time < now + LOOKAHEAD) {
      this.scheduleStep(p.track, p.step, p.time, dt, p.out);
      p.step = (p.step + 1) % p.track.steps;
      p.time += dt;
    }
  }

  private scheduleStep(tr: Track, step: number, at: number, dt: number, out: AudioNode): void {
    const at16 = (list: Note[]) => list.filter((n) => n.step === step);
    for (const n of at16(tr.bass)) {
      const f = freqOf(n.midi);
      this.tone({ wave: 'triangle', from: f, to: f, dur: n.len * dt * 0.95, vol: this.calm ? 0.14 : 0.2, lowpass: 900 }, at, out);
    }
    for (const n of at16(tr.arp)) {
      const f = freqOf(n.midi);
      this.tone({ wave: 'sine', from: f, to: f, dur: n.len * dt * 1.4, vol: this.calm ? 0.07 : 0.05, attack: 0.01 }, at, out);
    }
    if (this.calm) return;
    for (const n of at16(tr.lead)) {
      const f = freqOf(n.midi);
      // 네모·톱니파는 귀에 세게 들려서 작게, 그리고 위쪽을 깎는다
      const soft = tr.leadWave === 'triangle';
      this.tone({ wave: tr.leadWave, from: f, to: f, dur: Math.max(0.08, n.len * dt * 0.92), vol: soft ? 0.16 : 0.075, attack: 0.008, lowpass: soft ? undefined : 2600 }, at, out);
    }
    if (tr.kick.includes(step)) this.tone({ wave: 'sine', from: 150, to: 42, dur: 0.14, vol: 0.32 }, at, out);
    if (tr.snare.includes(step)) {
      this.burst({ dur: 0.12, vol: 0.13, filter: 'bandpass', freq: 1800, q: 0.8 }, at, out);
      this.tone({ wave: 'triangle', from: 220, to: 140, dur: 0.07, vol: 0.08 }, at, out);
    }
    if (tr.hat.includes(step)) this.burst({ dur: 0.035, vol: 0.05, filter: 'highpass', freq: 7000 }, at, out);
  }

  /** 개발용: 최종 출력 크기를 잴 수 있게 분석기를 붙인다 */
  debugAnalyser(): AnalyserNode | null {
    if (!this.ctx || !this.master) return null;
    const a = this.ctx.createAnalyser();
    this.master.connect(a);
    return a;
  }

  /** 배경음 예약을 멈춘다 (테스트 정리용) */
  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 무시 */
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function readVolume(ch: Channel): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY[ch]);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_VOLUME[ch];
  } catch {
    return DEFAULT_VOLUME[ch];
  }
}

export const sfx = new Sfx();

/** 효과음 이름 목록 (테스트·디버그용) */
export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];
