/**
 * The home chat in its pure parts: the user's trips as the home card reads
 * them (where each stands, which comes next, how many are left out), the
 * context and instructions of a home turn, the step that offers a trip's own
 * chat and the card it shows, and which tools the home chat keeps.
 */
import { emptyTripCard } from '../../../../src/nest/assistant/assistant-book-context';
import {
  homeCardFrom,
  homeCardOf,
  homePrompt,
  homeTurnContext,
  OPEN_TRIP_CHAT_SPEC,
  OPEN_TRIP_CHAT_TOOL,
  openTripChat,
  phaseOf,
  renderHomeCard,
  tripsOf,
} from '../../../../src/nest/assistant/assistant-home';
import {
  OPEN_JOURNEY_CHAT_SPEC,
  OPEN_JOURNEY_CHAT_TOOL,
  openJourneyChat,
} from '../../../../src/nest/assistant/assistant-home-journeys';
import { HOME_USE_TOOLS_SPEC, keptAtHome, USE_TOOLS_SPEC } from '../../../../src/nest/assistant/assistant-tool-offer';
import { journalChatAnswer, tripChatAnswer } from '../../../../src/nest/assistant/cards/home';
import { answerCardOf } from '../../../../src/nest/assistant/cards/registry';

import { describe, expect, it, vi } from 'vitest';

const TODAY = '2026-10-23';

function row(id: number, title: string, start: string | null, end: string | null, extra: Record<string, unknown> = {}) {
  return { id, title, start_date: start, end_date: end, place_count: 4, shared_count: 0, is_owner: 1, ...extra };
}

const LISTED = {
  trips: [
    row(1, 'Lisbon', '2026-10-20', '2026-10-27'),
    row(2, 'Kyoto', '2026-12-01', '2026-12-10', { shared_count: 2 }),
    row(3, 'Oslo', '2026-11-05', '2026-11-08'),
    row(4, 'Rome', '2026-05-01', '2026-05-07', { is_archived: 1 }),
    row(5, 'Someday', null, null, { place_count: null }),
    row(6, 'Porto', '2025-09-01', '2025-09-04', { is_owner: 0 }),
  ],
};

