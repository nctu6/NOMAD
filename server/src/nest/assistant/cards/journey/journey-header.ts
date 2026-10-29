import type { CardReader, Described, PreviewContext, ToolArgs } from '../card-types';
import { argId, clipped, recordOf, type Row } from '../card-values';
import { Rows, text } from '../preview-format';
import { rowsOf } from '../undo-snapshot';
import {
  JOURNEY_HEADER_LIMITS,
  type AssistantChangePreview,
  type AssistantChangeRow,
  type AssistantChangeVerbKey,
  type JourneyHeaderCard,
  type JourneyHeaderTrip,
} from '@trek/shared';

/**
 * The change cards of a journal itself: a new one, its settings changed, a
 * trip linked or unlinked, its suggestions brought back, the user's own view
 * of it, the whole journal deleted. The rows name what changes, old to new;
 * the card under them is the journal with its trips and what the change takes
 * along. Everything is read with the user's rights: the journal as
 * `get_journey` answers it, the trips it could link as
 * `list_journey_available_trips` does.
 */

/** What a held journal change looked up before its card is drawn. */
export interface JournalHeaderLoaded {
  /** The journal as `get_journey` answers it; null for a new one or a read that failed. */
  journey: Row | null;
  /** The user's trips a journal could link. */
  available: Row[];
}

/** The tools these cards are for. */
type HeaderTool =
  | 'create_journey'
  | 'update_journey'
  | 'delete_journey'
  | 'add_journey_trip'
  | 'remove_journey_trip'
  | 'restore_journey_suggestions'
  | 'update_journey_preferences';

/** The journal a call names, or none in a journey's own conversation, where the session pins it. */
export function journeyArgs(args: ToolArgs): ToolArgs {
  const journeyId = argId(args, 'journeyId');
  return journeyId === null ? {} : { journeyId };
}

/** At most two reads: the journal (all but a new one), the user's trips (a new journal, a trip linked). */
export async function loadJournalHeader(tool: string, args: ToolArgs, read: CardReader): Promise<JournalHeaderLoaded> {
  const withTrips = tool === 'create_journey' || tool === 'add_journey_trip';
  const available = withTrips ? rowsOf(recordOf(await read('list_journey_available_trips')).trips) : [];
  const found = tool === 'create_journey' ? null : recordOf(await read('get_journey', journeyArgs(args))).journey;
  return { journey: found ? recordOf(found) : null, available };
}

/** The settings an update can change beyond the name and subtitle, each a `field` row under the tool's own name. */
const SETTING_FIELDS = [
  'status',
  'status_override',
  'show_verdict',
  'show_mood',
  'show_weather',
  'photo_location',
  'show_trip_tracks',
  'auto_prepare_recordings',
  'cover_gradient',
] as const;
const FLAG_FIELDS: ReadonlySet<string> = new Set([
  'show_verdict',
  'show_mood',
  'show_weather',
  'photo_location',
  'show_trip_tracks',
  'auto_prepare_recordings',
  'hide_skeletons',
]);
const STATUS_FIELDS: ReadonlySet<string> = new Set(['status', 'status_override']);

/** A setting as its row writes it: a flag (stored 0 or 1, sent as a boolean) as ✓ or ✗, anything else as it is. */
function settingText(field: string, value: unknown): string {
  return FLAG_FIELDS.has(field) ? text(value === true || value === 1) : text(value);
}

function fieldRow(field: string, before: string | null, after: string): AssistantChangeRow {
  return { op: before === null ? 'add' : 'change', labelKey: 'field', field, before, after };
}

function described(subject: string, rows: Rows, extra: Partial<Described> = {}): Described {
  return { subject, rows, dayId: null, placeIds: [], domain: 'journey', ...extra };
}

/** Which verb an update reads as: a new name alone, a new status alone, else the settings. */
function updateVerb(args: ToolArgs): AssistantChangeVerbKey {
  const keys = Object.keys(args).filter((key) => key !== 'journeyId');
  if (keys.length > 0 && keys.every((key) => key === 'title')) return 'renameJournal';
  if (keys.length > 0 && keys.every((key) => STATUS_FIELDS.has(key))) return 'setJournalStatus';
  return 'updateJournalSettings';
}

/** The trip a call names, by the user's trips or the journal's own. */
function tripNamed(loaded: JournalHeaderLoaded | null, tripId: number | null): Row | null {
  if (tripId === null) return null;
  const own = rowsOf(loaded?.journey?.trips).find((trip) => trip.trip_id === tripId);
  if (own) return { id: own.trip_id, title: own.title, start_date: own.start_date, end_date: own.end_date };
  return loaded?.available.find((trip) => trip.id === tripId) ?? null;
}

function linked(loaded: JournalHeaderLoaded | null, tripId: number | null): boolean {
  return tripId !== null && rowsOf(loaded?.journey?.trips).some((trip) => trip.trip_id === tripId);
}

