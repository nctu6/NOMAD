import { EntityRepositoryType, type Opt, type Ref, defineEntity, p } from '@mikro-orm/core';
import { AssistantAttachmentsRepository } from '../repositories/AssistantAttachments.repository';
import { DbTimestampType } from '../types';
import { AssistantThreads } from './AssistantThreads.entity';
import { TripFiles } from './TripFiles.entity';
import { Trips } from './Trips.entity';
import { Users } from './Users.entity';

export class AssistantAttachments {
  [EntityRepositoryType]?: AssistantAttachmentsRepository;
  id!: string;
  thread!: Ref<AssistantThreads>;
  thread_id!: number;
  user!: Ref<Users>;
  user_id!: number;
  trip!: Ref<Trips>;
  trip_id!: number;
  name!: string;
  mime!: string;
  size!: number;
  sha256!: string;
  storage_key!: string;
  text?: string | null;
  text_status!: string;
  shared_at?: string | null;
  file?: Ref<TripFiles> | null;
  file_id?: number | null;
  created_at!: string & Opt;
}

export const AssistantAttachmentsSchema = defineEntity({
  class: AssistantAttachments,
  repository: () => AssistantAttachmentsRepository,
  indexes: [
    {
      name: 'idx_assistant_attachments_thread',
      properties: ['thread_id', 'created_at'],
    },
  ],
  properties: {
    id: p.text().primary(),
    thread: () => p.manyToOne(AssistantThreads).ref().deleteRule('cascade').hidden(),
    thread_id: p.integer().persist(false),
    user: () => p.manyToOne(Users).ref().deleteRule('cascade').hidden().index('idx_assistant_attachments_user'),
    user_id: p.integer().persist(false).index('idx_assistant_attachments_user'),
    trip: () => p.manyToOne(Trips).ref().deleteRule('cascade').hidden().index('idx_assistant_attachments_trip'),
    trip_id: p.integer().persist(false).index('idx_assistant_attachments_trip'),
    name: p.text(),
    mime: p.text(),
    size: p.integer(),
    sha256: p.text(),
    storage_key: p.text(),
    text: p.text().nullable(),
    text_status: p.text(),
    shared_at: p.type(DbTimestampType).nullable(),
    file: () => p.manyToOne(TripFiles).ref().nullable().hidden().index('idx_assistant_attachments_file'),
    file_id: p.integer().nullable().persist(false).index('idx_assistant_attachments_file'),
    created_at: p.type(DbTimestampType).defaultRaw(`CURRENT_TIMESTAMP`).index('idx_assistant_attachments_created'),
  },
});