describe('the trips of the home card', () => {
  it('ASTHOME-001: tells where a trip stands on a day, with one date standing for both', () => {
    expect(phaseOf('2026-10-20', '2026-10-27', TODAY)).toBe('now');
    expect(phaseOf('2026-10-23', null, TODAY)).toBe('now');
    expect(phaseOf('2026-11-01', '2026-11-03', TODAY)).toBe('upcoming');
    expect(phaseOf(null, '2026-01-03', TODAY)).toBe('past');
    expect(phaseOf(null, null, TODAY)).toBe('undated');
  });

  it('ASTHOME-002: reads the rows of list_trips once each, and nothing without an id or a title', () => {
    const trips = tripsOf(
      { trips: [...LISTED.trips, row(1, 'Again', null, null), { id: 0, title: 'x' }, { id: 9, title: '  ' }, null] },
      TODAY,
    );
    expect(trips.map((trip) => trip.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(trips.find((trip) => trip.id === 2)).toMatchObject({ shared: true, placeCount: 4 });
    expect(trips.find((trip) => trip.id === 4)).toMatchObject({ archived: true, phase: 'past' });
    expect(trips.find((trip) => trip.id === 5)).toMatchObject({ placeCount: null, phase: 'undated' });
    expect(trips.find((trip) => trip.id === 6)).toMatchObject({ shared: true });
    expect(tripsOf(null, TODAY)).toEqual([]);
    expect(tripsOf({ trips: 'none' }, TODAY)).toEqual([]);
  });

  it('ASTHOME-003: lists the trip under way, the next ones soonest first, the latest behind and the undated', () => {
    const card = homeCardOf(tripsOf(LISTED, TODAY));
    expect(card.trips.map((trip) => [trip.id, trip.phase])).toEqual([
      [1, 'now'],
      [3, 'next'],
      [2, 'upcoming'],
      [4, 'past'],
      [6, 'past'],
      [5, 'undated'],
    ]);
    expect(card.total).toBe(6);
  });

  it('ASTHOME-004: keeps a long history short and says how many it leaves out', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      row(100 + i, `Past ${i}`, `2025-0${(i % 9) + 1}-01`, `2025-0${(i % 9) + 1}-02`),
    );
    const card = homeCardOf(tripsOf({ trips: many }, TODAY));
    expect(card.trips).toHaveLength(4);
    expect(renderHomeCard(card)).toContain('and 8 more; list_trips lists them all.');
  });

  it('ASTHOME-005: renders one trip a line, with its id, and says when there is none', () => {
    const text = renderHomeCard(homeCardOf(tripsOf(LISTED, TODAY)));
    expect(text.split('\n')[0]).toBe("The user's trips (trip id | title | where it stands):");
    expect(text).toContain('1 | Lisbon | under way, 2026-10-20 to 2026-10-27, 4 places');
    expect(text).toContain('3 | Oslo | next, 2026-11-05 to 2026-11-08, 4 places');
    expect(text).toContain('2 | Kyoto | later, 2026-12-01 to 2026-12-10, 4 places, shared');
    expect(text).toContain('4 | Rome | behind, 2026-05-01 to 2026-05-07, 4 places, archived');
    expect(text).toMatch(/^5 \| Someday \| no dates$/m);
    expect(text).not.toContain('more;');
    expect(renderHomeCard({ trips: [], total: 0 })).toBe('The user has no trips yet.');
  });

  it('ASTHOME-006: is read through the session, and empty when the trips cannot be read', async () => {
    const read = vi.fn(async () => ({ ok: true, value: LISTED }));
    expect((await homeCardFrom({ read }, TODAY)).total).toBe(6);
    expect(read).toHaveBeenCalledWith('list_trips', {});
    expect(await homeCardFrom({ read: async () => ({ ok: false, value: 'no' }) }, TODAY)).toEqual({
      trips: [],
      total: 0,
    });
  });
});

describe('a home turn', () => {
  it('ASTHOME-010: brings the date, the units and the home card in its own tags', () => {
    const card = homeCardOf(tripsOf(LISTED, TODAY));
    const now = new Date('2026-10-23T09:00:00Z');
    const context = homeTurnContext(card, 'Europe/Berlin', now, { distance_unit: 'metric' });
    const lines = context.split('\n');
    expect(lines[0]).toBe('Today is 2026-10-23 (time zone Europe/Berlin).');
    expect(lines[1]).toBe('The user prefers distances in km.');
    expect(context).toContain('<home_card>');
    expect(context).toContain('</home_card>');
    expect(homeTurnContext(card, 'UTC', now, {}).split('\n')[1]).toBe('');
  });

  it('ASTHOME-011: tells the model what it can do here and that a trip is changed in its own chat', () => {
    const prompt = homePrompt('German');
    expect(prompt).toContain('in German');
    expect(prompt).not.toContain('{language}');
    expect(prompt).toContain('open_trip_chat');
    expect(prompt).toContain('You cannot change a trip from here.');
    expect(prompt).toContain('use_addon_tools');
    expect(OPEN_TRIP_CHAT_SPEC.name).toBe(OPEN_TRIP_CHAT_TOOL);
    expect(OPEN_TRIP_CHAT_SPEC.parameters.required).toEqual(['tripId']);
    expect(prompt).toContain('open_journey_chat');
    expect(prompt).toContain('create_journey');
    expect(OPEN_JOURNEY_CHAT_SPEC.name).toBe(OPEN_JOURNEY_CHAT_TOOL);
    expect(OPEN_JOURNEY_CHAT_SPEC.parameters.required).toEqual(['journeyId']);
  });

  it('ASTHOME-012: the step that loads groups says what needs nothing loaded in each chat', () => {
    expect(HOME_USE_TOOLS_SPEC.name).toBe(USE_TOOLS_SPEC.name);
    expect(HOME_USE_TOOLS_SPEC.parameters).toEqual(USE_TOOLS_SPEC.parameters);
    expect(HOME_USE_TOOLS_SPEC.description).toContain('list_trips');
    expect(USE_TOOLS_SPEC.description).toContain('The trip itself');
  });
});

