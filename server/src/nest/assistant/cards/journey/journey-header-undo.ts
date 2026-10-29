import type { ToolArgs, ToolCards, UndoSnapshot } from '../card-types';
import { argId, idIn, readKey, recordOf, type Row } from '../card-values';
import { rowsOf } from '../undo-snapshot';
import { journeyArgs } from './journey-header';

/**
 * The ways back from a change of a journal itself, each checked against the
 * journal as `get_journey` reads it now:
 * - a new journal is deleted while nothing was written, added or laid out in
 *   it since (its trips' suggestions are what it was made with);
 * - changed settings are written back as they were, while the journal was not
 *   changed again since;
 * - a linked trip is unlinked again, by its owner and while none of the
 *   trip's suggestions was written up since;
 * - the user's own switch is flipped back while it still stands as set.
 */

type Undo = NonNullable<ToolCards['undo']>;

/** The settings `update_journey` takes no null for. */
const NEVER_NULL: ReadonlySet<string> = new Set(['title', 'status']);

function journeyRead(args: ToolArgs) {
  return { tool: 'get_journey', args };
}

/** The journal a snapshot read, as `get_journey` answered. */
function journeyIn(snapshot: UndoSnapshot, args: ToolArgs): Row {
  const read = journeyRead(args);
  return recordOf(recordOf(snapshot.reads.get(readKey(read.tool, read.args))).journey);
}

/** The new journal by the id its answer names; the reads may not depend on it at boot, so they take it as given. */
function createdArgs(result: unknown): ToolArgs {
  const journeyId = idIn(result, 'journey');
  return journeyId === null ? {} : { journeyId };
}

export const DELETE_CREATED_JOURNEY: Undo = {
  tool: 'delete_journey',
  args: (_args, result) => {
    const journeyId = idIn(result, 'journey');
    return journeyId === null ? null : { journeyId };
  },
  reads: (_args, result) => [journeyRead(createdArgs(result)), { tool: 'get_book', args: createdArgs(result) }],
  unchanged: (result, snapshot) => {
    const created = recordOf(recordOf(result).journey);
    const args = createdArgs(result);
    if (args.journeyId === undefined) return false;
    const current = journeyIn(snapshot, args);
    const book = recordOf(snapshot.reads.get(readKey('get_book', args)));
    return (
      current.id === created.id &&
      current.updated_at !== undefined &&
      current.updated_at === created.updated_at &&
      rowsOf(current.entries).every((entry) => entry.type === 'skeleton') &&
      rowsOf(current.gallery).length === 0 &&
      rowsOf(current.contributors).length <= 1 &&
      book.exists === false
    );
  },
};

export const RESTORE_JOURNEY_SETTINGS: Undo = {
  tool: 'update_journey',
  args: (_args, result) => {
    const journeyId = idIn(result, 'journey');
    // The name and the status take no null; one stored empty has nothing to write back.
    const previous = Object.fromEntries(
      Object.entries(recordOf(recordOf(result).previous)).filter(
        ([key, value]) => value !== null || !NEVER_NULL.has(key),
      ),
    );
    return journeyId === null || Object.keys(previous).length === 0 ? null : { journeyId, ...previous };
  },
  reads: (_args, result) => [journeyRead(createdArgs(result))],
  unchanged: (result, snapshot) => {
    const changed = recordOf(recordOf(result).journey);
    const current = journeyIn(snapshot, createdArgs(result));
    return current.id === changed.id && current.updated_at !== undefined && current.updated_at === changed.updated_at;
  },
};

export const UNLINK_LINKED_TRIP: Undo = {
  tool: 'remove_journey_trip',
  args: (args, result, preview) => {
    const tripId = argId(args, 'tripId');
    if (preview?.undoable === false || tripId === null || recordOf(result).success !== true) return null;
    return { ...journeyArgs(args), tripId };
  },
  reads: (args) => [journeyRead(journeyArgs(args))],
  unchanged: (_result, snapshot, call) => {
    const tripId = argId(call?.args ?? {}, 'tripId');
    if (tripId === null) return false;
    const current = journeyIn(snapshot, journeyArgs(call?.args ?? {}));
    const stillLinked = rowsOf(current.trips).some((trip) => trip.trip_id === tripId);
    const written = rowsOf(current.entries).some(
      (entry) => entry.source_trip_id === tripId && entry.type !== 'skeleton',
    );
    return stillLinked && !written;
  },
};

export const FLIP_JOURNEY_PREFERENCE: Undo = {
  tool: 'update_journey_preferences',
  args: (args, result, preview) => {
    if (preview?.undoable === false || !('hide_skeletons' in args) || !('hide_skeletons' in recordOf(result))) {
      return null;
    }
    return { ...journeyArgs(args), hide_skeletons: !args.hide_skeletons };
  },
  reads: (args) => [journeyRead(journeyArgs(args))],
  unchanged: (result, snapshot, call) => {
    const current = journeyIn(snapshot, journeyArgs(call?.args ?? {}));
    return 'hide_skeletons' in current && !!current.hide_skeletons === !!recordOf(result).hide_skeletons;
  },
};
