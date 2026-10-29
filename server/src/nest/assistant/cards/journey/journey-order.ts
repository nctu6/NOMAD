import type { CardReader, Described, PreviewContext, ToolArgs } from '../card-types';
import { argId, recordOf, type Row } from '../card-values';
import { formatDate, Rows, text } from '../preview-format';
import { rowsOf } from '../undo-snapshot';
import { journeyArgs } from './journey-header';
import { entriesCard, lookOf } from './journey-look';
import { JOURNEY_CARD_LIMITS, stripMarkdown, type JourneyEntriesCard, type JourneyEntryLook } from '@trek/shared';

/**
 * Two more entry changes of the journal in the chat: a new order of its
 * entries, drawn as the entries that move, in their new order; and a stay
 * Dawarich recorded taken in as a new entry, drawn as the entry it writes
 * from the stay and what the call corrects of it.
 */

/** What a held reorder looked up: the journal's entries in their reading order, and the journal. */
export interface JournalOrderLoaded {
  entries: Row[];
  journeyId: number | null;
  title: unknown;
}

/** One read: the journal's entries as list_journey_entries answers them, on the journal the call names or pins. */
export async function loadJournalOrder(args: ToolArgs, read: CardReader): Promise<JournalOrderLoaded | null> {
  const answer = recordOf(await read('list_journey_entries', journeyArgs(args)));
  const journey = recordOf(answer.journey);
  const journeyId = argId(journey, 'id');
  return journeyId === null ? null : { entries: rowsOf(answer.entries), journeyId, title: journey.title };
}

function orderedIdsOf(args: ToolArgs): number[] {
  return Array.isArray(args.orderedIds) ? args.orderedIds.filter((id): id is number => Number.isInteger(id)) : [];
}

/** The ids the call names, in the order they stand in now and in the new one, and those that change place. */
function orderOf(args: ToolArgs, loaded: JournalOrderLoaded) {
  const next = orderedIdsOf(args);
  const named = new Set(next);
  const now = loaded.entries.map((entry) => entry.id).filter((id): id is number => named.has(id as number));
  const moved = new Set(next.filter((id, index) => now.indexOf(id) !== index));
  return { now, next, moved };
}

function nameOf(ctx: PreviewContext, entry: Row | undefined): string {
  if (!entry) return '';
  const day = typeof entry.entry_date === 'string' ? formatDate(ctx, entry.entry_date) : '';
  return text(entry.title) || text(entry.location_name) || day;
}

/** The row of a new order: the entries that move, as they stood and as they will stand. */
export function describeReorder(ctx: PreviewContext, args: ToolArgs, loaded: JournalOrderLoaded | null): Described {
  const rows = new Rows();
  if (loaded) {
    const { now, next, moved } = orderOf(args, loaded);
    const byId = new Map(loaded.entries.map((entry) => [entry.id, entry]));
    const names = (ids: number[]) =>
      ids
        .filter((id) => moved.has(id))
        .map((id) => nameOf(ctx, byId.get(id)))
        .join(', ');
    if (moved.size > 0) rows.change('order', names(now), names(next));
  }
  return { subject: text(loaded?.title), rows, dayId: null, placeIds: [], domain: 'journey' };
}

/** The card of a new order: the entries that move in their new places, the rest of the call counted. */
export function reorderCard(args: ToolArgs, loaded: JournalOrderLoaded | null): JourneyEntriesCard | null {
  if (!loaded) return null;
  const { next, moved } = orderOf(args, loaded);
  const byId = new Map(loaded.entries.map((entry) => [entry.id, entry]));
  const looks = next.flatMap((id): JourneyEntryLook[] => {
    if (!moved.has(id)) return [];
    const look = lookOf(byId.get(id));
    return look ? [{ ...look, moved: true }] : [];
  });
  const kept = looks.slice(0, JOURNEY_CARD_LIMITS.entries);
  const journal = {
    journeyId: loaded.journeyId,
    title: loaded.title,
    tripJournal: false,
    change: 'reordered' as const,
  };
  return entriesCard(journal, kept, looks.length - kept.length);
}

/** What a held Dawarich stay taken in as an entry looked up: the stay, and the journal it goes into. */
export interface StayLoaded {
  stay: Row | null;
  journeyId: number | null;
  title: unknown;
}

/** The journal a call names as `journalId`, or none in a journey's own conversation, where the session pins it. */
function journalArgs(args: ToolArgs): ToolArgs {
  const journeyId = argId(args, 'journalId');
  return journeyId === null ? {} : { journeyId };
}

/** Two reads: the stays held for review, to find this one, and the journal. */
export async function loadStay(args: ToolArgs, read: CardReader): Promise<StayLoaded | null> {
  const suggestionId = argId(args, 'suggestionId');
  if (suggestionId === null) return null;
  const listed = rowsOf(recordOf(await read('list_dawarich_suggestions', { limit: 200 })).suggestions);
  const journey = recordOf(recordOf(await read('get_journey', journalArgs(args))).journey);
  return {
    stay: listed.find((row) => row.id === suggestionId) ?? null,
    journeyId: argId(journey, 'id'),
    title: journey.title,
  };
}

/** The entry a stay becomes: the call's corrections over what the stay recorded, as the service writes it. */
function stayEntry(args: ToolArgs, stay: Row): Row {
  const name = text(args.name) || text(stay.name);
  const started = typeof stay.startedAt === 'string' ? stay.startedAt : '';
  const clock = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(started)?.[1] ?? null;
  return {
    id: null,
    type: 'entry',
    title: name || null,
    story: typeof args.notes === 'string' ? args.notes : null,
    entry_date: typeof args.date === 'string' ? args.date : stay.localDate,
    entry_time: typeof args.time === 'string' ? args.time : clock,
    location_name: name || null,
    location_lat: stay.lat,
    location_lng: stay.lng,
    photos: [],
    is_draft: false,
  };
}

/** The row of a stay taken in: what the entry is about, its day, time, place and text. */
export function describeStay(ctx: PreviewContext, args: ToolArgs, loaded: StayLoaded | null): Described {
  const entry: Row = loaded?.stay
    ? stayEntry(args, loaded.stay)
    : { title: args.name, story: args.notes, entry_date: args.date };
  const day = typeof entry.entry_date === 'string' ? formatDate(ctx, entry.entry_date) : '';
  const story = typeof entry.story === 'string' ? text(stripMarkdown(entry.story)) : '';
  const rows = new Rows()
    .add('day', day)
    .add('time', text(entry.entry_time))
    .add('location', text(entry.location_name))
    .add('text', story);
  return { subject: text(entry.title) || day, rows, dayId: null, placeIds: [], domain: 'journey' };
}

/** The card of a stay taken in: the entry it will write, in the journal it goes into. */
export function stayCard(args: ToolArgs, loaded: StayLoaded | null): JourneyEntriesCard | null {
  if (!loaded?.stay) return null;
  // What the call writes is cut only; what the stay recorded is masked like any stored text.
  const fromArgs = new Set([...(text(args.name) ? ['title', 'location_name'] : []), ...(args.notes ? ['story'] : [])]);
  const look = lookOf(stayEntry(args, loaded.stay), { fromArgs });
  const journal = { journeyId: loaded.journeyId, title: loaded.title, tripJournal: false, change: 'new' as const };
  return entriesCard(journal, look ? [look] : [], 0);
}
