import { applyPack, EMPTY_PACK_STATE, LANGUAGES, rollbackPack, TIER_NOTICE, type LangPack, type PackState, type Tier } from '@hillpath/core';

/** The slice of AppCore this module needs: device-only, sealed, never synced. Narrowed so it is easy to test without a real database. */
export interface LocalStore {
  getLocal<T>(name: string, fallback: T): T;
  putLocal(name: string, value: unknown): Promise<void>;
}

/**
 * The public half of the content-signing key tools/content/build-pack.ts uses. Empty until a real translation and
 * review pipeline runs (implementation_plan.md 8.3, docs/HUMAN_TASKS.md). With it empty, no downloaded pack can ever
 * verify, so every language beyond the built-in English stays Planned here, matching the decision to ship English only.
 */
export const TRUSTED_LANG_PUBLIC_KEY = '';

/**
 * English ships built into the app: Tier 1, the source language, never a downloaded pack. Keys are short paths so a
 * pack for another language can carry the same keys. This is a starting set, not the whole interface.
 */
export const EN_STRINGS = {
  'home.greeting': 'Hello, {name}',
  'home.subtitle': 'Would you like to play a little?',
  'home.play': 'Play: {title}',
  'home.day': 'My day',
  'home.memories': 'Memories',
  'home.music': 'Music',
  'home.help': 'I need help',
  'home.help_sent': 'I have told your family. They will come soon.',
  'reminder.confirm': 'Yes, done',
  'reminder.not_sure': 'I am not sure',
  'reminder.back': 'Back to home',
} as const;

export type StringKey = keyof typeof EN_STRINGS;

const ACTIVE_LANG_KEY = 'active_lang';
const packKey = (code: string) => `lang_pack:${code}`;

export function activeLang(core: LocalStore): string {
  return core.getLocal<string>(ACTIVE_LANG_KEY, 'eng');
}

export async function setActiveLang(core: LocalStore, code: string): Promise<void> {
  if (!LANGUAGES.some((l) => l.code === code)) throw new Error('Unknown language.');
  await core.putLocal(ACTIVE_LANG_KEY, code);
}

export function packState(core: LocalStore, code: string): PackState {
  return core.getLocal<PackState>(packKey(code), EMPTY_PACK_STATE);
}

/** Verifies and installs a downloaded pack for this device. English never needs one. */
export async function installPack(core: LocalStore, pack: LangPack): Promise<{ ok: boolean; reason: string | null }> {
  if (!TRUSTED_LANG_PUBLIC_KEY) return { ok: false, reason: 'The pack did not finish. Hillpath will keep using the current one. Try again on Wi-Fi.' };
  const r = applyPack(packState(core, pack.lang), pack, TRUSTED_LANG_PUBLIC_KEY);
  if (r.ok) await core.putLocal(packKey(pack.lang), r.state);
  return { ok: r.ok, reason: r.reason };
}

/** Undoes the last pack update for a language, going back to the one before it. */
export async function rollbackInstalledPack(core: LocalStore, code: string): Promise<boolean> {
  const state = packState(core, code);
  if (!state.previous) return false;
  await core.putLocal(packKey(code), rollbackPack(state));
  return true;
}

export function effectiveTier(core: LocalStore, code: string): Tier {
  if (code === 'eng') return 'T1';
  return packState(core, code).active?.tier ?? (LANGUAGES.find((l) => l.code === code)?.tier ?? 'T0');
}

export function tierNotice(tier: Tier): string | null {
  return TIER_NOTICE[tier];
}

/** Looks a string up in the active language's installed pack, then falls back to built-in English. Never returns a raw key. */
export function t(core: LocalStore, key: StringKey, vars: Record<string, string> = {}): string {
  const lang = activeLang(core);
  const installed = lang === 'eng' ? undefined : packState(core, lang).active?.strings[key];
  const raw = installed ?? EN_STRINGS[key];
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}
