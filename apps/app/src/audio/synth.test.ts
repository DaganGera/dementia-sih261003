import { describe, expect, it } from 'vitest';
import { scheduleSound, scheduleTune, SOUND_GROUPS, SOUND_LABELS, TUNES, type SoundId } from './synth';

/** A stand-in for an audio context that records what was scheduled. */
function fakeContext() {
  const log = { oscillators: [] as Array<{ freq: number; type: string }>, noise: 0, filters: 0, gains: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (): Record<string, unknown> => {
    const n: Record<string, unknown> = { connect: (d: unknown) => d ?? n, start() {}, stop() {}, disconnect() {} };
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 16000,
    createOscillator() {
      const o = { ...node(), type: 'sine', frequency: param() };
      log.oscillators.push({ freq: 0, type: 'sine' });
      return o;
    },
    createGain() {
      log.gains += 1;
      return { ...node(), gain: param() };
    },
    createBiquadFilter() {
      log.filters += 1;
      return { ...node(), type: 'lowpass', frequency: param(), Q: param() };
    },
    createBuffer(_c: number, n: number) {
      return { getChannelData: () => new Float32Array(n) };
    },
    createBufferSource() {
      log.noise += 1;
      return { ...node(), buffer: null };
    },
  };
  return { ctx: ctx as unknown as BaseAudioContext, dest: node() as unknown as AudioNode, log };
}

describe('synthesised sounds', () => {
  const ids = Object.keys(SOUND_LABELS) as SoundId[];

  it('every sound schedules audio and has a positive length', () => {
    for (const id of ids) {
      const { ctx, dest, log } = fakeContext();
      const seconds = scheduleSound(id, ctx, dest, 0);
      expect(seconds, id).toBeGreaterThan(0.5);
      expect(log.oscillators.length + log.noise, id).toBeGreaterThan(0);
    }
  });

  it('sounds differ from each other in how they are built', () => {
    const shape = (id: SoundId) => {
      const { ctx, dest, log } = fakeContext();
      const s = scheduleSound(id, ctx, dest, 0);
      return `${log.oscillators.length}/${log.noise}/${log.filters}/${s}`;
    };
    expect(new Set(ids.map(shape)).size).toBeGreaterThanOrEqual(6);
  });

  it('groups only contain known sounds and cover every sound once', () => {
    const flat = SOUND_GROUPS.flat();
    expect(new Set(flat).size).toBe(flat.length);
    for (const s of flat) expect(ids).toContain(s);
    expect(new Set(flat).size).toBe(ids.length);
  });

  it('tunes stay in a pentatonic set so they sound pleasant', () => {
    const allowed = new Set([0, 2, 4, 7, 9, -3, -5, -8, -1]);
    for (const t of TUNES) for (const n of t.notes) expect(allowed.has(n) || [0, 2, 4, 7, 9].includes(((n % 12) + 12) % 12)).toBe(true);
    const { ctx, dest, log } = fakeContext();
    const seconds = scheduleTune(ctx, dest, TUNES[0]!.notes, TUNES[0]!.beat);
    expect(seconds).toBeCloseTo(TUNES[0]!.notes.length * TUNES[0]!.beat, 6);
    expect(log.oscillators).toHaveLength(TUNES[0]!.notes.length);
  });
});
