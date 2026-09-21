import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULES } from './rules.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.agents', '.claude', 'assets-src', 'test-results', 'playwright-report', '.venv', '__pycache__', 'android', 'reports', 'data', 'media', 'models']);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'skills-lock.json', 'rules.mjs', 'avoid-list.test.mjs', 'PROMPT_implementation_plan.md']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  const s = statSync(dir);
  if (s.isFile()) return [dir];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join('/');

/** Returns findings as { rule, file, line, text }. */
export function scan(rules = RULES, root = ROOT) {
  const findings = [];
  const cache = new Map();
  for (const rule of rules) {
    const files = new Set();
    for (const s of rule.scope) for (const f of walk(resolve(root, s))) files.add(f);
    for (const f of files) {
      const r = relative(root, f).split(sep).join('/');
      if (!rule.exts.includes(extname(f)) && !(rule.exts.includes('.env') && f.includes('.env'))) continue;
      if (rule.skip?.some((s) => r === s || r.startsWith(`${s}/`))) continue;
      if (r.endsWith('.min.js')) continue;
      let text = cache.get(f);
      if (text === undefined) {
        text = readFileSync(f, 'utf8');
        cache.set(f, text);
      }
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i])) findings.push({ rule: rule.id, why: rule.why, file: r, line: i + 1, text: lines[i].trim().slice(0, 120) });
      }
    }
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const findings = scan();
  if (findings.length === 0) {
    console.log(`avoid-list: ${RULES.length} rules, no findings`);
  } else {
    for (const f of findings) console.error(`${f.file}:${f.line}  [${f.rule}]  ${f.text}\n    ${f.why}`);
    console.error(`\navoid-list: ${findings.length} finding(s)`);
    process.exitCode = 1;
  }
}
