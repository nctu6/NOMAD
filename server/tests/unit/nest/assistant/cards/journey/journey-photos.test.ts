/**
 * ASTCARD-JPH-001 to ASTCARD-JPH-008
 *
 * A change of a journal's photos in the assistant chat: what it reads first,
 * its row and its card (the photos and the entries they leave and reach), a
 * library add's receipt with the photos as they landed, and the ways back
 * with their checks. Every card is checked against the shared union through
 * the registry's guard.
 */
import { buildTripCard } from '../../../../../../src/nest/assistant/assistant-context';
import type { CardReader, PreviewContext, UndoSnapshot } from '../../../../../../src/nest/assistant/cards/card-types';
import { readKey } from '../../../../../../src/nest/assistant/cards/card-values';
import { JOURNEY_CARDS } from '../../../../../../src/nest/assistant/cards/journey';
import { loadJournalPhotos } from '../../../../../../src/nest/assistant/cards/journey/journey-photos';
import {
  appliedCardOf,
  ASSISTANT_UNDO_MAP,
  ASSISTANT_WRITE_TOOLS,
} from '../../../../../../src/nest/assistant/cards/registry';
import { describeToolCall } from '../../../../../../src/nest/assistant/tool-call-preview.helpers';
import { journeyPhotosCardSchema, type AssistantChangePreview, type JourneyPhotosCard } from '@trek/shared';

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../../src/nest/audit/audit-log.logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

const ctx: PreviewContext = {
  card: buildTripCard(1, 7, { trip: { title: 'Berlin' } }, null, null),
  categories: new Map(),
  locale: 'en',
  today: '2026-10-24',
  airport: () => null,
};

const JOURNEY = {
  id: 3,
  title: 'Iceland',
  gallery: [
    { id: 11, photo_id: 101, caption: 'Old', media_type: 'image' },
    { id: 12, photo_id: 102, caption: null, media_type: 'video' },
  ],
  entries: [
    { id: 1, title: 'Vik', entry_date: '2026-07-01', photos: [{ id: 11, photo_id: 101, caption: 'Old' }] },
    { id: 2, title: 'Reynisfjara', entry_date: '2026-07-02', photos: [] },
  ],
};
const LOADED = { journey: JOURNEY };

function cardOf(value: unknown): JourneyPhotosCard {
  return journeyPhotosCardSchema.parse(value);
}

function undoOf(tool: string) {
  const undo = JOURNEY_CARDS.tools[tool]?.undo;
  if (!undo) throw new Error(`no undo for ${tool}`);
  return undo;
}

function entriesRead(entries: Array<{ id: number; photos: number[] }>): UndoSnapshot {
  return {
    summary: null,
    places: null,
    reads: new Map(
      entries.map((entry) => [
        readKey('get_journey_entry', { entryId: entry.id }),
        { entry: { id: entry.id, photos: entry.photos.map((id) => ({ id })) } },
      ]),
    ),
  };
}

