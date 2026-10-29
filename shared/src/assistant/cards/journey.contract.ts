import { journeyEntriesCardSchema } from './journey-entries.card';
import { journeyHeaderCardSchema } from './journey-header.card';
import { journeyPhotosCardSchema } from './journey-photos.card';

export * from './journey-entries.card';
export * from './journey-header.card';
export * from './journey-photos.card';

/**
 * What the travel journal brings to the assistant chat: the kinds of card it draws,
 * the verbs of its change cards and what an applied change of its
 * touches, beyond the core ones. cards/index.ts and assistant.schema.ts
 * spread these into the card union and the shared enums, so a new kind, verb
 * or entity is added here and nowhere else.
 */
export const JOURNEY_CARD_SCHEMAS = [
  journeyEntriesCardSchema,
  journeyHeaderCardSchema,
  journeyPhotosCardSchema,
] as const;
/**
 * An entry written, changed or deleted, the entries put in a new order; a journal started, renamed, given
 * another status or other settings, deleted; a trip linked or unlinked; its
 * suggestions brought back; the user's own view of it changed; a photo put on
 * an entry, taken off, moved, put in order, captioned or added.
 */
export const JOURNEY_VERB_KEYS = [
  'addJournalEntry',
  'updateJournalEntry',
  'removeJournalEntry',
  'reorderJournalEntries',
  'createJournal',
  'renameJournal',
  'setJournalStatus',
  'updateJournalSettings',
  'deleteJournal',
  'linkJournalTrip',
  'unlinkJournalTrip',
  'restoreJournalSuggestions',
  'setJournalPreferences',
  'linkJournalPhoto',
  'unlinkJournalPhoto',
  'moveJournalPhotos',
  'orderJournalPhotos',
  'captionJournalPhoto',
  'addJournalPhotos',
] as const;
/** An entry of a journal, or the journal itself; the receipt opens it there. */
export const JOURNEY_APPLIED_ENTITIES = ['journey_entry', 'journey'] as const;
