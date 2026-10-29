import { idSchema } from '../../common/primitives.schema';
import { cardCountSchema, cardDateSchema, cardText } from './card-parts';

import { z } from 'zod';

/**
 * Photos of a journal as the assistant chat shows a change of them: one put
 * on an entry or taken off it, photos moved from one entry to another, an
 * entry's photos in a new order (the first is its cover), a caption changed,
 * photos added from a library. A photo travels as its TREK photo id, which
 * the client turns into TREK's own thumbnail address.
 */

/** How much a card carries; the server clips to the same numbers. */
export const JOURNEY_PHOTOS_LIMITS = { photos: 8, caption: 160, title: 100 } as const;

export const JOURNEY_PHOTOS_MODES = ['link', 'unlink', 'move', 'order', 'caption', 'add'] as const;

/** An entry the photos leave or reach. */
export const journeyPhotosEntrySchema = z.object({
  entryId: idSchema.nullable(),
  title: cardText(JOURNEY_PHOTOS_LIMITS.title).nullable(),
  date: cardDateSchema.nullable(),
});
export type JourneyPhotosEntry = z.infer<typeof journeyPhotosEntrySchema>;

export const journeyPhotoLookSchema = z.object({
  /** The TREK photo, for its thumbnail. */
  photoId: idSchema,
  video: z.boolean(),
  caption: cardText(JOURNEY_PHOTOS_LIMITS.caption).nullable(),
});
export type JourneyPhotoLook = z.infer<typeof journeyPhotoLookSchema>;

export const journeyPhotosCardSchema = z.object({
  kind: z.literal('journeyPhotos'),
  journeyId: idSchema,
  mode: z.enum(JOURNEY_PHOTOS_MODES),
  /** The entry the photos leave (a move, an unlink). */
  from: journeyPhotosEntrySchema.nullable(),
  /** The entry the photos reach or whose photos change (a link, a move, a new order, an add). */
  to: journeyPhotosEntrySchema.nullable(),
  /** In the order the change leaves them; for a new order, the first is the entry's cover. */
  photos: z.array(journeyPhotoLookSchema).max(JOURNEY_PHOTOS_LIMITS.photos),
  /** Photos the change concerns that the card does not carry. */
  more: cardCountSchema,
  /** A move that leaves the photos on the first entry as well. */
  kept: z.boolean(),
  /** A caption change, old to new; null on every other change. */
  caption: z
    .object({
      before: cardText(JOURNEY_PHOTOS_LIMITS.caption).nullable(),
      after: cardText(JOURNEY_PHOTOS_LIMITS.caption).nullable(),
    })
    .nullable(),
});
export type JourneyPhotosCard = z.infer<typeof journeyPhotosCardSchema>;
