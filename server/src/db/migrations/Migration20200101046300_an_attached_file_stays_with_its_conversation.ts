import { Migration } from '@mikro-orm/migrations';

/**
 * A file the user attaches in the trip chat stays with the conversation. Until
 * now it lived only as a buffer for the one request that read it, so the
 * assistant could neither look at it again nor keep it in the trip's Files.
 *
 * `assistant_attachments` keeps one row per attached file: who attached it,
 * in which thread of which trip, its name, type, size and hash, the storage
 * key its bytes sit under, and the text TREK read out of it with how that
 * went (`text_status`). The text reaches the AI provider only after the user
 * agreed for this one file (`shared_at`), and a file kept in Files names the
 * trip file it became (`file_id`).
 *
 * The rows go with their thread, their user and their trip; a trip file the
 * user deletes later only clears `file_id`. The retention sweep removes a row
 * and its bytes after a week, or as soon as its thread is gone. Every foreign
 * key leads an index, and `created_at` has one for that sweep.
 */
export class Migration20200101046300_an_attached_file_stays_with_its_conversation extends Migration {
  override name = 'Migration20200101046300_an_attached_file_stays_with_its_conversation';

  override up(): void {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS assistant_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        thread_id INTEGER NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        text TEXT,
        text_status TEXT NOT NULL CHECK(text_status IN ('ok', 'empty', 'scanned', 'unsupported', 'failed')),
        shared_at DATETIME,
        file_id INTEGER REFERENCES trip_files(id) ON DELETE SET NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.addSql(
      'CREATE INDEX IF NOT EXISTS idx_assistant_attachments_thread ON assistant_attachments(thread_id, created_at)',
    );
    this.addSql('CREATE INDEX IF NOT EXISTS idx_assistant_attachments_user ON assistant_attachments(user_id)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_assistant_attachments_trip ON assistant_attachments(trip_id)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_assistant_attachments_file ON assistant_attachments(file_id)');
    this.addSql('CREATE INDEX IF NOT EXISTS idx_assistant_attachments_created ON assistant_attachments(created_at)');
  }
}
