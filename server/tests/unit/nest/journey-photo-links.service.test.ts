/**
 * JourneyPhotoLinksService: which entries a journey's photos sit on, and
 * their captions, with every change told to everyone on the journey once it
 * is written (the link and the unlink used to tell nobody). The suite takes
 * the service from its module over a snapshot test db, so the journey access,
 * the writes and the realtime fake are the ones the app uses.
 */
import { DomainError } from '../../../src/nest/common/domain-error';
import { JourneyDomainModule } from '../../../src/nest/journey/journey-domain.module';
import { JourneyDomainService } from '../../../src/nest/journey/journey-domain.service';
import { JourneyPhotoLinksService } from '../../../src/nest/journey/journey-photo-links.service';
import { createSnapshotTestDb } from '../../helpers/db-mock';
import { addJourneyContributor, makeJourney, makeJourneyEntry } from '../../helpers/factories/journeys';
import { makeUser } from '../../helpers/factories/users';
import { resetTestDb } from '../../helpers/test-db';
import { createTestModule, type TestModule } from '../../helpers/test-module';
import { createTestOrm, type TestOrm } from '../../helpers/test-orm';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const db = createSnapshotTestDb();
let t: TestModule;
let orm: TestOrm;
let links: JourneyPhotoLinksService;
let journeys: JourneyDomainService;

beforeAll(async () => {
  t = await createTestModule({ db, imports: [JourneyDomainModule] });
  links = t.get(JourneyPhotoLinksService);
  journeys = t.get(JourneyDomainService);
  orm = await createTestOrm(db);
});
beforeEach(() => {
  resetTestDb(db);
  orm.clear();
  t.realtime.reset();
});
afterAll(async () => {
  await orm.close();
  await t.close();
  db.close();
});

/** What each user was sent, as [user, event type, payload entry id, left-out socket], in user order. */
const sent = () =>
  t.realtime.broadcastToUserMock.mock.calls
    .map(([to, msg, sid]) => [to, (msg as { type: string }).type, (msg as { entryId?: number }).entryId, sid] as const)
    .sort((a, b) => a[0] - b[0] || (a[2] ?? 0) - (b[2] ?? 0));

async function scene() {
  const { user: owner } = await makeUser(orm);
  const { user: editor } = await makeUser(orm);
  const journey = await makeJourney(orm, owner.id);
  await addJourneyContributor(orm, journey.id, editor.id, 'editor');
  const first = await makeJourneyEntry(orm, journey.id, owner.id, { title: 'Arrival' });
  const second = await makeJourneyEntry(orm, journey.id, owner.id, { title: 'Next day', entry_date: '2026-01-16' });
  const photo = await journeys.addProviderPhoto(first.id, owner.id, 'immich', `asset-${first.id}`);
  const gallery = await journeys.addProviderPhotoToGallery(journey.id, owner.id, 'immich', `gallery-${first.id}`);
  if (!photo || !gallery) throw new Error('the scene took no photo');
  const other = await makeJourney(orm, owner.id);
  const elsewhere = await makeJourneyEntry(orm, other.id, owner.id);
  t.realtime.broadcastToUserMock.mockClear();
  const everyone = [owner.id, editor.id].sort((a, b) => a - b);
  return { owner, editor, journey, first, second, photo, gallery, elsewhere, everyone };
}

async function photoIdsOf(journeyId: number, entryId: number, userId: number): Promise<number[]> {
  const entries = (await journeys.listEntries(journeyId, userId)) ?? [];
  return (entries.find((entry) => entry.id === entryId)?.photos ?? []).map((photo) => photo.id);
}

