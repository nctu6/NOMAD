import type { AssistantAttachments } from '../entities/AssistantAttachments.entity';
import type { DB } from '../kysely/db';
import type { AssertRowKeys } from './_shared/rows';
import { TrekRepository } from './_shared/trek-repository';

/** How TREK's reading of an attached file went: text it read, none, a scan, a type it does not read, a failure. */
export type AssistantAttachmentTextStatus = 'ok' | 'empty' | 'scanned' | 'unsupported' | 'failed';

/** One `assistant_attachments` row as stored, the text included. */
interface AssistantAttachmentRow {
  id: string;
  thread_id: number;
  user_id: number;
  trip_id: number;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  storage_key: string;
  text: string | null;
  text_status: string;
  shared_at: string | null;
  file_id: number | null;
  created_at: string;
}

const _assistantAttachmentRowKeys: AssertRowKeys<AssistantAttachmentRow, AssistantAttachments> = true;

/** An attachment as a turn lists it: everything but its text. */
export type AssistantAttachmentSummary = Omit<AssistantAttachmentRow, 'text'>;

/** A new attachment, as AssistantAttachmentsService writes it. */
interface AssistantAttachmentInsert {
  id: string;
  threadId: number;
  userId: number;
  tripId: number;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  storageKey: string;
  text: string | null;
  textStatus: AssistantAttachmentTextStatus;
  createdAt: string;
}

/** Where an attachment's bytes sit, for the sweep and a thread's deletion. */
export interface AssistantAttachmentObject {
  id: string;
  storage_key: string;
}

type AttachmentsKyselyDB = Pick<DB, 'assistant_attachments'>;

const SUMMARY_COLUMNS = [
  'id',
  'thread_id',
  'user_id',
  'trip_id',
  'name',
  'mime',
  'size',
  'sha256',
  'storage_key',
  'text_status',
  'shared_at',
  'file_id',
  'created_at',
] as const;

/**
 * `assistant_attachments`: the files users attached in a trip chat. Every
 * read a turn makes names the thread and the user next to the id, so an
 * attachment is only ever reached in the conversation it was attached in,
 * by the user who attached it.
 */
export class AssistantAttachmentsRepository extends TrekRepository<AssistantAttachments> {
  private db() {
    return this.kysely<AttachmentsKyselyDB>();
  }

  async insertAttachment(row: AssistantAttachmentInsert): Promise<void> {
    await this.db()
      .insertInto('assistant_attachments')
      .values({
        id: row.id,
        thread_id: row.threadId,
        user_id: row.userId,
        trip_id: row.tripId,
        name: row.name,
        mime: row.mime,
        size: row.size,
        sha256: row.sha256,
        storage_key: row.storageKey,
        text: row.text,
        text_status: row.textStatus,
        created_at: row.createdAt,
      })
      .execute();
  }

  /** One attachment of the user's in this thread, with its text; null for anyone else's or another thread's. */
  async findInThread(id: string, threadId: number, userId: number): Promise<AssistantAttachmentRow | null> {
    const row = await this.db()
      .selectFrom('assistant_attachments')
      .selectAll()
      .where('id', '=', id)
      .where('thread_id', '=', threadId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row ?? null;
  }

  /** The user's attachments in this thread, oldest first, without their text. */
  async listForThread(threadId: number, userId: number): Promise<AssistantAttachmentSummary[]> {
    return this.db()
      .selectFrom('assistant_attachments')
      .select(SUMMARY_COLUMNS)
      .where('thread_id', '=', threadId)
      .where('user_id', '=', userId)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .execute();
  }

  /** The texts of this thread's attachments the user let the model read, by id. */
  async listSharedTexts(threadId: number, userId: number): Promise<Array<{ id: string; text: string }>> {
    const rows = await this.db()
      .selectFrom('assistant_attachments')
      .select(['id', 'text'])
      .where('thread_id', '=', threadId)
      .where('user_id', '=', userId)
      .where('shared_at', 'is not', null)
      .where('text', 'is not', null)
      .execute();
    return rows.flatMap((row) => (row.text === null ? [] : [{ id: row.id, text: row.text }]));
  }

  /** Records that the user let the model read the attachment; the first agreement's time stays. */
  async markShared(id: string, threadId: number, userId: number, at: string): Promise<boolean> {
    const result = await this.db()
      .updateTable('assistant_attachments')
      .set({ shared_at: at })
      .where('id', '=', id)
      .where('thread_id', '=', threadId)
      .where('user_id', '=', userId)
      .where('shared_at', 'is', null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) > 0;
  }

  /** Names the trip file the attachment was kept as. */
  async setFile(id: string, fileId: number): Promise<void> {
    await this.db().updateTable('assistant_attachments').set({ file_id: fileId }).where('id', '=', id).execute();
  }

  /** Where the bytes of the user's attachments in this thread sit. */
  async listObjectsOfThread(threadId: number, userId: number): Promise<AssistantAttachmentObject[]> {
    return this.db()
      .selectFrom('assistant_attachments')
      .select(['id', 'storage_key'])
      .where('thread_id', '=', threadId)
      .where('user_id', '=', userId)
      .execute();
  }

  /** Retention: the attachments made before `cutoff`, oldest first, at most `limit`. */
  async listCreatedBefore(cutoff: string, limit: number): Promise<AssistantAttachmentObject[]> {
    return this.db()
      .selectFrom('assistant_attachments')
      .select(['id', 'storage_key'])
      .where('created_at', '<', cutoff)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute();
  }

  /** Which of these storage keys a row still names. */
  async listKnownKeys(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const rows = await this.db()
      .selectFrom('assistant_attachments')
      .select('storage_key')
      .where('storage_key', 'in', keys)
      .execute();
    return rows.map((row) => row.storage_key);
  }

  /** Drops these attachments; answers how many went. */
  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.db().deleteFrom('assistant_attachments').where('id', 'in', ids).executeTakeFirst();
    return Number(result.numDeletedRows);
  }
}
