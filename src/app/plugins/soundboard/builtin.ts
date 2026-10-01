import { Sound } from './types';

const RATE = 44100;

type Synth = { seconds: number; render: (ctx: OfflineAudioContext) => void };

const noiseBuffer = (ctx: BaseAudioContext, seconds: number) => {
  const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buf;
};

// One shaped burst of filtered noise, the base of drums, claps and cymbals.
const noiseHit = (
  ctx: OfflineAudioContext,
  at: number,
  decay: number,
  filter: BiquadFilterType,
  freq: number,
  level: number
) => {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, decay + 0.05);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + decay);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(at);
};

const tone = (
  ctx: OfflineAudioContext,
  type: OscillatorType,
  at: number,
  length: number,
  from: number,
  to: number,
  level: number
) => {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + length);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(g).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
};

const SYNTHS: Record<string, Synth> = {
  airhorn: {
    seconds: 1.5,
    render: (ctx) => {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      lp.connect(ctx.destination);
      [
        [0, 0.17],
        [0.24, 0.17],
        [0.48, 0.95],
      ].forEach(([at, len]) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
        g.gain.setValueAtTime(0.22, at + len - 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, at + len);
        g.connect(lp);
        [466, 587, 698].forEach((f) => {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, at);
          osc.frequency.linearRampToValueAtTime(f * 0.97, at + len);
          osc.connect(g);
          osc.start(at);
          osc.stop(at + len);
        });
      });
    },
  },
  badumtss: {
    seconds: 1.4,
    render: (ctx) => {
      tone(ctx, 'sine', 0, 0.16, 190, 90, 0.8);
      tone(ctx, 'sine', 0.2, 0.16, 150, 70, 0.8);
      noiseHit(ctx, 0.42, 0.9, 'highpass', 6000, 0.5);
    },
  },
  ding: {
    seconds: 1.8,
    render: (ctx) => {
      [
        [1318, 0.35],
        [2637, 0.12],
        [3951, 0.05],
      ].forEach(([f, level]) => tone(ctx, 'sine', 0, 1.7, f, f, level));
    },
  },
  sadtrombone: {
    seconds: 2.4,
    render: (ctx) => {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      lp.connect(ctx.destination);
      [
        [0, 0.38, 293.7],
        [0.42, 0.38, 277.2],
        [0.84, 0.38, 261.6],
        [1.26, 1.05, 246.9],
      ].forEach(([at, len, f], i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, at);
        if (i === 3) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 6;
          const depth = ctx.createGain();
          depth.gain.value = 7;
          lfo.connect(depth).connect(osc.frequency);
          lfo.start(at);
          lfo.stop(at + len);
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.3, at + 0.04);
        g.gain.setValueAtTime(0.3, at + len - 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, at + len);
        osc.connect(g).connect(lp);
        osc.start(at);
        osc.stop(at + len);
      });
    },
  },
  boing: {
    seconds: 1,
    render: (ctx) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 260;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 16;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(160, 0);
      depth.gain.exponentialRampToValueAtTime(1, 0.9);
      lfo.connect(depth).connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, 0);
      g.gain.exponentialRampToValueAtTime(0.0001, 0.95);
      osc.connect(g).connect(ctx.destination);
      osc.start(0);
      lfo.start(0);
      osc.stop(1);
      lfo.stop(1);
    },
  },
  applause: {
    seconds: 2.4,
    render: (ctx) => {
      for (let i = 0; i < 90; i += 1) {
        const at = Math.random() * 2;
        const fade = at < 0.3 ? at / 0.3 : Math.min(1, (2.2 - at) / 0.6);
        noiseHit(ctx, at, 0.05, 'bandpass', 1200 + Math.random() * 1400, 0.5 * fade);
      }
    },
  },
  drumroll: {
    seconds: 2.6,
    render: (ctx) => {
      for (let at = 0; at < 1.4; at += 0.05) {
        noiseHit(ctx, at, 0.05, 'bandpass', 2200, 0.1 + (at / 1.4) * 0.35);
      }
      tone(ctx, 'sine', 1.5, 0.3, 120, 60, 0.9);
      noiseHit(ctx, 1.5, 1.05, 'highpass', 5000, 0.6);
    },
  },
  pop: {
    seconds: 0.3,
    render: (ctx) => tone(ctx, 'sine', 0, 0.12, 500, 1400, 0.7),
  },
};

export const BUILTIN_SOUNDS: Sound[] = [
  { id: 'builtin-airhorn', builtin: 'airhorn', name: 'Airhorn', emoji: '📯' },
  { id: 'builtin-badumtss', builtin: 'badumtss', name: 'Ba Dum Tss', emoji: '🥁' },
  { id: 'builtin-ding', builtin: 'ding', name: 'Ding', emoji: '🔔' },
  { id: 'builtin-sadtrombone', builtin: 'sadtrombone', name: 'Sad Trombone', emoji: '🎺' },
  { id: 'builtin-boing', builtin: 'boing', name: 'Boing', emoji: '🦘' },
  { id: 'builtin-applause', builtin: 'applause', name: 'Applause', emoji: '👏' },
  { id: 'builtin-drumroll', builtin: 'drumroll', name: 'Drumroll', emoji: '🥁' },
  { id: 'builtin-pop', builtin: 'pop', name: 'Pop', emoji: '🫧' },
];

// 16-bit mono WAV, so a starter sound travels and decodes like any uploaded file.
const toWav = (buffer: AudioBuffer): ArrayBuffer => {
  const samples = buffer.getChannelData(0);
  const out = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(out);
  const text = (at: number, s: string) =>
    s.split('').forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const v = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  });
  return out;
};

const rendered = new Map<string, Promise<ArrayBuffer>>();

export const renderBuiltin = (name: string): Promise<ArrayBuffer> | undefined => {
  const synth = SYNTHS[name];
  if (!synth) return undefined;
  let job = rendered.get(name);
  if (!job) {
    const ctx = new OfflineAudioContext(1, Math.ceil(synth.seconds * RATE), RATE);
    synth.render(ctx);
    job = ctx.startRendering().then(toWav);
    rendered.set(name, job);
  }
  return job;
};
