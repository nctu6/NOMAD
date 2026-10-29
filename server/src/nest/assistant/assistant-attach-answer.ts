import type { BookingReadReason } from './assistant-booking-import.service';
import type { TripCard } from './assistant-context';
import type { AssistantWords } from './assistant-words';
import { MAX_FOLLOW_UPS } from '@trek/shared';

/**
 * The words the server answers an attached booking file with, before any
 * model is asked: one line that names the file and what TREK found in it
 * (and why it found nothing), then up to three chips with what makes sense
 * to do with the file next. A chip sends its words as an ordinary chat
 * message, so it goes through the model like anything the user types.
 */

/** What the chips are chosen from: what the file held, and what the user may do with it on this trip. */
export interface AttachFacts {
  /** The bookings the file proposes. */
  found: number;
  /** TREK read text out of the file, so the model could read it too. */
  readable: boolean;
  /** The file's type is allowed in Files and the user may upload there. */
  canKeep: boolean;
  /** The user may also change what a file is attached to. */
  canLink: boolean;
  /** The trip has a booking or an expense the file could be attached to. */
  hasTargets: boolean;
  /** The user may add bookings to the trip. */
  canBook: boolean;
}

/** Each chip's words, under *Key properties so the i18n check (lint:i18n-keys) sees every key. */
const CHIPS = {
  keepKey: 'assistant.attach.chip.keep',
  bookKey: 'assistant.attach.chip.book',
  attachKey: 'assistant.attach.chip.attach',
  readKey: 'assistant.attach.chip.read',
  keepWithBookingKey: 'assistant.attach.chip.keepWithBooking',
} as const;

/** Why a file held no booking, in the user's words. */
const WHY: Readonly<Record<BookingReadReason, { textKey: string }>> = {
  ai_not_configured: { textKey: 'assistant.attach.why.aiNotConfigured' },
  ai_failed: { textKey: 'assistant.attach.why.aiFailed' },
  no_text: { textKey: 'assistant.attach.why.noText' },
  nothing_found: { textKey: 'assistant.attach.why.nothingFound' },
};

/**
 * The chips under the answer, in order, at most MAX_FOLLOW_UPS. A file with
 * bookings asks to keep it with the booking once it is added; one without
 * offers to keep it, to make a booking from its text, to attach it to what
 * the trip holds, and to say what is in it.
 */
export function attachChipKeys(facts: AttachFacts): string[] {
  const wanted =
    facts.found > 0
      ? [facts.canKeep && facts.canLink && CHIPS.keepWithBookingKey, facts.readable && CHIPS.readKey]
      : [
          facts.canKeep && CHIPS.keepKey,
          facts.readable && facts.canBook && CHIPS.bookKey,
          facts.canKeep && facts.canLink && facts.hasTargets && CHIPS.attachKey,
          facts.readable && CHIPS.readKey,
        ];
  return wanted.filter((key): key is (typeof CHIPS)[keyof typeof CHIPS] => !!key).slice(0, MAX_FOLLOW_UPS);
}

/** The answer's line: what TREK found in the file, or that it found nothing, why, and the question what to do. */
export function attachLine(
  words: AssistantWords,
  name: string,
  found: number,
  reason: BookingReadReason | null,
): string {
  if (found > 0) return words.t('assistant.attach.found', { name, count: found });
  return [
    words.t('assistant.attach.none', { name }),
    ...(reason ? [words.t(WHY[reason].textKey)] : []),
    words.t('assistant.attach.ask'),
  ].join(' ');
}

/** Whether the trip has a booking or an expense a file could be kept with. */
export function hasLinkTargets(card: TripCard): boolean {
  if (card.reservations.size > 0) return true;
  const summary = card.sources.summary;
  const budget =
    summary && typeof summary === 'object' ? (summary as { budget?: { items?: unknown } }).budget : undefined;
  return Array.isArray(budget?.items) && budget.items.length > 0;
}
