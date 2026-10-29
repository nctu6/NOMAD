import { deltaE, luminance, parseHex } from '../book-colour';
import { solveBookTextFit } from '../book-text-fit';
import type { BookElement, BookFrame, BookPhotoElement, BookShapeId, BookTextElement } from '../book.schema';
import { mixHex } from '../theme/book-theme';
import { CALM_ART } from './design-art';
import { frameOf } from './design-compose';
import {
  accentOn,
  addLockup,
  clearOfTrim,
  coverText,
  inkOn,
  keptTurn,
  mmOn,
  mmToPt,
  printEl,
  shapeEl,
  titleText,
  type CoverDraft,
  type CoverKit,
} from './design-cover-kit';
import { placeStickers, sharedArea, turnedBox } from './design-stickers';

/**
 * Field notes: a page of a traveller's notebook. A sheet of squared paper
 * laid a little askew on the kraft, the photos taped in as prints turned a
 * few degrees each way with a strip of tape over their top edge, pressed
 * leaves beside them, and under them the title in the display face, the
 * subtitle (or the place) in the script, and the dates in mono.
 */

const WHITE = '#ffffff';
const lum = (hex: string) => luminance(parseHex(hex) ?? { r: 255, g: 255, b: 255 });

/** The sheet's paper: a light colour of the palette apart from the page, else the page lightened. */
function sheetOf(paper: string, accent2: string): string {
  const tried = [accent2, mixHex(paper, WHITE, 0.6), '#f8f4ea'];
  return tried.find((h) => lum(h) >= 0.72 && deltaE(h, paper) > 6) ?? '#f8f4ea';
}

/** Where the prints go, as shares of the page: a large one, one beside it and a small one under that. */
const SPOTS: readonly [number, number, number, number][] = [
  [0.1, 0.1, 0.48, 0.4],
  [0.62, 0.17, 0.28, 0.27],
  [0.6, 0.5, 0.3, 0.22],
];

const LEAVES: readonly BookShapeId[] = ['leaf-long', 'leaf-oak', 'leaf'];

