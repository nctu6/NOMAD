/**
 * What a journey's conversation offers on each of its pages, in its pure
 * parts: the journal page by the user's role, the Studio as it always was,
 * what a session holds for both, and the boot check of the journal's lists.
 */
import {
  checkJournalTools,
  heldInJourney,
  isHeldInJourney,
  JOURNAL_DENIED_TOOLS,
  JOURNAL_UNPINNED_READS,
  JOURNEY_OWNER_TOOLS,
  JOURNEY_PART_READ,
  JOURNEY_PIN_ARGS,
  keptInJournal,
  offeredInJourney,
  type JourneyListedTool,
} from '../../../../src/nest/assistant/assistant-journey-offer';

import { describe, expect, it } from 'vitest';

function tool(name: string, className: string | undefined, over: Partial<JourneyListedTool> = {}): JourneyListedTool {
  return { name, className, kind: 'write', pinned: true, onPart: false, ...over };
}

const ENTRY_WRITE = tool('update_journey_entry', 'JourneyMcp', { pinned: false, onPart: true });
const JOURNEY_WRITE = tool('update_journey', 'JourneyMcp');
const ENTRY_READ = tool('get_journey_entry', 'JourneyMcp', { kind: 'read', pinned: false, onPart: true });
const BOOK_WRITE = tool('edit_book_page', 'JourneyBookMcp');
const RECORDING_WRITE = tool('save_journey_recorded_day', 'JourneyRecordingsMcp');

describe('the journal page offer', () => {
  it('ASTJOFF-001: a viewer reads, an editor also writes the journal, the owner also the journey itself', () => {
    expect(keptInJournal(ENTRY_READ, 'viewer')).toBe(true);
    expect(keptInJournal(ENTRY_WRITE, 'viewer')).toBe(false);
    expect(keptInJournal(ENTRY_WRITE, 'editor')).toBe(true);
    expect(keptInJournal(RECORDING_WRITE, 'editor')).toBe(true);
    expect(keptInJournal(JOURNEY_WRITE, 'editor')).toBe(false);
    expect(keptInJournal(JOURNEY_WRITE, 'owner')).toBe(true);
    for (const name of JOURNEY_OWNER_TOOLS) expect(keptInJournal(tool(name, 'JourneyMcp'), 'editor'), name).toBe(false);
  });

  it('ASTJOFF-002: keeps only tools on the journey, but the reads the journal needs that name none', () => {
    expect(keptInJournal(tool('list_journeys', 'JourneyMcp', { kind: 'read', pinned: false }), 'owner')).toBe(false);
    expect(keptInJournal(tool('create_journey', 'JourneyMcp', { pinned: false }), 'owner')).toBe(false);
    expect(keptInJournal(tool('search_place', 'PlacesMcp', { kind: 'read', pinned: false }), 'viewer')).toBe(true);
    for (const name of JOURNAL_UNPINNED_READS) {
      expect(keptInJournal(tool(name, undefined, { kind: 'read', pinned: false }), 'viewer'), name).toBe(true);
    }
    // A read the journal names that turned into a write would wait on a card it was never meant to.
    expect(keptInJournal(tool('search_place', 'PlacesMcp', { pinned: false }), 'owner')).toBe(false);
    expect(keptInJournal(tool('create_place', 'PlacesMcp'), 'owner')).toBe(false);
  });

  it('ASTJOFF-003: never offers the book, the denied tools or what the journey chat leaves to others', () => {
    expect(keptInJournal(BOOK_WRITE, 'owner')).toBe(false);
    for (const name of Object.keys(JOURNAL_DENIED_TOOLS)) {
      expect(keptInJournal(tool(name, 'JourneyMcp'), 'owner'), name).toBe(false);
    }
    expect(keptInJournal(tool('add_journey_contributor', 'JourneyMcp'), 'owner')).toBe(false);
    expect(keptInJournal(tool('create_journey_share_link', 'JourneyMcp'), 'owner')).toBe(false);
    expect(keptInJournal(tool('link_trip_journal', 'TripJournalLinkMcp', { pinned: false }), 'owner')).toBe(false);
    const dawarich = tool('accept_dawarich_suggestion_as_journal_entry', 'DawarichMcp');
    expect(keptInJournal(dawarich, 'editor')).toBe(true);
    expect(keptInJournal(tool('accept_dawarich_suggestion_as_place', 'DawarichMcp'), 'owner')).toBe(false);
  });
});

describe('a journey session over both pages', () => {
  it('ASTJOFF-010: attaches what either page offers, and nothing of a trip', () => {
    expect(isHeldInJourney('edit_book_page', 'JourneyBookMcp')).toBe(true);
    expect(isHeldInJourney('create_journey_entry', 'JourneyMcp')).toBe(true);
    expect(isHeldInJourney('save_journey_recorded_day', 'JourneyRecordingsMcp')).toBe(true);
    expect(isHeldInJourney('search_place', 'PlacesMcp')).toBe(true);
    expect(isHeldInJourney('create_place', 'PlacesMcp')).toBe(false);
    expect(isHeldInJourney('delete_journey', 'JourneyMcp')).toBe(false);
    expect(isHeldInJourney('restore_book_page', 'JourneyBookMcp')).toBe(false);
  });

  it('ASTJOFF-011: holds the tools of both pages but offers the model only the asking page own', () => {
    expect(heldInJourney(BOOK_WRITE, 'owner')).toBe(true);
    expect(heldInJourney(ENTRY_WRITE, 'owner')).toBe(true);
    expect(offeredInJourney(BOOK_WRITE, { role: 'owner', surface: 'studio' })).toBe(true);
    expect(offeredInJourney(BOOK_WRITE, { role: 'owner', surface: 'journal' })).toBe(false);
    expect(offeredInJourney(ENTRY_WRITE, { role: 'owner', surface: 'studio' })).toBe(false);
    expect(offeredInJourney(ENTRY_WRITE, { role: 'owner', surface: 'journal' })).toBe(true);
    // The Studio keeps what it always offered, recorded days and the journal's writes left out.
    expect(
      offeredInJourney(tool('list_journey_recorded_days', 'JourneyRecordingsMcp', { kind: 'read' }), {
        role: 'owner',
        surface: 'studio',
      }),
    ).toBe(false);
    expect(heldInJourney(BOOK_WRITE, 'viewer')).toBe(false);
  });

  it('ASTJOFF-012: pins the journey under its alias too, and names every list entry the registry lacks', () => {
    expect(JOURNEY_PIN_ARGS).toEqual(['journeyId', 'journalId']);
    const all = new Set([
      ...JOURNAL_UNPINNED_READS,
      ...JOURNEY_OWNER_TOOLS,
      ...Object.keys(JOURNAL_DENIED_TOOLS),
      'accept_dawarich_suggestion_as_journal_entry',
      JOURNEY_PART_READ,
    ]);
    expect(checkJournalTools(all)).toEqual([]);
    all.delete('search_place');
    expect(checkJournalTools(all)).toEqual(['journal tool "search_place" is not registered']);
  });
});
