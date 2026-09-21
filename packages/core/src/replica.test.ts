import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Replica } from './replica';

function fixedClock(start: number) {
  let t = start;
  return () => (t += 1);
}

describe('Replica convergence', () => {
  it('three replicas converge whatever order ops arrive in', () => {
    const edit = fc.record({
      who: fc.integer({ min: 0, max: 2 }),
      id: fc.constantFrom('a', 'b', 'c'),
      field: fc.constantFrom('name', 'time', 'note'),
      value: fc.string({ maxLength: 6 }),
      del: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(edit, { maxLength: 25 }), fc.integer(), (edits, seed) => {
        const reps = [0, 1, 2].map((i) => new Replica(`dev${i}`, undefined, fixedClock(1_000_000 * (i + 1))));
        for (const e of edits) {
          const r = reps[e.who]!;
          if (e.del) r.remove('reminder', e.id);
          else r.set('reminder', e.id, { [e.field]: e.value });
        }
        const all = reps.flatMap((r) => r.allOps());
        const shuffled = (n: number) => {
          const copy = [...all];
          let s = (seed + n) >>> 0;
          for (let i = copy.length - 1; i > 0; i--) {
            s = (s * 1664525 + 1013904223) >>> 0;
            const j = s % (i + 1);
            [copy[i], copy[j]] = [copy[j]!, copy[i]!];
          }
          return copy;
        };
        const fresh = [0, 1, 2].map(() => new Replica('x'));
        fresh.forEach((f, n) => f.apply(shuffled(n)));
        expect(fresh[1]!.snapshot()).toBe(fresh[0]!.snapshot());
        expect(fresh[2]!.snapshot()).toBe(fresh[0]!.snapshot());
      }),
      { numRuns: 100 },
    );
  });

  it('is idempotent and reports only new ops', () => {
    const a = new Replica('a', undefined, fixedClock(10));
    const op = a.insert('person', 'p1', { name: 'Ama' });
    const b = new Replica('b');
    expect(b.apply([op])).toHaveLength(1);
    expect(b.apply([op])).toHaveLength(0);
    expect(b.list('person')).toEqual([{ id: 'p1', name: 'Ama' }]);
  });

  it('last writer wins per field and tombstones hide rows', () => {
    const a = new Replica('a', undefined, fixedClock(10));
    const b = new Replica('b', undefined, fixedClock(1000));
    a.insert('reminder', 'r', { time: '08:00', title: 'Tea' });
    b.apply(a.allOps());
    b.set('reminder', 'r', { time: '09:00' });
    a.set('reminder', 'r', { title: 'Morning tea' });
    a.apply(b.allOps());
    b.apply(a.allOps());
    expect(a.get('reminder', 'r')).toEqual({ id: 'r', time: '09:00', title: 'Morning tea' });
    b.remove('reminder', 'r');
    a.apply(b.allOps());
    expect(a.list('reminder')).toHaveLength(0);
  });

  it('computes what a peer is missing from its vector', () => {
    const a = new Replica('a', undefined, fixedClock(10));
    const first = a.insert('x', '1', { v: 1 });
    a.insert('x', '2', { v: 2 });
    const peer = new Replica('b');
    peer.apply([first]);
    const missing = a.missingFor(peer.vector());
    expect(missing).toHaveLength(1);
    expect(missing[0]!.id).toBe('2');
  });
});
