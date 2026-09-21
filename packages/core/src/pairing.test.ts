import { describe, expect, it } from 'vitest';
import { gunzipFromB64, gzipToB64 } from './bytes';
import { comparisonCode, newCircleKey, newDeviceKeys, relayBearer } from './crypto';
import { openEnvelope, sealEnvelope, EnvelopeError } from './envelope';
import { makeAccept, makeKey, makeOffer, openKey, parsePairing, type PairAccept, type PairKey } from './pairing';
import { PageAssembler, toPages } from './paging';
import { Replica } from './replica';

describe('pairing without a network', () => {
  it('pairs a patient device and gives it the circle key, and only it', () => {
    const cg = newDeviceKeys();
    const pt = newDeviceKeys();
    const other = newDeviceKeys();
    const circleKey = newCircleKey();

    const offer = parsePairing(makeOffer('circle-123', cg.signPublic, cg.boxPublic, 'Anita'));
    expect(offer?.t).toBe('offer');
    const accept = parsePairing(makeAccept('tablet-01', pt.signPublic, pt.boxPublic, 'Ama tablet', 'patient')) as PairAccept;
    expect(accept.t).toBe('accept');
    expect(comparisonCode(cg.boxPublic, pt.boxPublic)).toBe(comparisonCode(pt.boxPublic, cg.boxPublic));

    const key = parsePairing(makeKey('circle-123', circleKey, accept)) as PairKey;
    expect(openKey(key, 'tablet-01', pt.boxSecret)).toEqual(circleKey);
    expect(() => openKey(key, 'tablet-01', other.boxSecret)).toThrow();
    expect(() => openKey(key, 'someone-else', pt.boxSecret)).toThrow(/another device/);
  });

  it('rejects junk and wrong shapes', () => {
    expect(parsePairing('nope')).toBeNull();
    expect(parsePairing('{"t":"offer"}')).toBeNull();
  });

  it('a removed device cannot read envelopes sealed under the rotated key', () => {
    const removed = newDeviceKeys();
    const cg = newDeviceKeys();
    const oldKey = newCircleKey();
    const newKey = newCircleKey();
    const r = new Replica('cg');
    r.insert('reminder', 'r1', { title: 'Tea' });
    const env = sealEnvelope({ circle: 'c', circleKey: newKey, from: 'cg', signSecret: cg.signSecret, ops: r.allOps(), vector: r.vector() });
    expect(() => openEnvelope({ envelope: env, circleKey: oldKey, senderSignPublic: cg.signPublic })).toThrow(EnvelopeError);
    expect(removed.boxPublic).not.toEqual(cg.boxPublic);
    expect(relayBearer(oldKey)).not.toBe(relayBearer(newKey));
  });
});

describe('gzip pages', () => {
  it('shrinks repetitive op JSON and round trips through QR pages', async () => {
    const r = new Replica('dev');
    for (let i = 0; i < 60; i++) r.insert('trial', `s:${i}`, { game_id: 'G1', correct: i % 3 !== 0, rt_ms: 800 + i, domain: 'visual_memory', synthetic: false });
    const text = JSON.stringify(r.allOps());
    const packed = await gzipToB64(text);
    expect(packed.length).toBeLessThan(text.length / 2);
    expect(await gunzipFromB64(packed)).toBe(text);
    const asm = new PageAssembler();
    let out: { progress: number; text?: string } = { progress: 0 };
    for (const p of toPages(packed)) out = asm.add(p);
    expect(await gunzipFromB64(out.text!)).toBe(text);
  });
});
