import { SAMPLE_RATE } from './mfcc';

/**
 * Energy-based voice activity detection with an adaptive noise floor. This is the fallback path from the plan:
 * a small neural detector is a later swap. It finds speech segments and the timing features used for speech-timing signals.
 */
const FRAME_MS = 20;
const HANG_MS = 240;
const MIN_SPEECH_MS = 120;
const MERGE_GAP_MS = 120;

export interface Segment {
  startMs: number;
  endMs: number;
}

export interface Timing {
  /** Milliseconds from the start of the recording to the first speech. */
  latencyMs: number;
  speechMs: number;
  /** Share of the spoken span (first to last speech) that was silence of 150 ms or more. */
  pauseRatio: number;
  segments: Segment[];
}

export function frameDb(x: Float32Array): number[] {
  const n = Math.floor((SAMPLE_RATE * FRAME_MS) / 1000);
  const out: number[] = [];
  for (let s = 0; s + n <= x.length; s += n) {
    let e = 0;
    for (let i = 0; i < n; i++) e += x[s + i]! * x[s + i]!;
    out.push(10 * Math.log10(e / n + 1e-12));
  }
  return out;
}

export function detectSegments(x: Float32Array, marginDb = 9): Segment[] {
  const db = frameDb(x);
  if (db.length === 0) return [];
  // Noise floor: a low percentile of the recording, so speech does not raise it.
  const sorted = [...db].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.15)]!;
  const threshold = Math.max(floor + marginDb, -52);
  const hang = Math.ceil(HANG_MS / FRAME_MS);
  const flags: boolean[] = new Array(db.length).fill(false);
  let last = -1e9;
  for (let i = 0; i < db.length; i++) {
    if (db[i]! > threshold) last = i;
    flags[i] = i - last <= hang && last >= 0;
  }
  const segs: Segment[] = [];
  let start = -1;
  for (let i = 0; i <= flags.length; i++) {
    if (flags[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      segs.push({ startMs: start * FRAME_MS, endMs: i * FRAME_MS });
      start = -1;
    }
  }
  const merged: Segment[] = [];
  for (const s of segs) {
    const p = merged[merged.length - 1];
    if (p && s.startMs - p.endMs <= MERGE_GAP_MS) p.endMs = s.endMs;
    else merged.push({ ...s });
  }
  return merged.filter((s) => s.endMs - s.startMs >= MIN_SPEECH_MS);
}

export function timingOf(x: Float32Array): Timing | null {
  const segs = detectSegments(x);
  if (segs.length === 0) return null;
  // Trim the trailing hangover so it does not count as speech.
  const speech = segs.reduce((s, g) => s + (g.endMs - g.startMs - HANG_MS / 2), 0);
  const span = segs[segs.length - 1]!.endMs - segs[0]!.startMs;
  let pauses = 0;
  for (let i = 1; i < segs.length; i++) {
    const gap = segs[i]!.startMs - segs[i - 1]!.endMs;
    if (gap >= 150) pauses += gap;
  }
  return { latencyMs: segs[0]!.startMs, speechMs: Math.max(0, speech), pauseRatio: span > 0 ? Math.min(1, pauses / span) : 0, segments: segs };
}

/** Cut the first speech segment to its bounds, with a little padding. */
export function trimToSpeech(x: Float32Array): Float32Array | null {
  const segs = detectSegments(x);
  if (segs.length === 0) return null;
  const a = Math.max(0, Math.floor(((segs[0]!.startMs - 60) / 1000) * SAMPLE_RATE));
  const b = Math.min(x.length, Math.ceil(((segs[segs.length - 1]!.endMs + 40) / 1000) * SAMPLE_RATE));
  return x.slice(a, b);
}
