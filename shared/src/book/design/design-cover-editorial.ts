import type { BookElement, BookFrame, BookPhotoElement, BookTextElement } from '../book.schema';
import { frameOf } from './design-compose';
import {
  addLockup,
  bandPhoto,
  coverText,
  deepened,
  inkOn,
  mmOn,
  mmToPt,
  shapeEl,
  spacedLine,
  standOut,
  titleText,
  type CoverDraft,
  type CoverKit,
} from './design-cover-kit';

/**
 * Editorial: the cover of a travel magazine. The title as a huge masthead
 * across the top of the paper, a thin rule under it with the issue line (the
 * month on the left, the place on the right), the cover photo edge to edge
 * below (a field of colour without one), and the subtitle as the cover line
 * on a block of the accent in a lower corner, off the picture's detail.
 */

const holds = (b: BookFrame, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/** A short line of spaced capitals set flush to one side. */
function issueLine(
  k: CoverKit,
  words: string,
  frame: BookFrame,
  color: string,
  align: 'left' | 'right',
): BookTextElement {
  return { ...spacedLine(k, words, frame, color, 8), align };
}

/** Where the cover line's block may lie: the lower left corner, else the lower right, clear of the photo's detail. */
function coverLineBox(k: CoverKit, print: BookPhotoElement | null, w: number, h: number): BookFrame | null {
  const { W, H, m } = k;
  const corners = [frameOf(m, H - m - h, w, h), frameOf(W - m - w, H - m - h, w, h)];
  if (!print) return corners[0] ?? null;
  const fx = print.frame.x + print.focalX * print.frame.w;
  const fy = print.frame.y + print.focalY * print.frame.h;
  return corners.find((b) => !holds(frameOf(b.x - 3, b.y - 3, b.w + 6, b.h + 6), fx, fy)) ?? null;
}

export function editorial(k: CoverKit): CoverDraft {
  const { c, W, H, b, m } = k;
  const draft: CoverDraft = { elements: [], groups: [] };
  const ground = c.look.paper;
  const ink = inkOn(c, ground);
  const mast = H * k.rng.range(0.24, 0.28);
  const zone = frameOf(m, m, W - m * 2, mast - m);
  const ruleY = mast + mmOn(k, 1.5);
  const lineY = ruleY + mmOn(k, 2);
  const lineH = mmOn(k, 6);
  const top = lineY + lineH + mmOn(k, 3);
  const photo = k.photos[0];
  const print = photo ? bandPhoto(k, photo, frameOf(-b, top, W + b * 2, H - top + b)) : null;
  // Without a photo its place is a field of colour, as a magazine prints a cover of type alone.
  draft.elements.push(print ?? shapeEl(k, 'rect', frameOf(-b, top, W + b * 2, H - top + b), standOut(c, ground)));
  const head: BookElement[] = [];
  const asked = addLockup(k, draft, { box: zone, ground });
  if (!asked.length && k.title.words.trim()) {
    head.push(
      titleText(k, zone, {
        max: mmToPt(zone.h * 0.82),
        color: ink,
        transform: 'upper',
        leading: 0.9,
        weight: 800,
      }),
    );
  }
  const thin = Math.max(0.3, mmOn(k, 0.4));
  head.push(shapeEl(k, 'rect', frameOf(m, ruleY, W - m * 2, thin), ink));
  const half = (W - m * 2) / 2 - mmOn(k, 2);
  const left = k.words.dates || k.words.year || '';
  const place = k.words.place ?? '';
  if (left) head.push(issueLine(k, left, frameOf(m, lineY, half, lineH), ink, 'left'));
  if (place && place !== left) head.push(issueLine(k, place, frameOf(W - m - half, lineY, half, lineH), ink, 'right'));
  draft.elements.push(...head);
  if (head.length > 1) draft.groups.push(head.map((e) => e.id));
  // The cover line: the subtitle on a block of the accent over the photo, or on the paper without one.
  const sub = k.sub.words.trim();
  if (!sub || asked.length) return draft;
  const bw = W * k.rng.range(0.42, 0.5);
  const bh = Math.min(mmOn(k, 30), (H - top) * 0.36);
  const box = coverLineBox(k, print, bw, bh);
  if (!box) return draft;
  const block = deepened(print ? standOut(c, ground) : inkOn(c, ground));
  const pad = mmOn(k, 4);
  const words = coverText(k, sub, frameOf(box.x + pad, box.y + pad, box.w - pad * 2, box.h - pad * 2), {
    slot: 'heading',
    max: 16,
    color: inkOn(c, block),
    align: 'left',
    leading: 1.1,
  });
  const line = k.sub.bound ? { ...words, binding: { source: 'journey.subtitle' as const } } : words;
  const parts = [shapeEl(k, 'rect', box, block), line];
  draft.elements.push(...parts);
  draft.groups.push(parts.map((e) => e.id));
  return draft;
}
