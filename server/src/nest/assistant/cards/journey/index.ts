import type { DomainCards, ToolArgs, ToolCards } from '../card-types';
import { argId, idIn, recordOf } from '../card-values';
import {
  JOURNEY_DESCRIBERS,
  journalAppliedCard,
  journalChangeCard,
  loadJournal,
  type JournalLoaded,
} from './journey-change';
import {
  JOURNAL_HEADER_DESCRIBERS,
  journalHeaderApplied,
  journalHeaderCard,
  loadJournalHeader,
  type JournalHeaderLoaded,
} from './journey-header';
import {
  DELETE_CREATED_JOURNEY,
  FLIP_JOURNEY_PREFERENCE,
  RESTORE_JOURNEY_SETTINGS,
  UNLINK_LINKED_TRIP,
} from './journey-header-undo';
import { readCard } from './journey-look';
import {
  describeReorder,
  describeStay,
  loadJournalOrder,
  loadStay,
  reorderCard,
  stayCard,
  type JournalOrderLoaded,
  type StayLoaded,
} from './journey-order';
import {
  describeJournalPhotos,
  journalPhotosApplied,
  journalPhotosCard,
  loadJournalPhotos,
  type JournalPhotosLoaded,
  type JournalPhotosTool,
} from './journey-photos';
import {
  MOVE_PHOTOS_BACK,
  RELINK_UNLINKED_PHOTO,
  RESTORE_PHOTO_CAPTION,
  UNLINK_LINKED_PHOTO,
} from './journey-photos-undo';
import { DELETE_CREATED_ENTRY, RESTORE_CHANGED_ENTRY, RESTORE_ENTRY_ORDER } from './journey-undo';
import type { AssistantChangeVerbKey, JourneyEntriesCard } from '@trek/shared';

/**
 * The travel journal in the assistant chat. A read of a journal's entries
 * shows them as a card beside the answer; a held write of an entry shows the
 * entry it will write, change or delete, and once applied the entry as it
 * was stored, its photo and country included. A created entry can be taken
 * back while nothing was written to it since. A change of a journal itself
 * (a new one, its settings, its trips, its suggestions, the user's own view
 * of it, its deletion) shows the journal with its trips (journey-header.ts),
 * and most of them can be taken back (journey-header-undo.ts).
 */

/** The entry a create or a change answered with, else the one a delete named. */
function entryIds(args: ToolArgs, result: unknown): number[] {
  const id = idIn(result, 'entry') ?? argId(args, 'entryId');
  return id === null ? [] : [id];
}

/**
 * The card of a read that answers `{ entries | entry, journey: { id, title } }`.
 * One entry read on its own has no day of the journal to colour it by.
 */
function readAnswer(journeyId: number | null, value: unknown, key: 'entries' | 'entry'): JourneyEntriesCard | null {
  const answer = recordOf(value);
  const title = recordOf(answer.journey).title;
  if (key === 'entry') return readCard(journeyId, title, [answer.entry], false);
  return readCard(journeyId, title, answer.entries);
}

/** A journal write's card entries: its words, its lookups, its card while held and once applied. */
function journalWrite(tool: string): ToolCards<JournalLoaded> {
  return {
    load: (args, read) => loadJournal(tool, args, read),
    change: (_ctx, args, loaded) => journalChangeCard(tool, args, loaded),
    applied: ({ result, preview }) => journalAppliedCard(tool, result, preview),
    appliedIds: entryIds,
  };
}

/** The journal a change of the journal itself touched: the one its answer names, else the one it was called on. */
function journalIds(args: ToolArgs, result: unknown): number[] {
  const id = idIn(result, 'journey') ?? argId(args, 'journeyId');
  return id === null ? [] : [id];
}

/** A change of a journal itself: its verb, its words, its lookups, its card while held and once applied. */
function journalHeader(
  tool: keyof typeof JOURNAL_HEADER_DESCRIBERS,
  verbKey: AssistantChangeVerbKey,
  undo?: NonNullable<ToolCards['undo']>,
): ToolCards<JournalHeaderLoaded> {
  return {
    write: { verbKey, entity: 'journey' },
    describe: JOURNAL_HEADER_DESCRIBERS[tool],
    load: (args, read) => loadJournalHeader(tool, args, read),
    change: (_ctx, args, loaded) => journalHeaderCard(tool, args, loaded),
    applied: ({ result, preview }) => journalHeaderApplied(tool, result, preview),
    appliedIds: journalIds,
    ...(undo ? { undo } : {}),
  };
}

/** A new order of the journal's entries: the entries that move, in their new places, and the way back. */
const reorderCards: ToolCards<JournalOrderLoaded> = {
  write: { verbKey: 'reorderJournalEntries', entity: 'journey_entry' },
  load: (args, read) => loadJournalOrder(args, read),
  describe: describeReorder,
  change: (_ctx, args, loaded) => reorderCard(args, loaded),
  appliedIds: (args) => {
    const first = Array.isArray(args.orderedIds) ? args.orderedIds[0] : null;
    return typeof first === 'number' ? [first] : [];
  },
  undo: RESTORE_ENTRY_ORDER,
};

/**
 * A stay Dawarich recorded taken in as an entry: the entry it writes. No way
 * back: deleting the entry would leave the stay marked as taken in, with no
 * way to take it in again.
 */
