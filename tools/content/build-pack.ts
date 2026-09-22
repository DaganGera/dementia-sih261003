#!/usr/bin/env -S npx tsx
// Builds and signs a language pack. See implementation_plan.md 8.1 to 8.3.
// Usage:
//   pnpm exec tsx tools/content/build-pack.ts --lang hin --tier T2 --strings path/to/strings.json [--out content/lang/hin.json] [--key content/.signing-key.json]
//
// The signing key is generated on first use and kept out of git. Its public half must match
// TRUSTED_LANG_PUBLIC_KEY in apps/app/src/lib/i18n.ts before a device will accept packs built with it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fromB64, toB64 } from '../../packages/core/src/bytes';
import { newDeviceKeys } from '../../packages/core/src/crypto';
import { LANGUAGES, signPack, verifyPack, type Tier } from '../../packages/core/src/langpack';

const ROOT = resolve(import.meta.dirname, '..', '..');

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const lang = arg('lang', '');
const tierArg = arg('tier', '');
const stringsPath = arg('strings', '');
const keyPath = resolve(ROOT, arg('key', 'content/.signing-key.json'));
const outPath = resolve(ROOT, arg('out', `content/lang/${lang}.json`));

if (!lang || !(['T0', 'T1', 'T2', 'T3'] as const).includes(tierArg as Tier)) {
  console.log('usage: build-pack.ts --lang <code> --tier T0|T1|T2|T3 [--strings path.json] [--out path] [--key path]');
  process.exit(1);
}
const tier = tierArg as Tier;
if (!LANGUAGES.some((l) => l.code === lang)) {
  console.log(`"${lang}" is not one of the languages in implementation_plan.md 8.1: ${LANGUAGES.map((l) => l.code).join(', ')}`);
  process.exit(1);
}

let key: { signSecret: Uint8Array; signPublic: Uint8Array };
if (existsSync(keyPath)) {
  const saved = JSON.parse(readFileSync(keyPath, 'utf8')) as { signSecret: string; signPublic: string };
  key = { signSecret: fromB64(saved.signSecret), signPublic: fromB64(saved.signPublic) };
} else {
  const k = newDeviceKeys();
  key = { signSecret: k.signSecret, signPublic: k.signPublic };
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, JSON.stringify({ signSecret: toB64(key.signSecret), signPublic: toB64(key.signPublic) }, null, 1));
  console.log(`Made a new signing key at ${keyPath}. Keep it out of git (it already is).`);
  console.log(`Public key, paste into TRUSTED_LANG_PUBLIC_KEY in apps/app/src/lib/i18n.ts:\n${toB64(key.signPublic)}`);
}

const strings: Record<string, string> = tier === 'T0' ? {} : (JSON.parse(readFileSync(resolve(ROOT, stringsPath), 'utf8')) as Record<string, string>);
if (tier !== 'T0' && Object.keys(strings).length === 0) {
  console.log(`Tier ${tier} needs at least one string. Pass --strings pointing at a {"key": "text"} file.`);
  process.exit(1);
}

let version = 1;
if (existsSync(outPath)) {
  const prev = JSON.parse(readFileSync(outPath, 'utf8')) as { lang: string; version: number };
  if (prev.lang === lang) version = prev.version + 1;
}

const pack = signPack(lang, tier, version, strings, key.signSecret, key.signPublic);
const check = verifyPack(pack, toB64(key.signPublic));
if (!check.ok) throw new Error(`Built pack does not verify: ${check.reason}`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(pack, null, 1) + '\n');
console.log(`wrote ${outPath} (lang=${lang} tier=${tier} version=${version}, ${Object.keys(strings).length} strings)`);
