import { canonicalJson, fromB64, toB64, toHex, utf8 } from './bytes';
import { sha256Bytes, sign, verify } from './crypto';

/**
 * Language packs: signed bundles of interface strings. English ships built into the app (Tier 1, the source
 * language). Every other language is Tier 0 (Planned) until a real translation and review pipeline produces one;
 * see implementation_plan.md 8.1 to 8.3. This module only carries and checks packs; it never invents translations.
 */

export type Tier = 'T0' | 'T1' | 'T2' | 'T3';

/** English-source notice shown under a language's name in the picker. T1 needs none: it is fully checked. */
export const TIER_NOTICE: Record<Tier, string | null> = {
  T0: 'Planned. Help us add this language.',
  T1: null,
  T2: 'Draft translation. Not yet checked by a native speaker.',
  T3: 'Checked by one native speaker. Second check pending.',
};

export interface LangInfo {
  code: string;
  name: string;
  tier: Tier;
}

/** implementation_plan.md 8.1. English is the only language actually shipped; the rest stay Planned until reviewed. */
export const LANGUAGES: readonly LangInfo[] = [
  { code: 'eng', name: 'English', tier: 'T1' },
  { code: 'hin', name: 'Hindi', tier: 'T0' },
  { code: 'asm', name: 'Assamese', tier: 'T0' },
  { code: 'ben', name: 'Bengali', tier: 'T0' },
  { code: 'npi', name: 'Nepali', tier: 'T0' },
  { code: 'mni', name: 'Meitei', tier: 'T0' },
  { code: 'brx', name: 'Bodo', tier: 'T0' },
  { code: 'lus', name: 'Mizo', tier: 'T0' },
  { code: 'kha', name: 'Khasi', tier: 'T0' },
  { code: 'grt', name: 'Garo', tier: 'T0' },
  { code: 'nag', name: 'Nagamese', tier: 'T0' },
  { code: 'trp', name: 'Kokborok', tier: 'T0' },
  { code: 'njz', name: 'Nyishi', tier: 'T0' },
  { code: 'mjw', name: 'Karbi', tier: 'T0' },
];

export interface LangPack {
  v: 1;
  lang: string;
  tier: Tier;
  /** Increases by one each time a pack for this language is built. A pack is only accepted if it is newer than the active one. */
  version: number;
  builtAt: number;
  strings: Record<string, string>;
  sha256: string;
  sig: string;
  pub: string;
}

const digest = (lang: string, tier: Tier, version: number, builtAt: number, strings: Record<string, string>): Uint8Array =>
  sha256Bytes(utf8(canonicalJson({ lang, tier, version, builtAt, strings })));

/** Build a signed pack. A pack above T0 needs at least one string; T0 ships no text by definition. */
export function signPack(lang: string, tier: Tier, version: number, strings: Record<string, string>, signSecret: Uint8Array, signPublic: Uint8Array, builtAt = Date.now()): LangPack {
  if (tier !== 'T0' && Object.keys(strings).length === 0) throw new Error('A pack above T0 needs strings.');
  if (!Number.isInteger(version) || version < 1) throw new Error('version must be a positive integer.');
  const d = digest(lang, tier, version, builtAt, strings);
  return { v: 1, lang, tier, version, builtAt, strings, sha256: toHex(d), sig: toB64(sign(signSecret, d)), pub: toB64(signPublic) };
}

export interface PackCheck {
  ok: boolean;
  reason: string | null;
}

/** Checks the pack's own hash and signature, and that it was signed by the one trusted publisher key. */
export function verifyPack(p: LangPack, trustedPublicB64: string): PackCheck {
  if (p.v !== 1 || typeof p.lang !== 'string' || typeof p.strings !== 'object') return { ok: false, reason: 'Unknown pack format.' };
  const d = digest(p.lang, p.tier, p.version, p.builtAt, p.strings);
  if (toHex(d) !== p.sha256) return { ok: false, reason: 'The pack was changed after it was signed.' };
  if (p.pub !== trustedPublicB64) return { ok: false, reason: 'The pack was not signed by a trusted key.' };
  if (!verify(fromB64(p.pub), d, fromB64(p.sig))) return { ok: false, reason: 'The signature does not match.' };
  return { ok: true, reason: null };
}

export interface PackState {
  active: LangPack | null;
  /** The pack replaced by the active one, kept only so a bad update can be rolled back. */
  previous: LangPack | null;
}

export const EMPTY_PACK_STATE: PackState = { active: null, previous: null };

export interface ApplyResult {
  state: PackState;
  ok: boolean;
  reason: string | null;
}

/** Accept a new pack only if it verifies and is strictly newer than what is active for that language. */
export function applyPack(state: PackState, incoming: LangPack, trustedPublicB64: string): ApplyResult {
  const check = verifyPack(incoming, trustedPublicB64);
  if (!check.ok) return { state, ok: false, reason: check.reason };
  if (state.active && state.active.lang === incoming.lang && incoming.version <= state.active.version) {
    return { state, ok: false, reason: 'The pack did not finish. Hillpath will keep using the current one. Try again on Wi-Fi.' };
  }
  return { state: { active: incoming, previous: state.active }, ok: true, reason: null };
}

/** Undo the last apply for the active language. Only one step back is kept, by design: a pack pipeline this small does not need more. */
export function rollbackPack(state: PackState): PackState {
  return state.previous ? { active: state.previous, previous: null } : state;
}
