import type { ToolArgs, ToolCards, UndoSnapshot } from '../card-types';
import { idIn, readKey, recordOf } from '../card-values';
import { journeyArgs } from './journey-header';

/** How the undo reads the created entry again: by its id, whatever the turn read before. */
function entryRead(result: unknown) {
  return { tool: 'get_journey_entry', args: { entryId: idIn(result, 'entry') } };
}

function photoCount(entry: Record<string, unknown>): number {
  return Array.isArray(entry.photos) ? entry.photos.length : 0;
}

/**
 * A created entry, unchanged since: still there, not written since it was
 * made (every write of an entry stamps its `updated_at`), and holding the
 * photos it was created with, none added since, which the undo would delete
 * along with it.
 */
function entryUnchanged(result: unknown, snapshot: UndoSnapshot): boolean {
  const created = recordOf(recordOf(result).entry);
  const read = entryRead(result);
  if (read.args.entryId === null) return false;
  const current = recordOf(recordOf(snapshot.reads.get(readKey(read.tool, read.args))).entry);
  return (
    current.id === created.id &&
    current.updated_at !== undefined &&
    current.updated_at === created.updated_at &&
    photoCount(current) === photoCount(created)
  );
}

/** A created journal entry taken back by deleting it; a written-up suggestion is never one the create made. */
export const DELETE_CREATED_ENTRY: NonNullable<ToolCards['undo']> = {
  tool: 'delete_journey_entry',
  args: (_args, result) => {
    const entryId = idIn(result, 'entry');
    return entryId ? { entryId } : null;
  },
  reads: (_args, result) => [entryRead(result)],
  unchanged: entryUnchanged,
};

/**
 * A changed entry written back as it was, from what the tool answered it
 * replaced, while nothing was written to it since and it holds the photos it
 * held then.
 */
export const RESTORE_CHANGED_ENTRY: NonNullable<ToolCards['undo']> = {
  tool: 'update_journey_entry',
  args: (_args, result) => {
    const entryId = idIn(result, 'entry');
    const previous = recordOf(recordOf(result).previous);
    return entryId === null || Object.keys(previous).length === 0 ? null : { entryId, ...previous };
  },
  reads: (_args, result) => [entryRead(result)],
  unchanged: entryUnchanged,
};

/** The ids a reorder named, and the order the tool answered they stood in before. */
function ordersOf(args: ToolArgs, result: unknown): { next: number[]; before: number[] } {
  const ids = (value: unknown) =>
    Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
  return { next: ids(args.orderedIds), before: ids(recordOf(result).previous_order) };
}

/**
 * A new order taken back to the one before, while the entries still stand
 * as it left them: each at the place the reorder gave it.
 */
export const RESTORE_ENTRY_ORDER: NonNullable<ToolCards['undo']> = {
  tool: 'reorder_journey_entries',
  args: (args, result) => {
    const { next, before } = ordersOf(args, result);
    const same = before.length === next.length && before.every((id, index) => id === next[index]);
    return before.length === 0 || same ? null : { ...journeyArgs(args), orderedIds: before };
  },
  reads: (args) => [{ tool: 'list_journey_entries', args: journeyArgs(args) }],
  unchanged: (result, snapshot, call) => {
    const args = call?.args ?? {};
    const { next } = ordersOf(args, result);
    const read = recordOf(snapshot.reads.get(readKey('list_journey_entries', journeyArgs(args))));
    const sortOf = new Map(
      (Array.isArray(read.entries) ? read.entries.map(recordOf) : []).map((entry) => [entry.id, entry.sort_order]),
    );
    return next.length > 0 && next.every((id, index) => sortOf.get(id) === index);
  },
};