export function fieldNotes(k: CoverKit): CoverDraft {
  const { c, W, H, m } = k;
  const p = c.look.theme.palette;
  const draft: CoverDraft = { elements: [], groups: [] };
  const sheet = sheetOf(c.look.paper, p.accent2);
  const ink = inkOn(c, sheet);
  const tilt = -k.rng.range(1, 2.5);
  const inset = m * 0.55;
  const sheetFrame = clearOfTrim(k, frameOf(inset, inset, W - inset * 2, H - inset * 2), tilt);
  const lines = mixHex(ink, sheet, 0.86);
  const scale = Math.round(k.rng.range(0.55, 0.7) * 100) / 100;
  draft.elements.push({
    ...shapeEl(k, 'rect', sheetFrame, sheet, tilt),
    paint: { type: 'pattern', pattern: 'grid', fg: lines, bg: sheet, scale, angle: 0 },
  });
  // The words take the foot of the sheet, left of the small print.
  const top = H * 0.62;
  const zone = frameOf(m, top, W * 0.54 - m, H - m - top);
  const leaf = p.accent3;
  const placed: BookFrame[] = [];
  const prints: BookPhotoElement[] = [];
  k.photos.slice(0, SPOTS.length).forEach((photo, i) => {
    const [x, y, w, h] = SPOTS[i] as [number, number, number, number];
    const turn = keptTurn(k, (i % 2 === 0 ? -1 : 1) * k.rng.range(2, 4));
    const print = printEl(k, photo, frameOf(W * x, H * y, W * w, H * h), {
      turn,
      border: { width: mmOn(k, 2.6), color: WHITE },
      shadow: true,
    });
    const box = turnedBox(print.frame, print.rotation);
    if (placed.some((o) => sharedArea(o, box) > 0) || sharedArea(box, zone) > 0) return;
    placed.push(box);
    prints.push(print);
  });
  // Pressed leaves on the sheet, behind the prints and clear of the words.
  const leaves: BookElement[] = [];
  const spots: [number, number][] = [
    [W * 0.07, H * 0.5],
    [W * 0.9, H * 0.86],
  ];
  k.rng
    .shuffle(LEAVES)
    .slice(0, spots.length)
    .forEach((shape, i) => {
      const [cx, cy] = spots[i] as [number, number];
      const size = Math.min(W, H) * k.rng.range(0.16, 0.22);
      const turn = k.rng.range(-40, 40);
      const frame = clearOfTrim(k, frameOf(cx - size / 2, cy - size / 2, size, size), turn);
      if (sharedArea(turnedBox(frame, turn), zone) > 0) return;
      leaves.push({ ...shapeEl(k, shape, frame, leaf, turn), opacity: 0.9 });
    });
  draft.elements.push(...leaves);
  // Each print with its strip of tape over the top edge, the tape see-through so the picture shows under it.
  const tape = mixHex(sheet, c.look.accent, 0.22);
  for (const print of prints) {
    const tw = print.frame.w * 0.4;
    const th = mmOn(k, 7);
    const frame = frameOf(print.frame.x + (print.frame.w - tw) / 2, print.frame.y - th / 2, tw, th);
    const strip = { ...shapeEl(k, 'rect', frame, tape, print.rotation + k.rng.range(-7, 7)), opacity: 0.72 };
    const parts = [print, { ...strip, edge: 'zigzag' as const, edgeSize: mmOn(k, 1) }];
    draft.elements.push(...parts);
    draft.groups.push(parts.map((e) => e.id));
  }
  if (!addLockup(k, draft, { box: zone, ground: sheet }).length) notes(k, draft, zone, sheet, ink);
  const count = (c.art ?? CALM_ART).bare ? 0 : k.rng.int(1, 3);
  draft.elements.push(
    ...placeStickers(c, draft.elements, {
      count,
      size: [0.1, 0.15],
      sides: ['single'],
      key: 'cover:field-notes',
      avoid: [zone],
      used: c.art?.used,
    }),
  );
  return draft;
}

/** The notebook's own words in a box: the title, a line in the script, the dates in mono at the foot. */
function notes(k: CoverKit, draft: CoverDraft, zone: BookFrame, sheet: string, ink: string): void {
  const words: BookTextElement[] = [];
  const script = k.sub.words.trim() || k.words.place || '';
  const dates = k.words.dates || k.words.year || '';
  const scriptH = script ? Math.min(mmOn(k, 14), zone.h * 0.26) : 0;
  const datesH = dates ? mmOn(k, 6) : 0;
  const titleH = zone.h - scriptH - datesH - mmOn(k, 2);
  if (k.title.words.trim()) {
    const frame = frameOf(zone.x, zone.y, zone.w, titleH);
    words.push(titleText(k, frame, { max: mmToPt(titleH * 0.6), color: ink, align: 'left', leading: 0.95 }));
  }
  if (script) {
    const frame = frameOf(zone.x, zone.y + titleH, zone.w, scriptH);
    const max = k.c.look.theme.fonts.script ? 26 : 14;
    const line = coverText(k, script, frame, { slot: 'script', max, color: accentOn(k.c, sheet), align: 'left' });
    const bound = script === k.sub.words.trim() && k.sub.bound;
    words.push(bound ? { ...line, binding: { source: 'journey.subtitle' } } : line);
  }
  if (dates) {
    const frame = frameOf(zone.x, zone.y + zone.h - datesH, zone.w, datesH);
    const line = coverText(k, dates, frame, { slot: 'heading', max: 8, color: ink, align: 'left', tracking: 0.12 });
    const mono: BookTextElement = { ...line, font: 'mono', weight: 400, fitMax: 8 };
    words.push({ ...mono, size: solveBookTextFit(mono, 8) });
  }
  draft.elements.push(...words);
  if (words.length > 1) draft.groups.push(words.map((e) => e.id));
}
