import { layoutAroundLocks } from '../book-layout-locks';
import type { BookCountryLook, BookDocument, BookElement, BookSpread, BookStatsLook } from '../book.schema';
import { designBook, templatedSetting, type BookDesignInput, type TemplatedSetting } from '../design/design-book';
import type { BookDesignDirectivesInput } from '../design/design-directives.schema';
import { ARCHETYPE_KIN, type TemplatePickCtx } from '../design/design-template-pick';
import { layEntryPage, type LaidPage, type PageStory } from '../design/design-templated';
import {
  COUNTRY_CYCLE,
  SUMMARY_CYCLE,
  composeTravelCountries,
  composeTravelSummary,
  coverOnTemplate,
} from '../design/design-templated-framing';
import { decoratedTemplatesFor } from '../templates/template-catalogue';
import { templatePhotoSlots } from '../templates/template-format';
import { matchDecoratedTemplate } from '../templates/template-match';
import { bookThemeOf } from '../theme/book-theme';
import type { BookTheme, BookThemeId } from '../theme/book-theme.schema';
import { isPortrait } from './auto-elements';
import type { AutoEntry, AutoInput, AutoPhoto } from './auto-types';

/**
 * The Studio's Auto layout on the designed templates.
 *
 * "The whole book" is the design engine laying the book on the Studio's
 * decorated templates (`designBook` with `layouts: 'templates'`), in the
 * book's own theme, keeping every page that holds a locked element. "This
 * spread" lays one page again on another template than the one on screen and
 * its neighbours: an entry's page on the next best spread for its photos and
 * words, the cover on the next cover of its archetype and then of its kin,
 * the summary and the countries in their next look. The old Auto layout
 * (`buildBook`, `relayoutSpread`) stays as it was, the design engine's
 * classic style.
 */

/** The theme a book without one is laid in: calm, linen, serif. */
export const AUTO_DEFAULT_THEME: BookThemeId = 'fabric-classic';

/** The journey as the Studio's Auto layout takes it: the entries with their stops, and the loose gallery. */
export interface AutoDesignedInput extends AutoInput {
  gallery?: readonly AutoPhoto[];
}

export interface AutoDesignedOptions {
  /** The book's theme, a recoloured one of its own included; the default theme without one. */
  theme?: BookTheme | null;
  /** Another seed lays another book; the same one the same. */
  seed?: number;
}

const designInput = (input: AutoDesignedInput, theme: BookTheme | null | undefined): BookDesignInput => ({
  ...input,
  candidates: [],
  photos: [],
  theme: theme ?? bookThemeOf(AUTO_DEFAULT_THEME),
});

const directivesOf = (theme: BookTheme | null | undefined, seed: number | undefined): BookDesignDirectivesInput => ({
  style: theme?.id ?? AUTO_DEFAULT_THEME,
  layouts: 'templates',
  keep: 'locked',
  ...(seed === undefined ? {} : { seed }),
});

/** The whole book laid on the designed templates over the stored one, its page format kept. */
export function autoDesignedBook(
  doc: BookDocument | null,
  input: AutoDesignedInput,
  opts: AutoDesignedOptions = {},
): BookDocument {
  const page = doc?.page ?? input.page;
  return designBook(doc, designInput({ ...input, page }, opts.theme), directivesOf(opts.theme, opts.seed)).doc;
}

/** What "this spread" can lay again: an entry's page, the cover, the summary, the countries; null for the rest. */
export type AutoRelayoutKind = 'entry' | 'cover' | 'summary' | 'countries';

/** The kind of page a spread of the book is for "this spread", or null for one the engine did not make. */
export function autoRelayoutKind(spread: BookSpread | undefined): AutoRelayoutKind | null {
  if (!spread) return null;
  if (spread.role === 'cover') return 'cover';
  if (spread.role !== 'inner') return null;
  if (spread.entryId != null) return 'entry';
  const has = (kind: BookElement['kind']) => spread.elements.some((e) => e.kind === kind);
  if (has('stats') && has('map')) return 'summary';
  if (has('countries') && !has('stats')) return 'countries';
  return null;
}

/** The photos a page holds, on it and parked with it, in order. */
function photosOn(spread: BookSpread, entries: readonly AutoEntry[]): AutoPhoto[] {
  const known = new Map(entries.flatMap((e) => e.photos.map((p) => [p.photoId, p] as const)));
  return [...spread.elements, ...spread.parked].flatMap((e) =>
    e.kind === 'photo' && e.photoId != null
      ? [known.get(e.photoId) ?? { photoId: e.photoId, width: null, height: null }]
      : [],
  );
}

/** The story a page of this entry sets, and whether it is the whole of it. */
function storyOn(spread: BookSpread, entryId: number): PageStory {
  for (const e of spread.elements) {
    if (e.kind === 'text' && e.binding?.source === 'entry.story' && e.binding.entryId === entryId && e.text.trim()) {
      return { words: e.text, whole: !e.overridden };
    }
  }
  return null;
}

/** The templates of the page before and after this one, never to be laid here. */
function neighbours(doc: BookDocument, index: number): string[] {
  return [doc.spreads[index - 1], doc.spreads[index + 1]].flatMap((s) =>
    s ? (matchDecoratedTemplate(s, doc.page)?.id ?? []) : [],
  );
}

