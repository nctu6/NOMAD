import type { AutoEntry } from '../auto/auto-types';
import type { BookTravelContext } from '../book-travel';
import { bookElementSchema, bookPageSetupSchema, type BookElement } from '../book.schema';
import type { JourneyStats } from '../journey-stats.schema';
import { bookThemeColor, bookThemeOf } from '../theme/book-theme';
import {
  BOOK_TRAVEL_COUNTRY_LOOKS,
  BOOK_TRAVEL_FIGURE_SHELVES,
  BOOK_TRAVEL_MARK_STYLES,
  BOOK_TRAVEL_SUMMARY_LOOKS,
  bookTravelLooks,
} from './book-travel-looks';

import { describe, expect, it } from 'vitest';

/** The travel elements in their newer looks, as the Travel panel and the auto layout both build them. */

type Point = JourneyStats['points'][number];
const pt = (label: string, at: [number, number], country: string, entryId: number): Point => ({
  lat: at[0],
  lng: at[1],
  label,
  date: null,
  country,
  tripId: 1,
  photoId: null,
  entryId,
});

const stats: JourneyStats = {
  journeyId: 5,
  distance: 4_000_000,
  days: 21,
  steps: 6,
  photos: 40,
  places: 12,
  furthest: 3_000_000,
  countries: [
    { code: 'IS', name: 'Iceland', places: 2, firstVisit: '2026-06-02' },
    { code: 'PT', name: 'Portugal', places: 1, firstVisit: '2026-09-04' },
  ],
  points: [
    pt('Reykjavík', [64.14, -21.94], 'IS', 1),
    pt('Akureyri', [65.68, -18.12], 'IS', 2),
    pt('Lisboa', [38.72, -9.14], 'PT', 3),
  ],
  trips: [],
  excluded: [],
  start: '2026-06-02',
  end: '2026-09-12',
};

const entry: AutoEntry = {
  id: 2,
  title: 'North',
  story: null,
  location: 'Akureyri',
  date: '2026-06-06',
  photos: [],
  lat: 65.68,
  lng: -18.12,
  country: 'IS',
  dayNumber: 5,
  dayCount: 21,
};

const travel: BookTravelContext = {
  locale: 'en',
  stats,
  path: [],
  entries: [entry],
  labels: {
    day: 'DAY {day}',
    stations: 'Stops',
    summary: 'Summary',
    countries: 'Countries',
    distance: 'km',
    pros: '+',
    cons: '-',
  },
};

const page = bookPageSetupSchema.parse({});
const theme = bookThemeOf('riso');
let n = 0;
const newId = (p: string) => `${p}-${++n}`;
const place = (size: { w: number; h: number }) => ({ x: 1, y: 2, w: size.w, h: size.h });
const looks = bookTravelLooks({ page, stats, travel, theme, newId, place });
const plain = bookTravelLooks({ page, stats, travel, theme: null, newId, place });

const valid = (el: BookElement | null) => {
  expect(el).not.toBeNull();
  expect(bookElementSchema.safeParse(el).success).toBe(true);
};

/** Every element of every shelf, as the panel offers them. */
function everyElement(of: typeof looks): BookElement[] {
  const out: BookElement[] = [];
  for (const look of BOOK_TRAVEL_SUMMARY_LOOKS) out.push(of.summaryEl(look));
  for (const shelf of BOOK_TRAVEL_FIGURE_SHELVES) for (const m of shelf.metrics) out.push(of.figureEl(m, shelf.look));
  for (const code of ['IS', 'PT']) for (const look of BOOK_TRAVEL_COUNTRY_LOOKS) out.push(of.countryEl(code, look));
  for (const kind of ['shape', 'satellite', 'box'] as const) out.push(of.countryMapEl('IS', kind));
  out.push(of.mapEl({ style: 'minimal' }), of.mapEl({ style: 'dark', pins: 'numbered' }));
  for (const { style, variants } of BOOK_TRAVEL_MARK_STYLES) {
    for (const v of variants)
      out.push(...[of.markEl(v, style), of.markEl(v, style, { entry })].flatMap((e) => (e ? [e] : [])));
  }
  return out;
}

describe('the travel looks', () => {
  it('TRVLOOK-001: every factory answers an element the document takes, in every look it offers', () => {
    const all = everyElement(looks);
    expect(all.length).toBeGreaterThan(60);
    for (const el of all) valid(el);
  });

  it('TRVLOOK-002: never in the classic look or a classic mark style', () => {
    for (const el of [...everyElement(looks), ...everyElement(plain)]) {
      if (el.kind === 'stats' || el.kind === 'countries') expect(el.look).toBeDefined();
      if (el.kind === 'stats' || el.kind === 'countries') expect(el.look).not.toBe('classic');
      if (el.kind === 'badge') expect(['plain', 'chip', 'outline', 'stacked']).not.toContain(el.style);
    }
  });

  it("TRVLOOK-003: dressed in the book's theme, its links kept", () => {
    const stamp = looks.countryEl('IS', 'stamp');
    expect(stamp).toMatchObject({ token: 'ink', accentToken: 'accent2', fontRole: 'heading' });
    if (stamp.kind !== 'countries') throw new Error('a country element');
    expect(stamp.color).toBe(bookThemeColor(theme, 'ink'));
    expect(stamp.accent).toBe(bookThemeColor(theme, 'accent2'));
    expect(looks.summaryEl('note')).toMatchObject({ fontRole: 'script' });
    // Without a theme the engine's own colours stay, unlinked.
    expect(plain.countryEl('IS', 'stamp')).not.toHaveProperty('token');
  });

  it('TRVLOOK-004: lands in the frame given, else where the caller places one of its size', () => {
    const frame = { x: 10, y: 20, w: 30, h: 40 };
    expect(looks.summaryEl('poster', frame).frame).toEqual(frame);
    expect(looks.countryEl('PT', 'visa', frame).frame).toEqual(frame);
    expect(looks.figureEl('distance', 'odometer', frame).frame).toEqual(frame);
    expect(looks.mapEl({ style: 'minimal' }, 'journey', 'vector', frame).frame).toEqual(frame);
    expect(looks.markEl('day', 'stamp', { entry, frame })?.frame).toEqual(frame);
    const placed = looks.summaryEl('ticket');
    expect(placed.frame).toMatchObject({ x: 1, y: 2, ...looks.summarySize('ticket') });
  });

  it("TRVLOOK-005: a mark takes an entry's value when given one, the journey's when not", () => {
    const day = looks.markEl('day', 'stamp', { entry });
    const first = looks.markEl('day', 'stamp');
    expect(day).toMatchObject({ kind: 'badge', text: 'DAY 5' });
    expect(first).toMatchObject({ kind: 'badge', text: 'DAY 1' });
    expect(looks.markEl('flag', 'tag', { entry })).toMatchObject({ code: 'IS' });
    const lost = bookTravelLooks({ page, stats, travel: { ...travel, stats: null }, theme, newId, place });
    expect(lost.markEl('distance', 'pill')).toBeNull();
  });

  it("TRVLOOK-006: a country's map holds that country's stops alone, cut to its shape", () => {
    const map = looks.countryMapEl('IS', 'shape');
    if (map.kind !== 'map') throw new Error('a map');
    expect(map.points).toHaveLength(2);
    expect(map).toMatchObject({ clip: 'country', style: 'dark', pinStyle: 'numbered' });
    expect(looks.countryMapEl('IS', 'box')).toMatchObject({ clip: 'rect', style: 'minimal' });
    expect(looks.countryName('PT')).toBe('Portugal');
  });
});
