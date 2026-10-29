import { summaryMetrics } from '../auto/auto-book-spreads';
import { isPortrait } from '../auto/auto-elements';
import type { AutoEntry } from '../auto/auto-types';
import type { BookCoverArchetype } from '../book-archetypes';
import {
  MAX_BOOK_COUNTRIES,
  type BookCountryLook,
  type BookElement,
  type BookFrame,
  type BookSpread,
  type BookStatsLook,
} from '../book.schema';
import type { JourneyStats } from '../journey-stats.schema';
import { applyDecoratedTemplate } from '../templates/template-apply';
import type { BookDecoratedTemplate } from '../templates/template-format';
import { bookTemplateWords, type BookTemplateWords } from '../templates/template-words';
import { themedElement } from '../theme/book-theme-apply';
import { bookTravelLooks, BOOK_TRAVEL_COUNTRY_ACCENT, type BookTravelLooks } from '../travel/book-travel-looks';
import { frameOf, liveBox, photoEl, scaled, textEl, type ComposeCtx } from './design-compose';
import { composeArchetypeCover } from './design-cover';
import type { CoverMaterial } from './design-cover-kit';
import { titleWords, type CoverWords } from './design-cover-words';
import { composeBack } from './design-framing';
import { innerSpread } from './design-spreads';
import { pickCoverTemplate } from './design-template-pick';

/**
 * The pages around the chapters when the book is laid on the designed
 * templates: a cover laid on one of the archetype's cover templates, and the
 * journey at a glance, its countries and the back cover built from the
 * travel looks the Travel panel offers (a summary as a poster, tiles or a
 * sign, countries as stamps, visas or labels, marks as stamps and tags).
 * Nothing here sets a summary, a country or a mark in the classic look.
 */

/** The travel looks of this book, an element of a size centred on the right page unless a frame is named. */
function looksOf(c: ComposeCtx): BookTravelLooks | null {
  const stats = c.travel.stats;
  if (!stats) return null;
  const box = liveBox(c, 'right');
  const place = (size: { w: number; h: number }) =>
    frameOf(box.x + (box.w - size.w) / 2, box.y + (box.h - size.h) / 2, size.w, size.h);
  return bookTravelLooks({ page: c.page, stats, travel: c.travel, theme: c.look.theme, newId: c.newId, place });
}

