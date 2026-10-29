/**
 * ASTCARD-JHD-001 to ASTCARD-JHD-012
 *
 * A change of a journal itself in the assistant chat: what a held change
 * reads first, the words of its row (the verb an update reads as, each
 * setting old to new), the journal card under it with its trips and what the
 * change brings or takes, the receipt, and the ways back with their checks.
 * Every card is checked against the shared union through the registry's guard.
 */
import { buildTripCard } from '../../../../../../src/nest/assistant/assistant-context';
import type { CardReader, PreviewContext, UndoSnapshot } from '../../../../../../src/nest/assistant/cards/card-types';
import { readKey } from '../../../../../../src/nest/assistant/cards/card-values';
import { JOURNEY_CARDS } from '../../../../../../src/nest/assistant/cards/journey';
import {
  loadJournalHeader,
  type JournalHeaderLoaded,
} from '../../../../../../src/nest/assistant/cards/journey/journey-header';
import {
  appliedCardOf,
  ASSISTANT_UNDO_MAP,
  ASSISTANT_WRITE_TOOLS,
  changeCardOf,
  undoReadsOf,
} from '../../../../../../src/nest/assistant/cards/registry';
import { appliedChange, describeToolCall } from '../../../../../../src/nest/assistant/tool-call-preview.helpers';
import { journeyHeaderCardSchema, type AssistantChangePreview, type JourneyHeaderCard } from '@trek/shared';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../../src/nest/audit/audit-log.logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

const ctx: PreviewContext = {
  card: buildTripCard(1, 7, { trip: { title: 'Berlin' } }, null, null),
  categories: new Map(),
  locale: 'en',
  today: '2026-10-24',
  airport: () => null,
};

const AVAILABLE = [
  { id: 5, title: 'Tokyo days', start_date: '2026-11-02', end_date: '2026-11-08', place_count: 9 },
  { id: 6, title: 'Kyoto days', start_date: '2026-11-09', end_date: '2026-11-12', place_count: 4 },
];

function journey(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 12,
    title: 'Japan 2026',
    subtitle: null,
    status: 'active',
    status_override: null,
    show_mood: 1,
    show_verdict: 0,
    hide_skeletons: 0,
    my_role: 'owner',
    updated_at: 100,
    dismissed_count: 3,
    trips: [{ trip_id: 5, title: 'Tokyo days', start_date: '2026-11-02', end_date: '2026-11-08' }],
    entries: [
      { id: 1, type: 'entry', source_trip_id: 5, dismissed: false },
      { id: 2, type: 'skeleton', source_trip_id: 5, dismissed: false },
      { id: 3, type: 'skeleton', source_trip_id: 5, dismissed: false },
    ],
    gallery: [{ id: 1 }, { id: 2 }],
    contributors: [{ user_id: 7 }],
    ...over,
  };
}

function readerOf(answers: Record<string, unknown>): { read: CardReader; asked: string[] } {
  const asked: string[] = [];
  const read: CardReader = (tool, args = {}) => {
    asked.push(readKey(tool, args));
    return Promise.resolve(answers[readKey(tool, args)] ?? answers[tool] ?? null);
  };
  return { read, asked };
}

const loadedWith = (over: Record<string, unknown> = {}): JournalHeaderLoaded => ({
  journey: journey(over),
  available: AVAILABLE,
});

function cardOf(value: unknown): JourneyHeaderCard {
  return journeyHeaderCardSchema.parse(value);
}

describe('the lookups of a journal change', () => {
  it('ASTCARD-JHD-001: a new journal reads the trips it could link, a change the journal it is on', async () => {
    const created = readerOf({ list_journey_available_trips: { trips: AVAILABLE } });
    expect(await loadJournalHeader('create_journey', { title: 'Japan' }, created.read)).toEqual({
      journey: null,
      available: AVAILABLE,
    });
    expect(created.asked).toEqual([readKey('list_journey_available_trips')]);

    const named = readerOf({ get_journey: { journey: journey() } });
    const loaded = await loadJournalHeader('update_journey', { journeyId: 12, title: 'X' }, named.read);
    expect(loaded.journey).toMatchObject({ id: 12 });
    expect(named.asked).toEqual([readKey('get_journey', { journeyId: 12 })]);
    // A journey's own conversation pins the journal, so the read names none.
    const pinned = readerOf({});
    expect(await loadJournalHeader('delete_journey', {}, pinned.read)).toEqual({ journey: null, available: [] });
    expect(pinned.asked).toEqual([readKey('get_journey', {})]);
    const linking = readerOf({});
    await loadJournalHeader('add_journey_trip', { journeyId: 12, tripId: 6 }, linking.read);
    expect(linking.asked).toHaveLength(2);
  });
});

