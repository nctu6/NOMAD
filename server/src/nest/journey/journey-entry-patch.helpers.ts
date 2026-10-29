import { presenceSet } from '../../db/repositories/_shared/presence-set';
import type { JourneyEntry } from '../../types';
import { decodeEntryRow } from './journey-entry-row';

/**
 * An update of a journal entry as every surface hands it in (the REST route,
 * the MCP tool, the plugin RPC), the columns it writes, and what it replaced.
 * Pure: the service resolves the entry's country from its coordinates and
 * the clock, and hands both in.
 */

export type JourneyEntryUpdateInput = Partial<{
  type: string;
  title: string;
  story: string;
  entry_date: string;
  entry_time: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  mood: string;
  weather: string;
  tags: string[];
  pros_cons: { pros: string[]; cons: string[] };
  visibility: string;
  sort_order: number;
  stats_excluded: boolean;
  dismissed: boolean;
  is_draft: boolean;
}>;

/** The columns an update writes, as they are stored. */
type JourneyEntryColumns = {
  type: string;
  title: string | null;
  story: string | null;
  entry_date: string;
  entry_time: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  mood: string | null;
  weather: string | null;
  tags: string | null;
  pros_cons: string | null;
  visibility: string;
  sort_order: number;
  stats_excluded: number;
  dismissed: number;
  is_draft: number;
  country_code: string | null;
  updated_at: number;
};

/**
 * JG78: the columns an update of `entry` with `data` writes, each resolved to
 * its bound value (`tags`/`pros_cons` JSON-encoded, the flags 0/1, the
 * country recomputed whenever either half of the coordinates is named,
 * including as null, which takes the entry off the map). The skeleton to
 * entry promotion keeps the legacy nuance: a story written onto a skeleton
 * makes it an entry even over an explicit `data.type`, as the legacy SET
 * list's last assignment did. `updated_at` is always written.
 */
export function entryUpdatePatch(
  entry: JourneyEntry,
  data: JourneyEntryUpdateInput,
  country: string | null,
  now: number,
): Partial<JourneyEntryColumns> {
  const promoteToEntry = entry.type === 'skeleton' && !!data.story && data.story.trim().length > 0;
  const proscons = data.pros_cons && typeof data.pros_cons === 'object' ? JSON.stringify(data.pros_cons) : null;
  return presenceSet<JourneyEntryColumns>({
    type: [data.type !== undefined || promoteToEntry, promoteToEntry ? 'entry' : (data.type as string)],
    title: [data.title !== undefined, data.title as string],
    story: [data.story !== undefined, data.story as string],
    entry_date: [data.entry_date !== undefined, data.entry_date as string],
    entry_time: [data.entry_time !== undefined, data.entry_time as string],
    location_name: [data.location_name !== undefined, data.location_name as string],
    location_lat: [data.location_lat !== undefined, data.location_lat as number | null],
    location_lng: [data.location_lng !== undefined, data.location_lng as number | null],
    mood: [data.mood !== undefined, data.mood as string],
    weather: [data.weather !== undefined, data.weather as string],
    // A caller sending `tags: null`/`pros_cons: null` to CLEAR the field must write SQL NULL, never the
    // JSON string "null" (tools-journey.test.ts, "clears a field on null").
    tags: [data.tags !== undefined, Array.isArray(data.tags) ? JSON.stringify(data.tags) : null],
    pros_cons: [data.pros_cons !== undefined, proscons],
    visibility: [data.visibility !== undefined, data.visibility as string],
    sort_order: [data.sort_order !== undefined, data.sort_order as number],
    stats_excluded: [data.stats_excluded !== undefined, data.stats_excluded ? 1 : 0],
    dismissed: [data.dismissed !== undefined, data.dismissed ? 1 : 0],
    is_draft: [data.is_draft !== undefined, data.is_draft ? 1 : 0],
    country_code: [data.location_lat !== undefined || data.location_lng !== undefined, country],
    updated_at: [true, now],
  });
}

/** The fields an update can write back, as the MCP tool takes them. */
const RESTORABLE = [
  'title',
  'story',
  'entry_date',
  'entry_time',
  'location_name',
  'location_lat',
  'location_lng',
  'mood',
  'weather',
  'tags',
  'pros_cons',
  'visibility',
  'type',
  'stats_excluded',
  'dismissed',
  'is_draft',
] as const;

/** What an entry update replaced: the fields `data` names, as the entry held them on the wire, decoded. */
export type JourneyEntryPrevious = Partial<Record<(typeof RESTORABLE)[number], unknown>>;

/**
 * The entry's values, as read before the update, of exactly the fields the
 * update names (the sort order aside, which reorder takes back): what writing
 * the change back sets again. JSON columns decoded, flags as booleans.
 */
export function entryPrevious(entry: JourneyEntry, data: JourneyEntryUpdateInput): JourneyEntryPrevious {
  const wire = decodeEntryRow(entry) as unknown as Record<string, unknown>;
  const previous: JourneyEntryPrevious = {};
  for (const key of RESTORABLE) if (data[key] !== undefined) previous[key] = wire[key] ?? null;
  // A story written onto a suggestion makes it an entry: going back makes it a suggestion again.
  if (entry.type === 'skeleton' && typeof data.story === 'string' && data.story.trim()) previous.type = 'skeleton';
  return previous;
}