/** A size scaled down to fit a box, its proportions kept, centred in it. */
function fitIn(size: { w: number; h: number }, box: BookFrame): BookFrame {
  const k = Math.min(1, box.w / size.w, box.h / size.h);
  const w = size.w * k;
  const h = size.h * k;
  return frameOf(box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}

// ── the cover ─────────────────────────────────────────────────────────────

/**
 * The cover's own words and pictures as a page, for a template to pour:
 * the title bound to the journey's (unless the person gave their own), the
 * subtitle bound the same way, the year it was travelled, and the photos.
 * Poured from a page, the title keeps its binding, which the template's
 * words for a cover would not give it.
 */
function coverSeed(c: ComposeCtx, words: CoverWords, material: CoverMaterial, slots: number): BookSpread {
  const box = liveBox(c, 'single');
  const els: BookElement[] = [];
  const title = titleWords(words.ownTitle, words.title);
  if (title.words.trim()) {
    const binding = title.bound ? { source: 'journey.title' as const } : null;
    els.push(textEl(c, box, title.words, 'heading', { binding, size: c.look.sizes.display }));
  }
  const sub = titleWords(words.ownSubtitle, words.subtitle ?? '');
  if (sub.words.trim()) {
    const binding = sub.bound ? { source: 'journey.subtitle' as const } : null;
    els.push(textEl(c, box, sub.words, 'sub', { binding }));
  }
  const year = material.entries.find((e) => e.date && /^\d{4}/.test(e.date))?.date?.slice(0, 4);
  if (year) els.push(textEl(c, box, year, 'meta'));
  els.push(...material.photos.slice(0, slots).map((p) => photoEl(c, p, box)));
  return { id: c.newId('sp'), role: 'cover', background: null, elements: els, parked: [], entryId: null };
}

/**
 * A page laid on a decorated template in the book's theme, its empty roles
 * taking the journey's words, or the words `given` for a role by name.
 */
export function pourTemplate(
  c: ComposeCtx,
  seed: BookSpread,
  tpl: BookDecoratedTemplate,
  entries: readonly AutoEntry[],
  given: BookTemplateWords = {},
) {
  const words = { ...bookTemplateWords(seed, { bookTitle: '', locale: c.locale, entries }), ...given };
  return applyDecoratedTemplate(seed, tpl, c.page, {
    theme: c.look.theme,
    travel: c.travel,
    locale: c.locale,
    newId: c.newId,
    words,
  });
}

/**
 * The cover on one of the archetype's cover templates: one that leaves no
 * frame empty and fills the most, a tall one for a tall cover photo. An
 * archetype with none for the photos there are (none at all, or fewer than
 * its grid takes) has its cover composed instead (design-cover.ts).
 */
export function composeTemplatedCover(
  c: ComposeCtx,
  words: CoverWords,
  material: CoverMaterial,
  archetype: BookCoverArchetype,
  avoid: readonly string[] = [],
): { spread: BookSpread; template: string | null } {
  const first = material.photos[0];
  const seed = c.directives.seed ?? 0;
  const tpl = pickCoverTemplate({
    archetype,
    photos: material.photos.length,
    portrait: !!first && isPortrait(first),
    seed,
    avoid,
  });
  if (!tpl) return { spread: composeArchetypeCover(c, archetype, words, material), template: null };
  return { spread: coverOnTemplate(c, words, material, tpl), template: tpl.id };
}

/** The cover laid on this cover template, its title and subtitle bound to the journey's. */
export function coverOnTemplate(
  c: ComposeCtx,
  words: CoverWords,
  material: CoverMaterial,
  tpl: BookDecoratedTemplate,
): BookSpread {
  const laid = pourTemplate(c, coverSeed(c, words, material, material.photos.length), tpl, material.entries);
  // The photos the cover has no frame for are the book's own pages', not the cover's to park.
  return { ...laid, parked: [] };
}

// ── the journey at a glance ───────────────────────────────────────────────

/** The summary's look for an archetype: tiles for the collage and grid books, a sign for the postcard ones. */
export function summaryLookFor(archetype: BookCoverArchetype): BookStatsLook {
  if (archetype === 'stamp-collage' || archetype === 'grid-badge') return 'tiles';
  return archetype === 'postcard' ? 'sign' : 'poster';
}

/** The summary looks "this spread" goes through, in turn. */
export const SUMMARY_CYCLE: readonly BookStatsLook[] = ['poster', 'tiles', 'sign'];

/** Whether the journey adds up to a summary worth a spread: a way of two stops at least. */
const hasSummary = (stats: JourneyStats | null): stats is JourneyStats => !!stats && stats.points.length >= 2;

/**
 * The journey at a glance: its map with a photo at every stop on the left
 * page; on the right the figures in the look's panel, a ticket stub of how
 * far and how long below it, and the furthest point on an odometer when the
 * journey went anywhere. Null when there is nothing to sum up.
 */
export function composeTravelSummary(c: ComposeCtx, look: BookStatsLook): BookSpread | null {
  const stats = c.travel.stats;
  const looks = looksOf(c);
  if (!hasSummary(stats) || !looks) return null;
  const els: BookElement[] = [looks.mapEl({ style: 'minimal' }, 'journey', 'vector', liveBox(c, 'left'))];
  const box = liveBox(c, 'right');
  const parts: { size: { w: number; h: number }; make: (f: BookFrame) => BookElement }[] = [];
  const metrics = summaryMetrics(stats);
  const main = looks.summarySize(look);
  parts.push({ size: { w: box.w, h: (box.w * main.h) / main.w }, make: (f) => looks.summaryEl(look, f, metrics) });
  const stub = looks.summarySize('ticket');
  parts.push({
    size: { w: box.w * 0.72, h: (box.w * 0.72 * stub.h) / stub.w },
    make: (f) => looks.summaryEl('ticket', f, ['distance', 'days']),
  });
  if (stats.furthest > 0) {
    const drums = looks.figureSize('odometer');
    parts.push({
      size: { w: box.w * 0.5, h: (box.w * 0.5 * drums.h) / drums.w },
      make: (f) => looks.figureEl('furthest', 'odometer', f),
    });
  }
  els.push(...stacked(c, parts, box));
  return innerSpread(c, els, null);
}

/** Parts stacked down a box with a gap between, all scaled alike to fit it, each centred across. */
function stacked(
  c: ComposeCtx,
  parts: readonly { size: { w: number; h: number }; make: (f: BookFrame) => BookElement }[],
  box: BookFrame,
): BookElement[] {
  const gap = scaled(c, 8);
  const tall = parts.reduce((h, p) => h + p.size.h, 0);
  const k = Math.min(1, (box.h - gap * (parts.length - 1)) / tall);
  let y = box.y + (box.h - (tall * k + gap * (parts.length - 1))) / 2;
  return parts.map((p) => {
    const w = p.size.w * k;
    const h = p.size.h * k;
    const el = p.make(frameOf(box.x + (box.w - w) / 2, y, w, h));
    y += h + gap;
    return el;
  });
}

// ── the countries ─────────────────────────────────────────────────────────

/** The country look for an archetype: stamps for the collage books, postcards, labels for the quiet ones, else visas. */
export function countryLookFor(archetype: BookCoverArchetype): BookCountryLook {
  if (archetype === 'stamp-collage') return 'stamp';
  if (archetype === 'postcard') return 'postcard';
  return archetype === 'spine-band' || archetype === 'minimal-serif' ? 'label' : 'visa';
}

/** The country looks "this spread" goes through, in turn. */
export const COUNTRY_CYCLE: readonly BookCountryLook[] = ['stamp', 'visa', 'label', 'postcard'];

/** Past this many countries one panel of stamps holds them all, rather than a stamp each. */
const MOST_COUNTRY_CARDS = 12;

/** A country in its look, its accent the look's or the theme's first by turns, so a grid is not one colour. */
function countryCard(
  c: ComposeCtx,
  looks: BookTravelLooks,
  code: string,
  look: BookCountryLook,
  at: number,
  frame: BookFrame,
) {
  const el = looks.countryEl(code, look, frame);
  const own = BOOK_TRAVEL_COUNTRY_ACCENT[look] ?? 'accent';
  if (at % 2 === 0 || own === 'accent') return el;
  return themedElement({ ...el, accentToken: 'accent' } as BookElement, c.look.theme);
}

/** The cells of a grid of `n` on one page's live box, at most three across. */
function grid(box: BookFrame, n: number, gap: number): BookFrame[] {
  const cols = Math.min(3, n);
  const rows = Math.ceil(n / cols);
  const w = (box.w - gap * (cols - 1)) / cols;
  const h = Math.min(w, (box.h - gap * (rows - 1)) / rows);
  const top = box.y + (box.h - (h * rows + gap * (rows - 1))) / 2;
  return Array.from({ length: n }, (_, i) =>
    frameOf(box.x + (i % cols) * (w + gap), top + Math.floor(i / cols) * (h + gap), w, h),
  );
}

/**
 * The countries of the journey: one country as its map cut to its shape
 * beside its stamp; up to twelve as a card each over both pages; more as one
 * panel of stamps. Null for a journey that crossed no border it knows of.
 */
export function composeTravelCountries(c: ComposeCtx, look: BookCountryLook): BookSpread | null {
  const stats = c.travel.stats;
  const looks = looksOf(c);
  const codes = stats?.countries.map((k) => k.code) ?? [];
  if (!looks || !codes.length) return null;
  const card = looks.countrySize(look);
  const [only] = codes;
  if (codes.length === 1 && only) {
    const els = [
      looks.countryMapEl(only, 'shape', liveBox(c, 'left')),
      countryCard(c, looks, only, look, 0, fitIn({ w: card.w * 1.4, h: card.h * 1.4 }, liveBox(c, 'right'))),
    ];
    return innerSpread(c, els, null);
  }
  if (codes.length > MOST_COUNTRY_CARDS) {
    // One panel on the right page, every country a stamp in it, beside the journey's map.
    const map = looks.mapEl({ style: 'minimal', pins: 'numbered' }, 'journey', 'vector', liveBox(c, 'left'));
    return innerSpread(
      c,
      [map, withCodes(looks.countryEl(only ?? '', 'stamp', liveBox(c, 'right')), looks, codes)],
      null,
    );
  }
  const left = Math.ceil(codes.length / 2);
  const gap = scaled(c, 6);
  const cells = [...grid(liveBox(c, 'left'), left, gap), ...grid(liveBox(c, 'right'), codes.length - left, gap)];
  const els = codes.map((code, i) => countryCard(c, looks, code, look, i, fitIn(card, cells[i] as BookFrame)));
  return innerSpread(c, els, null);
}

/** A countries panel holding every one of the journey's countries, named in the book's language. */
function withCodes(el: BookElement, looks: BookTravelLooks, codes: readonly string[]): BookElement {
  if (el.kind !== 'countries') return el;
  const all = codes.slice(0, MAX_BOOK_COUNTRIES);
  return { ...el, codes: all.map((k) => k.toUpperCase()), names: all.map((k) => looks.countryName(k)), layout: 'grid' };
}

// ── the back cover ────────────────────────────────────────────────────────

/**
 * The back cover: the title and when it was, as the composed back sets
 * them, then a band of how long, how many places and how many photos, and a
 * row of up to four country stamps. One page: everything stays inside its
 * live area.
 */
export function composeTravelBack(c: ComposeCtx, words: CoverWords, entries: readonly AutoEntry[]): BookSpread {
  const back = composeBack(c, words, entries);
  const looks = looksOf(c);
  const stats = c.travel.stats;
  if (!looks || !stats) return back;
  const box = liveBox(c, 'single');
  const els: BookElement[] = [...back.elements];
  const bandH = Math.min(c.page.pageHeight * 0.13, box.h * 0.16);
  els.push(looks.summaryEl('band', frameOf(box.x, box.y + box.h * 0.66, box.w, bandH), ['days', 'places', 'photos']));
  const codes = stats.countries.slice(0, 4).map((k) => k.code);
  if (codes.length) {
    const gap = scaled(c, 4);
    const side = Math.min((box.w - gap * 3) / 4, box.y + box.h - (box.y + box.h * 0.66 + bandH + gap));
    const row = codes.length * side + gap * (codes.length - 1);
    const y = box.y + box.h - side;
    codes.forEach((code, i) => {
      els.push(looks.countryEl(code, 'stamp', frameOf(box.x + (box.w - row) / 2 + i * (side + gap), y, side, side)));
    });
  }
  return { ...back, elements: els };
}

// ── a page of words ───────────────────────────────────────────────────────

/**
 * A page of an entry's words where no template takes them (a story with no
 * photo, or the rest of one that ran over its template's frame): the story
 * in a column on the left page, and on the right the stop's map with its
 * stops numbered, its day as a stamp and its country as a tag.
 */
export function composeWordsPage(c: ComposeCtx, entry: AutoEntry, story: BookElement | null): BookSpread {
  const looks = looksOf(c);
  const els: BookElement[] = story ? [story] : [];
  const right = liveBox(c, 'right');
  if (looks && c.travel.stats && c.travel.stats.points.length) {
    const map = frameOf(right.x, right.y, right.w, right.h * 0.62);
    els.push(looks.mapEl({ style: 'minimal', pins: 'numbered' }, 'journey', 'vector', map));
    const marks = [looks.markEl('day', 'stamp', { entry }), looks.markEl('flag', 'tag', { entry })];
    let x = right.x;
    for (const mark of marks) {
      if (!mark) continue;
      const { w = 0, h = 0 } = mark.frame;
      const frame = fitIn({ w, h }, frameOf(x, right.y + right.h * 0.7, right.w / 2 - scaled(c, 4), right.h * 0.3));
      els.push({ ...mark, frame: frameOf(x, frame.y, frame.w, frame.h) });
      x += frame.w + scaled(c, 8);
    }
  }
  return innerSpread(c, els, entry.id);
}
