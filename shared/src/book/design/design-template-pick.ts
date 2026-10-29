import { isPortrait } from '../auto/auto-elements';
import type { AutoPhoto } from '../auto/auto-types';
import type { BookCoverArchetype } from '../book-archetypes';
import { DESIGN_TEXT_HEADROOM, textHeightNeeded } from '../book-findings';
import type { BookPageSetup, BookTextElement } from '../book.schema';
import { layDecoratedTemplate } from '../templates/template-apply';
import { decoratedTemplatesFor } from '../templates/template-catalogue';
import { templatePhotoSlots, templateRoles, type BookDecoratedTemplate } from '../templates/template-format';
import { themedElement } from '../theme/book-theme-apply';
import type { BookTheme, BookThemeId } from '../theme/book-theme.schema';
import { BOOK_THEME_PRESETS } from '../theme/book-themes.data';
import { isLandscape } from './design-photos';
import { designRng } from './design-random';

/**
 * Which decorated template a page of the auto layout is laid on.
 *
 * A book is in a theme, and a theme belongs to one of the twelve archetypes
 * the templates are drawn in (`THEME_ARCHETYPE`). Its pages are picked from
 * that archetype's templates and from those of the archetypes that sit well
 * beside it (`ARCHETYPE_KIN`), by what a page holds: how many photos, whether
 * a story has to fit, whether the stop can draw a map. Templates that would
 * leave an empty frame, lose the story or repeat the page before are never
 * candidates; of the rest the best is taken, the theme's own first, its
 * story fitting its body, its first frame the shape of the first photo, not
 * one used a few pages back, and calm where the book should breathe. Equal
 * ones are chosen by the design's seed, so the same journey and seed give the
 * same book and another seed another.
 */

/** The archetype each built-in theme's pages are drawn in. */
export const THEME_ARCHETYPE: Readonly<Record<BookThemeId, BookCoverArchetype>> = {
  'poster-pop': 'poster-pop',
  tropical: 'poster-pop',
  cutout: 'cutout',
  postcard: 'postcard',
  riviera: 'postcard',
  'fabric-classic': 'spine-band',
  alpine: 'spine-band',
  'minimal-serif': 'minimal-serif',
  nordic: 'minimal-serif',
  'grid-badge': 'grid-badge',
  'scrapbook-script': 'stamp-collage',
  'india-stamp': 'stamp-collage',
  riso: 'riso',
  magazine: 'editorial',
  'retro-travel': 'vintage-poster',
  midnight: 'night-film',
  'field-notes': 'field-notes',
};

/** The archetypes whose spreads sit well in a book of another, nearest first. */
export const ARCHETYPE_KIN: Readonly<Record<BookCoverArchetype, readonly BookCoverArchetype[]>> = {
  'spine-band': ['minimal-serif', 'postcard'],
  'poster-pop': ['cutout', 'riso', 'stamp-collage'],
  cutout: ['poster-pop', 'riso'],
  postcard: ['vintage-poster', 'spine-band'],
  'grid-badge': ['minimal-serif', 'stamp-collage'],
  'minimal-serif': ['editorial', 'spine-band'],
  'stamp-collage': ['field-notes', 'postcard'],
  riso: ['poster-pop', 'cutout'],
  editorial: ['minimal-serif', 'grid-badge'],
  'vintage-poster': ['postcard', 'stamp-collage'],
  'night-film': ['editorial', 'minimal-serif'],
  'field-notes': ['stamp-collage', 'spine-band'],
};

/** The archetype a book without a recognisable theme takes. */
const FALLBACK_ARCHETYPE: BookCoverArchetype = 'spine-band';

/**
 * The archetype of a book's theme: a built-in theme's own; a theme of the
 * book's own (no id) that of the built-in one whose faces it still sets,
 * else the calm bookish one.
 */
