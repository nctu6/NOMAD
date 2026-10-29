import { storedTrekCardSchema, trekCardSchema } from './index';
import { JOURNEY_HEADER_LIMITS, journeyHeaderCardSchema } from './journey-header.card';

import { describe, expect, it } from 'vitest';

const card = {
  kind: 'journeyHeader',
  journeyId: 12,
  title: 'Japan 2026',
  subtitle: null,
  change: 'changed',
  trips: [{ id: 5, title: 'Tokyo days', startDate: '2026-11-02', endDate: null, change: 'link' }],
  entries: 3,
  photos: null,
  suggestions: 9,
} as const;

describe('journeyHeaderCardSchema', () => {
  it('JOURNEYHEADER-001: is part of the card union and reads as itself', () => {
    expect(trekCardSchema.parse(card)).toEqual(card);
    expect(storedTrekCardSchema.parse(card)).toEqual(card);
  });

  it('JOURNEYHEADER-002: takes a new journal without an id, and a trip the user trips do not list', () => {
    const fresh = { ...card, journeyId: null, change: 'new', trips: [{ ...card.trips[0], id: null }] };
    expect(journeyHeaderCardSchema.parse(fresh)).toEqual(fresh);
  });

  it('JOURNEYHEADER-003: refuses an unknown change, too many trips, an empty title or a negative count', () => {
    expect(journeyHeaderCardSchema.safeParse({ ...card, change: 'renamed' }).success).toBe(false);
    const many = Array.from({ length: JOURNEY_HEADER_LIMITS.trips + 1 }, () => card.trips[0]);
    expect(journeyHeaderCardSchema.safeParse({ ...card, trips: many }).success).toBe(false);
    expect(journeyHeaderCardSchema.safeParse({ ...card, title: '' }).success).toBe(false);
    expect(journeyHeaderCardSchema.safeParse({ ...card, entries: -1 }).success).toBe(false);
    expect(journeyHeaderCardSchema.safeParse({ ...card, trips: [{ ...card.trips[0], change: 'moved' }] }).success).toBe(
      false,
    );
  });
});