describe('the cards of a photo change', () => {
  it('ASTCARD-JPH-001: reads the entry for its journal where the call names none, then the journal', async () => {
    const asked: string[] = [];
    const read: CardReader = (tool, args = {}) => {
      asked.push(readKey(tool, args));
      if (tool === 'get_journey_entry') return Promise.resolve({ journey: { id: 3 } });
      return Promise.resolve(tool === 'get_journey' ? { journey: JOURNEY } : null);
    };
    expect(await loadJournalPhotos({ entryId: 1, journey_photo_id: 12 }, read)).toEqual(LOADED);
    expect(asked).toEqual([readKey('get_journey_entry', { entryId: 1 }), readKey('get_journey', { journeyId: 3 })]);
    expect(await loadJournalPhotos({ journeyId: 9 }, () => Promise.resolve(null))).toBeNull();
  });

  it('ASTCARD-JPH-002: a link shows the gallery photo on the entry it reaches, undoable unless it is there already', () => {
    const preview = describeToolCall('link_journey_photo', 'c1', { entryId: 2, journey_photo_id: 12 }, ctx, LOADED);
    expect(preview).toMatchObject({ verbKey: 'linkJournalPhoto', subject: 'Reynisfjara', undoable: true });
    expect(cardOf(preview.card)).toMatchObject({
      mode: 'link',
      from: null,
      to: { entryId: 2, title: 'Reynisfjara', date: '2026-07-02' },
      photos: [{ photoId: 102, video: true, caption: null }],
    });
    const already = describeToolCall('link_journey_photo', 'c2', { entryId: 1, journey_photo_id: 11 }, ctx, LOADED);
    expect(already.undoable).toBe(false);
  });

  it('ASTCARD-JPH-003: a move names both entries and shows the photos that go', () => {
    const args = { fromEntryId: 1, toEntryId: 2, photoIds: [11], keep_in_source: true };
    const preview = describeToolCall('move_journey_photos', 'c1', args, ctx, LOADED);
    expect(preview).toMatchObject({ verbKey: 'moveJournalPhotos', subject: 'Reynisfjara', undoable: true });
    expect(preview.rows).toContainEqual({
      op: 'move',
      labelKey: 'field',
      field: 'entry',
      before: 'Vik',
      after: 'Reynisfjara',
    });
    expect(cardOf(preview.card)).toMatchObject({
      mode: 'move',
      from: { entryId: 1, title: 'Vik' },
      to: { entryId: 2 },
      kept: true,
      photos: [{ photoId: 101 }],
    });
    const back = describeToolCall(
      'move_journey_photos',
      'c2',
      { fromEntryId: 2, toEntryId: 1, photoIds: [11] },
      ctx,
      LOADED,
    );
    expect(back.undoable).toBe(false);
  });

  it('ASTCARD-JPH-004: an unlink, a new order and a caption draw their own cards', () => {
    const unlink = cardOf(
      describeToolCall('unlink_journey_photo', 'c1', { entryId: 1, journey_photo_id: 11 }, ctx, LOADED).card,
    );
    expect(unlink).toMatchObject({ mode: 'unlink', from: { entryId: 1 }, to: null, photos: [{ photoId: 101 }] });
    const order = describeToolCall('reorder_journey_entry_photos', 'c2', { entryId: 1, orderedIds: [11] }, ctx, LOADED);
    expect(order).toMatchObject({ verbKey: 'orderJournalPhotos', undoable: false });
    expect(cardOf(order.card)).toMatchObject({ mode: 'order', to: { entryId: 1 } });
    const caption = describeToolCall(
      'set_journey_photo_caption',
      'c3',
      { journey_photo_id: 11, caption: 'New' },
      ctx,
      LOADED,
    );
    expect(caption).toMatchObject({ verbKey: 'captionJournalPhoto', subject: 'Iceland', undoable: true });
    expect(caption.rows).toEqual([{ op: 'change', labelKey: 'text', before: 'Old', after: 'New' }]);
    expect(cardOf(caption.card).caption).toEqual({ before: 'Old', after: 'New' });
  });

  it('ASTCARD-JPH-005: a library add counts its assets while held and shows the photos once they landed', () => {
    const args = { journeyId: 3, entryId: 2, provider: 'immich', asset_ids: ['a', 'b'] };
    const held = describeToolCall('add_journey_provider_photos', 'c1', args, ctx, LOADED);
    expect(cardOf(held.card)).toMatchObject({ mode: 'add', photos: [], more: 2, to: { entryId: 2 } });
    const result = { photos: [{ photo_id: 201 }, { photo_id: 202, media_type: 'video' }], added: 2 };
    const preview = held as unknown as AssistantChangePreview;
    expect(cardOf(appliedCardOf('add_journey_provider_photos', { args, result, preview }))).toMatchObject({
      photos: [
        { photoId: 201, video: false },
        { photoId: 202, video: true },
      ],
      more: 0,
    });
    expect(ASSISTANT_UNDO_MAP.add_journey_provider_photos).toBeUndefined();
    expect(ASSISTANT_WRITE_TOOLS.add_journey_provider_photos).toEqual({
      verbKey: 'addJournalPhotos',
      entity: 'journey_entry',
    });
  });
});

