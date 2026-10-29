import { describe, expect, it } from 'vitest';
import { dayPlaceCounts } from './dayPlaceCounts';

describe('dayPlaceCounts', () => {
  it('counts two ordinary visits of the same place and ignores a second copy of the same row', () => {
    const place = { id: 5 };
    const stats = dayPlaceCounts([
      { id: 1, place, place_id: 5 },
      { id: 1, place, place_id: 5 },
      { id: 2, place, place_id: 5 },
      { id: 3, place: { id: 6 }, place_id: 6 },
    ]);
    expect(stats.counts.get(5)).toBe(2);
    expect(stats.counts.get(6)).toBe(1);
    expect(stats.blocked.size).toBe(0);
  });

  it('blocks a place a lodging booking already holds, and does not count that row as a visit', () => {
    const hotel = { id: 5 };
    const stats = dayPlaceCounts([
      { id: 1, place: hotel, place_id: 5, accommodation_id: 4 },
      { id: 2, place: hotel, place_id: 5 },
    ]);
    expect(stats.blocked.has(5)).toBe(true);
    expect(stats.counts.get(5)).toBe(1);
  });

  it('treats an empty accommodation id as an ordinary visit', () => {
    const stats = dayPlaceCounts([{ id: 1, place_id: 8, accommodation_id: '' }]);
    expect(stats.blocked.has(8)).toBe(false);
    expect(stats.counts.get(8)).toBe(1);
  });
});
