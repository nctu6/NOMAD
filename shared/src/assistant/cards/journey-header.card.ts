import { idSchema } from '../../common/primitives.schema';
import { cardCountSchema, cardDateSchema, cardText } from './card-parts';

import { z } from 'zod';

/**
 * A journal itself as the assistant chat shows a change of it: a new one,
 * its settings changed, a trip linked or unlinked, its suggestions brought
 * back, or the whole journal deleted. The rows of the change card say what
 * changes field by field; this card is the journal under them, its trips and
 * what a change takes with it.
 */

/** How much of a journal the card carries; the server clips to the same numbers. */
export const JOURNEY_HEADER_LIMITS = { title: 200, subtitle: 300, trips: 12, tripTitle: 120 } as const;

/** What the change does to the journal: makes it, changes it, deletes it. */
export const JOURNEY_HEADER_CHANGES = ['new', 'changed', 'willDelete'] as const;

/** What the change does to one of its trips. */
export const JOURNEY_HEADER_TRIP_CHANGES = ['kept', 'link', 'unlink'] as const;

export const journeyHeaderTripSchema = z.object({
  /** Null for a trip a new journal names that the user's trips do not list. */
  id: idSchema.nullable(),
  title: cardText(JOURNEY_HEADER_LIMITS.tripTitle),
  startDate: cardDateSchema.nullable(),
  endDate: cardDateSchema.nullable(),
  change: z.enum(JOURNEY_HEADER_TRIP_CHANGES),
});
export type JourneyHeaderTrip = z.infer<typeof journeyHeaderTripSchema>;

export const journeyHeaderCardSchema = z.object({
  kind: z.literal('journeyHeader'),
  /** Null for a journal a held change has not made yet. */
  journeyId: idSchema.nullable(),
  title: cardText(JOURNEY_HEADER_LIMITS.title),
  subtitle: cardText(JOURNEY_HEADER_LIMITS.subtitle).nullable(),
  change: z.enum(JOURNEY_HEADER_CHANGES),
  trips: z.array(journeyHeaderTripSchema).max(JOURNEY_HEADER_LIMITS.trips),
  /** What the journal holds: what a deletion takes with it, what an unlinked trip leaves behind. */
  entries: cardCountSchema.nullable(),
  photos: cardCountSchema.nullable(),
  /** Places of the linked trips that come in as suggestions; null when unknown. */
  suggestions: cardCountSchema.nullable(),
});
export type JourneyHeaderCard = z.infer<typeof journeyHeaderCardSchema>;
