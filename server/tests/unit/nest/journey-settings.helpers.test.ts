/**
 * The one reading of a journey's settings both the REST route and the MCP
 * tool update through, and what an update replaced, as the undo writes it
 * back: only the columns the update named, flags as booleans.
 */
import { journeySettingsPatch, previousSettings } from '../../../src/nest/journey/journey-settings.helpers';

import { describe, expect, it } from 'vitest';

describe('journeySettingsPatch', () => {
  it('JSET-001: writes only what the input names, every flag as 0 or 1, null where it clears', () => {
    expect(journeySettingsPatch({ title: 'Japan', show_mood: false, show_trip_tracks: true, subtitle: null })).toEqual({
      title: 'Japan',
      subtitle: null,
      show_mood: 0,
      show_trip_tracks: 1,
    });
    expect(journeySettingsPatch({})).toEqual({});
    expect(journeySettingsPatch({ auto_prepare_recordings: 1, cover_gradient: null })).toEqual({
      auto_prepare_recordings: 1,
      cover_gradient: null,
    });
  });

  it('JSET-002: leaves a status or an override outside its allow-list alone, and takes null back to the dates', () => {
    expect(journeySettingsPatch({ status: 'bogus', status_override: 'upcoming' })).toEqual({});
    expect(journeySettingsPatch({ status: 'archived', status_override: null })).toEqual({
      status: 'archived',
      status_override: null,
    });
  });
});

describe('previousSettings', () => {
  const row = { title: 'Japan', subtitle: null, show_mood: 1, show_verdict: 0, status: 'active', cover_gradient: null };

  it('JSET-010: reads the stored values of exactly the written columns, flags as booleans', () => {
    const patch = journeySettingsPatch({ title: 'Nippon', show_mood: false, show_verdict: true, subtitle: 'Autumn' });
    expect(previousSettings(row, patch)).toEqual({
      title: 'Japan',
      subtitle: null,
      show_mood: true,
      show_verdict: false,
    });
  });

  it('JSET-011: a column the row does not hold reads as null, and a journey that is gone gives nulls', () => {
    const patch = journeySettingsPatch({ status_override: 'live', show_weather: true });
    expect(previousSettings(row, patch)).toEqual({ status_override: null, show_weather: false });
    expect(previousSettings(undefined, journeySettingsPatch({ title: 'X' }))).toEqual({ title: null });
  });
});
