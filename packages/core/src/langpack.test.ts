import { describe, expect, it } from 'vitest';
import { newDeviceKeys } from './crypto';
import { applyPack, EMPTY_PACK_STATE, LANGUAGES, rollbackPack, signPack, TIER_NOTICE, verifyPack } from './langpack';
import { toB64 } from './bytes';

const publisher = newDeviceKeys();
const pub = toB64(publisher.signPublic);
const other = newDeviceKeys();

describe('language list', () => {
  it('ships English as the only Tier 1 language; every other language stays Planned', () => {
    const eng = LANGUAGES.find((l) => l.code === 'eng')!;
    expect(eng.tier).toBe('T1');
    expect(LANGUAGES.filter((l) => l.code !== 'eng').every((l) => l.tier === 'T0')).toBe(true);
    expect(LANGUAGES.length).toBe(14);
  });

  it('has a UI notice for every tier except the fully checked one', () => {
    expect(TIER_NOTICE.T1).toBeNull();
    expect(TIER_NOTICE.T0).toMatch(/Planned/);
    expect(TIER_NOTICE.T2).toMatch(/not yet checked/i);
    expect(TIER_NOTICE.T3).toMatch(/one native speaker/i);
  });
});

describe('signing and verifying a pack', () => {
  it('round trips', () => {
    const p = signPack('hin', 'T2', 1, { greeting: 'Namaste' }, publisher.signSecret, publisher.signPublic);
    expect(verifyPack(p, pub)).toEqual({ ok: true, reason: null });
  });

  it('refuses a pack above T0 with no strings', () => {
    expect(() => signPack('hin', 'T2', 1, {}, publisher.signSecret, publisher.signPublic)).toThrow();
  });

  it('allows an empty T0 pack (a placeholder that ships no text)', () => {
    const p = signPack('kha', 'T0', 1, {}, publisher.signSecret, publisher.signPublic);
    expect(verifyPack(p, pub).ok).toBe(true);
  });

  it('rejects a pack whose strings were changed after signing', () => {
    const p = signPack('hin', 'T2', 1, { greeting: 'Namaste' }, publisher.signSecret, publisher.signPublic);
    const tampered = { ...p, strings: { greeting: 'Something else' } };
    const r = verifyPack(tampered, pub);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/changed after/);
  });

  it('rejects a pack signed by an untrusted key', () => {
    const p = signPack('hin', 'T2', 1, { greeting: 'Namaste' }, other.signSecret, other.signPublic);
    const r = verifyPack(p, pub);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/trusted key/);
  });

  it('rejects a forged signature even with the pub field swapped to the trusted key', () => {
    const p = signPack('hin', 'T2', 1, { greeting: 'Namaste' }, other.signSecret, other.signPublic);
    const forged = { ...p, pub };
    expect(verifyPack(forged, pub).ok).toBe(false);
  });
});

describe('applying and rolling back packs on a device', () => {
  it('accepts the first pack for a language', () => {
    const p = signPack('hin', 'T2', 1, { greeting: 'Namaste' }, publisher.signSecret, publisher.signPublic);
    const r = applyPack(EMPTY_PACK_STATE, p, pub);
    expect(r.ok).toBe(true);
    expect(r.state.active?.version).toBe(1);
    expect(r.state.previous).toBeNull();
  });

  it('accepts a newer version and keeps the old one for rollback', () => {
    const v1 = signPack('hin', 'T2', 1, { greeting: 'Namaste' }, publisher.signSecret, publisher.signPublic);
    const v2 = signPack('hin', 'T2', 2, { greeting: 'Namaste ji' }, publisher.signSecret, publisher.signPublic);
    const s1 = applyPack(EMPTY_PACK_STATE, v1, pub).state;
    const r2 = applyPack(s1, v2, pub);
    expect(r2.ok).toBe(true);
    expect(r2.state.active?.version).toBe(2);
    expect(r2.state.previous?.version).toBe(1);
  });

  it('refuses a pack that is not newer, and an invalid one, leaving the active pack untouched', () => {
    const v1 = signPack('hin', 'T2', 2, { greeting: 'Namaste ji' }, publisher.signSecret, publisher.signPublic);
    const s1 = applyPack(EMPTY_PACK_STATE, v1, pub).state;
    const older = signPack('hin', 'T2', 1, { greeting: 'Namaste' }, publisher.signSecret, publisher.signPublic);
    const rOld = applyPack(s1, older, pub);
    expect(rOld.ok).toBe(false);
    expect(rOld.state).toBe(s1);
    const bad = signPack('hin', 'T2', 3, { greeting: 'x' }, other.signSecret, other.signPublic);
    const rBad = applyPack(s1, bad, pub);
    expect(rBad.ok).toBe(false);
    expect(rBad.state.active?.version).toBe(2);
  });

  it('rolls back one step to the previous pack', () => {
    const v1 = signPack('hin', 'T2', 1, { greeting: 'Namaste' }, publisher.signSecret, publisher.signPublic);
    const v2 = signPack('hin', 'T2', 2, { greeting: 'broken' }, publisher.signSecret, publisher.signPublic);
    const s1 = applyPack(EMPTY_PACK_STATE, v1, pub).state;
    const s2 = applyPack(s1, v2, pub).state;
    const back = rollbackPack(s2);
    expect(back.active?.version).toBe(1);
    expect(back.previous).toBeNull();
    // Rolling back again with nothing further behind it is a no-op, not an error.
    expect(rollbackPack(back)).toEqual(back);
  });
});