describe('JourneyPhotoLinksService', () => {
  it('PLINK-001: a link tells everyone on the journey, the asking tab left out; a refused one tells nobody', async () => {
    const s = await scene();
    expect(await links.link(s.second.id, s.gallery.id, s.editor.id, 'sock-e')).toMatchObject({ id: s.gallery.id });
    expect(sent()).toEqual(s.everyone.map((id) => [id, 'journey:entry:updated', s.second.id, 'sock-e']));
    t.realtime.broadcastToUserMock.mockClear();
    const { user: stranger } = await makeUser(orm);
    expect(await links.link(s.second.id, s.gallery.id, stranger.id)).toBeNull();
    expect(t.realtime.broadcastToUserMock).not.toHaveBeenCalled();
  });

  it('PLINK-002: an unlink takes the photo off the entry, keeps it in the gallery and tells everyone', async () => {
    const s = await scene();
    expect(await links.unlink(s.first.id, s.photo.id, s.owner.id)).toBe(true);
    expect(await photoIdsOf(s.journey.id, s.first.id, s.owner.id)).toEqual([]);
    expect(sent()).toEqual(s.everyone.map((id) => [id, 'journey:entry:updated', s.first.id, undefined]));
    t.realtime.broadcastToUserMock.mockClear();
    expect(await links.unlink(s.first.id, s.photo.id, s.owner.id)).toBe(false);
    expect(t.realtime.broadcastToUserMock).not.toHaveBeenCalled();
  });

  it('PLINK-003: a move puts the photos on the other entry and takes them off the first, telling both', async () => {
    const s = await scene();
    const moved = await links.move(s.first.id, { toEntryId: s.second.id, photoIds: [s.photo.id] }, s.editor.id, 'x');
    expect(moved).toEqual({ moved: [s.photo.id], fromEntryId: s.first.id, toEntryId: s.second.id, kept: false });
    expect(await photoIdsOf(s.journey.id, s.first.id, s.owner.id)).toEqual([]);
    expect(await photoIdsOf(s.journey.id, s.second.id, s.owner.id)).toEqual([s.photo.id]);
    expect(sent()).toEqual(
      s.everyone.flatMap((id) => [
        [id, 'journey:entry:updated', s.first.id, 'x'],
        [id, 'journey:entry:updated', s.second.id, 'x'],
      ]),
    );
  });

  it('PLINK-004: a move that keeps the source leaves the photos on both entries', async () => {
    const s = await scene();
    await links.move(s.first.id, { toEntryId: s.second.id, photoIds: [s.photo.id], keep_in_source: true }, s.owner.id);
    expect(await photoIdsOf(s.journey.id, s.first.id, s.owner.id)).toEqual([s.photo.id]);
    expect(await photoIdsOf(s.journey.id, s.second.id, s.owner.id)).toEqual([s.photo.id]);
  });

  it('PLINK-005: refuses another journey, the same entry, a photo not on the source and a viewer, and moves nothing', async () => {
    const s = await scene();
    const { user: viewer } = await makeUser(orm);
    await addJourneyContributor(orm, s.journey.id, viewer.id, 'viewer');
    const refusal = async (run: Promise<unknown>) => {
      try {
        await run;
      } catch (err) {
        if (err instanceof DomainError) return { status: err.getStatus(), message: err.publicMessage };
        throw err;
      }
      throw new Error('expected a refusal');
    };
    const req = { toEntryId: s.elsewhere.id, photoIds: [s.photo.id] };
    expect(await refusal(links.move(s.first.id, req, s.owner.id))).toEqual({ status: 404, message: 'Entry not found' });
    const same = { toEntryId: s.first.id, photoIds: [s.photo.id] };
    expect((await refusal(links.move(s.first.id, same, s.owner.id))).status).toBe(400);
    const notOnSource = { toEntryId: s.second.id, photoIds: [s.gallery.id] };
    expect(await refusal(links.move(s.first.id, notOnSource, s.owner.id))).toEqual({
      status: 400,
      message: 'Every photo must be one of this entry',
    });
    const asViewer = { toEntryId: s.second.id, photoIds: [s.photo.id] };
    expect((await refusal(links.move(s.first.id, asViewer, viewer.id))).status).toBe(404);
    expect(await photoIdsOf(s.journey.id, s.first.id, s.owner.id)).toEqual([s.photo.id]);
    expect(t.realtime.broadcastToUserMock).not.toHaveBeenCalled();
  });

  it('PLINK-006: a caption answers the one it replaced and tells everyone; another journey is refused', async () => {
    const s = await scene();
    const first = await links.setCaption(s.journey.id, s.photo.id, 'Black sand', s.owner.id);
    expect(first).toMatchObject({ photo: { id: s.photo.id, caption: 'Black sand' }, previous: { caption: null } });
    const second = await links.setCaption(s.journey.id, s.photo.id, null, s.owner.id);
    expect(second).toMatchObject({ photo: { caption: null }, previous: { caption: 'Black sand' } });
    expect(sent().filter(([, type]) => type === 'journey:updated')).toHaveLength(s.everyone.length * 2);
    const other = await makeJourney(orm, s.owner.id);
    expect(await links.setCaption(other.id, s.photo.id, 'x', s.owner.id)).toBeNull();
  });

  it('PLINK-007: the REST photo change tells everyone once it is written, and a refused one nobody', async () => {
    const s = await scene();
    expect(await links.updatePhoto(s.photo.id, s.owner.id, { caption: 'Vik' }, 'sock-o')).toMatchObject({
      caption: 'Vik',
    });
    expect(sent()).toEqual(s.everyone.map((id) => [id, 'journey:updated', undefined, 'sock-o']));
    t.realtime.broadcastToUserMock.mockClear();
    const { user: stranger } = await makeUser(orm);
    expect(await links.updatePhoto(s.photo.id, stranger.id, { caption: 'x' })).toBeNull();
    expect(t.realtime.broadcastToUserMock).not.toHaveBeenCalled();
  });
});