describe('the words of a journal change', () => {
  it('ASTCARD-JHD-002: an update reads as a rename, a status change or a change of settings', () => {
    const loaded = loadedWith();
    const rename = describeToolCall('update_journey', 'c1', { journeyId: 12, title: 'Nippon' }, ctx, loaded);
    expect(rename).toMatchObject({ verbKey: 'renameJournal', subject: 'Japan 2026', undoable: true });
    expect(rename.rows).toEqual([{ op: 'change', labelKey: 'name', before: 'Japan 2026', after: 'Nippon' }]);
    const status = describeToolCall('update_journey', 'c2', { status_override: 'live' }, ctx, loaded);
    expect(status.verbKey).toBe('setJournalStatus');
    expect(status.rows).toEqual([
      { op: 'change', labelKey: 'field', field: 'status_override', before: '', after: 'live' },
    ]);
    const settings = describeToolCall(
      'update_journey',
      'c3',
      { show_mood: false, show_verdict: false, subtitle: 'Autumn', show_trip_tracks: true },
      ctx,
      loaded,
    );
    expect(settings.verbKey).toBe('updateJournalSettings');
    // A setting set to what it holds gets no row; one the journal does not name has no before.
    expect(settings.rows).toEqual([
      { op: 'change', labelKey: 'description', before: null, after: 'Autumn' },
      { op: 'change', labelKey: 'field', field: 'show_mood', before: '✓', after: '✗' },
      { op: 'add', labelKey: 'field', field: 'show_trip_tracks', before: null, after: '✓' },
    ]);
  });

  it('ASTCARD-JHD-003: a trip linked names it, and is undoable only for the owner and a trip not linked yet', () => {
    const add = describeToolCall('add_journey_trip', 'c1', { journeyId: 12, tripId: 6 }, ctx, loadedWith());
    expect(add).toMatchObject({ verbKey: 'linkJournalTrip', subject: 'Japan 2026', undoable: true });
    expect(add.rows).toEqual([{ op: 'add', labelKey: 'field', field: 'trip', before: null, after: 'Kyoto days' }]);
    const again = describeToolCall('add_journey_trip', 'c2', { journeyId: 12, tripId: 5 }, ctx, loadedWith());
    expect(again.undoable).toBe(false);
    const editor = describeToolCall('add_journey_trip', 'c3', { tripId: 6 }, ctx, loadedWith({ my_role: 'editor' }));
    expect(editor.undoable).toBe(false);
  });

  it('ASTCARD-JHD-004: the other changes name the journal, and a deletion or an unlink has no way back', () => {
    const loaded = loadedWith();
    expect(describeToolCall('delete_journey', 'c1', { journeyId: 12 }, ctx, loaded)).toMatchObject({
      verbKey: 'deleteJournal',
      subject: 'Japan 2026',
      undoable: false,
    });
    const unlink = describeToolCall('remove_journey_trip', 'c2', { tripId: 5 }, ctx, loaded);
    expect(unlink).toMatchObject({ verbKey: 'unlinkJournalTrip', undoable: false });
    expect(unlink.rows).toEqual([{ op: 'change', labelKey: 'field', field: 'trip', before: 'Tokyo days', after: '' }]);
    const restore = describeToolCall('restore_journey_suggestions', 'c3', {}, ctx, loaded);
    expect(restore).toMatchObject({ verbKey: 'restoreJournalSuggestions', undoable: false });
    expect(restore.rows).toEqual([{ op: 'add', labelKey: 'field', field: 'suggestions', before: null, after: '3' }]);
    const prefs = describeToolCall('update_journey_preferences', 'c4', { hide_skeletons: true }, ctx, loaded);
    expect(prefs).toMatchObject({ verbKey: 'setJournalPreferences', undoable: true });
    expect(prefs.rows).toEqual([{ op: 'change', labelKey: 'field', field: 'hide_skeletons', before: '✗', after: '✓' }]);
    // Set to what it holds, the switch has no way back that would mean anything.
    expect(describeToolCall('update_journey_preferences', 'c5', { hide_skeletons: false }, ctx, loaded).undoable).toBe(
      false,
    );
    expect(describeToolCall('create_journey', 'c6', { title: 'Japan' }, ctx, null)).toMatchObject({
      verbKey: 'createJournal',
      subject: 'Japan',
      undoable: true,
    });
  });
});