export function archetypeOfTheme(theme: BookTheme | null | undefined): BookCoverArchetype {
  if (!theme) return FALLBACK_ARCHETYPE;
  if (theme.id) return THEME_ARCHETYPE[theme.id];
  const kin = BOOK_THEME_PRESETS.find(
    (p) => p.fonts.display.font === theme.fonts.display.font && p.fonts.heading.font === theme.fonts.heading.font,
  );
  return kin ? THEME_ARCHETYPE[kin.id] : FALLBACK_ARCHETYPE;
}

/** How loud a template is, from its tags: a loud poster, a lively collage, a graphic grid, a calm page. */
type TemplateEnergy = 'loud' | 'lively' | 'medium' | 'calm';

/** A template's energy. Graphic pages, and the few drawn without a word for it, count as medium. */
export function templateEnergy(tpl: Pick<BookDecoratedTemplate, 'tags'>): TemplateEnergy {
  if (tpl.tags.includes('loud')) return 'loud';
  if (tpl.tags.includes('lively')) return 'lively';
  if (tpl.tags.includes('calm') && !tpl.tags.includes('graphic')) return 'calm';
  return 'medium';
}

const isLoud = (e: TemplateEnergy | undefined) => e === 'loud';
const isBusy = (e: TemplateEnergy | undefined) => e === 'loud' || e === 'lively';

/** A page format and theme as a cache key: what a laid template's measures depend on. */
const formatKey = (page: BookPageSetup, theme: BookTheme | null | undefined) =>
  `${page.pageWidth}x${page.pageHeight}|${theme?.fonts.body.font ?? '-'}|${theme?.fonts.body.weight ?? '-'}`;

/** Words of an ordinary length, to measure a body frame by. */
const FILLER =
  'We left early and walked along the water while the town woke up, stopped for coffee, ' +
  'and found the road that runs up the hill to the old walls and the view over the bay. ';

const laidBodies = new Map<string, BookTextElement | null>();

/** The body text of a template as it is laid on this format in this theme, empty; null without one. */
function laidBody(tpl: BookDecoratedTemplate, page: BookPageSetup, theme: BookTheme | null | undefined) {
  const key = `${tpl.id}|${formatKey(page, theme)}`;
  if (laidBodies.has(key)) return laidBodies.get(key) ?? null;
  let n = 0;
  const laid = layDecoratedTemplate(tpl, page, theme ?? null, (p) => `${p}${++n}`);
  const found = laid.find((l) => l.role === 'body' && l.el.kind === 'text')?.el;
  const body = found?.kind === 'text' ? (theme ? themedElement(found, theme) : found) : null;
  laidBodies.set(key, body);
  return body;
}

/** Whether these words fit a laid body frame as it is set. */
function fitsBody(body: BookTextElement, words: string): boolean {
  return textHeightNeeded({ ...body, text: words }, DESIGN_TEXT_HEADROOM) <= body.frame.h;
}

const capacities = new Map<string, number>();

/**
 * How many characters of ordinary running text a template's story frame
 * holds on this page format in this theme's body face: 0 for a template
 * without one. Measured once per template, format and face.
 */
export function bodyCapacity(tpl: BookDecoratedTemplate, page: BookPageSetup, theme?: BookTheme | null): number {
  const key = `${tpl.id}|${formatKey(page, theme)}`;
  const known = capacities.get(key);
  if (known !== undefined) return known;
  const body = laidBody(tpl, page, theme);
  let lo = 0;
  if (body) {
    let hi = 4000;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fitsBody(body, FILLER.repeat(Math.ceil(mid / FILLER.length)).slice(0, mid))) lo = mid;
      else hi = mid - 1;
    }
  }
  capacities.set(key, lo);
  return lo;
}

/** The parts a page of photos is cut into: how many photos each takes, the first one carrying the words. */
interface PhotoChunking {
  sizes: number[];
  /** Photos that find no frame: noted and parked, never lost. */
  parked: number;
}

