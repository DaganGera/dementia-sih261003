import { describe, expect, it } from 'vitest';
import { concat, decide, deserialise, detectSegments, dtw, enrol, mfcc, renderWord, resampleTo16k, serialise, silence, templateFrom, timingOf, WORDS, type EnrolledWord, type Speaker } from './index';

const speaker = (seed: number, pitch = 1, tempo = 1, noise = 0.003): Speaker => ({ seed, pitch, tempo, noise });

describe('voice activity detection', () => {
  it('finds one segment close to where the word is, and none in silence or noise', () => {
    const x = renderWord(WORDS.anita!, speaker(1));
    const segs = detectSegments(x);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.startMs).toBeGreaterThan(200);
    expect(segs[0]!.startMs).toBeLessThan(420);
    expect(segs[0]!.endMs - segs[0]!.startMs).toBeGreaterThan(300);
    expect(detectSegments(silence(1500))).toHaveLength(0);
    expect(detectSegments(Float32Array.from({ length: 24000 }, () => (Math.random() - 0.5) * 0.02))).toHaveLength(0);
  });

  it('reports latency, and a higher pause ratio when a word is split by a long silence', () => {
    const oneGo = timingOf(concat(silence(600), renderWord(WORDS.anita!, speaker(2), 0, 0), silence(400)))!;
    const split = timingOf(concat(silence(600), renderWord(WORDS.anita!, speaker(3), 0, 0), silence(900), renderWord(WORDS.ravi!, speaker(4), 0, 0), silence(400)))!;
    expect(oneGo.latencyMs).toBeGreaterThan(500);
    expect(oneGo.latencyMs).toBeLessThan(700);
    expect(split.segments.length).toBeGreaterThanOrEqual(2);
    expect(split.pauseRatio).toBeGreaterThan(oneGo.pauseRatio + 0.2);
  });

  it('gives no timing for silence', () => {
    expect(timingOf(silence(1000))).toBeNull();
  });
});

describe('features', () => {
  it('produces finite, normalised frames and resamples 48 kHz down to 16 kHz', () => {
    const f = mfcc(renderWord(WORDS.ravi!, speaker(5)));
    expect(f.length).toBeGreaterThan(40);
    expect(f.every((fr) => fr.every(Number.isFinite))).toBe(true);
    const mean = f.reduce((s, fr) => s + fr[0]!, 0) / f.length;
    expect(Math.abs(mean)).toBeLessThan(1e-3);
    const up = new Float32Array(48000).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000));
    expect(resampleTo16k(up, 48000)).toHaveLength(16000);
  });

  it('DTW is zero for identical templates and larger for different words', () => {
    const a = templateFrom(renderWord(WORDS.anita!, speaker(6)))!;
    const a2 = templateFrom(renderWord(WORDS.anita!, speaker(7, 1.02, 1.1)))!;
    const b = templateFrom(renderWord(WORDS.ravi!, speaker(8)))!;
    expect(dtw(a, a)).toBeCloseTo(0, 6);
    expect(dtw(a, a2)).toBeLessThan(dtw(a, b));
  });
});

describe('personal keyword spotting on synthetic speech-like words', () => {
  const names = ['anita', 'ravi', 'dev', 'market'] as const;
  const enrolled: EnrolledWord[] = names.map((n, k) => enrol(n, [1, 2, 3].map((i) => renderWord(WORDS[n]!, speaker(100 * k + i, 1 + 0.01 * i, 1 + 0.03 * i)))))!.filter((w): w is EnrolledWord => w !== null);

  it('enrols every word from three recordings', () => {
    expect(enrolled).toHaveLength(4);
    expect(enrolled.every((w) => w.templates.length === 3)).toBe(true);
  });

  it('recognises the enrolled words with the same voice at other speeds, and abstains rather than guessing', () => {
    let right = 0;
    let wrong = 0;
    let abstained = 0;
    let trials = 0;
    for (const [k, n] of names.entries()) {
      for (let i = 0; i < 10; i++) {
        const sp = speaker(1000 + 37 * k + i, 0.97 + 0.006 * i, 0.88 + 0.03 * i, 0.004);
        const d = decide(enrolled, renderWord(WORDS[n]!, sp));
        trials += 1;
        if (d.match === n) right += 1;
        else if (d.match === null) abstained += 1;
        else wrong += 1;
      }
    }
    console.log(`KWS synthetic: ${right}/${trials} right, ${wrong} wrong, ${abstained} abstained`);
    expect(right / trials).toBeGreaterThanOrEqual(0.9);
    expect(wrong / trials).toBeLessThanOrEqual(0.05);
  });

  it('rejects a word that was never enrolled and pure noise', () => {
    let accepted = 0;
    for (let i = 0; i < 12; i++) if (decide(enrolled, renderWord(WORDS.other!, speaker(500 + i, 0.98 + 0.004 * i, 0.9 + 0.02 * i))).match !== null) accepted += 1;
    expect(accepted / 12).toBeLessThanOrEqual(0.25);
    expect(decide(enrolled, silence(1500)).match).toBeNull();
  });

  it('gives the same decisions after storage as int8', () => {
    const restored = enrolled.map((w) => deserialise(JSON.parse(JSON.stringify(serialise(w)))));
    const u = renderWord(WORDS.ravi!, speaker(2000, 1, 1.05));
    expect(decide(restored, u).match).toBe(decide(enrolled, u).match);
    expect(JSON.stringify(serialise(enrolled[0]!)).length).toBeLessThan(40_000);
  });
});
