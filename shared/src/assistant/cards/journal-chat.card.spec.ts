import { storedTrekCardSchema, trekCardSchema } from './index';
import { journalChatCardSchema } from './journal-chat.card';

import { describe, expect, it } from 'vitest';

const card = {
  kind: 'journalChat',
  journey: {
    id: 12,
    title: 'Japan 2026',
    subtitle: 'Two weeks in autumn',
    startDate: '2026-11-02',
    endDate: '2026-11-16',
    entryCount: 4,
    photoCount: 120,
  },
  question: 'Make a new entry for Berlin Hauptbahnhof',
} as const;

describe('journalChatCardSchema', () => {
  it('JOURNALCHAT-001: is part of the card union and reads as itself', () => {
    expect(trekCardSchema.parse(card)).toEqual(card);
    expect(storedTrekCardSchema.parse(card)).toEqual(card);
  });

  it('JOURNALCHAT-002: takes a journal without dates, a subtitle or a question', () => {
    const bare = {
      kind: 'journalChat',
      journey: { id: 3, title: 'Notes', subtitle: null, startDate: null, endDate: null, entryCount: 0, photoCount: 0 },
      question: null,
    };
    expect(journalChatCardSchema.parse(bare)).toEqual(bare);
  });

  it('JOURNALCHAT-003: refuses a bad id, a bad date, an empty title, a negative count or an overlong question', () => {
    expect(journalChatCardSchema.safeParse({ ...card, journey: { ...card.journey, id: 0 } }).success).toBe(false);
    expect(
      journalChatCardSchema.safeParse({ ...card, journey: { ...card.journey, startDate: '2.11.2026' } }).success,
    ).toBe(false);
    expect(journalChatCardSchema.safeParse({ ...card, journey: { ...card.journey, title: '' } }).success).toBe(false);
    expect(journalChatCardSchema.safeParse({ ...card, journey: { ...card.journey, entryCount: -1 } }).success).toBe(
      false,
    );
    expect(journalChatCardSchema.safeParse({ ...card, question: 'x'.repeat(501) }).success).toBe(false);
  });
});
