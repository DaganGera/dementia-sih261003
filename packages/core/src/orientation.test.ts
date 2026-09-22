import { describe, expect, it } from 'vitest';
import { isValidFestivalDate, nextFestival, seasonFor, SEASON_LABEL, type FestivalEntry } from './orientation';

describe('season', () => {
  it('follows the Indian meteorological convention', () => {
    expect(seasonFor(1)).toBe('winter');
    expect(seasonFor(12)).toBe('winter');
    expect(seasonFor(4)).toBe('summer');
    expect(seasonFor(7)).toBe('monsoon');
    expect(seasonFor(9)).toBe('monsoon');
    expect(seasonFor(10)).toBe('autumn');
    expect(seasonFor(11)).toBe('autumn');
    expect(Object.keys(SEASON_LABEL).length).toBe(4);
  });
});

describe('festival date validity', () => {
  it('rejects an out of range month or day', () => {
    expect(isValidFestivalDate(0, 1)).toBe(false);
    expect(isValidFestivalDate(13, 1)).toBe(false);
    expect(isValidFestivalDate(2, 30)).toBe(false);
    expect(isValidFestivalDate(2, 29)).toBe(false);
    expect(isValidFestivalDate(4, 31)).toBe(false);
  });

  it('accepts a real date', () => {
    expect(isValidFestivalDate(2, 28)).toBe(true);
    expect(isValidFestivalDate(4, 30)).toBe(true);
    expect(isValidFestivalDate(12, 31)).toBe(true);
  });
});

const entry = (over: Partial<FestivalEntry>): FestivalEntry => ({ id: 'f1', name: 'Bihu', month: 4, day: 14, source: 'family', approved: true, addedAt: 0, ...over });

describe('next festival', () => {
  it('is null with no list, and null while every entry is unapproved', () => {
    expect(nextFestival([])).toBeNull();
    expect(nextFestival([entry({ approved: false })], new Date(2026, 0, 1))).toBeNull();
  });

  it('ignores a malformed entry rather than crashing', () => {
    expect(nextFestival([entry({ month: 13, day: 1 })], new Date(2026, 0, 1))).toBeNull();
  });

  it('finds the nearest approved festival later this year', () => {
    const list = [entry({ id: 'a', name: 'Bihu', month: 4, day: 14 }), entry({ id: 'b', name: 'Durga Puja', month: 10, day: 20 })];
    const r = nextFestival(list, new Date(2026, 2, 1)); // 1 March 2026
    expect(r?.entry.id).toBe('a');
    expect(r?.daysAway).toBe(44);
  });

  it('wraps into next year once every date this year has passed', () => {
    const list = [entry({ id: 'a', name: 'Bihu', month: 4, day: 14 })];
    const r = nextFestival(list, new Date(2026, 11, 1)); // 1 December 2026
    expect(r?.entry.id).toBe('a');
    expect(new Date(2026, 11, 1).getTime() + (r?.daysAway ?? 0) * 86_400_000).toBeGreaterThan(new Date(2027, 3, 13).getTime());
  });

  it('is today with zero days away when the festival is today', () => {
    const list = [entry({ month: 6, day: 15 })];
    const r = nextFestival(list, new Date(2026, 5, 15, 18, 30));
    expect(r?.daysAway).toBe(0);
  });
});
