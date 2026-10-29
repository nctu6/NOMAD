import { luminance, parseHex } from '../book-colour';
import type { BookElement, BookFrame } from '../book.schema';
import { CALM_ART } from './design-art';
import { frameOf } from './design-compose';
import {
  addLockup,
  clearOfTrim,
  deepened,
  inkOn,
  keptTurn,
  mmOn,
  mmToPt,
  onBand,
  printEl,
  shapeEl,
  spacedLine,
  standOut,
  titleText,
  type CoverDraft,
  type CoverKit,
} from './design-cover-kit';
import { placeStickers, turnedBox } from './design-stickers';

/**
 * Riso print: a page printed in two or three spot inks, each a little out of
 * register with the next. A disc of one ink and a halftone disc of another
 * laid over it off centre, the cover photo as a duotone of the book's ink on
 * a block of the first ink that shows past its edge, the title in heavy
 * capitals with a hard shadow of that ink beside it, the subtitle and the
 * year on bands of their own, and a few doodles.
 */

/** The darker and the lighter of two colours, for a duotone that keeps its tones the right way round in any theme. */
function tonesOf(a: string, b: string): { dark: string; light: string } {
  const lum = (h: string) => luminance(parseHex(h) ?? { r: 255, g: 255, b: 255 });
  return lum(a) <= lum(b) ? { dark: a, light: b } : { dark: b, light: a };
}

/** A box moved down until it starts below `top`, or left where it is. */
const below = (box: BookFrame, top: number): BookFrame => (box.y >= top ? box : { ...box, y: top });

export function riso(k: CoverKit): CoverDraft {
  const { c, W, H, m } = k;
  const draft: CoverDraft = { elements: [], groups: [] };
  const ground = c.look.paper;
  const first = standOut(c, ground);
  const second = standOut(c, ground, [first]);
  const titleZone = frameOf(m, m, W - m * 2, H * 0.3);
  const titleFoot = titleZone.y + titleZone.h + mmOn(k, 12);
  const photo = k.photos[0];
  const pw = W * k.rng.range(0.5, 0.56);
  const ph = Math.min(H * 0.46, H - m - titleFoot);
  const at = frameOf(W - m - pw - k.rng.range(0, 0.04) * W, H - m - ph, pw, ph);
  // The two inks of the discs, the second laid over the first a few millimetres off.
  const d = Math.min(W, H) * k.rng.range(0.5, 0.6);
  const miss = mmOn(k, k.rng.range(3, 5));
  const disc = clearOfTrim(k, below(frameOf(at.x - d * 0.45, at.y + at.h * 0.35 - d / 2, d, d), titleFoot));
  const solid = shapeEl(k, 'ellipse', disc, second);
  const dots = shapeEl(k, 'ellipse', clearOfTrim(k, frameOf(disc.x + miss, disc.y - miss, d, d)), first);
  const scale = Math.round(k.rng.range(0.35, 0.5) * 100) / 100;
  draft.elements.push(
    { ...solid, opacity: 0.85 },
    { ...dots, paint: { type: 'pattern', pattern: 'dots', fg: first, bg: null, scale, angle: 45 } },
  );
  let photoBox: BookFrame | null = null;
  if (photo) {
    const turn = keptTurn(k, k.rng.sign() * k.rng.range(1.5, 3));
    const print = printEl(k, photo, at, { turn });
    const shift = mmOn(k, k.rng.range(2.5, 4));
    const offset = frameOf(print.frame.x - shift, print.frame.y + shift, print.frame.w, print.frame.h);
    const block = shapeEl(k, 'rect', offset, first, print.rotation);
    draft.elements.push(block, { ...print, duotone: tonesOf(c.look.ink, c.look.paper) });
    photoBox = turnedBox(offset, print.rotation);
  }
  const ink = inkOn(c, ground);
  const head: BookElement[] = [];
  if (!addLockup(k, draft, { box: titleZone, ground }).length) {
    if (k.title.words.trim()) {
      const title = titleText(k, titleZone, {
        max: mmToPt(titleZone.h / 2 / 0.95),
        color: ink,
        transform: 'upper',
        leading: 0.92,
        weight: 800,
        align: 'left',
      });
      const dx = mmOn(k, 1.6);
      head.push({ ...title, shadow: { dx, dy: dx, color: first, alpha: 1 } });
    }
    const sub = k.sub.words.trim();
    if (sub) {
      const line = spacedLine(k, sub, frameOf(m, titleZone.y + titleZone.h + mmOn(k, 3), W * 0.5, mmOn(k, 7)), ink, 10);
      const bound = k.sub.bound ? { ...line, binding: { source: 'journey.subtitle' as const } } : line;
      head.push(onBand(k, { ...bound, align: 'left' }, ground));
    }
    draft.elements.push(...head);
    if (head.length > 1) draft.groups.push(head.map((t) => t.id));
  }
  const year = k.words.year ?? '';
  // The year on a band of the second ink at the foot, left of the photo and its block, deepened
  // where a mid-tone ink would not carry a small line.
  const room = (photoBox ? photoBox.x : W - m) - m - mmOn(k, 4);
  if (year && room > mmOn(k, 18)) {
    const frame = frameOf(m, H - m - mmOn(k, 7), Math.min(room, mmOn(k, 40)), mmOn(k, 7));
    draft.elements.push(onBand(k, { ...spacedLine(k, year, frame, ink, 9), align: 'left' }, deepened(second)));
  }
  const count = (c.art ?? CALM_ART).bare ? 0 : k.rng.int(2, 4);
  draft.elements.push(
    ...placeStickers(c, draft.elements, {
      count,
      size: [0.1, 0.16],
      sides: ['single'],
      key: 'cover:riso',
      avoid: [titleZone],
      used: c.art?.used,
    }),
  );
  return draft;
}
