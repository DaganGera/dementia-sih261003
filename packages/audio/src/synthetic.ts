import { SAMPLE_RATE } from './mfcc';

/**
 * Speech-like test signals: each "word" is a sequence of two-formant vowels. They are not speech.
 * They let tests and browser checks exercise the voice pipeline without a person or a recording.
 */
export type Formants = Array<[number, number, number]>;

export const WORDS: Record<string, Formants> = {
  anita: [[300, 2300, 140], [700, 1200, 160], [400, 800, 140]],
  ravi: [[800, 1200, 130], [300, 900, 150], [600, 2000, 130]],
  dev: [[500, 1500, 150], [500, 1500, 110], [300, 2500, 150], [800, 1000, 120]],
  market: [[350, 700, 170], [900, 1500, 170]],
  other: [[1000, 3000, 130], [250, 500, 160], [1200, 1800, 140]],
};

export interface Speaker {
  /** Frequency scale, about 1 for the same voice. */
  pitch: number;
  /** Time stretch, above 1 is slower. */
  tempo: number;
  noise: number;
  seed: number;
}

function lcg(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export function renderWord(word: Formants, sp: Speaker, leadMs = 300, tailMs = 400): Float32Array {
  const r = lcg(sp.seed);
  const lead = Math.floor((leadMs / 1000) * SAMPLE_RATE);
  const tail = Math.floor((tailMs / 1000) * SAMPLE_RATE);
  const parts: Float32Array[] = [];
  for (const [f1, f2, ms] of word) {
    const n = Math.floor(((ms * sp.tempo * (0.95 + 0.1 * r())) / 1000) * SAMPLE_RATE);
    const seg = new Float32Array(n);
    const jitter = 1 + (r() - 0.5) * 0.04;
    for (let i = 0; i < n; i++) {
      const env = Math.sin((Math.PI * i) / n) ** 0.5;
      const t = i / SAMPLE_RATE;
      seg[i] = 0.16 * env * (Math.sin(2 * Math.PI * f1 * sp.pitch * jitter * t) + 0.6 * Math.sin(2 * Math.PI * f2 * sp.pitch * jitter * t));
    }
    parts.push(seg);
  }
  const total = lead + parts.reduce((s, p) => s + p.length, 0) + tail;
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) out[i] = (r() - 0.5) * 2 * sp.noise;
  let at = lead;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) out[at + i]! += p[i]!;
    at += p.length;
  }
  return out;
}

export function silence(ms: number, noise = 0.002, seed = 1): Float32Array {
  const r = lcg(seed);
  return Float32Array.from({ length: Math.floor((ms / 1000) * SAMPLE_RATE) }, () => (r() - 0.5) * 2 * noise);
}

export function concat(...xs: Float32Array[]): Float32Array {
  const out = new Float32Array(xs.reduce((s, x) => s + x.length, 0));
  let at = 0;
  for (const x of xs) {
    out.set(x, at);
    at += x.length;
  }
  return out;
}

/** 16-bit mono WAV bytes, used to feed a fake microphone in browser tests. */
export function encodeWav(x: Float32Array, rate = SAMPLE_RATE): Uint8Array {
  const buf = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + x.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i]!)) * 32767, true);
  return new Uint8Array(buf);
}