describe('the journal card under a change', () => {
  it('ASTCARD-JHD-005: a new journal shows the trips it links and the places that come in as suggestions', () => {
    const loaded: JournalHeaderLoaded = { journey: null, available: AVAILABLE };
    const card = cardOf(
      changeCardOf('create_journey', ctx, { title: 'Japan 2026', subtitle: 'Autumn', trip_ids: [5, 6, 99] }, loaded),
    );
    expect(card).toMatchObject({ journeyId: null, title: 'Japan 2026', subtitle: 'Autumn', change: 'new' });
    expect(card.trips.map((trip) => [trip.id, trip.change])).toEqual([
      [5, 'link'],
      [6, 'link'],
    ]);
    expect(card.suggestions).toBe(13);
    expect(changeCardOf('create_journey', ctx, {}, loaded)).toBeNull();
  });

  it('ASTCARD-JHD-006: a deletion counts what goes, an unlink what stays and what goes, a link comes first', () => {
    const loaded = loadedWith();
    const deleting = cardOf(changeCardOf('delete_journey', ctx, {}, loaded));
    expect(deleting).toMatchObject({ change: 'willDelete', journeyId: 12, entries: 1, photos: 2 });
    const unlinking = cardOf(changeCardOf('remove_journey_trip', ctx, { tripId: 5 }, loaded));
    expect(unlinking).toMatchObject({ change: 'changed', entries: 1, suggestions: 2, photos: null });
    expect(unlinking.trips).toEqual([
      { id: 5, title: 'Tokyo days', startDate: '2026-11-02', endDate: '2026-11-08', change: 'unlink' },
    ]);
    const linking = cardOf(changeCardOf('add_journey_trip', ctx, { tripId: 6 }, loaded));
    expect(linking.trips.map((trip) => [trip.id, trip.change])).toEqual([
      [6, 'link'],
      [5, 'kept'],
    ]);
    expect(linking).toMatchObject({ suggestions: 4, entries: null });
    expect(changeCardOf('update_journey', ctx, { title: 'X' }, { journey: null, available: [] })).toBeNull();
  });

  it('ASTCARD-JHD-007: the receipt of a new journal names it with its id, a change takes its new name', () => {
    const result = { journey: journey({ entries: [{ type: 'skeleton' }, { type: 'skeleton' }] }) };
    const created = cardOf(appliedCardOf('create_journey', { args: {}, result, preview: null }));
    expect(created).toMatchObject({ journeyId: 12, change: 'new', suggestions: 2 });
    expect(created.trips[0]).toMatchObject({ id: 5, change: 'link' });
    const held = changeCardOf('update_journey', ctx, { title: 'Nippon' }, loadedWith());
    const preview = { card: held } as unknown as AssistantChangePreview;
    const renamed = { journey: journey({ title: 'Nippon' }), previous: { title: 'Japan 2026' } };
    expect(appliedCardOf('update_journey', { args: {}, result: renamed, preview })).toMatchObject({
      title: 'Nippon',
      journeyId: 12,
    });
    expect(appliedCardOf('delete_journey', { args: {}, result: { success: true }, preview })).toBeNull();
    expect(appliedChange('create_journey', 'c1', {}, result, null, null)).toMatchObject({
      entity: 'journey',
      ids: [12],
    });
    expect(appliedChange('delete_journey', 'c2', { journeyId: 12 }, { success: true }, null, null)?.ids).toEqual([12]);
  });
});

function snapshotOf(entries: Array<[string, Record<string, unknown>, unknown]>): UndoSnapshot {
  return {
    summary: null,
    places: null,
    reads: new Map(entries.map(([tool, args, value]) => [readKey(tool, args), value])),
  };
}

function undoOf(tool: string) {
  const undo = JOURNEY_CARDS.tools[tool]?.undo;
  if (!undo) throw new Error(`no undo for ${tool}`);
  return undo;
}

