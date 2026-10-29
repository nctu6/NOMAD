import { journalChatCardSchema } from './journal-chat.card';
import { tripChatCardSchema } from './trip-chat.card';

export * from './journal-chat.card';
export * from './trip-chat.card';

/**
 * What the chat outside any one trip (the `home` scope) brings to the
 * assistant chat: the cards that offer to go on in a trip's own chat or on a
 * journal's page. It has no change cards of its own; the writes it proposes
 * are the atlas', the vacation planner's, the collections' and a new
 * journal's. cards/index.ts spreads the kinds into the card union.
 */
export const HOME_CARD_SCHEMAS = [tripChatCardSchema, journalChatCardSchema] as const;