describe("the way into a trip's chat", () => {
  const listed = { ok: true, value: LISTED };

  it("ASTHOME-020: answers with one of the user's trips and the question, cleaned up", () => {
    const run = openTripChat({ tripId: 3, question: '  What is   left to book? ' }, listed, TODAY);
    expect(run).toMatchObject({
      ok: true,
      value: {
        trip: { id: 3, title: 'Oslo', startDate: '2026-11-05', endDate: '2026-11-08', phase: 'next', placeCount: 4 },
        question: 'What is left to book?',
      },
    });
    expect(openTripChat({ tripId: 2 }, listed, TODAY)).toMatchObject({ value: { question: null } });
  });

  it('ASTHOME-021: a trip past the card is still found, and one the user cannot open is refused', () => {
    const many = { ok: true, value: { trips: Array.from({ length: 9 }, (_, i) => row(i + 1, `T${i}`, null, null)) } };
    expect(openTripChat({ tripId: 9 }, many, TODAY)).toMatchObject({ ok: true, value: { trip: { id: 9 } } });
    expect(openTripChat({ tripId: 77 }, listed, TODAY)).toMatchObject({ ok: false });
    expect(openTripChat({ tripId: 3 }, { ok: false, value: 'no' }, TODAY)).toMatchObject({ ok: false });
    expect(openTripChat({}, listed, TODAY)).toMatchObject({ ok: false });
  });

  it('ASTHOME-022: shows a card, reading where the trip stands in the user zone', () => {
    const run = openTripChat({ tripId: 3, question: 'Pack list?' }, listed, TODAY);
    const input = { toolCallId: 'c1', args: {}, value: run.value, card: emptyTripCard(1), today: TODAY };
    expect(tripChatAnswer(input)).toEqual({
      kind: 'tripChat',
      trip: { id: 3, title: 'Oslo', startDate: '2026-11-05', endDate: '2026-11-08', phase: 'next', placeCount: 4 },
      question: 'Pack list?',
    });
    // The day it starts on, it is under way, whatever the step read.
    expect(tripChatAnswer({ ...input, today: '2026-11-05' })).toMatchObject({ trip: { phase: 'now' } });
    expect(answerCardOf(OPEN_TRIP_CHAT_TOOL, input)).toMatchObject({ kind: 'tripChat' });
  });

  it('ASTHOME-023: shows no card for an answer without a trip or with a broken one', () => {
    const base = { toolCallId: 'c1', args: {}, card: emptyTripCard(1), today: TODAY };
    expect(tripChatAnswer({ ...base, value: 'No trip' })).toBeNull();
    expect(tripChatAnswer({ ...base, value: { trip: { id: 0, title: '' } } })).toBeNull();
  });
});

