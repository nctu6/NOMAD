/**
 * The server's own answer to an attached booking file: which chips it offers
 * for what the file held and what the user may do, the line it writes in the
 * user's language, and the words it is written with.
 */
import {
  attachChipKeys,
  attachLine,
  hasLinkTargets,
  type AttachFacts,
} from '../../../../src/nest/assistant/assistant-attach-answer';
import type { TripCard } from '../../../../src/nest/assistant/assistant-context';
import { AssistantWords, supportedLocale } from '../../../../src/nest/assistant/assistant-words';

import { describe, expect, it } from 'vitest';

const ALL: AttachFacts = {
  found: 0,
  readable: true,
  canKeep: true,
  canLink: true,
  hasTargets: true,
  canBook: true,
};

const chip = (name: string) => `assistant.attach.chip.${name}`;

describe('attachChipKeys', () => {
  it('ASTACH-001: a file without a booking offers to keep it, book from it and attach it, three at most', () => {
    expect(attachChipKeys(ALL)).toEqual([chip('keep'), chip('book'), chip('attach')]);
    expect(attachChipKeys({ ...ALL, hasTargets: false })).toEqual([chip('keep'), chip('book'), chip('read')]);
  });

  it('ASTACH-002: what the user may not do, and what an unreadable file cannot give, is never offered', () => {
    expect(attachChipKeys({ ...ALL, canKeep: false })).toEqual([chip('book'), chip('read')]);
    expect(attachChipKeys({ ...ALL, canBook: false })).toEqual([chip('keep'), chip('attach'), chip('read')]);
    expect(attachChipKeys({ ...ALL, canLink: false, canBook: false })).toEqual([chip('keep'), chip('read')]);
    expect(attachChipKeys({ ...ALL, readable: false })).toEqual([chip('keep'), chip('attach')]);
    expect(attachChipKeys({ ...ALL, readable: false, canKeep: false })).toEqual([]);
  });

  it('ASTACH-003: a file with bookings asks to keep it with the booking', () => {
    expect(attachChipKeys({ ...ALL, found: 2 })).toEqual([chip('keepWithBooking'), chip('read')]);
    expect(attachChipKeys({ ...ALL, found: 1, canLink: false, readable: false })).toEqual([]);
  });
});

describe('attachLine', () => {
  it('ASTACH-004: names the file and what was found, or why nothing was, and asks what to do', async () => {
    const words = await AssistantWords.of('en');
    expect(attachLine(words, 'trip.pdf', 1, null)).toBe(
      'I found 1 booking in trip.pdf. Add it below if it looks right.',
    );
    expect(attachLine(words, 'trip.pdf', 3, null)).toBe('I found 3 bookings in trip.pdf. Add the ones you want below.');
    expect(attachLine(words, 'scan.pdf', 0, 'no_text')).toBe(
      'I could not find a booking in scan.pdf. It holds no readable text, so it is most likely a scan. ' +
        'What should I do with the file?',
    );
    expect(attachLine(words, 'a.txt', 0, null)).toBe(
      'I could not find a booking in a.txt. What should I do with the file?',
    );
  });
});

describe('AssistantWords', () => {
  it('ASTACH-005: picks the form the language takes for the count, and English where a table has no key', async () => {
    const ru = await AssistantWords.of('ru-RU');
    expect(ru.t('assistant.attach.found', { name: 'a.pdf', count: 21 })).toContain('21 бронирование');
    expect(ru.t('assistant.attach.found', { name: 'a.pdf', count: 5 })).toContain('5 бронирований');
    expect(ru.t('assistant.attach.chip.keep')).toBe('Сохрани его в Файлы');
    expect(ru.t('assistant.no.such.key')).toBe('assistant.no.such.key');
    const unknown = await AssistantWords.of('xx');
    expect(unknown.t('assistant.attach.none', { name: 'b.pdf' })).toBe('I could not find a booking in b.pdf.');
    expect(unknown.t('assistant.no.such.key', { count: 2 })).toBe('assistant.no.such.key');
  });

  it('ASTACH-006: a locale reads as itself, its language or English', () => {
    expect(supportedLocale('zh-TW')).toBe('zh-TW');
    expect(supportedLocale('de-AT')).toBe('de');
    expect(supportedLocale('xx-YY')).toBe('en');
  });
});

describe('hasLinkTargets', () => {
  const card = (reservations: number, budgetItems: unknown) =>
    ({
      reservations: new Map(Array.from({ length: reservations }, (_, i) => [i + 1, {}])),
      sources: { summary: { budget: { items: budgetItems } }, places: null },
    }) as unknown as TripCard;

  it('ASTACH-007: a booking or an expense is something to attach a file to', () => {
    expect(hasLinkTargets(card(1, []))).toBe(true);
    expect(hasLinkTargets(card(0, [{ id: 3 }]))).toBe(true);
    expect(hasLinkTargets(card(0, []))).toBe(false);
    expect(hasLinkTargets(card(0, undefined))).toBe(false);
  });
});
