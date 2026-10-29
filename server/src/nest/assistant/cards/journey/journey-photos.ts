import type { CardReader, Described, PreviewContext, ToolArgs } from '../card-types';
import { argId, clipped, recordOf, type Row } from '../card-values';
import { formatDate, Rows, text } from '../preview-format';
import { rowsOf } from '../undo-snapshot';
import {
  JOURNEY_PHOTOS_LIMITS,
  type AssistantChangePreview,
  type JourneyPhotoLook,
  type JourneyPhotosCard,
  type JourneyPhotosEntry,
} from '@trek/shared';

/**
 * The change cards of a journal's photos: one put on an entry or taken off
 * it, photos moved between entries, an entry's photos in a new order, a
 * caption, photos added from a library. Each shows the photos themselves (by
 * their TREK photo id, for the thumbnail) and the entries they leave and
 * reach, read with the user's rights from `get_journey`.
 */

/** What a held photo change looked up: the journal as `get_journey` answers it. */
export interface JournalPhotosLoaded {
  journey: Row;
}

/** The tools these cards are for, each with what its card shows. */
const MODES = {
  link_journey_photo: 'link',
  unlink_journey_photo: 'unlink',
  move_journey_photos: 'move',
  reorder_journey_entry_photos: 'order',
  set_journey_photo_caption: 'caption',
  add_journey_provider_photos: 'add',
} as const satisfies Record<string, JourneyPhotosCard['mode']>;
export type JournalPhotosTool = keyof typeof MODES;

/** The entry a call is about: the one it changes, or the one the photos leave. */
function entryArg(args: ToolArgs): number | null {
  return argId(args, 'entryId') ?? argId(args, 'fromEntryId');
}

/**
 * At most two reads: the journal the call names, or, where it names only an
 * entry, the entry first for its journal. In a journey's own conversation the
 * session pins the journal, so the entry read and the journal read both reach it.
 */
export async function loadJournalPhotos(args: ToolArgs, read: CardReader): Promise<JournalPhotosLoaded | null> {
  let journeyId = argId(args, 'journeyId');
  const entryId = entryArg(args);
  if (journeyId === null && entryId !== null) {
    journeyId = argId(recordOf(recordOf(await read('get_journey_entry', { entryId })).journey), 'id');
  }
  const journey = recordOf(recordOf(await read('get_journey', journeyId === null ? {} : { journeyId })).journey);
  return argId(journey, 'id') === null ? null : { journey };
}

function entriesOf(loaded: JournalPhotosLoaded | null): Row[] {
  return rowsOf(loaded?.journey.entries);
}

function entryOf(loaded: JournalPhotosLoaded | null, entryId: number | null): Row | undefined {
  return entryId === null ? undefined : entriesOf(loaded).find((entry) => entry.id === entryId);
}

/** The photos of an entry, by their journey photo id, in its order. */
function entryPhotos(entry: Row | undefined): Row[] {
  return rowsOf(entry?.photos);
}

function galleryPhoto(loaded: JournalPhotosLoaded | null, journeyPhotoId: number | null): Row | undefined {
  return rowsOf(loaded?.journey.gallery).find((photo) => photo.id === journeyPhotoId);
}

function idsOf(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
}

/** A photo as a card shows it; null for a row without a TREK photo. */
function photoLook(row: Row | undefined): JourneyPhotoLook | null {
  const photoId = argId(row ?? {}, 'photo_id');
  if (!row || photoId === null) return null;
  return {
    photoId,
    video: row.media_type === 'video',
    caption: clipped(row.caption, JOURNEY_PHOTOS_LIMITS.caption),
  };
}

function entryRef(entry: Row | undefined, entryId: number | null): JourneyPhotosEntry | null {
  if (entryId === null) return null;
  const raw = entry?.entry_date;
  const date = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  const title =
    clipped(entry?.title, JOURNEY_PHOTOS_LIMITS.title) ?? clipped(entry?.location_name, JOURNEY_PHOTOS_LIMITS.title);
  return { entryId, title, date };
}

/** The photos a call concerns, as the card draws them, in the order the change leaves them. */
function photosOf(tool: JournalPhotosTool, args: ToolArgs, loaded: JournalPhotosLoaded | null): Row[] {
  const source = entryPhotos(entryOf(loaded, entryArg(args)));
  const byId = (rows: Row[], ids: number[]) => ids.flatMap((id) => rows.filter((row) => row.id === id));
  if (tool === 'link_journey_photo' || tool === 'set_journey_photo_caption') {
    const photo = galleryPhoto(loaded, argId(args, 'journey_photo_id'));
    return photo ? [photo] : [];
  }
  if (tool === 'unlink_journey_photo') return byId(source, [argId(args, 'journey_photo_id') ?? 0]);
  if (tool === 'move_journey_photos') return byId(source, idsOf(args.photoIds));
  if (tool === 'reorder_journey_entry_photos') return byId(source, idsOf(args.orderedIds));
  return [];
}