/** What a chunking may use: the photo counts of the templates there are, those with a story frame apart. */
export interface ChunkSizes {
  any: ReadonlySet<number>;
  story: ReadonlySet<number>;
  /**
   * What a page of this many photos costs beyond being a page: its story cut
   * short when it is the first, a template from outside the book's own pool.
   */
  pageCost?: (size: number, first: boolean) => number;
}

/** A spread costs this much, and every photo left without a frame more. */
const SPREAD_COST = 10;
const PARKED_COST = 15;
/** The most spreads one entry's photos are cut into. */
const MOST_CHUNKS = 3;

/**
 * An entry's photos cut into page-sized parts that leave no frame empty,
 * as few pages and as few photos without a frame as there can be: every
 * spread costs 10, every photo left over 15, and the first part, which
 * carries the story, is one a story template takes. Of two equal cuts the
 * more even one is kept, so twelve photos make six and six rather than ten
 * and two.
 */
export function chunkPhotos(n: number, hasStory: boolean, sizes: ChunkSizes): PhotoChunking {
  type Plan = { sizes: number[]; cost: number; parked: number };
  const firsts = [...(hasStory ? sizes.story : sizes.any)].filter((s) => s <= n);
  const rest = [...sizes.any].filter((s) => s > 0);
  let best: Plan = { sizes: [], cost: Infinity, parked: n };
  const better = (a: Plan, b: Plan) =>
    a.cost < b.cost ||
    (a.cost === b.cost && Math.max(...a.sizes) - Math.min(...a.sizes) < Math.max(...b.sizes) - Math.min(...b.sizes));
  const walk = (taken: number[], left: number, cost: number) => {
    const plan: Plan = { sizes: taken, cost: cost + left * PARKED_COST, parked: left };
    if (taken.length && (!best.sizes.length || better(plan, best))) best = plan;
    if (taken.length >= MOST_CHUNKS) return;
    const options = taken.length ? rest : firsts;
    for (const s of options) {
      if (s > left || (taken.length && s === 0)) continue;
      const extra = sizes.pageCost?.(s, !taken.length) ?? 0;
      walk([...taken, s], left - s, cost + SPREAD_COST + extra);
    }
  };
  walk([], n, 0);
  return best.sizes.length ? { sizes: best.sizes, parked: best.parked } : { sizes: [], parked: n };
}

/** What a page to be laid holds, as the picker reads it. */
export interface TemplateChunk {
  photos: readonly AutoPhoto[];
  /** The words a story frame must take; empty when the page sets none. */
  story: string;
  /** The stop or the journey has a place a map can draw. */
  mappable: boolean;
}

/** What the picker knows of the book around the page. */
export interface TemplatePickCtx {
  archetype: BookCoverArchetype;
  page: BookPageSetup;
  theme: BookTheme | null | undefined;
  /** Template ids of the spreads laid so far, in order. */
  history: readonly string[];
  /** The book's energy for template choice: a calm book keeps its busy pages few. */
  calm: boolean;
  seed: number;
  /** Names the decision for the seed: the same page of the same journey picks the same. */
  key: string;
  /** Ids never to take here (the page's own on "this spread", its neighbours'). */
  avoid?: readonly string[];
}

const hasRole = (tpl: BookDecoratedTemplate, role: string) => (templateRoles(tpl) as readonly string[]).includes(role);

const slotsOf = new Map<string, number>();
const slots = (tpl: BookDecoratedTemplate) => {
  const known = slotsOf.get(tpl.id);
  if (known !== undefined) return known;
  const n = templatePhotoSlots(tpl);
  slotsOf.set(tpl.id, n);
  return n;
};

/** The inner templates of an archetype and of its kin, the own ones first. */
export function innerPool(archetype: BookCoverArchetype): BookDecoratedTemplate[] {
  return [archetype, ...ARCHETYPE_KIN[archetype]].flatMap((a) => decoratedTemplatesFor('inner', a));
}

