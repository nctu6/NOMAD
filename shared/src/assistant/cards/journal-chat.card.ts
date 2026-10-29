import { idSchema } from '../../common/primitives.schema';
import { cardCountSchema, cardDateSchema, cardText } from './card-parts';

import { z } from 'zod';

/**
 * A journal the chat outside any one trip offers to go on with on the
 * journal's own page: the conversation there knows the journal's entries and
 * photos and can change them, which the chat on the dashboard does not. The
 * question is what the user asked about the journal, handed over so it waits
 * there ready to send.
 */
export const journalChatCardSchema = z.object({
  kind: z.literal('journalChat'),
  journey: z.object({
    id: idSchema,
    title: cardText(200),
    subtitle: cardText(300).nullable(),
    /** The days of the trips it holds, when it holds any. */
    startDate: cardDateSchema.nullable(),
    endDate: cardDateSchema.nullable(),
    entryCount: cardCountSchema,
    photoCount: cardCountSchema,
  }),
  /** The question to ask on the journal's page, in the user's words; null when there is none to hand over. */
  question: cardText(500).nullable(),
});
export type JournalChatCard = z.infer<typeof journalChatCardSchema>;
