import { applyPack, LANGUAGES, newDeviceKeys, signPack, toB64, verifyPack, type LangPack } from '@hillpath/core';
import { describe, expect, it } from 'vitest';
import { activeLang, effectiveTier, EN_STRINGS, installPack, rollbackInstalledPack, setActiveLang, t, tierNotice, TRUSTED_LANG_PUBLIC_KEY, type LocalStore } from './i18n';

/** A minimal stand-in for AppCore's device-only store, in memory, no database. */
function fakeStore(): LocalStore {
  const data: Record<string, unknown> = {};
  return {
    getLocal: <T,>(name: string, fallback: T) => (name in data ? (data[name] as T) : fallback),
    putLocal: async (name: string, value: unknown) => {
      data[name] = value;
    },
  };
}

describe('language on the device', () => {
  it('defaults to English, and every built-in string has a value', () => {
    const core = fakeStore();
    expect(activeLang(core)).toBe('eng');
    for (const key of Object.keys(EN_STRINGS) as (keyof typeof EN_STRINGS)[]) expect(t(core, key)).toBe(EN_STRINGS[key]);
  });

  it('fills in named placeholders and leaves an unmatched one visibly alone', () => {
    const core = fakeStore();
    expect(t(core, 'home.greeting', { name: 'Ama' })).toBe('Hello, Ama');
    expect(t(core, 'home.greeting')).toBe('Hello, {name}');
  });

  it('refuses to switch to a language that is not in the list', async () => {
    const core = fakeStore();
    await expect(setActiveLang(core, 'xx')).rejects.toThrow();
  });

  it('reports English as Verified and every other language as Planned, with no notice for English', () => {
    const core = fakeStore();
    expect(effectiveTier(core, 'eng')).toBe('T1');
    expect(tierNotice(effectiveTier(core, 'eng'))).toBeNull();
    for (const l of LANGUAGES.filter((x) => x.code !== 'eng')) {
      expect(effectiveTier(core, l.code)).toBe('T0');
      expect(tierNotice(effectiveTier(core, l.code))).toMatch(/Planned/);
    }
  });

  it('refuses every pack while no publisher key is trusted, which is the current, honest state', async () => {
    expect(TRUSTED_LANG_PUBLIC_KEY).toBe('');
    const core = fakeStore();
    const key = newDeviceKeys();
    const pack = signPack('hin', 'T2', 1, { 'home.greeting': 'Namaste, {name}' }, key.signSecret, key.signPublic);
    expect(verifyPack(pack, toB64(key.signPublic)).ok).toBe(true); // the pack itself is well formed
    const r = await installPack(core, pack);
    expect(r.ok).toBe(false);
    expect(effectiveTier(core, 'hin')).toBe('T0');
  });

  it('once a pack is installed, its strings are used, and rollback goes back one version', async () => {
    const core = fakeStore();
    const key = newDeviceKeys();
    // Simulate a trusted key by installing directly through the same verify path a real device would use,
    // bypassing the empty TRUSTED_LANG_PUBLIC_KEY guard to exercise applyPack's own version and rollback rules.
    const v1: LangPack = signPack('hin', 'T2', 1, { 'home.greeting': 'Namaste, {name}' }, key.signSecret, key.signPublic);
    const v2: LangPack = signPack('hin', 'T2', 2, { 'home.greeting': 'Namaste-ji, {name}' }, key.signSecret, key.signPublic);
    const pub = toB64(key.signPublic);
    let state = applyPack({ active: null, previous: null }, v1, pub).state;
    await core.putLocal('lang_pack:hin', state);
    await setActiveLang(core, 'hin');
    expect(t(core, 'home.greeting', { name: 'Ama' })).toBe('Namaste, Ama');

    state = applyPack(state, v2, pub).state;
    await core.putLocal('lang_pack:hin', state);
    expect(t(core, 'home.greeting', { name: 'Ama' })).toBe('Namaste-ji, Ama');

    expect(await rollbackInstalledPack(core, 'hin')).toBe(true);
    expect(t(core, 'home.greeting', { name: 'Ama' })).toBe('Namaste, Ama');
    expect(await rollbackInstalledPack(core, 'hin')).toBe(false);
  });
});