/** The photo counts a pool of templates takes, and those of its templates with a story frame. */
export function chunkSizesOf(pool: readonly BookDecoratedTemplate[]): { any: Set<number>; story: Set<number> } {
  return {
    any: new Set(pool.map(slots)),
    story: new Set(pool.filter((t) => hasRole(t, 'body')).map(slots)),
  };
}

/** Whether a template can take this page at all, after the one before it. */
function admits(
  tpl: BookDecoratedTemplate,
  chunk: TemplateChunk,
  ctx: TemplatePickCtx,
  before: TemplateEnergy | undefined,
) {
  return fitsAtAll(tpl, chunk, ctx) && !keepsApart(tpl, ctx, before);
}

/** Whether a template can hold the page: no frame left empty, the story and the map where it has them. */
function fitsAtAll(tpl: BookDecoratedTemplate, chunk: TemplateChunk, ctx: TemplatePickCtx) {
  if (tpl.kind !== 'inner' || slots(tpl) > chunk.photos.length || ctx.avoid?.includes(tpl.id)) return false;
  if (chunk.story && !hasRole(tpl, 'body')) return false;
  return !hasRole(tpl, 'map') || chunk.mappable;
}

/** The rhythm a book keeps where it can: never the page before again, never loud after loud or lively. */
function keepsApart(tpl: BookDecoratedTemplate, ctx: TemplatePickCtx, before: TemplateEnergy | undefined) {
  return ctx.history[ctx.history.length - 1] === tpl.id || (isLoud(templateEnergy(tpl)) && isBusy(before));
}

/** The orientation of a template's first frame on this format: wide, tall or square. */
function firstFrameShape(tpl: BookDecoratedTemplate, page: BookPageSetup): 'wide' | 'tall' | 'square' {
  const el = tpl.elements.find((e) => e.role === 'photo:1');
  if (!el) return 'square';
  const across = el.frame.w * page.pageWidth;
  const down = el.frame.h * page.pageHeight;
  if (across >= down * 1.2) return 'wide';
  return down >= across * 1.1 ? 'tall' : 'square';
}

/** Points for the story: it fits the frame, or it loses in proportion to how far it runs over. */
function storyScore(tpl: BookDecoratedTemplate, chunk: TemplateChunk, ctx: TemplatePickCtx): number {
  if (!chunk.story) return 0;
  const room = bodyCapacity(tpl, ctx.page, ctx.theme);
  if (room >= chunk.story.length) return 10;
  return -Math.min(40, (20 * (chunk.story.length - room)) / Math.max(room, 1));
}

/** What a photo left without a frame costs a template. */
const UNUSED_PHOTO = 60;
/** What a template of an archetype neither the book's nor its kin costs, where only such can take the page. */
const FOREIGN = 25;

/** How well a template suits the page, the higher the better. */
function scoreOf(
  tpl: BookDecoratedTemplate,
  chunk: TemplateChunk,
  ctx: TemplatePickCtx,
  before: TemplateEnergy | undefined,
) {
  // A photo the page has no frame for waits in the tray.
  let score = 100 - UNUSED_PHOTO * (chunk.photos.length - slots(tpl));
  if (tpl.archetype === ctx.archetype) score += 20;
  else if (ARCHETYPE_KIN[ctx.archetype].includes(tpl.archetype)) score += 8;
  else score -= FOREIGN;
  const first = chunk.photos[0];
  const shape = firstFrameShape(tpl, ctx.page);
  if (first && ((shape === 'wide' && isLandscape(first)) || (shape === 'tall' && isPortrait(first)))) score += 6;
  score += storyScore(tpl, chunk, ctx);
  const recent = ctx.history.slice(-3);
  if (recent.includes(tpl.id)) score -= 40;
  score -= 8 * ctx.history.slice(0, -3).filter((id) => id === tpl.id).length;
  const energy = templateEnergy(tpl);
  if ((ctx.calm || isBusy(before)) && isBusy(energy)) score -= 30;
  return score;
}

