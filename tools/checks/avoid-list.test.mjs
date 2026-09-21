import { describe, expect, it } from 'vitest';
import { RULES } from './rules.mjs';
import { scan } from './avoid-list.mjs';

describe('avoid-list rules', () => {
  for (const r of RULES) {
    it(`${r.id} fails its bad sample and passes its good sample`, () => {
      expect(r.pattern.test(r.bad), 'bad sample').toBe(true);
      expect(r.pattern.test(r.good), 'good sample').toBe(false);
    });
  }

  it('the repository has no findings', () => {
    const f = scan();
    expect(f.map((x) => `${x.file}:${x.line} ${x.rule}`)).toEqual([]);
  });
});