describe('the ways back from a photo change', () => {
  it('ASTCARD-JPH-006: a linked photo comes off while it is still on the entry, an unlinked one goes back while off', () => {
    const args = { entryId: 2, journey_photo_id: 12 };
    const unlink = undoOf('link_journey_photo');
    expect(unlink.args(args, { photo: { id: 12 } }, null)).toEqual(args);
    expect(unlink.args(args, {}, { undoable: false } as unknown as AssistantChangePreview)).toBeNull();
    const call = { args, preview: null };
    expect(unlink.unchanged({}, entriesRead([{ id: 2, photos: [12] }]), call)).toBe(true);
    expect(unlink.unchanged({}, entriesRead([{ id: 2, photos: [] }]), call)).toBe(false);
    const relink = undoOf('unlink_journey_photo');
    expect(relink.args(args, { success: true }, null)).toEqual(args);
    expect(relink.args(args, { success: false }, null)).toBeNull();
    expect(relink.unchanged({}, entriesRead([{ id: 2, photos: [] }]), call)).toBe(true);
    expect(relink.unchanged({}, entriesRead([{ id: 2, photos: [12] }]), call)).toBe(false);
  });

  it('ASTCARD-JPH-007: moved photos go back while the target holds them all and the source none', () => {
    const undo = undoOf('move_journey_photos');
    const result = { moved: [11], fromEntryId: 1, toEntryId: 2, kept: false };
    expect(undo.args({}, result, null)).toEqual({ fromEntryId: 2, toEntryId: 1, photoIds: [11] });
    expect(undo.args({}, { ...result, moved: [] }, null)).toBeNull();
    expect(
      undo.unchanged(
        result,
        entriesRead([
          { id: 2, photos: [11] },
          { id: 1, photos: [] },
        ]),
      ),
    ).toBe(true);
    expect(
      undo.unchanged(
        result,
        entriesRead([
          { id: 2, photos: [] },
          { id: 1, photos: [] },
        ]),
      ),
    ).toBe(false);
    expect(
      undo.unchanged(
        result,
        entriesRead([
          { id: 2, photos: [11] },
          { id: 1, photos: [11] },
        ]),
      ),
    ).toBe(false);
    // Kept on the source too, the photos may stay there.
    const kept = { ...result, kept: true };
    expect(
      undo.unchanged(
        kept,
        entriesRead([
          { id: 2, photos: [11] },
          { id: 1, photos: [11] },
        ]),
      ),
    ).toBe(true);
  });

  it('ASTCARD-JPH-008: a caption is written back while the photo still carries the new one', () => {
    const undo = undoOf('set_journey_photo_caption');
    const result = { photo: { id: 11, caption: 'New' }, previous: { caption: 'Old' } };
    expect(undo.args({ journeyId: 3 }, result, null)).toEqual({ journeyId: 3, journey_photo_id: 11, caption: 'Old' });
    expect(undo.args({}, { photo: { id: 11 }, previous: {} }, null)).toBeNull();
    const snapshot = (caption: string | null): UndoSnapshot => ({
      summary: null,
      places: null,
      reads: new Map([[readKey('get_journey', { journeyId: 3 }), { journey: { gallery: [{ id: 11, caption }] } }]]),
    });
    const call = { args: { journeyId: 3 }, preview: null };
    expect(undo.unchanged(result, snapshot('New'), call)).toBe(true);
    expect(undo.unchanged(result, snapshot('Other'), call)).toBe(false);
  });
});
