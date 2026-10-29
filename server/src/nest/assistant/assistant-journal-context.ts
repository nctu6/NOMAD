import { todayIn } from './assistant-context';
import type { JourneyRole } from './assistant-journey-offer';

/**
 * The journey as the assistant on its journal page knows it on a turn: the
 * journey, the user's role in it, the trips it holds, its gallery in numbers
 * and its entries with their ids, so the model writes, changes and orders
 * entries by ids it was given. Built from the journey service with the
 * user's own rights (AssistantBookContext.journalCardOf); this file only
 * reads it out.
 */

/** One entry as the card lists it. */
export interface JournalCardEntry {
  id: number;
  date: string;
  time: string | null;
  title: string | null;
  place: string | null;
  photos: number;
  draft: boolean;
  /** A suggestion the journal made from a trip place, not written yet. */
  suggestion: boolean;
  /** It has coordinates, so it is on the journey's map. */
  mapped: boolean;
}

/** A trip the journey holds. */
interface JournalCardTrip {
  id: number;
  title: string;
  startDate: string | null;
  endDate: string | null;
}

export interface JournalCard {
  journeyId: number;
  title: string;
  subtitle: string | null;
  role: JourneyRole;
  trips: JournalCardTrip[];
  galleryPhotos: number;
  entries: JournalCardEntry[];
}

/** Entries the card lists one by one; the rest are counted. */
const ENTRIES_LISTED = 200;

const ROLE_WORDING: Readonly<Record<JourneyRole, string>> = {
  owner: 'owner (you may change the entries, the photos and the journal itself: its name, status and settings)',
  editor: 'editor (you may change the entries and the photos, not the journal itself)',
  viewer: 'viewer (you may read the journal but not change it; propose no changes, say so when asked for one)',
};

function oneLine(text: string, max = 120): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function entryRow(entry: JournalCardEntry): string {
  const marks = [
    entry.draft ? 'draft' : 'published',
    ...(entry.suggestion ? ['suggestion from a trip place'] : []),
    entry.mapped ? 'on the map' : 'no coordinates',
  ];
  const cells = [
    entry.id,
    entry.date,
    entry.time ?? '',
    oneLine(entry.title ?? ''),
    oneLine(entry.place ?? '', 80),
    entry.photos,
    marks.join(', '),
  ];
  return cells.join(' | ');
}

function tripRow(trip: JournalCardTrip): string {
  return `${trip.id} | ${oneLine(trip.title)} | ${trip.startDate ?? '?'} to ${trip.endDate ?? '?'}`;
}

/** The card as the model reads it: the journey, the role, its trips, the gallery and the entries. */
export function renderJournalCard(card: JournalCard): string {
  const lines = [`Journey: ${oneLine(card.title)}`];
  if (card.subtitle) lines.push(`Subtitle: ${oneLine(card.subtitle)}`);
  lines.push(`Your role: ${ROLE_WORDING[card.role]}`, '');
  if (card.trips.length === 0) lines.push('Trips: none linked.');
  else lines.push('Trips (trip id | title | dates):', ...card.trips.map(tripRow));
  lines.push('', `Gallery: ${card.galleryPhotos} photos and videos.`, '');
  lines.push('Entries (entry id | date | time | title | place | photos | state):');
  if (card.entries.length === 0) lines.push('(no entries yet)');
  lines.push(...card.entries.slice(0, ENTRIES_LISTED).map(entryRow));
  const more = card.entries.length - ENTRIES_LISTED;
  if (more > 0) lines.push(`and ${more} more; list_journey_entries lists them all.`);
  return lines.join('\n');
}

/** What the model reads next to its instructions on a journal turn: the date and the journal card. */
export function journalTurnContext(card: JournalCard, timeZone: string, now: Date): string {
  const today = `Today is ${todayIn(timeZone, now)} (time zone ${timeZone}).`;
  return [today, '', '<journal_card>', renderJournalCard(card), '</journal_card>'].join('\n');
}
