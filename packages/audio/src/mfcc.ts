import { fft } from './fft';

export const SAMPLE_RATE = 16000;
const FRAME = 400;
const HOP = 160;
const NFFT = 512;
const FILTERS = 26;
export const MFCC_DIMS = 12;

const hz2mel = (f: number) => 2595 * Math.log10(1 + f / 700);
const mel2hz = (m: number) => 700 * (10 ** (m / 2595) - 1);

let bank: Float64Array[] | null = null;
function filterbank(): Float64Array[] {
  if (bank) return bank;
  const lo = hz2mel(100);
  const hi = hz2mel(SAMPLE_RATE / 2);
  const pts = Array.from({ length: FILTERS + 2 }, (_, i) => Math.floor(((NFFT + 1) * mel2hz(lo + ((hi - lo) * i) / (FILTERS + 1))) / SAMPLE_RATE));
  bank = Array.from({ length: FILTERS }, (_, m) => {
    const f = new Float64Array(NFFT / 2 + 1);
    for (let k = pts[m]!; k < pts[m + 1]!; k++) f[k] = (k - pts[m]!) / Math.max(1, pts[m + 1]! - pts[m]!);
    for (let k = pts[m + 1]!; k < pts[m + 2]!; k++) f[k] = (pts[m + 2]! - k) / Math.max(1, pts[m + 2]! - pts[m + 1]!);
    return f;
  });
  return bank;
}

const window_ = Float64Array.from({ length: FRAME }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
const dct = Array.from({ length: MFCC_DIMS }, (_, i) => Float64Array.from({ length: FILTERS }, (_, j) => Math.cos((Math.PI * (i + 1) * (j + 0.5)) / FILTERS)));

/** MFCC frames (12 coefficients, no c0) at 25 ms with a 10 ms step. Each utterance is mean and variance normalised. */
export function mfcc(samples: Float32Array): Float32Array[] {
  const out: Float32Array[] = [];
  const fb = filterbank();
  const re = new Float64Array(NFFT);
  const im = new Float64Array(NFFT);
  for (let start = 0; start + FRAME <= samples.length; start += HOP) {
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < FRAME; i++) {
      const prev = start + i > 0 ? samples[start + i - 1]! : 0;
      re[i] = (samples[start + i]! - 0.97 * prev) * window_[i]!;
    }
    fft(re, im);
    const logE = new Float64Array(FILTERS);
    for (let m = 0; m < FILTERS; m++) {
      let e = 0;
      for (let k = 0; k <= NFFT / 2; k++) if (fb[m]![k]!) e += fb[m]![k]! * (re[k]! * re[k]! + im[k]! * im[k]!);
      logE[m] = Math.log(e + 1e-10);
    }
    const c = new Float32Array(MFCC_DIMS);
    for (let i = 0; i < MFCC_DIMS; i++) {
      let s = 0;
      for (let j = 0; j < FILTERS; j++) s += dct[i]![j]! * logE[j]!;
      c[i] = s;
    }
    out.push(c);
  }
  return normalise(out);
}

export function normalise(frames: Float32Array[]): Float32Array[] {
  if (frames.length === 0) return frames;
  const d = frames[0]!.length;
  const mean = new Float64Array(d);
  const sq = new Float64Array(d);
  for (const f of frames) for (let i = 0; i < d; i++) mean[i] = mean[i]! + f[i]! / frames.length;
  for (const f of frames) for (let i = 0; i < d; i++) sq[i] = sq[i]! + (f[i]! - mean[i]!) ** 2 / frames.length;
  return frames.map((f) => Float32Array.from(f, (v, i) => (v - mean[i]!) / (Math.sqrt(sq[i]!) + 1e-6)));
}

/** Average the input down to 16 kHz with a box filter. */
export function resampleTo16k(x: Float32Array, rate: number): Float32Array {
  if (rate === SAMPLE_RATE) return x;
  const ratio = rate / SAMPLE_RATE;
  const n = Math.floor(x.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(x.length, Math.max(a + 1, Math.floor((i + 1) * ratio)));
    let s = 0;
    for (let k = a; k < b; k++) s += x[k]!;
    out[i] = s / (b - a);
  }
  return out;
}
