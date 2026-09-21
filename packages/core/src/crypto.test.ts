import { describe, expect, it } from 'vitest';
import { bearerHash, comparisonCode, newCircleKey, newDeviceKeys, relayBearer, unwrapCircleKey, wrapCircleKey } from './crypto';
import { EnvelopeError, openEnvelope, sealEnvelope } from './envelope';
import { PageAssembler, toPages } from './paging';
import { Replica } from './replica';

function setup() {
  const key = newCircleKey();
  const keys = newDeviceKeys();
  const r = new Replica('dev-a');
  r.insert('session', 's1', { game_id: 'G1', started_at: 1 });
  r.insert('trial', 's1:0', { correct: true, rt_ms: 800 });
  const envelope = sealEnvelope({ circle: 'c1', circleKey: key, from: 'dev-a', signSecret: keys.signSecret, ops: r.allOps(), vector: r.vector() });
  return { key, keys, r, envelope };
}

describe('envelopes', () => {
  it('round trips and applies to another replica', () => {
    const { key, keys, r, envelope } = setup();
    const opened = openEnvelope({ envelope, circleKey: key, senderSignPublic: keys.signPublic });
    const other = new Replica('dev-b');
    other.apply(opened.ops);
    expect(other.snapshot()).toBe(r.snapshot());
  });

  it('rejects tampered ciphertext, header and signer', () => {
    const { key, keys, envelope } = setup();
    const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    expect(() => openEnvelope({ envelope: { ...envelope, ciphertext: flip(envelope.ciphertext) }, circleKey: key, senderSignPublic: keys.signPublic })).toThrow(EnvelopeError);
    expect(() => openEnvelope({ envelope: { ...envelope, from: 'dev-z' }, circleKey: key, senderSignPublic: keys.signPublic })).toThrow(EnvelopeError);
    expect(() => openEnvelope({ envelope, circleKey: key, senderSignPublic: newDeviceKeys().signPublic })).toThrow(EnvelopeError);
    expect(() => openEnvelope({ envelope, circleKey: newCircleKey(), senderSignPublic: keys.signPublic })).toThrow(EnvelopeError);
  });

  it('wraps the circle key for one device only', () => {
    const key = newCircleKey();
    const a = newDeviceKeys();
    const b = newDeviceKeys();
    const wrapped = wrapCircleKey(key, a.boxPublic);
    expect(unwrapCircleKey(wrapped, a.boxSecret)).toEqual(key);
    expect(() => unwrapCircleKey(wrapped, b.boxSecret)).toThrow();
  });

  it('derives a bearer whose hash differs from the bearer', () => {
    const b = relayBearer(newCircleKey());
    expect(b).toHaveLength(64);
    expect(bearerHash(b)).not.toBe(b);
  });

  it('gives both devices the same four digit code', () => {
    const a = newDeviceKeys().boxPublic;
    const b = newDeviceKeys().boxPublic;
    expect(comparisonCode(a, b)).toBe(comparisonCode(b, a));
    expect(comparisonCode(a, b)).toMatch(/^\d{4}$/);
  });
});

describe('QR pages', () => {
  it('reassembles from pages in any order, with repeats', () => {
    const { envelope } = setup();
    const text = JSON.stringify(envelope);
    const pages = toPages(text, 300);
    expect(pages.length).toBeGreaterThan(1);
    const asm = new PageAssembler();
    let result: { progress: number; text?: string } = { progress: 0 };
    for (const p of [...pages].reverse().concat(pages)) result = asm.add(p);
    expect(result.text).toBe(text);
  });

  it('ignores junk and a corrupted page set', () => {
    const asm = new PageAssembler();
    expect(asm.add('hello').progress).toBe(0);
    const pages = toPages('x'.repeat(2000), 500);
    pages[1] = pages[1]!.replace(/x/g, 'y');
    let r: { progress: number; text?: string } = { progress: 0 };
    for (const p of pages) r = asm.add(p);
    expect(r.text).toBeUndefined();
  });
});
