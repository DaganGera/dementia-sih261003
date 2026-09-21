import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { rng } from '@hillpath/ml';
import { comparePolicies, reportM1 } from './eval';
import { instrumentsFor } from './instruments';
import { makePersona, SIM_VERSION } from './persona';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function write(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log(`wrote ${path}`);
}

const cmd = process.argv[2];

if (cmd === 'm2-data') {
  const n = Number(arg('n', '6000'));
  const out = arg('out', 'ml/data/sim/m2.jsonl');
  const r = rng(Number(arg('seed', '17')));
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const stage = i % 4;
    const p = makePersona(i, 'S1_stable', 101, stage);
    const row = instrumentsFor(p, r);
    lines.push(JSON.stringify({ person_id: p.id, stage, synthetic: true, sim_version: SIM_VERSION, ...row }));
  }
  write(out, lines.join('\n') + '\n');
} else if (cmd === 'm1-eval') {
  const n = Number(arg('n', '90'));
  const days = Number(arg('days', '90'));
  const res = [comparePolicies(n, days, 'logistic', 5), comparePolicies(n, days, 'probit', 6)];
  write(arg('out', 'ml/reports/m1.md'), reportM1(res));
  console.log(JSON.stringify(res.map((x) => ({ family: x.family, m1: x.m1, threshold: x.threshold, diff: x.diff })), null, 1));
} else {
  console.log('usage: cli.ts m2-data|m1-eval [--n N] [--days D] [--out PATH]');
  process.exitCode = 1;
}
