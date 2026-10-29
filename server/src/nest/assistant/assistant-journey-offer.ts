import {
  ASSISTANT_DENIED_TOOLS,
  isOfferedInJourney,
  isStudioController,
  JOURNEY_PINNED_ARG,
  keptInJourney,
} from './assistant-tool-offer';
import type { AssistantJourneySurface } from '@trek/shared';

/**
 * Which tools a journey's conversation offers on each of its two pages. The
 * Studio keeps what it always offered (the book's tools and the journey's
 * reads, assistant-tool-offer.ts); the journal page offers the journal's own
 * tools by the user's role in the journey: a viewer reads, an editor also
 * writes entries, photos, recorded days and day imports, the owner also
 * reshapes the journey itself. Both pages share the journey's threads, so a
 * session holds what either page offers and runs a decision made on the
 * other; only the page's own tools are offered to the model.
 *
 * The role only spares the user a card that could only fail: the tool still
 * decides, with the user's own rights, as for any MCP client.
 */

/** What the user may do in a journey. */
export type JourneyRole = 'owner' | 'editor' | 'viewer';

/** How a journey's session offers its tools: the user's role, and the page asking. */
export interface JourneyOffer {
  role: JourneyRole;
  surface: AssistantJourneySurface;
}

/** The controllers of the journal: the journey and its entries, its map and tracks, its recorded days and imports. */
const JOURNAL_CONTROLLERS: ReadonlySet<string> = new Set([
  'JourneyMcp',
  'JourneyPhotoLinksMcp',
  'JourneyMapMcp',
  'JourneyTracksMcp',
  'JourneyRecordingsMcp',
  'JourneyDayImportMcp',
]);

/**
 * Reads that name no journey and that the journal still needs: a place's
 * coordinates for an entry, the photo libraries, the recorded stays, and the
 * trips a journal could link.
 */
export const JOURNAL_UNPINNED_READS: ReadonlySet<string> = new Set([
  'search_place',
  'reverse_geocode',
  'search_provider_photos',
  'list_provider_albums',
  'list_provider_album_photos',
  'list_dawarich_suggestions',
  'list_journey_available_trips',
  'get_journey_suggestions',
]);

/** Writes of other parts of TREK that work on a journal, pinned to it through an alias (JOURNEY_PIN_ALIASES). */
const JOURNAL_OTHER_WRITES: ReadonlySet<string> = new Set(['accept_dawarich_suggestion_as_journal_entry']);

/** The journal's writes only its owner is offered: they reshape the journey itself. */
export const JOURNEY_OWNER_TOOLS: ReadonlySet<string> = new Set(['update_journey', 'remove_journey_trip']);

/** Never offered in a journey's own conversation, whatever the role, each for the reason beside it. */
export const JOURNAL_DENIED_TOOLS: Readonly<Record<string, string>> = {
  delete_journey:
    "takes the journal and this conversation with it; the home chat and a trip's chat offer it to the owner",
};

/**
 * The other names a tool gives the conversation's journey: a Dawarich stay
 * taken into a journal names it `journalId`. The session pins and hides them
 * like `journeyId`; renaming the argument would break every MCP client.
 */
const JOURNEY_PIN_ALIASES: readonly string[] = ['journalId'];

/** Every argument a journey's session pins to its journey. */
export const JOURNEY_PIN_ARGS: readonly string[] = [JOURNEY_PINNED_ARG, ...JOURNEY_PIN_ALIASES];

/**
 * The arguments that name a part of a journey, an entry, by its own id. A
 * journey's session checks that each names a part of its journey before the
 * tool runs, so the conversation never reaches another journey through one.
 */
export const JOURNEY_PART_ARGS: readonly string[] = ['entryId', 'fromEntryId', 'toEntryId'];

/** The read the session checks a part with: it answers the entry's journey, with the user's rights. */
export const JOURNEY_PART_READ = 'get_journey_entry';

/** Whether the journal page attaches a registered tool. */
function isOfferedInJournal(name: string, className: string | undefined): boolean {
  if (name in ASSISTANT_DENIED_TOOLS || name in JOURNAL_DENIED_TOOLS) return false;
  if (JOURNAL_UNPINNED_READS.has(name) || JOURNAL_OTHER_WRITES.has(name)) return true;
  return className !== undefined && JOURNAL_CONTROLLERS.has(className) && !isStudioController(className);
}

/**
 * Whether a journey's session attaches a registered tool: what either of its
 * pages offers. A tool denied in a journey's own conversation is never
 * attached, though the Studio's controllers would bring it along.
 */
export function isHeldInJourney(name: string, className: string | undefined): boolean {
  if (name in JOURNAL_DENIED_TOOLS) return false;
  return isOfferedInJourney(name, className) || isOfferedInJournal(name, className);
}

/** A listed tool as the offer reads it. */
export interface JourneyListedTool {
  name: string;
  className: string | undefined;
  kind: 'read' | 'write';
  /** It takes the journey (or one of its aliases), which the session sets. */
  pinned: boolean;
  /** It names a part of the journey (an entry), which the session checks. */
  onPart: boolean;
}

/**
 * Whether the journal page keeps an attached tool once its schema is known:
 * a tool on this journey (pinned, or naming one of its entries) or one of the
 * reads that name none; then every read, and the writes the role allows.
 */
export function keptInJournal(tool: JourneyListedTool, role: JourneyRole): boolean {
  if (!isOfferedInJournal(tool.name, tool.className)) return false;
  if (JOURNAL_UNPINNED_READS.has(tool.name)) return tool.kind === 'read';
  if (!tool.pinned && !tool.onPart) return false;
  if (tool.kind === 'read') return true;
  if (role === 'viewer') return false;
  return !JOURNEY_OWNER_TOOLS.has(tool.name) || role === 'owner';
}

/**
 * Whether the Studio keeps a tool, as it always has: one it attaches, then
 * only the book's writes, for someone who may write.
 */
function keptInStudio(tool: JourneyListedTool, role: JourneyRole): boolean {
  if (!isOfferedInJourney(tool.name, tool.className)) return false;
  return keptInJourney(tool.className, tool.kind, tool.pinned, role !== 'viewer');
}

/** Whether a journey's session holds a listed tool: what either page keeps, so a decision runs on both. */
export function heldInJourney(tool: JourneyListedTool, role: JourneyRole): boolean {
  return keptInStudio(tool, role) || keptInJournal(tool, role);
}

/** Whether the model is offered a held tool on the page that asks. */
export function offeredInJourney(tool: JourneyListedTool, offer: JourneyOffer): boolean {
  return offer.surface === 'studio' ? keptInStudio(tool, offer.role) : keptInJournal(tool, offer.role);
}

/**
 * What is wrong with the journal's lists against the registry: a name in one
 * of them that is no registered tool.
 */
export function checkJournalTools(names: ReadonlySet<string>): string[] {
  const listed = [
    ...JOURNAL_UNPINNED_READS,
    ...JOURNAL_OTHER_WRITES,
    ...JOURNEY_OWNER_TOOLS,
    ...Object.keys(JOURNAL_DENIED_TOOLS),
    JOURNEY_PART_READ,
  ];
  return listed.filter((name) => !names.has(name)).map((name) => `journal tool "${name}" is not registered`);
}
