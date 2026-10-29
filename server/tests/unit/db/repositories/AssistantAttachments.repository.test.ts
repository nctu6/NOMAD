/**
 * The files attached in a trip chat through their repository: an attachment
 * is only reached in its own thread by the user who attached it, its text
 * reaches the model only once it is shared, the first agreement's time stays,
 * and the retention sweep finds, matches and drops rows by age and key.
 */
import { AssistantAttachments } from '../../../../src/db/entities/AssistantAttachments.entity';
import { AssistantThreads } from '../../../../src/db/entities/AssistantThreads.entity';
import type { AssistantAttachmentsRepository } from '../../../../src/db/repositories/AssistantAttachments.repository';
import type { AssistantThreadsRepository } from '../../../../src/db/repositories/AssistantThreads.repository';
import { createSnapshotTestDb } from '../../../helpers/db-mock';
import { makeTripFile } from '../../../helpers/factories/files';
import { makeTrip } from '../../../helpers/factories/trips';
import { makeUser } from '../../../helpers/factories/users';
import { resetTestDb } from '../../../helpers/test-db';
import { createTestOrm, type TestOrm } from '../../../helpers/test-orm';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const testDb = createSnapshotTestDb();
let t: TestOrm;
let attachments: AssistantAttachmentsRepository;
let threads: AssistantThreadsRepository;

beforeAll(async () => {
  t = await createTestOrm(testDb);
  attachments = t.repo(AssistantAttachments);
  threads = t.repo(AssistantThreads);
});
beforeEach(() => {
  resetTestDb(testDb);
  t.clear();
});
afterAll(async () => {
  await t.close();
  testDb.close();
});

const AT = '2026-10-20 10:00:00';
const LATER = '2026-10-21 10:00:00';
const ID_A = '0b6c1f7e-3d2a-4c5b-9e8f-1a2b3c4d5e6f';
const ID_B = '1c7d2a8f-4e3b-4d6c-8f9a-2b3c4d5e6f70';

async function threadOf() {
  const { user } = await makeUser(t);
  const trip = await makeTrip(t, user.id);
  const threadId = await threads.createThread(user.id, trip.id, 'Porto', AT);
  return { userId: user.id, tripId: trip.id, threadId };
}

function attach(
  at: { userId: number; tripId: number; threadId: number },
  id: string,
  over: { text?: string | null; createdAt?: string; storageKey?: string } = {},
) {
  return attachments.insertAttachment({
    id,
    threadId: at.threadId,
    userId: at.userId,
    tripId: at.tripId,
    name: 'AirBnB Buchung.pdf',
    mime: 'application/pdf',
    size: 2048,
    sha256: 'f'.repeat(64),
    storageKey: over.storageKey ?? `assistant/${id}.pdf`,
    text: over.text === undefined ? 'Check-in 14:00' : over.text,
    textStatus: over.text === null ? 'empty' : 'ok',
    createdAt: over.createdAt ?? AT,
  });
}

describe('AssistantAttachmentsRepository', () => {
  it('ASTATTREPO-001: an attachment is reached only in its own thread by the user who attached it', async () => {
    const at = await threadOf();
    const other = await threadOf();
    await attach(at, ID_A);

    const row = await attachments.findInThread(ID_A, at.threadId, at.userId);
    expect(row).toMatchObject({ id: ID_A, name: 'AirBnB Buchung.pdf', text: 'Check-in 14:00', text_status: 'ok' });
    expect(await attachments.findInThread(ID_A, other.threadId, at.userId)).toBeNull();
    expect(await attachments.findInThread(ID_A, at.threadId, other.userId)).toBeNull();
    expect(await attachments.findInThread(ID_B, at.threadId, at.userId)).toBeNull();
  });

  it('ASTATTREPO-002: a thread lists its attachments oldest first and without their text', async () => {
    const at = await threadOf();
    await attach(at, ID_B, { createdAt: LATER });
    await attach(at, ID_A);

    const listed = await attachments.listForThread(at.threadId, at.userId);
    expect(listed.map((a) => a.id)).toEqual([ID_A, ID_B]);
    expect(listed[0]).not.toHaveProperty('text');
    expect(await attachments.listObjectsOfThread(at.threadId, at.userId)).toEqual(
      expect.arrayContaining([
        { id: ID_A, storage_key: `assistant/${ID_A}.pdf` },
        { id: ID_B, storage_key: `assistant/${ID_B}.pdf` },
      ]),
    );
  });

  it('ASTATTREPO-003: a text reaches the model only once shared, and the first agreement keeps its time', async () => {
    const at = await threadOf();
    await attach(at, ID_A);
    await attach(at, ID_B, { text: null });
    expect(await attachments.listSharedTexts(at.threadId, at.userId)).toEqual([]);

    expect(await attachments.markShared(ID_A, at.threadId, at.userId, AT)).toBe(true);
    expect(await attachments.markShared(ID_A, at.threadId, at.userId, LATER)).toBe(false);
    expect(await attachments.markShared(ID_B, at.threadId, at.userId, AT)).toBe(true);
    expect((await attachments.findInThread(ID_A, at.threadId, at.userId))?.shared_at).toBe(AT);
    // A shared attachment without text has nothing to send.
    expect(await attachments.listSharedTexts(at.threadId, at.userId)).toEqual([{ id: ID_A, text: 'Check-in 14:00' }]);
  });

  it('ASTATTREPO-004: a kept attachment names its trip file', async () => {
    const at = await threadOf();
    await attach(at, ID_A);
    const file = await makeTripFile(t, at.tripId);
    await attachments.setFile(ID_A, file.id);
    expect((await attachments.findInThread(ID_A, at.threadId, at.userId))?.file_id).toBe(file.id);
  });

  it('ASTATTREPO-005: the sweep finds old rows by age, matches known keys and drops rows by id', async () => {
    const at = await threadOf();
    await attach(at, ID_A);
    await attach(at, ID_B, { createdAt: LATER });

    expect(await attachments.listCreatedBefore(LATER, 10)).toEqual([
      { id: ID_A, storage_key: `assistant/${ID_A}.pdf` },
    ]);
    expect(await attachments.listCreatedBefore('2026-10-22 00:00:00', 1)).toHaveLength(1);
    expect(await attachments.listKnownKeys([`assistant/${ID_B}.pdf`, 'assistant/gone.pdf'])).toEqual([
      `assistant/${ID_B}.pdf`,
    ]);
    expect(await attachments.listKnownKeys([])).toEqual([]);

    expect(await attachments.deleteByIds([])).toBe(0);
    expect(await attachments.deleteByIds([ID_A, 'not-there'])).toBe(1);
    expect(await attachments.listForThread(at.threadId, at.userId)).toHaveLength(1);
  });
});