function updateRows(before: Row, args: ToolArgs): Rows {
  const rows = new Rows();
  if ('title' in args && text(args.title) !== text(before.title))
    rows.change('name', text(before.title), text(args.title));
  if ('subtitle' in args && text(args.subtitle) !== text(before.subtitle)) {
    rows.change('description', text(before.subtitle), text(args.subtitle));
  }
  for (const field of SETTING_FIELDS) {
    if (!(field in args)) continue;
    const was = field in before ? settingText(field, before[field]) : null;
    const now = settingText(field, args[field]);
    if (was !== now) rows.rows.push(fieldRow(field, was, now));
  }
  return rows;
}

const TRIP_ROW = (verb: 'add' | 'remove', name: string): AssistantChangeRow =>
  verb === 'add'
    ? { op: 'add', labelKey: 'field', field: 'trip', before: null, after: name }
    : { op: 'change', labelKey: 'field', field: 'trip', before: name, after: '' };

export const JOURNAL_HEADER_DESCRIBERS: Readonly<
  Record<HeaderTool, (ctx: PreviewContext, args: ToolArgs, loaded: JournalHeaderLoaded | null) => Described>
> = {
  create_journey: (_ctx, args) =>
    described(text(args.title), new Rows().add('name', text(args.title)).add('description', text(args.subtitle))),
  update_journey: (_ctx, args, loaded) => {
    const before = loaded?.journey ?? {};
    return described(text(before.title) || text(args.title), updateRows(before, args), { verbKey: updateVerb(args) });
  },
  delete_journey: (_ctx, _args, loaded) => described(text(loaded?.journey?.title), new Rows()),
  add_journey_trip: (_ctx, args, loaded) => {
    const tripId = argId(args, 'tripId');
    const rows = new Rows();
    rows.rows.push(TRIP_ROW('add', text(tripNamed(loaded, tripId)?.title)));
    // Unlinking takes the owner; a trip linked already would be unlinked by a way back that never linked it.
    const owner = loaded?.journey?.my_role === 'owner';
    return described(text(loaded?.journey?.title), rows, { undoable: owner && !linked(loaded, tripId) });
  },
  remove_journey_trip: (_ctx, args, loaded) => {
    const rows = new Rows();
    rows.rows.push(TRIP_ROW('remove', text(tripNamed(loaded, argId(args, 'tripId'))?.title)));
    return described(text(loaded?.journey?.title), rows);
  },
  restore_journey_suggestions: (_ctx, _args, loaded) => {
    const rows = new Rows();
    const dismissed = Number(loaded?.journey?.dismissed_count);
    if (Number.isInteger(dismissed) && dismissed > 0) rows.rows.push(fieldRow('suggestions', null, String(dismissed)));
    return described(text(loaded?.journey?.title), rows);
  },
  update_journey_preferences: (_ctx, args, loaded) => {
    const rows = new Rows();
    const known = loaded?.journey && 'hide_skeletons' in loaded.journey;
    const was = known ? settingText('hide_skeletons', loaded?.journey?.hide_skeletons) : null;
    const now = 'hide_skeletons' in args ? settingText('hide_skeletons', args.hide_skeletons) : null;
    if (now !== null && now !== was) rows.rows.push(fieldRow('hide_skeletons', was, now));
    // A way back that flips the switch is a way back only where the switch was known to change.
    return described(text(loaded?.journey?.title), rows, { undoable: was !== null && now !== null && was !== now });
  },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateOf(value: unknown): string | null {
  return typeof value === 'string' && DATE.test(value.slice(0, 10)) ? value.slice(0, 10) : null;
}

function tripLook(row: Row, change: JourneyHeaderTrip['change'], idKey: 'id' | 'trip_id'): JourneyHeaderTrip | null {
  const title = clipped(row.title, JOURNEY_HEADER_LIMITS.tripTitle);
  if (!title) return null;
  const id = argId(row, idKey);
  return { id, title, startDate: dateOf(row.start_date), endDate: dateOf(row.end_date), change };
}

function count(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, 1_000_000) : null;
}

/** The journal's own trips, with what the change does to the one it names; that one first, so a cut keeps it. */
function journalTrips(tool: string, args: ToolArgs, loaded: JournalHeaderLoaded): JourneyHeaderTrip[] {
  const tripId = argId(args, 'tripId');
  const own = rowsOf(loaded.journey?.trips).flatMap((row) => {
    const change = tool === 'remove_journey_trip' && row.trip_id === tripId ? 'unlink' : 'kept';
    const look = tripLook(row, change, 'trip_id');
    return look ? [look] : [];
  });
  const changedFirst = [
    ...own.filter((trip) => trip.change !== 'kept'),
    ...own.filter((trip) => trip.change === 'kept'),
  ];
  if (tool !== 'add_journey_trip' || linked(loaded, tripId)) return changedFirst;
  const added = loaded.available.find((row) => row.id === tripId);
  const look = added ? tripLook(added, 'link', 'id') : null;
  return look ? [look, ...changedFirst] : changedFirst;
}

