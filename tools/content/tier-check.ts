#!/usr/bin/env -S npx tsx
// Checks every built language pack in content/lang against implementation_plan.md 8.1 and 8.2:
// the language is one Hillpath actually lists, the tier is real, a pack above T0 carries strings and
// verifies against the one trusted publisher key, and a T0 pack carries none (a placeholder ships no text).
// Usage: pnpm exec tsx tools/content/tier-check.ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANGUAGES, verifyPack, type LangPack } from '../../packages/core/src/langpack';
import { TRUSTED_LANG_PUBLIC_KEY } from '../../apps/app/src/lib/i18n';

const ROOT = resolve(import.meta.dirname, '..', '..');
const dir = resolve(ROOT, 'content/lang');
const problems: string[] = [];

if (existsSync(dir)) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const path = `content/lang/${file}`;
    const pack = JSON.parse(readFileSync(resolve(dir, file), 'utf8')) as LangPack;
    const info = LANGUAGES.find((l) => l.code === pack.lang);
    if (!info) {
      problems.push(`${path}: "${pack.lang}" is not one of the languages in implementation_plan.md 8.1.`);
      continue;
    }
    const check = verifyPack(pack, TRUSTED_LANG_PUBLIC_KEY);
    if (!check.ok) problems.push(`${path}: ${check.reason}`);
    if (pack.tier === 'T0' && Object.keys(pack.strings).length > 0) problems.push(`${path}: tier T0 ships no text, but this pack carries ${Object.keys(pack.strings).length} strings.`);
    if (pack.tier !== 'T0' && Object.keys(pack.strings).length === 0) problems.push(`${path}: tier ${pack.tier} needs at least one string.`);
    if (file !== `${pack.lang}.json`) problems.push(`${path}: file name should be ${pack.lang}.json.`);
  }
}

if (problems.length) {
  console.log(`tier-check: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log(`tier-check: ${existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0} pack(s), no findings`);
}
