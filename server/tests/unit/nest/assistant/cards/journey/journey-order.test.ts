/**
 * ASTCARD-JORD-001 to ASTCARD-JORD-007
 *
 * The rest of a journal entry's changes in the assistant chat: an update's
 * tags, verdict and coordinates on the row and the card, a new order of the
 * entries with its way back, a changed entry written back as it was, and a
 * Dawarich stay taken in as an entry. Every card is checked against the
 * shared union through the registry's guard.
 */
import { buildTripCard } from '../../../../../../src/nest/assistant/assistant-context';
import type { CardReader, PreviewContext, UndoSnapshot } from '../../../../../../src/nest/assistant/cards/card-types';
import { readKey } from '../../../../../../src/nest/assistant/cards/card-values';
import { JOURNEY_CARDS } from '../../../../../../src/nest/assistant/cards/journey';
import type { JournalLoaded } from '../../../../../../src/nest/assistant/cards/journey/journey-change';
import { lookOf } from '../../../../../../src/nest/assistant/cards/journey/journey-look';
import { loadJournalOrder, loadStay } from '../../../../../../src/nest/assistant/cards/journey/journey-order';
import { ASSISTANT_WRITE_TOOLS, changeCardOf } from '../../../../../../src/nest/assistant/cards/registry';
import { describeToolCall } from '../../../../../../src/nest/assistant/tool-call-preview.helpers';
import { journeyEntriesCardSchema, type JourneyEntriesCard } from '@trek/shared';

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

function cardOf(value: unknown): JourneyEntriesCard {
  return journeyEntriesCardSchema.parse(value);
}

function readerOf(answers: Record<string, unknown>): { read: CardReader; asked: string[] } {
  const asked: string[] = [];
  const read: CardReader = (tool, args = {}) => {
    asked.push(readKey(tool, args));
    return Promise.resolve(answers[readKey(tool, args)] ?? answers[tool] ?? null);
  };
  return { read, asked };
}

function undoOf(tool: string) {
  const undo = JOURNEY_CARDS.tools[tool]?.undo;
  if (!undo) throw new Error(`no undo for ${tool}`);
  return undo;
}

const SPREE = {
  id: 12,
  journey_id: 3,
  type: 'entry',
  title: 'Sunset at the Spree',
  entry_date: '2026-10-21',
  tags: ['river', 'evening'],
  pros_cons: { pros: ['the light'], cons: [] },
  location_lat: null,
  location_lng: null,
  photos: [],
  updated_at: 5,
};

describe('the tags, the verdict and the coordinates of an entry', () => {
  it('ASTCARD-JORD-001: an entry shows its first tags and how its verdict leans', () => {
    expect(lookOf(SPREE)).toMatchObject({
      tags: ['river', 'evening'],
      verdict: { pros: ['the light'], cons: [], prosCount: 1, consCount: 0 },
    });
    const many = { ...SPREE, tags: Array.from({ length: 9 }, (_, i) => `t${i}`), pros_cons: null };
    expect(lookOf(many)?.tags).toHaveLength(6);
    expect(lookOf(many)?.verdict).toBeNull();
    expect(lookOf({ ...SPREE, tags: 'not a list', pros_cons: { pros: [' '], cons: [] } })).toMatchObject({
      tags: [],
      verdict: null,
    });
  });

  it('ASTCARD-JORD-002: an update names the tags, each side of the verdict and the coordinates it changes', () => {
    const loaded: JournalLoaded = { entry: SPREE, journeyId: 3, title: 'Berlin', tripJournal: false };
    const args = {
      entryId: 12,
      tags: ['river'],
      pros_cons: { pros: ['the light', 'calm'], cons: ['cold'] },
      location_lat: 52.52,
      location_lng: 13.405,
    };
    const preview = describeToolCall('update_journey_entry', 'c1', args, ctx, loaded);
    expect(preview.rows).toEqual([
      { op: 'change', labelKey: 'field', field: 'tags', before: 'river, evening', after: 'river' },
      { op: 'change', labelKey: 'field', field: 'pros', before: 'the light', after: 'the light, calm' },
      { op: 'change', labelKey: 'field', field: 'cons', before: null, after: 'cold' },
      { op: 'change', labelKey: 'coordinates', before: null, after: '52.5200, 13.4050' },
    ]);
    // The card shows the entry with what the call sets, the verdict and the tags included.
    const card = cardOf(changeCardOf('update_journey_entry', ctx, args, loaded));
    expect(card.entries[0]).toMatchObject({ tags: ['river'], verdict: { prosCount: 2, consCount: 1 } });
    expect(card.entries[0]?.point).toEqual({ lat: 52.52, lng: 13.405 });
    // A list set to what it holds gets no row.
    expect(
      describeToolCall('update_journey_entry', 'c2', { entryId: 12, tags: ['river', 'evening'] }, ctx, loaded).rows,
    ).toEqual([]);
  });

  it('ASTCARD-JORD-003: a changed entry is written back from what the tool answered it replaced', () => {
    const undo = undoOf('update_journey_entry');
    const result = { entry: { ...SPREE, title: 'Evening' }, previous: { title: 'Sunset at the Spree', tags: [] } };
    expect(undo.args({}, result, null)).toEqual({ entryId: 12, title: 'Sunset at the Spree', tags: [] });
    expect(undo.args({}, { entry: SPREE, previous: {} }, null)).toBeNull();
    const snapshot = (current: unknown): UndoSnapshot => ({
      summary: null,
      places: null,
      reads: new Map([[readKey('get_journey_entry', { entryId: 12 }), current]]),
    });
    expect(undo.unchanged(result, snapshot({ entry: { ...SPREE, title: 'Evening' } }))).toBe(true);
    expect(undo.unchanged(result, snapshot({ entry: { ...SPREE, updated_at: 6 } }))).toBe(false);
  });
});

