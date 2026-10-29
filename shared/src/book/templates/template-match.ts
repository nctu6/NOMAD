import type { BookElement, BookPageSetup, BookSpread } from '../book.schema';
import { layDecoratedTemplate } from './template-apply';
import { BOOK_DECORATED_TEMPLATES } from './template-catalogue';
import type { BookDecoratedTemplate } from './template-format';

/**
 * Which decorated template a laid page is, read from the page alone.
 *
 * A template keeps its frames where it pours: the photo frames, the role
 * texts and the design (panels, shapes, lines, stickers) all land where the
 * template put them on this page's format. So a page is fingerprinted by its
 * elements' kinds and frames, rounded to the millimetre, and compared with
 * every template laid on the same format: a template is the page's when
 * nearly all of its design is there, and of those the one that explains the
 * most of the page wins. A page somebody rearranged by hand matches none.
 *
 * Nothing depends on the answer being right: the auto layout's "this spread"
 * uses it to offer another template than the one on screen, and at worst
 * offers that one again.
 */

/** The share of a template's design elements a page must hold to be that template. */
const DESIGN_SHARE = 0.8;
/** The share of the page's own elements the template must explain: a template of little design is no excuse. */
const PAGE_SHARE = 0.6;

/** A photo frame, and a map laid as one when it had nothing to draw, read alike. */
const kindKey = (kind: BookElement['kind']) => (kind === 'map' ? 'photo' : kind);

const keyOf = (el: BookElement) => {
  const f = el.frame;
  return [kindKey(el.kind), Math.round(f.x), Math.round(f.y), Math.round(f.w), Math.round(f.h)].join(':');
};

interface Fingerprint {
  /** Every laid element, its role's ones included. */
  all: string[];
  /** The design alone: what no page's content changes. */
  design: string[];
}

const laidPrints = new Map<string, Fingerprint>();

/** A template's fingerprint on a page format, laid once per format. */
function printOf(tpl: BookDecoratedTemplate, page: BookPageSetup): Fingerprint {
  const key = `${tpl.id}|${page.pageWidth}x${page.pageHeight}|${page.bleed}`;
  const known = laidPrints.get(key);
  if (known) return known;
  let n = 0;
  const laid = layDecoratedTemplate(tpl, page, null, (p) => `${p}${++n}`);
  const print = { all: laid.map((l) => keyOf(l.el)), design: laid.filter((l) => !l.role).map((l) => keyOf(l.el)) };
  laidPrints.set(key, print);
  return print;
}

/** How many of `want` the multiset `have` holds. */
function held(want: readonly string[], have: ReadonlyMap<string, number>): number {
  const left = new Map(have);
  let found = 0;
  for (const k of want) {
    const n = left.get(k) ?? 0;
    if (n > 0) {
      left.set(k, n - 1);
      found++;
    }
  }
  return found;
}

/** The decorated template a page was laid on, or undefined when it reads as none. */
export function matchDecoratedTemplate(spread: BookSpread, page: BookPageSetup): BookDecoratedTemplate | undefined {
  const own = spread.elements.filter((e) => !e.locked);
  if (!own.length) return undefined;
  const have = new Map<string, number>();
  for (const el of own) have.set(keyOf(el), (have.get(keyOf(el)) ?? 0) + 1);
  const kind = spread.role === 'inner' ? 'inner' : 'single';
  let best: { tpl: BookDecoratedTemplate; explained: number; found: number } | undefined;
  for (const tpl of BOOK_DECORATED_TEMPLATES) {
    if (tpl.kind !== kind) continue;
    const print = printOf(tpl, page);
    const design = held(print.design, have);
    if (design < print.design.length * DESIGN_SHARE) continue;
    const found = held(print.all, have);
    const explained = found / own.length;
    if (explained < PAGE_SHARE) continue;
    if (!best || explained > best.explained || (explained === best.explained && found > best.found)) {
      best = { tpl, explained, found };
    }
  }
  return best?.tpl;
}
