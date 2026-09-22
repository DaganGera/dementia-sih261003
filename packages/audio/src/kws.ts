import { mfcc, MFCC_DIMS } from './mfcc';
import { trimToSpeech } from './vad';

/**
 * Personal keyword spotting. A person or family member says a word three times; each recording becomes
 * a template of MFCC frames. A new utterance is matched by dynamic time warping. There is no language model,
 * so it works for any language, but it only knows the words that were enrolled, and only for the voices that enrolled them.
 */
export type Template = Float32Array[];

export interface EnrolledWord {
  id: string;
  templates: Template[];
  /** Largest distance seen between two of this word's own templates. */
  spread: number;
}

/** Sakoe-Chiba banded DTW, averaged over the path length. Returns Infinity when the lengths are too different. */
export function dtw(a: Template, b: Template, band = 0.35): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Infinity;
  const w = Math.max(Math.abs(n - m), Math.ceil(Math.max(n, m) * band));
  const INF = 1e18;
  let prevC = new Float64Array(m + 1).fill(INF);
  let curC = new Float64Array(m + 1).fill(INF);
  let prevL = new Int32Array(m + 1);
  let curL = new Int32Array(m + 1);
  prevC[0] = 0;
  for (let i = 1; i <= n; i++) {
    curC.fill(INF);
    curL.fill(0);
    for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) {
      let d = 0;
      for (let k = 0; k < MFCC_DIMS; k++) {
        const t = a[i - 1]![k]! - b[j - 1]![k]!;
        d += t * t;
      }
      d = Math.sqrt(d);
      let best = prevC[j - 1]!;
      let bl = prevL[j - 1]!;
      if (prevC[j]! < best) {
        best = prevC[j]!;
        bl = prevL[j]!;
      }
      if (curC[j - 1]! < best) {
        best = curC[j - 1]!;
        bl = curL[j - 1]!;
      }
      curC[j] = best + d;
      curL[j] = bl + 1;
    }
    [prevC, curC] = [curC, prevC];
    [prevL, curL] = [curL, prevL];
  }
  return prevC[m]! >= INF ? Infinity : prevC[m]! / Math.max(1, prevL[m]!);
}

/** Turn one raw recording into a template, or null if no speech was found. */
export function templateFrom(samples: Float32Array): Template | null {
  const speech = trimToSpeech(samples);
  if (!speech || speech.length < 1600) return null;
  return mfcc(speech);
}

export function enrol(id: string, recordings: Float32Array[]): EnrolledWord | null {
  const templates = recordings.map(templateFrom).filter((t): t is Template => t !== null);
  if (templates.length < 2) return null;
  let spread = 0;
  for (let i = 0; i < templates.length; i++) for (let j = i + 1; j < templates.length; j++) spread = Math.max(spread, dtw(templates[i]!, templates[j]!));
  return { id, templates, spread };
}

export interface Match {
  id: string;
  distance: number;
}

export interface Decision {
  /** The matched word, or null when nothing was close enough or two words were too alike to tell apart. */
  match: string | null;
  ranked: Match[];
}

/**
 * Accept the nearest word only if it is within 1.6 times the word's own spread (with a floor) and clearly
 * closer than the next word. Otherwise say nothing, and the person taps.
 */
export function decide(words: EnrolledWord[], utterance: Float32Array, options = { tolerance: 1.6, floor: 0.9, margin: 1.12 }): Decision {
  const t = templateFrom(utterance);
  if (!t || words.length === 0) return { match: null, ranked: [] };
  const ranked = words
    .map((w) => {
      const ds = w.templates.map((x) => dtw(t, x)).sort((a, b) => a - b);
      return { id: w.id, distance: ds.length > 1 ? (ds[0]! + ds[1]!) / 2 : ds[0]! };
    })
    .sort((a, b) => a.distance - b.distance);
  const best = ranked[0]!;
  const word = words.find((w) => w.id === best.id)!;
  const limit = Math.max(options.floor, word.spread * options.tolerance);
  const second = ranked[1];
  const clear = !second || second.distance >= best.distance * options.margin;
  return { match: Number.isFinite(best.distance) && best.distance <= limit && clear ? best.id : null, ranked };
}

// ---------- storage: int8 quantised so a word is a few kilobytes ----------

export interface StoredTemplate {
  frames: number;
  data: number[];
}

export function serialise(w: EnrolledWord): { id: string; spread: number; templates: StoredTemplate[] } {
  return {
    id: w.id,
    spread: w.spread,
    templates: w.templates.map((t) => ({ frames: t.length, data: t.flatMap((f) => Array.from(f, (v) => Math.max(-127, Math.min(127, Math.round(v * 24))))) })),
  };
}

export function deserialise(s: { id: string; spread: number; templates: StoredTemplate[] }): EnrolledWord {
  return {
    id: s.id,
    spread: s.spread,
    templates: s.templates.map((t) => Array.from({ length: t.frames }, (_, i) => Float32Array.from(t.data.slice(i * MFCC_DIMS, (i + 1) * MFCC_DIMS), (v) => v / 24))),
  };
}
