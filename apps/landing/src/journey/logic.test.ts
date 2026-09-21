import { describe, expect, it } from 'vitest';
import { blendFor, entryFrame, frameAt, idleOpacity, loadOrder, RESOLVE_AT, shouldUseStatic } from './logic';

const calm = { reducedMotion: false, saveData: false, pausedByUser: false };

describe('fallback rules', () => {
  it('falls back for reduced motion, save-data, slow networks, low memory and the pause choice', () => {
    expect(shouldUseStatic(calm)).toBe(false);
    expect(shouldUseStatic({ ...calm, reducedMotion: true })).toBe(true);
    expect(shouldUseStatic({ ...calm, saveData: true })).toBe(true);
    expect(shouldUseStatic({ ...calm, pausedByUser: true })).toBe(true);
    for (const t of ['slow-2g', '2g', '3g']) expect(shouldUseStatic({ ...calm, effectiveType: t })).toBe(true);
    expect(shouldUseStatic({ ...calm, effectiveType: '4g' })).toBe(false);
    expect(shouldUseStatic({ ...calm, deviceMemory: 2 })).toBe(true);
    expect(shouldUseStatic({ ...calm, deviceMemory: 4 })).toBe(false);
  });
});

describe('scrub mapping', () => {
  it('runs from the start frame at p0 to the last frame at the resolve point, and clamps', () => {
    expect(frameAt(0.003, 0.003, 10, 169)).toBe(10);
    expect(frameAt(RESOLVE_AT, 0.003, 10, 169)).toBeCloseTo(168, 9);
    expect(frameAt(1, 0.003, 10, 169)).toBeCloseTo(168, 9);
    expect(frameAt(0, 0.003, 10, 169)).toBe(10);
    const mid = frameAt(0.5, 0.003, 0, 169);
    expect(mid).toBeGreaterThan(80);
    expect(mid).toBeLessThan(90);
  });

  it('is monotonic in progress', () => {
    let prev = -1;
    for (let p = 0; p <= 1; p += 0.01) {
      const f = frameAt(p, 0.003, 5, 169);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  it('restarts from the top when the idle clip is near its end', () => {
    expect(entryFrame(3, 12, 169)).toBe(36);
    expect(entryFrame(13.9, 12, 169)).toBe(0);
    expect(entryFrame(0, 12, 169)).toBe(0);
  });
});

describe('blending and loading', () => {
  it('blends neighbours when both are ready, and falls back to the nearest ready frame otherwise', () => {
    const ready = (i: number) => i % 8 === 0;
    expect(blendFor(8.5, () => true, 169)).toEqual({ a: 8, b: 9, t: 0.5 });
    expect(blendFor(13, ready, 169)).toEqual({ a: 16, b: 16, t: 0 });
    expect(blendFor(3, () => false, 169)).toBeNull();
  });

  it('loads coarse frames first and every frame exactly once', () => {
    const order = loadOrder(169);
    expect(new Set(order).size).toBe(169);
    expect(order.slice(0, 5)).toEqual([0, 8, 16, 24, 32]);
    expect(order.indexOf(168)).toBeLessThan(30);
  });

  it('fades the idle video in and out over half a second', () => {
    expect(idleOpacity(0, 14)).toBe(0);
    expect(idleOpacity(0.25, 14)).toBeCloseTo(0.5, 9);
    expect(idleOpacity(5, 14)).toBe(1);
    expect(idleOpacity(13.75, 14)).toBeCloseTo(0.5, 9);
    expect(idleOpacity(1, Number.NaN)).toBe(0);
  });
});