const stayCards: ToolCards<StayLoaded> = {
  write: { verbKey: 'addJournalEntry', entity: 'journey_entry' },
  load: (args, read) => loadStay(args, read),
  describe: describeStay,
  change: (_ctx, args, loaded) => stayCard(args, loaded),
  appliedIds: (_args, result) => {
    const id = recordOf(result).createdJournalEntryId;
    return typeof id === 'number' ? [id] : [];
  },
};

/** The entry a photo change touched, else the journal (a caption). */
function photoIds(args: ToolArgs, result: unknown): number[] {
  const id = argId(args, 'toEntryId') ?? argId(args, 'entryId') ?? argId(recordOf(result), 'toEntryId');
  return id === null ? [] : [id];
}

/** A change of a journal's photos: its verb, its words, its lookups, its card while held and once applied. */
function journalPhotos(
  tool: JournalPhotosTool,
  verbKey: AssistantChangeVerbKey,
  undo?: NonNullable<ToolCards['undo']>,
): ToolCards<JournalPhotosLoaded> {
  return {
    write: { verbKey, entity: tool === 'set_journey_photo_caption' ? 'journey' : 'journey_entry' },
    load: (args, read) => loadJournalPhotos(args, read),
    describe: (ctx, args, loaded) => describeJournalPhotos(tool, ctx, args, loaded),
    change: (_ctx, args, loaded) => journalPhotosCard(tool, args, loaded),
    applied: ({ result, preview }) => journalPhotosApplied(tool, result, preview),
    appliedIds: tool === 'set_journey_photo_caption' ? journalIds : photoIds,
    ...(undo ? { undo } : {}),
  };
}

export const JOURNEY_CARDS: DomainCards = {
  id: 'journey',
  tools: {
    // A Studio conversation pins the journey, so its arguments hold no id: the answer names the journey too.
    list_journey_entries: {
      answer: ({ args, value }) => readAnswer(argId(args, 'journeyId') ?? idIn(value, 'journey'), value, 'entries'),
    },
    get_journey_entry: { answer: ({ value }) => readAnswer(idIn(value, 'journey'), value, 'entry') },
    get_journey: {
      answer: ({ value }) => {
        const journey = recordOf(recordOf(value).journey);
        return readCard(argId(journey, 'id'), journey.title, journey.entries);
      },
    },
    create_journey_entry: {
      write: { verbKey: 'addJournalEntry', entity: 'journey_entry' },
      describe: JOURNEY_DESCRIBERS.create_journey_entry,
      undo: DELETE_CREATED_ENTRY,
      ...journalWrite('create_journey_entry'),
    },
    update_journey_entry: {
      write: { verbKey: 'updateJournalEntry', entity: 'journey_entry' },
      describe: JOURNEY_DESCRIBERS.update_journey_entry,
      undo: RESTORE_CHANGED_ENTRY,
      ...journalWrite('update_journey_entry'),
    },
    delete_journey_entry: {
      write: { verbKey: 'removeJournalEntry', entity: 'journey_entry' },
      describe: JOURNEY_DESCRIBERS.delete_journey_entry,
      ...journalWrite('delete_journey_entry'),
    },
    reorder_journey_entries: reorderCards,
    link_journey_photo: journalPhotos('link_journey_photo', 'linkJournalPhoto', UNLINK_LINKED_PHOTO),
    unlink_journey_photo: journalPhotos('unlink_journey_photo', 'unlinkJournalPhoto', RELINK_UNLINKED_PHOTO),
    move_journey_photos: journalPhotos('move_journey_photos', 'moveJournalPhotos', MOVE_PHOTOS_BACK),
    reorder_journey_entry_photos: journalPhotos('reorder_journey_entry_photos', 'orderJournalPhotos'),
    set_journey_photo_caption: journalPhotos('set_journey_photo_caption', 'captionJournalPhoto', RESTORE_PHOTO_CAPTION),
    add_journey_provider_photos: journalPhotos('add_journey_provider_photos', 'addJournalPhotos'),
    accept_dawarich_suggestion_as_journal_entry: stayCards,
    create_journey: journalHeader('create_journey', 'createJournal', DELETE_CREATED_JOURNEY),
    update_journey: journalHeader('update_journey', 'updateJournalSettings', RESTORE_JOURNEY_SETTINGS),
    delete_journey: journalHeader('delete_journey', 'deleteJournal'),
    add_journey_trip: journalHeader('add_journey_trip', 'linkJournalTrip', UNLINK_LINKED_TRIP),
    remove_journey_trip: journalHeader('remove_journey_trip', 'unlinkJournalTrip'),
    restore_journey_suggestions: journalHeader('restore_journey_suggestions', 'restoreJournalSuggestions'),
    update_journey_preferences: journalHeader(
      'update_journey_preferences',
      'setJournalPreferences',
      FLIP_JOURNEY_PREFERENCE,
    ),
  },
  prompt: [
    'Journal: get_trip_journal finds the journal this trip shows. To show entries, call list_journey_entries with from/to for the days asked: the app draws them as cards, so do not list them again in your answer.',
    "Photo book: a journey's photo book is laid out in its Studio, which has an assistant of its own. When asked to design or change the book, tell the user to open Studio from the journey; its tools are not offered here.",
  ],
};