describe("the way onto a journal's page", () => {
  const journal = {
    id: 12,
    title: '  Japan   2026 ',
    subtitle: '',
    trip_date_min: '2026-11-02',
    trip_date_max: '2026-11-16 00:00:00',
    entry_count: 4,
    photo_count: 120,
  };
  const listed = { ok: true, value: { journeys: [journal, { id: 13, title: 'Other' }] } };

  it("ASTHOME-040: answers with one of the user's journals and the question, cleaned up", () => {
    expect(openJourneyChat({ journeyId: 12, question: ' A new  entry ' }, listed)).toEqual({
      ok: true,
      value: {
        journey: {
          id: 12,
          title: 'Japan 2026',
          subtitle: null,
          startDate: '2026-11-02',
          endDate: '2026-11-16',
          entryCount: 4,
          photoCount: 120,
        },
        question: 'A new entry',
        shown: "Shown to the user as a card that opens the journal's page with its chat.",
      },
    });
    expect(openJourneyChat({ journeyId: 13 }, listed)).toMatchObject({
      value: { journey: { id: 13, entryCount: 0, startDate: null }, question: null },
    });
  });

  it('ASTHOME-041: refuses a journal the user cannot open, a failed read and a row without a title', () => {
    expect(openJourneyChat({ journeyId: 77 }, listed)).toMatchObject({ ok: false });
    expect(openJourneyChat({ journeyId: 12 }, { ok: false, value: 'no' })).toMatchObject({ ok: false });
    expect(openJourneyChat({}, listed)).toMatchObject({ ok: false });
    const untitled = { ok: true, value: { journeys: [{ id: 5, title: '  ' }] } };
    expect(openJourneyChat({ journeyId: 5 }, untitled)).toMatchObject({ ok: false });
  });

  it('ASTHOME-042: shows a card for the journal, and none for an answer without one', () => {
    const run = openJourneyChat({ journeyId: 12, question: 'A new entry' }, listed);
    const input = { toolCallId: 'c1', args: {}, value: run.value, card: emptyTripCard(1), today: TODAY };
    expect(journalChatAnswer(input)).toMatchObject({
      kind: 'journalChat',
      journey: { id: 12, title: 'Japan 2026' },
      question: 'A new entry',
    });
    expect(answerCardOf(OPEN_JOURNEY_CHAT_TOOL, input)).toMatchObject({ kind: 'journalChat' });
    expect(journalChatAnswer({ ...input, value: 'No journal' })).toBeNull();
    expect(journalChatAnswer({ ...input, value: { journey: { id: 0 } } })).toBeNull();
  });
});

describe('the tools the home chat keeps', () => {
  it('ASTHOME-030: every read, and only the writes that name no trip and no journey', () => {
    expect(keptAtHome('read', ['tripId'], 'TripsMcp')).toBe(true);
    expect(keptAtHome('read', ['journeyId'], 'JourneyMcp')).toBe(true);
    expect(keptAtHome('write', ['country_code'], 'AtlasMcp')).toBe(true);
    expect(keptAtHome('write', [], undefined)).toBe(true);
    for (const arg of ['tripId', 'journeyId', 'trip_id', 'trip_ids', 'journey_id', 'journalId']) {
      expect(keptAtHome('write', ['name', arg], undefined), arg).toBe(false);
    }
  });

  it("ASTHOME-031: a journey's writes stay with the journey, also those that name only an entry", () => {
    expect(keptAtHome('read', ['entryId'], 'JourneyMcp')).toBe(true);
    for (const className of ['JourneyMcp', 'JourneyRecordingsMcp', 'JourneyDayImportMcp']) {
      expect(keptAtHome('write', ['entryId'], className), className).toBe(false);
    }
    // A Dawarich stay taken into a journal names the journey as `journalId`; one marked on the bucket list stays.
    expect(keptAtHome('write', ['suggestionId', 'journalId'], 'DawarichMcp')).toBe(false);
    expect(keptAtHome('write', ['suggestionId', 'bucketListItemId'], 'DawarichMcp')).toBe(true);
  });

  it('ASTHOME-032: starts a journal and deletes one, which no journey chat offers, and no other journey write', () => {
    expect(keptAtHome('write', ['title', 'trip_ids'], 'JourneyMcp', 'create_journey')).toBe(true);
    expect(keptAtHome('write', ['journeyId'], 'JourneyMcp', 'delete_journey')).toBe(true);
    expect(keptAtHome('write', ['journeyId'], 'JourneyMcp', 'update_journey')).toBe(false);
    expect(keptAtHome('write', ['journeyId', 'tripId'], 'JourneyMcp', 'add_journey_trip')).toBe(false);
  });
});
