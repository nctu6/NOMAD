import type { AiToolSpec } from '../ai-connections/ai-chat-client.interface';
import type { ToolRun } from './assistant-tools.service';

/**
 * The home chat's way onto a journal's own page, the twin of open_trip_chat:
 * a journal's entries, photos and settings change in the chat on its page,
 * which knows them, so the home chat hands the question over there. The
 * journal is read from the user's own journals (`list_journeys`, with the
 * user's rights), so the card never names one the user cannot open.
 */

/** The server's own step that offers to go on on a journal's page; no MCP tool has its name. */
export const OPEN_JOURNEY_CHAT_TOOL = 'open_journey_chat';

/** The read the step answers from, offered only where the journal addon lists journals. */
export const OPEN_JOURNEY_CHAT_READ = 'list_journeys';

/** The longest journal title and subtitle a card carries. */
const MAX_TITLE_CHARS = 200;
const MAX_SUBTITLE_CHARS = 300;

/** How the model is offered the way onto a journal's page. */
export const OPEN_JOURNEY_CHAT_SPEC: AiToolSpec = {
  name: OPEN_JOURNEY_CHAT_TOOL,
  description:
    "Offer the user to go on in the chat on one journal's own page, shown as a card with a button. Use it when the " +
    'user wants to write, change or delete entries of a journal, add or move its photos, or change its settings, ' +
    "which only that journal's chat can do. Pass the journal's id from list_journeys (or from create_journey's " +
    "answer) and the question to ask there, in the user's words and language. Call it once per journal, next to a " +
    'short answer saying why.',
  parameters: {
    type: 'object',
    properties: {
      journeyId: { type: 'integer', minimum: 1, description: 'The id of the journal, from list_journeys.' },
      question: {
        type: 'string',
        maxLength: 500,
        description: "What to ask in the journal's chat, as the user would; leave it out when there is nothing to ask.",
      },
    },
    required: ['journeyId'],
    additionalProperties: false,
  },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateOf(value: unknown): string | null {
  return typeof value === 'string' && DATE.test(value.slice(0, 10)) ? value.slice(0, 10) : null;
}

function lineOf(value: unknown, max: number): string | null {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  return text || null;
}

function countOf(value: unknown): number {
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? Math.min(count, 1_000_000) : 0;
}

/** One journal of a `list_journeys` answer, as the card names it; null for a row without an id or a title. */
function journalOf(row: unknown) {
  const record = (row ?? {}) as Record<string, unknown>;
  const id = Number(record.id);
  const title = lineOf(record.title, MAX_TITLE_CHARS);
  if (!Number.isInteger(id) || id <= 0 || !title) return null;
  return {
    id,
    title,
    subtitle: lineOf(record.subtitle, MAX_SUBTITLE_CHARS),
    startDate: dateOf(record.trip_date_min),
    endDate: dateOf(record.trip_date_max),
    entryCount: countOf(record.entry_count),
    photoCount: countOf(record.photo_count),
  };
}

/**
 * Answers the step from the user's journals: the journal it names, as one
 * the user may open, and the question to hand over. A journal the user
 * cannot open is refused like one that does not exist.
 */
export function openJourneyChat(args: Record<string, unknown>, listed: ToolRun): ToolRun {
  const journeyId = Number(args.journeyId);
  const rows = listed.ok ? (listed.value as { journeys?: unknown } | null)?.journeys : null;
  const row = Array.isArray(rows) ? rows.find((candidate) => Number(candidate?.id) === journeyId) : undefined;
  const journey = row === undefined ? null : journalOf(row);
  if (!journey) return { ok: false, value: 'No journal of the user has this id. Take the id from list_journeys.' };
  return {
    ok: true,
    value: {
      journey,
      question: lineOf(args.question, 500),
      shown: "Shown to the user as a card that opens the journal's page with its chat.",
    },
  };
}
