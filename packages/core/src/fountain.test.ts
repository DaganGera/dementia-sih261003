import { describe, expect, it } from 'vitest';
import { FountainDecoder, FountainEncoder, indicesFor } from './fountain';

const text = (n: number, seed = 1) => {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return String.fromCharCode(33 + (s % 90));
  }).join('');
};

function transmit(enc: FountainEncoder, lossRate: number, seed: number, maxFrames = 100_000): { text?: string; received: number; sent: number } {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const dec = new FountainDecoder();
  // The receiver joins mid-stream: start at a random sequence number.
  let seq = Math.floor(rnd() * enc.k);
  for (let sent = 1; sent <= maxFrames; sent++, seq++) {
    if (rnd() < lossRate) continue;
    const r = dec.add(enc.frame(seq));
    if (r.text !== undefined) return { text: r.text, received: dec.received, sent };
  }
  return { received: dec.received, sent: maxFrames };
}

describe('fountain frames', () => {
  it('gives single chunks first and then deterministic combinations', () => {
    expect(indicesFor('abcd1234', 10, 3)).toEqual([3]);
    expect(indicesFor('abcd1234', 10, 25)).toEqual(indicesFor('abcd1234', 10, 25));
    const degrees = Array.from({ length: 400 }, (_, i) => indicesFor('abcd1234', 40, 40 + i).length);
    expect(Math.max(...degrees)).toBeGreaterThan(3);
    expect(degrees.filter((d) => d === 2).length).toBeGreaterThan(80);
  });

  it('rebuilds text from a stream with no loss, from any starting frame', () => {
    const t = text(3000);
    const r = transmit(new FountainEncoder(t), 0, 5);
    expect(r.text).toBe(t);
  });

  it('rebuilds text after heavy random loss, and reports the overhead', () => {
    const overheads: number[] = [];
    for (const [n, loss, seed] of [[500, 0.3, 1], [2500, 0.4, 2], [9000, 0.4, 3], [20000, 0.5, 4], [1, 0.2, 5], [421, 0.3, 6]] as const) {
      const t = text(n, seed);
      const enc = new FountainEncoder(t);
      const r = transmit(enc, loss, seed * 7);
      expect(r.text, `${n} bytes at ${loss} loss`).toBe(t);
      overheads.push(r.received / enc.k);
    }
    const mean = overheads.reduce((a, b) => a + b, 0) / overheads.length;
    console.log(`fountain overhead (frames received divided by K): ${overheads.map((o) => o.toFixed(2)).join(', ')}, mean ${mean.toFixed(2)}`);
    expect(mean).toBeLessThan(1.9);
  });

  it('handles duplicates, junk and a second message without mixing them up', () => {
    const a = new FountainEncoder(text(1200, 9));
    const b = new FountainEncoder(text(900, 10));
    const dec = new FountainDecoder();
    expect(dec.add('not a frame').progress).toBe(0);
    dec.add(a.frame(0));
    dec.add(a.frame(0));
    expect(dec.received).toBe(1);
    let out: { progress: number; text?: string } = { progress: 0 };
    for (let i = 0; i < 40 && out.text === undefined; i++) out = dec.add(b.frame(i));
    expect(out.text).toBe(text(900, 10));
  });

  it('never returns wrong text: a corrupted frame is caught by the hash, and clean frames then recover', () => {
    const original = text(800, 11);
    const enc = new FountainEncoder(original);
    const dec = new FountainDecoder();
    let out: { progress: number; text?: string } = { progress: 0 };
    for (let i = 0; i < 2; i++) {
      const parts = enc.frame(i).split('|');
      if (i === 1) parts[5] = parts[5]!.replace(/[A-Za-z]/, (c) => (c === 'A' ? 'B' : 'A'));
      out = dec.add(parts.join('|'));
    }
    expect(out.text).toBeUndefined();
    for (let i = 2; i < 60 && out.text === undefined; i++) out = dec.add(enc.frame(i));
    expect(out.text).toBe(original);
  });
});
