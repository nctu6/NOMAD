import type { AutoEntry } from '../auto/auto-types';
import {
  bookBadgeValue,
  bookCountryName,
  bookTravelBadge,
  bookTravelCountries,
  bookTravelMap,
  bookTravelSize,
  bookTravelStats,
  type BookMapScope,
  type BookTravelContext,
} from '../book-travel';
import type {
  BookBadgeStyle,
  BookBadgeVariant,
  BookCountryLook,
  BookElement,
  BookFrame,
  BookMapElement,
  BookMetric,
  BookPageSetup,
  BookStatsLook,
} from '../book.schema';
import type { JourneyStats } from '../journey-stats.schema';
import { themedElement } from '../theme/book-theme-apply';
import type { BookColorToken, BookTheme } from '../theme/book-theme.schema';

/**
 * The travel elements in their newer looks, dressed in the book's theme: a
 * summary as a poster, a ticket or a sign, a single figure on a medal or an
 * odometer, a map of the journey or of one country, a mark as a stamp or a
 * tag, a country as a stamp, a visa or a postcard.
 *
 * One factory for the Studio's Travel panel, whose cards are the elements
 * their click places, and for the auto layout, which builds its framing pages
 * from the same looks. Both take the book engine's own factories
 * (book-travel.ts), so a card, a designed page and what the assistant places
 * are one thing. Where an element lands is the caller's: the panel centres it
 * on the spread on screen, a designed page names its frame.
 */

/** The figures a summary offers: how far, how long, where, and how much was kept. */
const SUMMARY_METRICS: readonly BookMetric[] = ['distance', 'days', 'countries', 'photos'];

/** The looks of a summary, in the order the panel offers them. */
export const BOOK_TRAVEL_SUMMARY_LOOKS: readonly BookStatsLook[] = [
  'poster',
  'ticket',
  'tiles',
  'sign',
  'odometer',
  'note',
  'sketch',
  'band',
];

/** The marks the journey fills, in the order a page is read: when, which day, how far, where. */
export const BOOK_TRAVEL_MARK_VARIANTS = ['date', 'day', 'distance', 'coords', 'flag'] as const;
export type BookTravelMarkVariant = (typeof BOOK_TRAVEL_MARK_VARIANTS)[number];

/** The newer styles a mark comes in, and which of them each mark is offered in. */
export const BOOK_TRAVEL_MARK_STYLES: readonly {
  style: BookBadgeStyle;
  variants: readonly BookTravelMarkVariant[];
}[] = [
  { style: 'stamp', variants: ['date', 'day', 'flag'] },
  { style: 'tag', variants: ['day', 'distance', 'coords', 'flag'] },
  { style: 'pill', variants: ['date', 'day', 'distance', 'coords', 'flag'] },
  { style: 'ribbon', variants: ['date', 'day', 'distance', 'flag'] },
  { style: 'sticker', variants: ['date', 'day', 'distance', 'flag'] },
  { style: 'patch', variants: ['day', 'distance', 'flag'] },
  { style: 'sketch', variants: ['date', 'day', 'distance', 'coords', 'flag'] },
];

/** The single figures, one shelf per look, with the figures each look suits. */
export const BOOK_TRAVEL_FIGURE_SHELVES: readonly { look: BookStatsLook; metrics: readonly BookMetric[] }[] = [
  { look: 'medal', metrics: ['distance', 'days', 'steps', 'photos', 'countries', 'places', 'furthest'] },
  { look: 'odometer', metrics: ['distance', 'furthest', 'days', 'photos'] },
  { look: 'sketch', metrics: ['distance', 'days', 'countries', 'photos'] },
];

/** The looks a country is offered in. */
export const BOOK_TRAVEL_COUNTRY_LOOKS: readonly BookCountryLook[] = [
  'stamp',
  'visa',
  'postcard',
  'flag',
  'pin',
  'label',
  'sketch',
];

/** The looks written by hand take the theme's script face rather than its heading. */
const HANDWRITTEN = new Set<string>(['note', 'sketch']);

/** Which of the theme's accents each country look takes, so a shelf of them is not one colour. */
export const BOOK_TRAVEL_COUNTRY_ACCENT: Partial<Record<BookCountryLook, BookColorToken>> = {
  stamp: 'accent2',
  visa: 'accent3',
  pin: 'accent',
  label: 'accent2',
};