/** Scores this close count as equal, and the seed chooses among them. */
const TIE = 5;

/** The best of scored templates, equals chosen by the seed. */
function bestOf(scored: { tpl: BookDecoratedTemplate; score: number }[], seed: number, key: string) {
  if (!scored.length) return undefined;
  const top = Math.max(...scored.map((s) => s.score));
  const near = scored.filter((s) => s.score >= top - TIE).map((s) => s.tpl);
  return designRng(seed, key).pick(near);
}

/** The energy of the template a page was laid on, by its id. */
function energyOfId(pool: readonly BookDecoratedTemplate[], id: string | undefined): TemplateEnergy | undefined {
  const tpl = id ? pool.find((t) => t.id === id) : undefined;
  return tpl ? templateEnergy(tpl) : undefined;
}

/**
 * The template a page is laid on. A frame for every photo comes first, then
 * the book's own styles (its archetype and its kin), then the rhythm:
 *
 * 1. the own styles, every photo framed, the rhythm kept;
 * 2. the own styles, every photo framed, the rhythm given up for this page;
 * 3. another archetype, every photo framed, the rhythm kept;
 * 4. the own styles with a photo left to wait in the tray;
 * 5. whatever can take the page at all.
 *
 * Undefined when nothing can.
 */
export function pickInnerTemplate(chunk: TemplateChunk, ctx: TemplatePickCtx): BookDecoratedTemplate | undefined {
  const all = decoratedTemplatesFor('inner');
  const own = innerPool(ctx.archetype);
  const before = energyOfId(all, ctx.history[ctx.history.length - 1]);
  const full = (t: BookDecoratedTemplate) => slots(t) === chunk.photos.length;
  const kept = (t: BookDecoratedTemplate) => admits(t, chunk, ctx, before);
  const held = (t: BookDecoratedTemplate) => fitsAtAll(t, chunk, ctx);
  const tiers: [readonly BookDecoratedTemplate[], (t: BookDecoratedTemplate) => boolean][] = [
    [own, (t) => full(t) && kept(t)],
    [own, (t) => full(t) && held(t)],
    [all, (t) => full(t) && kept(t)],
    [own, kept],
    [all, held],
  ];
  for (const [pool, takes] of tiers) {
    const scored = pool.filter(takes).map((tpl) => ({ tpl, score: scoreOf(tpl, chunk, ctx, before) }));
    if (scored.length) return bestOf(scored, ctx.seed, ctx.key);
  }
  return undefined;
}

/** What a cover may be laid with: how many photos there are, and whether the cover photo stands tall. */
interface CoverPick {
  archetype: BookCoverArchetype;
  photos: number;
  portrait: boolean;
  seed: number;
  /** Ids never to take (the cover on screen, on "this spread"). */
  avoid?: readonly string[];
}

const PORTRAIT_COVER = /-portrait$|^cutout-/;

/**
 * The cover template of an archetype for the photos there are: one that
 * leaves no frame empty and fills the most of them, a tall one for a tall
 * cover photo, equals chosen by the seed. Undefined when the archetype has
 * none to take them, for the composed cover to stand in.
 */
export function pickCoverTemplate(p: CoverPick): BookDecoratedTemplate | undefined {
  const scored = decoratedTemplatesFor('single', p.archetype)
    .filter((t) => slots(t) <= p.photos && !p.avoid?.includes(t.id))
    // Without a photo only a cover drawn for none stands; a photo frame left empty does not.
    .filter((t) => p.photos > 0 || slots(t) === 0)
    .map((tpl) => {
      const tall = PORTRAIT_COVER.test(tpl.id);
      return { tpl, score: slots(tpl) * 10 + (tall === p.portrait ? 8 : 0) };
    });
  return bestOf(scored, p.seed, `cover:${p.archetype}`);
}
