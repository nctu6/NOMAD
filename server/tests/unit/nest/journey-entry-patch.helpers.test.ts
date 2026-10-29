/**
 * The one reading of an entry update every surface makes, and what it
 * replaced: the columns it writes as they are stored, the skeleton promoted
 * by a story, and the entry's earlier values of exactly the fields it names.
 */
import { entryPrevious, entryUpdatePatch } from '../../../src/nest/journey/journey-entry-patch.helpers';
import type { JourneyEntry } from '../../../src/types';

import { describe, expect, it } from 'vitest';

function entry(over: Partial<JourneyEntry> = {}): JourneyEntry {
  return {
    id: 12,
    journey_id: 3,
    author_id: 7,
    type: 'entry',
    title: 'Vik',
    story: null,
    entry_date: '2026-07-01',
    entry_time: '14:30',
    location_lat: 63.4,
    location_lng: -19.04,
    tags: '["beach"]',
    pros_cons: null,
    visibility: 'private',
    sort_order: 0,
    dismissed: 0,
    stats_excluded: 0,
    is_draft: 1,
    ...over,
  } as JourneyEntry;
}

describe('entryUpdatePatch', () => {
  it('JEPATCH-001: writes the named columns as stored, the country only with a coordinate, and always the time', () => {
    const patch = entryUpdatePatch(entry(), { title: 'Reynisfjara', tags: ['sand'], is_draft: false }, 'IS', 99);
    expect(patch).toEqual({ title: 'Reynisfjara', tags: '["sand"]', is_draft: 0, updated_at: 99 });
    const placed = entryUpdatePatch(entry(), { location_lat: null as unknown as number }, null, 99);
    expect(placed).toEqual({ location_lat: null, country_code: null, updated_at: 99 });
    expect(entryUpdatePatch(entry(), { tags: null as unknown as string[] }, null, 1)).toEqual({
      tags: null,
      updated_at: 1,
    });
  });

  it('JEPATCH-002: a story on a suggestion makes it an entry, over the type the call names', () => {
    const skeleton = entry({ type: 'skeleton' });
    expect(entryUpdatePatch(skeleton, { story: 'Windy', type: 'checkin' }, null, 1)).toMatchObject({ type: 'entry' });
    expect(entryUpdatePatch(skeleton, { story: '  ' }, null, 1)).not.toHaveProperty('type');
  });
});

describe('entryPrevious', () => {
  it('JEPATCH-010: answers the entry earlier values of the fields named, decoded, nothing else', () => {
    expect(entryPrevious(entry(), { title: 'X', tags: [], is_draft: false, location_lat: 1 })).toEqual({
      title: 'Vik',
      tags: ['beach'],
      is_draft: true,
      location_lat: 63.4,
    });
    expect(entryPrevious(entry(), { sort_order: 4 })).toEqual({});
  });

  it('JEPATCH-011: a suggestion written up goes back to being a suggestion', () => {
    expect(entryPrevious(entry({ type: 'skeleton' }), { story: 'Windy' })).toEqual({ story: null, type: 'skeleton' });
    expect(entryPrevious(entry({ type: 'skeleton' }), { story: '' })).toEqual({ story: null });
  });
});