/** The trips a new journal links, by the user's trips; an id the user's trips do not list is left out. */
function newTrips(args: ToolArgs, loaded: JournalHeaderLoaded): JourneyHeaderTrip[] {
  const ids = Array.isArray(args.trip_ids) ? args.trip_ids : [];
  return ids.flatMap((id) => {
    const row = loaded.available.find((trip) => trip.id === id);
    const look = row ? tripLook(row, 'link', 'id') : null;
    return look ? [look] : [];
  });
}

/** The places of the trips linked by the change, which come in as suggestions. */
function suggestionsOf(trips: readonly JourneyHeaderTrip[], loaded: JournalHeaderLoaded): number | null {
  const linking = trips.filter((trip) => trip.change === 'link' && trip.id !== null);
  if (linking.length === 0) return null;
  const places = linking.map((trip) => count(loaded.available.find((row) => row.id === trip.id)?.place_count) ?? 0);
  return places.reduce((sum, n) => sum + n, 0);
}

/** What the journal holds that the change concerns: all of it, or what one unlinked trip leaves behind. */
function heldBy(tool: string, args: ToolArgs, journey: Row): { entries: number | null; photos: number | null } {
  const entries = rowsOf(journey.entries).filter((entry) => !entry.dismissed);
  if (tool === 'remove_journey_trip') {
    const tripId = argId(args, 'tripId');
    return {
      entries: entries.filter((e) => e.source_trip_id === tripId && e.type !== 'skeleton').length,
      photos: null,
    };
  }
  const written = entries.filter((entry) => entry.type !== 'skeleton').length;
  return { entries: written, photos: Array.isArray(journey.gallery) ? journey.gallery.length : null };
}

/** The suggestions an unlinked trip takes with it: its places nobody wrote up. */
function unlinkedSuggestions(args: ToolArgs, journey: Row): number {
  const tripId = argId(args, 'tripId');
  return rowsOf(journey.entries).filter((e) => e.source_trip_id === tripId && e.type === 'skeleton').length;
}

/** The card under a held journal change; null when it has no journal to name. */
export function journalHeaderCard(
  tool: string,
  args: ToolArgs,
  loaded: JournalHeaderLoaded | null,
): JourneyHeaderCard | null {
  if (!loaded) return null;
  if (tool === 'create_journey') {
    const title = clipped(args.title, JOURNEY_HEADER_LIMITS.title);
    if (!title) return null;
    const trips = newTrips(args, loaded).slice(0, JOURNEY_HEADER_LIMITS.trips);
    const subtitle = clipped(args.subtitle, JOURNEY_HEADER_LIMITS.subtitle);
    const suggestions = suggestionsOf(trips, loaded);
    return {
      kind: 'journeyHeader',
      journeyId: null,
      title,
      subtitle,
      change: 'new',
      trips,
      entries: null,
      photos: null,
      suggestions,
    };
  }
  const journey = loaded.journey;
  const title = clipped(journey?.title, JOURNEY_HEADER_LIMITS.title);
  if (!journey || !title) return null;
  const trips = journalTrips(tool, args, loaded).slice(0, JOURNEY_HEADER_LIMITS.trips);
  const held = heldBy(tool, args, journey);
  const suggestions =
    tool === 'remove_journey_trip' ? unlinkedSuggestions(args, journey) : suggestionsOf(trips, loaded);
  return {
    kind: 'journeyHeader',
    journeyId: argId(journey, 'id'),
    title,
    subtitle: clipped(journey.subtitle, JOURNEY_HEADER_LIMITS.subtitle),
    change: tool === 'delete_journey' ? 'willDelete' : 'changed',
    trips,
    entries: tool === 'add_journey_trip' ? null : held.entries,
    photos: tool === 'delete_journey' ? held.photos : null,
    suggestions,
  };
}

/**
 * The card of an applied journal change: a new journal as the tool answered
 * it (its id, its trips), a changed one with its new name and subtitle over
 * the card it was held with. Every other change keeps its held card.
 */
export function journalHeaderApplied(
  tool: string,
  result: unknown,
  preview: AssistantChangePreview | null,
): JourneyHeaderCard | null {
  const journey = recordOf(recordOf(result).journey);
  const held = preview?.card?.kind === 'journeyHeader' ? preview.card : null;
  const title = clipped(journey.title, JOURNEY_HEADER_LIMITS.title);
  if (!title) return null;
  const subtitle = clipped(journey.subtitle, JOURNEY_HEADER_LIMITS.subtitle);
  if (tool === 'update_journey') return held ? { ...held, journeyId: argId(journey, 'id'), title, subtitle } : null;
  if (tool !== 'create_journey') return null;
  const trips = rowsOf(journey.trips).flatMap((row) => {
    const look = tripLook(row, 'link', 'trip_id');
    return look ? [look] : [];
  });
  const suggestions = rowsOf(journey.entries).filter((entry) => entry.type === 'skeleton').length;
  return {
    kind: 'journeyHeader',
    journeyId: argId(journey, 'id'),
    title,
    subtitle,
    change: 'new',
    trips: trips.slice(0, JOURNEY_HEADER_LIMITS.trips),
    entries: null,
    photos: null,
    suggestions,
  };
}
