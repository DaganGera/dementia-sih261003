import { describe, expect, it } from 'vitest';
import { Envelope, Op, StageEstimate, Trial } from './index';

describe('contracts', () => {
  it('accepts a valid trial and rejects an unknown game', () => {
    const base = {
      session_id: 's1', idx: 0, game_id: 'G1', domain: 'visual_memory', design: { pairs: 3 },
      difficulty: -0.5, chance: 0.5, correct: true, rt_ms: 900, hint_used: false, input_mode: 'tap', synthetic: true,
    };
    expect(Trial.safeParse(base).success).toBe(true);
    expect(Trial.safeParse({ ...base, game_id: 'G99' }).success).toBe(false);
  });

  it('validates ops and envelopes', () => {
    expect(Op.safeParse({ op_id: 'a', hlc: 'h', device: 'd', entity: 'person', id: '1', kind: 'set', fields: { name: 'Ama' } }).success).toBe(true);
    expect(Op.safeParse({ op_id: 'a', hlc: 'h', device: 'd', entity: 'person', id: '1', kind: 'delete' }).success).toBe(false);
    expect(Envelope.safeParse({ v: 2 }).success).toBe(false);
  });

  it('requires four stage probabilities', () => {
    const ok = { model_version: 'm2-sim-1', maturity: 'Simulated', at: 1, probs: [0.4, 0.3, 0.2, 0.1], set: [0, 1], abstain: null, contributions: [] };
    expect(StageEstimate.safeParse(ok).success).toBe(true);
    expect(StageEstimate.safeParse({ ...ok, probs: [1] }).success).toBe(false);
  });
});
