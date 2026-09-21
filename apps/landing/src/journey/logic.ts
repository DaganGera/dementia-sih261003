/** Pure helpers for the hero journey, kept apart from the DOM so they can be tested. */

export interface Env {
  reducedMotion: boolean;
  saveData: boolean;
  effectiveType?: string;
  deviceMemory?: number;
  pausedByUser: boolean;
}

/** Static poster with light CSS parallax instead of the scrubbed film. */
export function shouldUseStatic(e: Env): boolean {
  if (e.reducedMotion || e.saveData || e.pausedByUser) return true;
  if (e.effectiveType && ['slow-2g', '2g', '3g'].includes(e.effectiveType)) return true;
  if (e.deviceMemory !== undefined && e.deviceMemory <= 2) return true;
  return false;
}

export const IDLE_EXIT = 0.003;
export const RESOLVE_AT = 0.97;
export const TAIL_FRAMES = 12;

/**
 * Frame position while scrubbing. Progress `p0` (where scrubbing began) maps to `start`,
 * and progress `RESOLVE_AT` maps to the last frame. Returns a fractional index.
 */
export function frameAt(p: number, p0: number, start: number, count: number): number {
  const last = count - 1;
  const t = Math.max(0, Math.min(1, (p - p0) / (RESOLVE_AT - p0)));
  return start + (last - start) * t;
}

/** Start frame for scrubbing from the idle video's current time. Near the end it restarts from the top so there is room to travel. */
export function entryFrame(videoTime: number, fps: number, count: number): number {
  const idx = Math.floor(videoTime * fps);
  return idx > count - 1 - TAIL_FRAMES ? 0 : Math.max(0, idx);
}

export interface Blend {
  a: number;
  b: number;
  /** Weight of frame b, 0 to 1. */
  t: number;
}

/** Two neighbouring frames to blend for a fractional position, using only frames that are ready. */
export function blendFor(f: number, ready: (i: number) => boolean, count: number): Blend | null {
  const lo = Math.max(0, Math.min(count - 1, Math.floor(f)));
  const hi = Math.min(count - 1, lo + 1);
  const t = f - lo;
  if (ready(lo) && ready(hi)) return { a: lo, b: hi, t };
  const near = nearest(Math.round(f), ready, count);
  return near === null ? null : { a: near, b: near, t: 0 };
}

export function nearest(i: number, ready: (i: number) => boolean, count: number): number | null {
  for (let d = 0; d < count; d++) {
    if (i - d >= 0 && ready(i - d)) return i - d;
    if (i + d < count && ready(i + d)) return i + d;
  }
  return null;
}

/** Load order: every 8th frame first, then every 4th, 2nd, and the rest, so a coarse film exists early. */
export function loadOrder(count: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const step of [8, 4, 2, 1]) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        out.push(i);
      }
    }
  }
  if (!seen.has(count - 1)) out.splice(Math.min(out.length, 8), 0, count - 1);
  return out;
}

/** Idle video opacity: fade in over the first 0.5 s, fade out over the last 0.5 s. */
export function idleOpacity(time: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (time < 0.5) return time / 0.5;
  if (duration - time < 0.5) return Math.max(0, (duration - time) / 0.5);
  return 1;
}