describe('the ways back from a journal change', () => {
  it('ASTCARD-JHD-008: a new journal is deleted while nothing was written, added or laid out in it', () => {
    const undo = undoOf('create_journey');
    const created = journey({ entries: [{ type: 'skeleton' }], gallery: [] });
    const result = { journey: created };
    expect(ASSISTANT_UNDO_MAP.create_journey?.tool).toBe('delete_journey');
    expect(undo.args({}, result, null)).toEqual({ journeyId: 12 });
    expect(undo.args({}, {}, null)).toBeNull();
    expect(undoReadsOf('create_journey', {}, result)).toEqual([
      { tool: 'get_journey', args: { journeyId: 12 } },
      { tool: 'get_book', args: { journeyId: 12 } },
    ]);
    const check = (current: Record<string, unknown>, book: unknown = { exists: false }) =>
      undo.unchanged(
        result,
        snapshotOf([
          ['get_journey', { journeyId: 12 }, { journey: current }],
          ['get_book', { journeyId: 12 }, book],
        ]),
      );
    expect(check(created)).toBe(true);
    expect(check({ ...created, updated_at: 101 })).toBe(false);
    expect(check({ ...created, entries: [{ type: 'entry' }] })).toBe(false);
    expect(check({ ...created, gallery: [{ id: 1 }] })).toBe(false);
    expect(check({ ...created, contributors: [{ user_id: 7 }, { user_id: 8 }] })).toBe(false);
    expect(check(created, { exists: true })).toBe(false);
    expect(check(created, null)).toBe(false);
  });

  it('ASTCARD-JHD-009: changed settings are written back as they were, while the journal was not changed since', () => {
    const undo = undoOf('update_journey');
    const result = { journey: journey({ title: 'Nippon' }), previous: { title: 'Japan 2026', show_mood: true } };
    expect(undo.args({ title: 'Nippon' }, result, null)).toEqual({
      journeyId: 12,
      title: 'Japan 2026',
      show_mood: true,
    });
    expect(undo.args({}, { journey: journey(), previous: {} }, null)).toBeNull();
    // A name or a status stored empty has nothing the tool could take back.
    expect(undo.args({}, { journey: journey(), previous: { title: null, subtitle: null } }, null)).toEqual({
      journeyId: 12,
      subtitle: null,
    });
    const at = (updated: number) =>
      undo.unchanged(
        result,
        snapshotOf([['get_journey', { journeyId: 12 }, { journey: journey({ updated_at: updated }) }]]),
      );
    expect(at(100)).toBe(true);
    expect(at(150)).toBe(false);
  });

  it('ASTCARD-JHD-010: a linked trip is unlinked by its owner while none of its suggestions was written up', () => {
    const undo = undoOf('add_journey_trip');
    const args = { journeyId: 12, tripId: 6 };
    expect(undo.args(args, { success: true }, null)).toEqual({ journeyId: 12, tripId: 6 });
    expect(undo.args({ tripId: 6 }, { success: true }, null)).toEqual({ tripId: 6 });
    expect(undo.args(args, { success: false }, null)).toBeNull();
    const notOwner = { undoable: false } as unknown as AssistantChangePreview;
    expect(undo.args(args, { success: true }, notOwner)).toBeNull();
    const linked = { trips: [{ trip_id: 6 }], entries: [{ type: 'skeleton', source_trip_id: 6 }] };
    const check = (current: Record<string, unknown>) =>
      undo.unchanged({ success: true }, snapshotOf([['get_journey', { journeyId: 12 }, { journey: current }]]), {
        args,
        preview: null,
      });
    expect(check(linked)).toBe(true);
    expect(check({ ...linked, entries: [{ type: 'entry', source_trip_id: 6 }] })).toBe(false);
    expect(check({ ...linked, trips: [] })).toBe(false);
    expect(undo.unchanged({ success: true }, snapshotOf([]), { args: {}, preview: null })).toBe(false);
  });

  it('ASTCARD-JHD-011: the own switch flips back while it still stands as set', () => {
    const undo = undoOf('update_journey_preferences');
    const args = { journeyId: 12, hide_skeletons: true };
    expect(undo.args(args, { hide_skeletons: 1 }, null)).toEqual({ journeyId: 12, hide_skeletons: false });
    expect(undo.args({ journeyId: 12 }, { hide_skeletons: 1 }, null)).toBeNull();
    const same = { undoable: false } as unknown as AssistantChangePreview;
    expect(undo.args(args, { hide_skeletons: 1 }, same)).toBeNull();
    const check = (stored: unknown) =>
      undo.unchanged(
        { hide_skeletons: 1 },
        snapshotOf([['get_journey', { journeyId: 12 }, { journey: { hide_skeletons: stored } }]]),
        { args, preview: null },
      );
    expect(check(1)).toBe(true);
    expect(check(0)).toBe(false);
  });

  it('ASTCARD-JHD-012: the journal changes bring their verbs, the journal as entity, and no way back for a deletion', () => {
    expect(ASSISTANT_WRITE_TOOLS.create_journey).toEqual({ verbKey: 'createJournal', entity: 'journey' });
    expect(ASSISTANT_WRITE_TOOLS.update_journey?.verbKey).toBe('updateJournalSettings');
    expect(ASSISTANT_WRITE_TOOLS.delete_journey?.verbKey).toBe('deleteJournal');
    expect(ASSISTANT_WRITE_TOOLS.add_journey_trip?.verbKey).toBe('linkJournalTrip');
    expect(ASSISTANT_WRITE_TOOLS.remove_journey_trip?.verbKey).toBe('unlinkJournalTrip');
    expect(ASSISTANT_WRITE_TOOLS.restore_journey_suggestions?.verbKey).toBe('restoreJournalSuggestions');
    expect(ASSISTANT_WRITE_TOOLS.update_journey_preferences?.verbKey).toBe('setJournalPreferences');
    for (const tool of ['delete_journey', 'remove_journey_trip', 'restore_journey_suggestions']) {
      expect(ASSISTANT_UNDO_MAP[tool], tool).toBeUndefined();
    }
  });
});