/** How many photos the call names: its ids, or for a library add the assets it brings. */
function namedCount(tool: JournalPhotosTool, args: ToolArgs): number {
  if (tool === 'move_journey_photos') return idsOf(args.photoIds).length;
  if (tool === 'reorder_journey_entry_photos') return idsOf(args.orderedIds).length;
  if (tool === 'add_journey_provider_photos') return Array.isArray(args.asset_ids) ? args.asset_ids.length : 0;
  return 1;
}

/** The card under a held photo change; null without a journal to name. */
export function journalPhotosCard(
  tool: JournalPhotosTool,
  args: ToolArgs,
  loaded: JournalPhotosLoaded | null,
): JourneyPhotosCard | null {
  const journeyId = argId(loaded?.journey ?? {}, 'id');
  if (journeyId === null) return null;
  const mode = MODES[tool];
  const looks = photosOf(tool, args, loaded).flatMap((row) => {
    const look = photoLook(row);
    return look ? [look] : [];
  });
  const shown = looks.slice(0, JOURNEY_PHOTOS_LIMITS.photos);
  const entryId = entryArg(args);
  const leaves = mode === 'move' || mode === 'unlink';
  const toId = mode === 'move' ? argId(args, 'toEntryId') : entryId;
  const captioned = galleryPhoto(loaded, argId(args, 'journey_photo_id'));
  return {
    kind: 'journeyPhotos',
    journeyId,
    mode,
    from: leaves ? entryRef(entryOf(loaded, entryId), entryId) : null,
    to: mode === 'unlink' || mode === 'caption' ? null : entryRef(entryOf(loaded, toId), toId),
    photos: shown,
    more: Math.max(0, namedCount(tool, args) - shown.length),
    kept: mode === 'move' && args.keep_in_source === true,
    caption:
      mode === 'caption'
        ? {
            before: clipped(captioned?.caption, JOURNEY_PHOTOS_LIMITS.caption),
            after: clipped(args.caption, JOURNEY_PHOTOS_LIMITS.caption),
          }
        : null,
  };
}

/** What an entry is called on a row: its title, else its place, else its day. */
function entryName(ctx: PreviewContext, entry: Row | undefined): string {
  const raw = entry?.entry_date;
  const day = typeof raw === 'string' ? formatDate(ctx, raw) : '';
  return text(entry?.title) || text(entry?.location_name) || day;
}

/**
 * The words of a photo change: the entry it is about, the number of photos,
 * a caption old to new. A link or a move is undoable only where none of its
 * photos was on the entry they reach already: the way back would take off a
 * photo the change never put there.
 */
export function describeJournalPhotos(
  tool: JournalPhotosTool,
  ctx: PreviewContext,
  args: ToolArgs,
  loaded: JournalPhotosLoaded | null,
): Described {
  const rows = new Rows();
  const entry = entryOf(loaded, entryArg(args));
  const count = namedCount(tool, args);
  const base = { dayId: null, placeIds: [], domain: 'journey' };
  if (tool === 'set_journey_photo_caption') {
    const photo = galleryPhoto(loaded, argId(args, 'journey_photo_id'));
    rows.change('text', text(photo?.caption), text(args.caption));
    return { subject: text(loaded?.journey.title), rows, ...base };
  }
  rows.rows.push({ op: 'add', labelKey: 'field', field: 'photos', before: null, after: String(count) });
  if (tool === 'move_journey_photos') {
    const target = entryOf(loaded, argId(args, 'toEntryId'));
    const from = entryName(ctx, entry);
    rows.rows.push({
      op: 'move',
      labelKey: 'field',
      field: 'entry',
      before: from || null,
      after: entryName(ctx, target),
    });
    const already = new Set(entryPhotos(target).map((photo) => photo.id));
    const undoable = !idsOf(args.photoIds).some((id) => already.has(id));
    return { subject: entryName(ctx, target) || entryName(ctx, entry), rows, ...base, undoable };
  }
  if (tool === 'link_journey_photo') {
    const already = entryPhotos(entry).some((photo) => photo.id === argId(args, 'journey_photo_id'));
    return { subject: entryName(ctx, entry), rows, ...base, undoable: !already };
  }
  return { subject: entryName(ctx, entry) || text(loaded?.journey.title), rows, ...base };
}

/**
 * The card of an applied photo change: photos added from a library as they
 * landed (their TREK photo ids are known only now); every other change keeps
 * the card it was held with.
 */
export function journalPhotosApplied(
  tool: JournalPhotosTool,
  result: unknown,
  preview: AssistantChangePreview | null,
): JourneyPhotosCard | null {
  const held = preview?.card?.kind === 'journeyPhotos' ? preview.card : null;
  if (tool !== 'add_journey_provider_photos' || !held) return null;
  const looks = rowsOf(recordOf(result).photos).flatMap((row) => {
    const look = photoLook(row);
    return look ? [look] : [];
  });
  const photos = looks.slice(0, JOURNEY_PHOTOS_LIMITS.photos);
  return { ...held, photos, more: Math.max(0, looks.length - photos.length) };
}