/** Templates tried for a page whose story would be cut, before one that cuts it is taken. */
const STORY_TRIES = 4;

/** An entry's page on the best template but the one on screen and its neighbours'. */
function relayEntry(s: TemplatedSetting, doc: BookDocument, index: number, free: BookSpread): BookSpread | null {
  const entry = s.placed.find((e) => e.id === free.entryId);
  const own = doc.spreads[index];
  if (!entry || !own) return null;
  const current = matchDecoratedTemplate(own, doc.page)?.id;
  const around = neighbours(doc, index);
  const avoid = [...(current ? [current] : []), ...around];
  const page = { photos: photosOn(free, s.placed), story: storyOn(free, entry.id), entries: s.placed };
  const pick = (more: readonly string[]): TemplatePickCtx => ({
    archetype: s.archetype,
    page: s.c.page,
    theme: s.c.look.theme,
    history: around.slice(0, 1),
    calm: s.calm,
    seed: s.c.directives.seed ?? 0,
    key: `relay:${entry.id}`,
    avoid: [...avoid, ...more],
  });
  let laid: LaidPage | null = null;
  const tried: string[] = [];
  for (let n = 0; n < STORY_TRIES; n++) {
    const next = layEntryPage(s.c, entry, page, pick(tried));
    laid ??= next;
    if (!next.rest || !next.template) {
      laid = next;
      break;
    }
    tried.push(next.template.id);
  }
  if (!laid) return null;
  return { ...s.finish(laid.spread, !!laid.template).spread, entryId: entry.id };
}

/** The cover on the next cover template of its archetype, then of its kin, for the photos there are. */
function relayCover(s: TemplatedSetting, doc: BookDocument, index: number, input: AutoDesignedInput) {
  const own = doc.spreads[index];
  if (!own) return null;
  const others = doc.spreads.flatMap((sp) => (sp === own ? [] : photosOn(sp, s.placed)));
  const photos = [...new Map([...photosOn(own, s.placed), ...others].map((p) => [p.photoId, p])).values()].slice(0, 8);
  const order = [s.archetype, ...ARCHETYPE_KIN[s.archetype]].flatMap((a) => decoratedTemplatesFor('single', a));
  const fits = order.filter(
    (t) => templatePhotoSlots(t) <= photos.length && (photos.length > 0 || !templatePhotoSlots(t)),
  );
  if (!fits.length) return null;
  const current = matchDecoratedTemplate(own, doc.page)?.id;
  const at = fits.findIndex((t) => t.id === current);
  // A cover the engine cannot read takes the first of the archetype's, a portrait one for a tall photo first.
  const tall = photos[0] && isPortrait(photos[0]) ? fits.find((t) => /-portrait$|^cutout-/.test(t.id)) : undefined;
  const tpl = at >= 0 ? fits[(at + 1) % fits.length] : (tall ?? fits[0]);
  if (!tpl) return null;
  const ownTitle = doc.title !== input.title ? doc.title : undefined;
  const words = { title: input.title, subtitle: input.subtitle, ownTitle };
  return s.finish(coverOnTemplate(s.c, words, { photos, entries: s.placed }, tpl), true).spread;
}

/** The look after this one in its cycle; the first for a look outside it (the classic one). */
function nextLook<T extends string>(cycle: readonly T[], look: string | undefined): T {
  const at = look ? cycle.indexOf(look as T) : -1;
  return cycle[(at + 1) % cycle.length] as T;
}

/** The summary or the countries in their next look. */
function relayTravel(s: TemplatedSetting, free: BookSpread, kind: 'summary' | 'countries'): BookSpread | null {
  if (kind === 'summary') {
    const stats = free.elements.find((e) => e.kind === 'stats' && e.metrics.length > 2);
    const look = stats?.kind === 'stats' ? stats.look : undefined;
    const next = composeTravelSummary(s.c, nextLook<BookStatsLook>(SUMMARY_CYCLE, look));
    return next ? s.finish(next).spread : null;
  }
  const country = free.elements.find((e) => e.kind === 'countries');
  const look = country?.kind === 'countries' ? country.look : undefined;
  const next = composeTravelCountries(s.c, nextLook<BookCountryLook>(COUNTRY_CYCLE, look));
  return next ? s.finish(next).spread : null;
}

/**
 * One page of the book laid again on the designed templates, around its
 * locked elements, its id kept: null for a page the engine did not make
 * (stops, the first and last page, the back, a page made by hand), or when
 * the page and its locks would not fit.
 */
export function autoRelayoutSpread(
  doc: BookDocument,
  index: number,
  input: AutoDesignedInput,
  opts: Pick<AutoDesignedOptions, 'seed'> = {},
): BookSpread | null {
  const spread = doc.spreads[index];
  const kind = autoRelayoutKind(spread);
  if (!spread || !kind) return null;
  const setting = templatedSetting(
    doc,
    designInput({ ...input, page: doc.page }, doc.theme),
    directivesOf(doc.theme, opts.seed),
  );
  return layoutAroundLocks(spread, (free) => {
    const next =
      kind === 'entry'
        ? relayEntry(setting, doc, index, free)
        : kind === 'cover'
          ? relayCover(setting, doc, index, input)
          : relayTravel(setting, free, kind);
    return next ? { ...next, id: spread.id } : null;
  });
}
