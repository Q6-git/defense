// 효과음. 음원 파일 없이 Web Audio로 즉석에서 합성한다.
// 같은 소리가 한 프레임에 수십 번 겹치지 않도록 소리마다 최소 간격을 둔다.

type Wave = OscillatorType;

interface Tone {
  wave: Wave;
  from: number;
  to: number;
  dur: number;
  vol: number;
  noise?: boolean;
  delay?: number;
}

const SOUNDS = {
  shoot: { gap: 0.06, tones: [{ wave: 'square', from: 660, to: 330, dur: 0.06, vol: 0.05 }] },
  vacuum: { gap: 0.09, tones: [{ wave: 'sawtooth', from: 220, to: 180, dur: 0.05, vol: 0.03 }] },
  snipe: { gap: 0.1, tones: [{ wave: 'square', from: 1600, to: 200, dur: 0.18, vol: 0.08, noise: true }] },
  beam: { gap: 0.15, tones: [{ wave: 'sawtooth', from: 90, to: 110, dur: 0.15, vol: 0.03 }] },
  hit: { gap: 0.05, tones: [{ wave: 'triangle', from: 300, to: 120, dur: 0.05, vol: 0.05 }] },
  crit: { gap: 0.08, tones: [{ wave: 'square', from: 900, to: 1400, dur: 0.08, vol: 0.06 }] },
  blast: { gap: 0.1, tones: [{ wave: 'sine', from: 160, to: 40, dur: 0.25, vol: 0.18, noise: true }] },
  pulse: { gap: 0.15, tones: [{ wave: 'sine', from: 500, to: 700, dur: 0.12, vol: 0.03 }] },
  pop: { gap: 0.04, tones: [{ wave: 'sine', from: 520, to: 980, dur: 0.07, vol: 0.08 }] },
  coin: { gap: 0.08, tones: [{ wave: 'square', from: 988, to: 988, dur: 0.05, vol: 0.04 }, { wave: 'square', from: 1319, to: 1319, dur: 0.12, vol: 0.04, delay: 0.05 }] },
  place: { gap: 0.05, tones: [{ wave: 'triangle', from: 200, to: 500, dur: 0.12, vol: 0.12 }] },
  upgrade: { gap: 0.05, tones: [{ wave: 'triangle', from: 523, to: 523, dur: 0.08, vol: 0.1 }, { wave: 'triangle', from: 659, to: 659, dur: 0.08, vol: 0.1, delay: 0.08 }, { wave: 'triangle', from: 784, to: 784, dur: 0.15, vol: 0.1, delay: 0.16 }] },
  sell: { gap: 0.05, tones: [{ wave: 'triangle', from: 500, to: 200, dur: 0.15, vol: 0.1 }] },
  error: { gap: 0.15, tones: [{ wave: 'square', from: 140, to: 120, dur: 0.15, vol: 0.06 }] },
  leak: { gap: 0.1, tones: [{ wave: 'sawtooth', from: 200, to: 60, dur: 0.35, vol: 0.15 }] },
  wave: { gap: 0.3, tones: [{ wave: 'square', from: 392, to: 392, dur: 0.1, vol: 0.07 }, { wave: 'square', from: 523, to: 523, dur: 0.2, vol: 0.07, delay: 0.1 }] },
  boss: { gap: 0.5, tones: [{ wave: 'sawtooth', from: 110, to: 55, dur: 0.9, vol: 0.18 }, { wave: 'sawtooth', from: 116, to: 58, dur: 0.9, vol: 0.12 }] },
  plunger: { gap: 0.1, tones: [{ wave: 'sine', from: 120, to: 30, dur: 0.4, vol: 0.3, noise: true }] },
  overload: { gap: 0.1, tones: [{ wave: 'sawtooth', from: 200, to: 1200, dur: 0.5, vol: 0.08 }] },
  clear: { gap: 0.3, tones: [{ wave: 'triangle', from: 659, to: 659, dur: 0.1, vol: 0.1 }, { wave: 'triangle', from: 880, to: 880, dur: 0.25, vol: 0.1, delay: 0.1 }] },
  win: { gap: 1, tones: [523, 659, 784, 1047].map((f, i) => ({ wave: 'triangle' as Wave, from: f, to: f, dur: 0.25, vol: 0.12, delay: i * 0.15 })) },
  lose: { gap: 1, tones: [392, 330, 262, 196].map((f, i) => ({ wave: 'triangle' as Wave, from: f, to: f, dur: 0.3, vol: 0.12, delay: i * 0.2 })) },
} satisfies Record<string, { gap: number; tones: Tone[] }>;

export type SoundId = keyof typeof SOUNDS;

const MUTE_KEY = 'appliance-defense.muted';

class Sfx {
  private ctx: AudioContext | null = null;
  private last = new Map<SoundId, number>();
  muted = readMuted();

  /** 브라우저 정책상 첫 터치/클릭 이후에만 소리를 낼 수 있다 */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* 무시 */
    }
    return this.muted;
  }

  play(id: SoundId): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const s = SOUNDS[id];
    if (now - (this.last.get(id) ?? -1) < s.gap) return;
    this.last.set(id, now);
    for (const t of s.tones as Tone[]) {
      const start = now + (t.delay ?? 0);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(t.vol, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.to), start + t.dur);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + t.dur + 0.02);
      if (t.noise) this.noise(ctx, start, t.dur, t.vol * 0.6);
    }
  }

  private noise(ctx: AudioContext, start: number, dur: number, vol: number): void {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(ctx.destination);
    src.start(start);
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const sfx = new Sfx();