/** Which of the theme's accents each mark takes, so a page of them is not one colour. */
const MARK_ACCENT: Record<BookTravelMarkVariant, BookColorToken> = {
  date: 'accent',
  day: 'accent2',
  distance: 'accent3',
  coords: 'accent',
  flag: 'accent2',
};

/** A map card: its ground and the pins it marks its stops with. */
export interface BookTravelMapCard {
  style: BookMapElement['style'];
  pins?: BookMapElement['pinStyle'];
}

interface BookTravelLooksInput {
  page: BookPageSetup;
  stats: JourneyStats;
  /** The journey's figures, way and words, as the engine's factories read them. */
  travel: BookTravelContext;
  /** The book's theme; without one an element keeps the engine's own colours. */
  theme: BookTheme | null | undefined;
  newId: (prefix: string) => string;
  /** Where an element of this size lands when the caller names no frame of its own. */
  place: (size: { w: number; h: number }) => BookFrame;
}

/** The travel elements of one book, each in the frame given or where `place` puts one of its size. */
export function bookTravelLooks({ page, stats, travel, theme, newId, place }: BookTravelLooksInput) {
  const frameFor = (size: { w: number; h: number }, frame?: BookFrame) => frame ?? place(size);

  /**
   * An element dressed in the book's theme: its words in the theme's ink and
   * heading face, its colour one of the theme's accents, all three linked so
   * it follows when the theme changes. A book without a theme keeps the
   * engine's own colours.
   */
  const dress = (el: BookElement, accent: BookColorToken = 'accent', hand = false): BookElement =>
    theme
      ? themedElement(
          { ...el, token: 'ink', accentToken: accent, fontRole: hand ? 'script' : 'heading' } as BookElement,
          theme,
        )
      : el;

  /** The size a summary is set at in a look; a band is a strip, so it is set a third as tall. */
  const summarySize = (look: BookStatsLook) => {
    const w = page.pageWidth * (look === 'note' || look === 'sign' ? 0.56 : 0.72);
    const h =
      look === 'band' ? page.pageHeight * 0.13 : look === 'ticket' ? w * 0.42 : look === 'note' ? w * 0.72 : w * 0.5;
    return { w, h };
  };

  /** A summary in one of the newer looks, of the figures given or the four a summary offers. */
  const summaryEl = (look: BookStatsLook, frame?: BookFrame, metrics: readonly BookMetric[] = SUMMARY_METRICS) => {
    const at = frameFor(summarySize(look), frame);
    const el = { ...bookTravelStats(stats, { id: newId('st'), frame: at, metrics }), look };
    return dress(el, look === 'sign' ? 'accent3' : 'accent', HANDWRITTEN.has(look));
  };

  /** The size a single figure is set at: a square, or the drums of an odometer. */
  const figureSize = (look: BookStatsLook) => {
    const side = Math.min(page.pageWidth, page.pageHeight) * 0.3;
    return look === 'odometer' ? { w: side * 1.6, h: side * 0.62 } : { w: side, h: side };
  };

  /**
   * One figure on its own, the mark to drop beside a photograph: as a medal, on
   * the drums of an odometer, or ringed by hand.
   */
  const figureEl = (metric: BookMetric, look: BookStatsLook = 'medal', frame?: BookFrame): BookElement => {
    const at = frameFor(figureSize(look), frame);
    const el = { ...bookTravelStats(stats, { id: newId('st'), frame: at, metrics: [metric] }), look };
    return dress(el, 'accent', HANDWRITTEN.has(look));
  };

  /**
   * A map as the engine places it, on the card's ground and with the card's
   * stops. The scope is the journey or one trip; the ground is the outlines
   * or one of the two imagery sources.
   */
  const mapEl = (
    card: BookTravelMapCard,
    scope: BookMapScope = 'journey',
    source: 'vector' | 'relief' | 'satellite' = 'vector',
    frame?: BookFrame,
  ): BookElement => {
    const at = frameFor(bookTravelSize('map', page), frame);
    const el = bookTravelMap(travel, stats, { id: newId('mp'), frame: at, scope, source });
    const shaped = { ...el, style: card.style, ...(card.pins ? { pinStyle: card.pins } : {}) };
    // Over imagery the line is white on purpose (book-travel.ts); only the outline maps take the theme.
    return source === 'vector' ? dress(shaped) : shaped;
  };

  /**
   * A map of one country: its stops alone, without the way there. A journey's
   * recorded way often starts with the flight from home, and fitted to all of
   * it the country is a speck at the edge of a continent; the page a travel
   * book wants is the country, cut to its own shape on the paper or over the
   * satellite picture, or the country in a box.
   */
  const countryMapEl = (code: string, kind: 'shape' | 'satellite' | 'box', frame?: BookFrame): BookElement => {
    const own: JourneyStats = {
      ...stats,
      points: stats.points.filter((p) => p.country === code),
      countries: stats.countries.filter((c) => c.code === code),
    };
    const ctx: BookTravelContext = { ...travel, stats: own, path: [], entries: [] };
    const source = kind === 'satellite' ? 'satellite' : 'vector';
    const at = frameFor(bookTravelSize('map', page), frame);
    const el = bookTravelMap(ctx, own, { id: newId('mp'), frame: at, scope: 'journey', source });
    // Cut to its shape on the paper, the land is dark, so the silhouette reads and the route in the accent stands on it.
    const style = kind === 'shape' ? 'dark' : 'minimal';
    const shaped = {
      ...el,
      style,
      clip: kind === 'box' ? 'rect' : 'country',
      pinStyle: 'numbered',
      fitToCountries: true,
    } as const;
    return source === 'vector' ? dress(shaped) : shaped;
  };

  /**
   * How large a mark is set: as wide as its words need. A stamp stacks them in
   * a box with room for its two rules; a tag or a pill sets them in a line
   * after its eyelet or its disc, so its length follows the words.
   */
  const markSize = (style: BookBadgeStyle, text: string, sub: string) => {
    const twoLines = !!text && !!sub && text.length > 14;
    const h = page.pageHeight * (style === 'stamp' ? 0.12 : twoLines ? 0.1 : 0.066);
    const main = text || sub;
    if (style === 'stamp') return { w: Math.max(h * 1.3, h * 0.2 * Math.max(main.length * 1.4, sub.length)), h };
    // Two lines are set smaller than one, so they need less width a letter.
    if (twoLines)
      return { w: Math.min(page.pageWidth * 0.6, h * (1.5 + 0.13 * Math.max(text.length, sub.length * 0.7))), h };
    const chars = main.length * (text ? 1 : 0.85) + (text ? sub.length * 0.5 : 0);
    return { w: Math.min(page.pageWidth * 0.6, h * (1.6 + 0.3 * chars)), h };
  };

  /**
   * A mark in one of the newer styles, at the size its variant suits; a stamp
   * is set taller for its two rules. The journey's value, or an entry's when
   * one is given; null when nothing says what it would show.
   */
  const markEl = (
    variant: BookTravelMarkVariant,
    style: BookBadgeStyle,
    of: { entry?: AutoEntry | null; frame?: BookFrame } = {},
  ): BookElement | null => {
    const value = bookBadgeValue(travel, variant, of.entry ?? null);
    if (!value) return null;
    const at = frameFor(markSize(style, value.text, value.sub), of.frame);
    const el = {
      ...bookTravelBadge({ id: newId('bd'), frame: at, variant: variant as BookBadgeVariant, value }),
      style,
    };
    return dress(el, MARK_ACCENT[variant], style === 'sketch');
  };

  /** The size a country is set at: a square stamp, or a card in the proportions of a postcard. */
  const countrySize = (look: BookCountryLook) => {
    const side = Math.min(page.pageWidth, page.pageHeight) * 0.36;
    const ratio = look === 'stamp' || look === 'pin' || look === 'sketch' ? 1 : look === 'postcard' ? 1.36 : 1.4;
    return { w: side * ratio, h: side };
  };

  /** One country as a square stamp, or as a card in the proportions of a postcard. */
  const countryEl = (code: string, look: BookCountryLook, frame?: BookFrame): BookElement => {
    const at = frameFor(countrySize(look), frame);
    const el = {
      ...bookTravelCountries(travel, { id: newId('co'), frame: at, codes: [code] }),
      look,
      showFlag: look === 'pin' || look === 'postcard',
    };
    return dress(el, BOOK_TRAVEL_COUNTRY_ACCENT[look] ?? 'accent', look === 'sketch');
  };

  /** A country's name in the reader's language, from the same CLDR data Atlas uses. */
  const countryName = (code: string): string => bookCountryName(code, travel.locale, stats);

  return {
    summaryEl,
    summarySize,
    figureEl,
    figureSize,
    mapEl,
    countryMapEl,
    markEl,
    markSize,
    countryEl,
    countrySize,
    countryName,
  };
}

/** The travel elements one book builds: what `bookTravelLooks` answers. */
export type BookTravelLooks = ReturnType<typeof bookTravelLooks>;
