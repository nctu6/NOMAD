import type { ToolArgs, ToolCards, UndoSnapshot } from '../card-types';
import { argId, idIn, readKey, recordOf } from '../card-values';
import { rowsOf } from '../undo-snapshot';

/**
 * The ways back from a change of a journal's photos, each checked against
 * the entry as `get_journey_entry` reads it now:
 * - a photo put on an entry comes off again while it is still there;
 * - a photo taken off goes back while it is still off;
 * - moved photos go back while the target holds them all and, unless they
 *   were kept, the source none of them;
 * - a caption is written back while the photo still carries the new one.
 */

type Undo = NonNullable<ToolCards['undo']>;

function entryRead(entryId: number | null) {
  return { tool: 'get_journey_entry', args: { entryId } };
}

/** The journey photo ids an entry holds now, as the snapshot read it; null when the read failed. */
function heldBy(snapshot: UndoSnapshot, entryId: number | null): Set<number> | null {
  const read = entryRead(entryId);
  const entry = recordOf(recordOf(snapshot.reads.get(readKey(read.tool, read.args))).entry);
  if (entry.id !== entryId) return null;
  return new Set(rowsOf(entry.photos).map((photo) => photo.id as number));
}

function linkArgs(args: ToolArgs): { entryId: number; journey_photo_id: number } | null {
  const entryId = argId(args, 'entryId');
  const photoId = argId(args, 'journey_photo_id');
  return entryId === null || photoId === null ? null : { entryId, journey_photo_id: photoId };
}

export const UNLINK_LINKED_PHOTO: Undo = {
  tool: 'unlink_journey_photo',
  args: (args, _result, preview) => (preview?.undoable === false ? null : linkArgs(args)),
  reads: (args) => [entryRead(argId(args, 'entryId'))],
  unchanged: (_result, snapshot, call) => {
    const link = linkArgs(call?.args ?? {});
    return !!link && (heldBy(snapshot, link.entryId)?.has(link.journey_photo_id) ?? false);
  },
};

export const RELINK_UNLINKED_PHOTO: Undo = {
  tool: 'link_journey_photo',
  args: (args, result) => (recordOf(result).success === true ? linkArgs(args) : null),
  reads: (args) => [entryRead(argId(args, 'entryId'))],
  unchanged: (_result, snapshot, call) => {
    const link = linkArgs(call?.args ?? {});
    const held = link ? heldBy(snapshot, link.entryId) : null;
    return !!link && !!held && !held.has(link.journey_photo_id);
  },
};

/** What a move answered it moved, between which entries. */
function movedBy(result: unknown) {
  const answer = recordOf(result);
  const moved = Array.isArray(answer.moved) ? answer.moved.filter((id): id is number => Number.isInteger(id)) : [];
  return { moved, from: argId(answer, 'fromEntryId'), to: argId(answer, 'toEntryId'), kept: answer.kept === true };
}

export const MOVE_PHOTOS_BACK: Undo = {
  tool: 'move_journey_photos',
  args: (_args, result, preview) => {
    const { moved, from, to } = movedBy(result);
    if (preview?.undoable === false || moved.length === 0 || from === null || to === null) return null;
    // Back to the source and off the target; a kept photo is on the source already, so only the target loses it.
    return { fromEntryId: to, toEntryId: from, photoIds: moved };
  },
  reads: (_args, result) => {
    const { from, to } = movedBy(result);
    return [entryRead(to), entryRead(from)];
  },
  unchanged: (result, snapshot) => {
    const { moved, from, to, kept } = movedBy(result);
    const onTarget = heldBy(snapshot, to);
    const onSource = heldBy(snapshot, from);
    if (!onTarget || !onSource || moved.length === 0) return false;
    return moved.every((id) => onTarget.has(id) && (kept || !onSource.has(id)));
  },
};

/** The caption a caption change wrote, and the one it replaced. */
function captionsOf(result: unknown) {
  const answer = recordOf(result);
  return { photo: recordOf(answer.photo), previous: recordOf(answer.previous) };
}

export const RESTORE_PHOTO_CAPTION: Undo = {
  tool: 'set_journey_photo_caption',
  args: (args, result) => {
    const { photo, previous } = captionsOf(result);
    const photoId = idIn(result, 'photo');
    if (photoId === null || !('caption' in previous)) return null;
    const journeyId = argId(args, 'journeyId') ?? argId(photo, 'journey_id');
    return {
      ...(journeyId === null ? {} : { journeyId }),
      journey_photo_id: photoId,
      caption: previous.caption ?? null,
    };
  },
  reads: (args) => [
    { tool: 'get_journey', args: argId(args, 'journeyId') === null ? {} : { journeyId: args.journeyId } },
  ],
  unchanged: (result, snapshot, call) => {
    const args = call?.args ?? {};
    const read = { tool: 'get_journey', args: argId(args, 'journeyId') === null ? {} : { journeyId: args.journeyId } };
    const journey = recordOf(recordOf(snapshot.reads.get(readKey(read.tool, read.args))).journey);
    const { photo } = captionsOf(result);
    const current = rowsOf(journey.gallery).find((row) => row.id === photo.id);
    return !!current && (current.caption ?? null) === (photo.caption ?? null);
  },
};
