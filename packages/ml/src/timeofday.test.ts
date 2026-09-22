import { describe, expect, it } from 'vitest';
import { calmingSuggestion, CALMING_SUGGESTIONS, dayPart, MIN_SAMPLES_PER_GROUP, timeOfDay, type TimeSample } from './timeofday';

describe('day part boundaries', () => {
  it('buckets each hour', () => {
    expect(dayPart(5)).toBe('morning');
    expect(dayPart(11)).toBe('morning');
    expect(dayPart(12)).toBe('afternoon');
    expect(dayPart(16)).toBe('afternoon');
    expect(dayPart(17)).toBe('evening');
    expect(dayPart(20)).toBe('evening');
    expect(dayPart(21)).toBe('night');
    expect(dayPart(4)).toBe('night');
    expect(dayPart(0)).toBe('night');
    expect(dayPart(24)).toBe('night'); // wraps to hour 0
  });
});

function even(hours: number[], value: (h: number) => number): TimeSample[] {
  return hours.map((h) => ({ hour: h, excess: value(h) }));
}

describe('time of day pattern', () => {
  it('needs enough sessions in both evening and the rest of the day before it says anything', () => {
    const few = timeOfDay([{ hour: 18, excess: -0.5 }, { hour: 9, excess: 0.1 }]);
    expect(few.enough).toBe(false);
    expect(few.eveningDip).toBe(false);
  });

  it('flags a real evening dip', () => {
    const hours = [8, 9, 10, 11, 13, 14, 15, 16, 18, 18, 19, 19, 20, 20];
    const samples = even(hours, (h) => (h >= 17 && h < 21 ? -0.3 : 0.05));
    const r = timeOfDay(samples);
    expect(r.enough).toBe(true);
    expect(r.eveningDip).toBe(true);
    const evening = r.parts.find((p) => p.part === 'evening')!;
    expect(evening.n).toBeGreaterThanOrEqual(MIN_SAMPLES_PER_GROUP);
  });

  it('does not flag someone whose evenings are no different, even with the same volume', () => {
    const hours = [8, 9, 10, 11, 13, 14, 15, 16, 18, 18, 19, 19, 20, 20];
    const samples = even(hours, () => 0.05);
    const r = timeOfDay(samples);
    expect(r.enough).toBe(true);
    expect(r.eveningDip).toBe(false);
  });

  it('rotates a short, calm suggestion without repeating the exact same line every call', () => {
    const a = calmingSuggestion(10);
    const b = calmingSuggestion(11);
    expect(CALMING_SUGGESTIONS).toContain(a);
    expect(CALMING_SUGGESTIONS).toContain(b);
    expect(a).not.toBe(b);
  });
});
