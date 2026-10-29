import type {
  BookBadgeStyle,
  BookCountryLook,
  BookMapElement,
  BookMapScope,
  BookMetric,
  BookPageSetup,
  BookStatsLook,
  BookTheme,
  BookTravelMapCard,
  BookTravelMarkVariant,
  JourneyStats,
} from '@trek/shared';
import {
  BOOK_TRAVEL_COUNTRY_LOOKS,
  BOOK_TRAVEL_FIGURE_SHELVES,
  BOOK_TRAVEL_MARK_STYLES,
  BOOK_TRAVEL_MARK_VARIANTS,
  BOOK_TRAVEL_SUMMARY_LOOKS,
  bookTravelLooks,
  bookElementId as uid,
} from '@trek/shared';
import { studioTravelContext } from '../studioTravelContext';

/**
 * What the Travel panel offers, built: every card is the element its click
 * places, made by the book's own travel looks (book-travel-looks.ts in
 * shared), the same factory the auto layout builds its framing pages with,
 * so a card and a designed page are one thing.
 *
 * Pure, so the panel stays a list of shelves: it asks for an element and
 * renders it through the page's own renderer, and the preview and the result
 * are the same object. What is the panel's own here is where a new element
 * lands: centred on the spread on screen.
 */

/** The looks of a summary, in the order the panel offers them. */
export const SUMMARY_LOOKS: readonly BookStatsLook[] = BOOK_TRAVEL_SUMMARY_LOOKS;

/** The marks the journey fills, in the order a page is read: when, which day, how far, where. */
export const MARK_VARIANTS = BOOK_TRAVEL_MARK_VARIANTS;
export type MarkVariant = BookTravelMarkVariant;

/** The newer styles a mark comes in, and which of them each mark is offered in. */
export const MARK_STYLES: readonly { style: BookBadgeStyle; variants: readonly MarkVariant[] }[] =
  BOOK_TRAVEL_MARK_STYLES;

/** The single figures, one shelf per look, with the figures each look suits. */
export const FIGURE_SHELVES: readonly { look: BookStatsLook; metrics: readonly BookMetric[] }[] =
  BOOK_TRAVEL_FIGURE_SHELVES;

/** The looks a country is offered in. */
export const COUNTRY_LOOKS: readonly BookCountryLook[] = BOOK_TRAVEL_COUNTRY_LOOKS;

/** The map cards: the photographed route, its stops numbered, its two ends marked, and the dark ground. */
export const MAP_CARDS: {
  id: string;
  labelKey: string;
  style: BookMapElement['style'];
  pins?: BookMapElement['pinStyle'];
}[] = [
  { id: 'photos', labelKey: 'journey.studio.pinPhoto', style: 'minimal' },
  { id: 'numbered', labelKey: 'journey.studio.pinNumbered', style: 'minimal', pins: 'numbered' },
  { id: 'ends', labelKey: 'journey.studio.pinEnds', style: 'minimal', pins: 'ends' },
  { id: 'dark', labelKey: 'journey.studio.mapStyle.dark', style: 'dark', pins: 'numbered' },
];

interface BuilderInput {
  page: BookPageSetup;
  stats: JourneyStats;
  /** The travelled way, already thinned. */
  path: [number, number][][];
  locale: string;
  t: (k: string) => string;
  theme: BookTheme | null | undefined;
  /** The spread on screen is one page rather than two, so a new element centres on it. */
  single: boolean;
}

export function travelBuilders({ page, stats, path, locale, t, theme, single }: BuilderInput) {
  const travel = studioTravelContext(stats, path, locale, t);

  /** Centred across the spread on screen, where the engine's `add` takes the right page. */
  const at = (size: { w: number; h: number }) => {
    const W = single ? page.pageWidth : page.pageWidth * 2;
    return { x: (W - size.w) / 2, y: (page.pageHeight - size.h) / 2, w: size.w, h: size.h };
  };

  const looks = bookTravelLooks({ page, stats, travel, theme, newId: uid, place: at });

  return {
    summaryEl: (look: BookStatsLook) => looks.summaryEl(look),
    figureEl: (metric: BookMetric, look: BookStatsLook = 'medal') => looks.figureEl(metric, look),
    mapEl: (
      card: BookTravelMapCard,
      scope: BookMapScope = 'journey',
      source: 'vector' | 'relief' | 'satellite' = 'vector'
    ) => looks.mapEl(card, scope, source),
    countryMapEl: (code: string, kind: 'shape' | 'satellite' | 'box') => looks.countryMapEl(code, kind),
    markEl: (variant: MarkVariant, style: BookBadgeStyle) => looks.markEl(variant, style),
    countryEl: (code: string, look: BookCountryLook) => looks.countryEl(code, look),
    countryName: looks.countryName,
  };
}
