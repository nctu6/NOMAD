import { idSchema } from '../common/primitives.schema';
import { fileUpdateRequestSchema } from '../file/file.schema';

import { z } from 'zod';

/**
 * A file the user attached in the trip chat, as the conversation knows it.
 *
 * The server keeps the file with the thread under a random id, which the
 * message's `attachment` part carries. The id never reaches anything but the
 * thread it was attached in: every read answers an id of another thread or
 * another user the way it answers one that does not exist.
 */
export const assistantAttachmentIdSchema = z.uuid();
export type AssistantAttachmentId = z.infer<typeof assistantAttachmentIdSchema>;

/**
 * What the model calls `read_attached_file` with: the attachment, by the id
 * the user's message names. The server adds the file's name and where its
 * text would go to the held call before the user sees it; those are no input.
 */
export const assistantReadAttachedFileArgsSchema = z.object({
  attachmentId: assistantAttachmentIdSchema,
});
export type AssistantReadAttachedFileArgs = z.infer<typeof assistantReadAttachedFileArgsSchema>;

/**
 * What the model calls `keep_attached_file` with: the attachment, and what
 * of the trip the kept file is attached to, the fields a trip file's update
 * takes (`fileUpdateRequestSchema`) as plain ids. Every id must name a row of
 * the same trip; the server checks that when the user applies the change.
 */
export const assistantKeepFileArgsSchema = z.object({
  attachmentId: assistantAttachmentIdSchema,
  reservation_id: idSchema.optional(),
  budget_item_id: idSchema.optional(),
  place_id: idSchema.optional(),
  description: fileUpdateRequestSchema.shape.description.unwrap().max(1000).optional(),
});
export type AssistantKeepFileArgs = z.infer<typeof assistantKeepFileArgsSchema>;