const ENTRIES = [
  { id: 1, title: 'Arrival', entry_date: '2026-10-21', sort_order: 0, photos: [] },
  { id: 2, title: 'Museum Island', entry_date: '2026-10-21', sort_order: 1, photos: [] },
  { id: 3, title: 'Dinner', entry_date: '2026-10-21', sort_order: 2, photos: [] },
];

describe('a new order of the entries', () => {
  it('ASTCARD-JORD-004: reads the journal, names the entries that move, and draws them in their new places', async () => {
    const { read, asked } = readerOf({
      list_journey_entries: { journey: { id: 3, title: 'Berlin' }, entries: ENTRIES },
    });
    const loaded = await loadJournalOrder({ journeyId: 3, orderedIds: [2, 1, 3] }, read);
    expect(asked).toEqual([readKey('list_journey_entries', { journeyId: 3 })]);
    expect(loaded).toMatchObject({ journeyId: 3, title: 'Berlin' });
    const preview = describeToolCall('reorder_journey_entries', 'c1', { orderedIds: [2, 1, 3] }, ctx, loaded);
    expect(preview).toMatchObject({ verbKey: 'reorderJournalEntries', subject: 'Berlin', undoable: true });
    expect(preview.rows).toEqual([
      { op: 'change', labelKey: 'order', before: 'Arrival, Museum Island', after: 'Museum Island, Arrival' },
    ]);
    const card = cardOf(preview.card);
    expect(card.change).toBe('reordered');
    expect(card.entries.map((look) => [look.entryId, look.moved])).toEqual([
      [2, true],
      [1, true],
    ]);
    expect(await loadJournalOrder({}, readerOf({}).read)).toBeNull();
    expect(ASSISTANT_WRITE_TOOLS.reorder_journey_entries).toEqual({
      verbKey: 'reorderJournalEntries',
      entity: 'journey_entry',
    });
  });

  it('ASTCARD-JORD-005: is taken back to the order before while every entry still stands where it put it', () => {
    const undo = undoOf('reorder_journey_entries');
    const args = { journeyId: 3, orderedIds: [2, 1, 3] };
    const result = { success: true, previous_order: [1, 2, 3] };
    expect(undo.args(args, result, null)).toEqual({ journeyId: 3, orderedIds: [1, 2, 3] });
    expect(undo.args({ orderedIds: [1, 2, 3] }, result, null)).toBeNull();
    expect(undo.args(args, { success: true }, null)).toBeNull();
    const check = (entries: unknown[]) =>
      undo.unchanged(
        result,
        {
          summary: null,
          places: null,
          reads: new Map([[readKey('list_journey_entries', { journeyId: 3 }), { entries }]]),
        },
        { args, preview: null },
      );
    expect(
      check([
        { id: 2, sort_order: 0 },
        { id: 1, sort_order: 1 },
        { id: 3, sort_order: 2 },
      ]),
    ).toBe(true);
    expect(
      check([
        { id: 1, sort_order: 0 },
        { id: 2, sort_order: 1 },
        { id: 3, sort_order: 2 },
      ]),
    ).toBe(false);
  });
});

const STAY = {
  id: 4,
  name: 'Berlin Hauptbahnhof',
  lat: 52.525,
  lng: 13.369,
  startedAt: '2026-10-20T09:15:00+02:00',
  localDate: '2026-10-20',
};

describe('a Dawarich stay taken in as an entry', () => {
  it('ASTCARD-JORD-006: reads the stay and the journal, and shows the entry the stay becomes', async () => {
    const { read, asked } = readerOf({
      list_dawarich_suggestions: { suggestions: [STAY] },
      get_journey: { journey: { id: 3, title: 'Berlin' } },
    });
    const args = { suggestionId: 4, journalId: 3, notes: 'Arrived early' };
    const loaded = await loadStay(args, read);
    expect(asked).toEqual([
      readKey('list_dawarich_suggestions', { limit: 200 }),
      readKey('get_journey', { journeyId: 3 }),
    ]);
    const preview = describeToolCall('accept_dawarich_suggestion_as_journal_entry', 'c1', args, ctx, loaded);
    expect(preview).toMatchObject({ verbKey: 'addJournalEntry', subject: 'Berlin Hauptbahnhof', undoable: false });
    expect(preview.rows.map((row) => [row.labelKey, row.after])).toEqual([
      ['day', 'Tue, Oct 20'],
      ['time', '09:15'],
      ['location', 'Berlin Hauptbahnhof'],
      ['text', 'Arrived early'],
    ]);
    const card = cardOf(preview.card);
    expect(card).toMatchObject({ journeyId: 3, journalTitle: 'Berlin', change: 'new' });
    expect(card.entries[0]).toMatchObject({ entryId: null, date: '2026-10-20', point: { lat: 52.525, lng: 13.369 } });
  });

  it('ASTCARD-JORD-007: a correction wins over the stay, and a stay no longer listed draws no card', async () => {
    const loaded = { stay: STAY, journeyId: 3, title: 'Berlin' };
    const fixed = describeToolCall(
      'accept_dawarich_suggestion_as_journal_entry',
      'c1',
      { suggestionId: 4, name: 'Hbf', date: '2026-10-19', time: '20:00' },
      ctx,
      loaded,
    );
    expect(fixed.subject).toBe('Hbf');
    expect(fixed.rows.map((row) => row.after)).toEqual(['Mon, Oct 19', '20:00', 'Hbf']);
    expect(
      changeCardOf('accept_dawarich_suggestion_as_journal_entry', ctx, { suggestionId: 4 }, { ...loaded, stay: null }),
    ).toBeNull();
    expect(await loadStay({}, readerOf({}).read)).toBeNull();
  });
});
