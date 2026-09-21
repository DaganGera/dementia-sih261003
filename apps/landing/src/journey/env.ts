import type { Env } from './logic';

const PAUSE_KEY = 'hillpath.motion.paused';

export function readPause(): boolean {
  try {
    return window.localStorage.getItem(PAUSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writePause(v: boolean): void {
  try {
    window.localStorage.setItem(PAUSE_KEY, v ? '1' : '0');
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}

interface NetInfo {
  saveData?: boolean;
  effectiveType?: string;
}

export function readEnv(): Env {
  const nav = navigator as Navigator & { connection?: NetInfo; deviceMemory?: number };
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(nav.connection?.saveData),
    effectiveType: nav.connection?.effectiveType,
    deviceMemory: nav.deviceMemory,
    pausedByUser: readPause(),
  };
}
