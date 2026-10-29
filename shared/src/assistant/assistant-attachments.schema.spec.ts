import {
  assistantAttachmentIdSchema,
  assistantKeepFileArgsSchema,
  assistantReadAttachedFileArgsSchema,
} from './assistant-attachments.schema';

import { describe, expect, it } from 'vitest';

const ID = '0b7c2f0e-6f6d-4a8e-9b1a-3d2c1e0f9a87';

describe('assistant attachments contract', () => {
  it('takes an attachment only by a uuid, never a path or a number', () => {
    expect(assistantAttachmentIdSchema.safeParse(ID).success).toBe(true);
    for (const bad of ['../x', '42', '', 42, null]) {
      expect(assistantAttachmentIdSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('reads the model arguments of read_attached_file and drops what the server sets itself', () => {
    expect(assistantReadAttachedFileArgsSchema.parse({ attachmentId: ID, name: 'x.pdf' })).toEqual({
      attachmentId: ID,
    });
    expect(assistantReadAttachedFileArgsSchema.safeParse({}).success).toBe(false);
  });

  it('keeps a file with plain ids of the trip, never a string or a negative id, and a short description', () => {
    const kept = { attachmentId: ID, reservation_id: 5, budget_item_id: 7, place_id: 9, description: 'Airbnb' };
    expect(assistantKeepFileArgsSchema.parse({ ...kept, name: 'x.pdf' })).toEqual(kept);
    expect(assistantKeepFileArgsSchema.parse({ attachmentId: ID })).toEqual({ attachmentId: ID });
    for (const bad of [{ reservation_id: '5' }, { budget_item_id: -1 }, { description: 'x'.repeat(1001) }]) {
      expect(assistantKeepFileArgsSchema.safeParse({ attachmentId: ID, ...bad }).success).toBe(false);
    }
  });
});
