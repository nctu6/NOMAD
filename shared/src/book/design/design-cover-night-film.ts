import { luminance, parseHex } from '../book-colour';
import { solveBookTextFit } from '../book-text-fit';
import type { BookElement, BookFrame, BookLineElement, BookTextElement } from '../book.schema';
import { mixHex } from '../theme/book-theme';
import { frameOf } from './design-compose';
import {
  accentOn,
  addLockup,
  bandPhoto,
  coverText,
  inkOn,
  mmOn,
  mmToPt,
  printEl,
  shapeEl,
  spacedLine,
  titleText,
  type CoverDraft,
  type CoverKit,
} from './design-cover-kit';

/**
 * Night film: a dark cinematic page. The month and the place in mono in the
 * neon accent above a letterboxed still to the bleed, the title in tall
 * condensed capitals widely spaced with a short neon rule, and across the
 * foot a strip of film, its sprocket holes two dashed lines, holding the
 * next photos as frames.
 */

const lum = (hex: string) => luminance(parseHex(hex) ?? { r: 255, g: 255, b: 255 });

/** The page's near black: the darker of the paper and the ink, taken towards black until it is one. */
function nightOf(paper: string, ink: string): string {
  let night = lum(paper) <= lum(ink) ? paper : ink;
  for (let step = 0; step < 8 && lum(night) > 0.012; step++) night = mixHex(night, '#000000', 0.35);
  return night;
}

/** A straight dashed line across a frame, as a row of sprocket holes. */
function sprockets(k: CoverKit, frame: BookFrame, stroke: string): BookLineElement {
  return {
    id: k.c.newId('l'),
    kind: 'line',
    frame,
    rotation: 0,
    opacity: 1,
    locked: false,
    points: [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    ],
    curve: 'straight',
    stroke,
    strokeWidth: Math.round(frame.h * 100) / 100,
    dash: 'dashed',
    squiggle: 'none',
    startCap: 'none',
    endCap: 'none',
    wobble: 0,
    ornament: 'none',
  };
}

/** A line in mono, as a timecode is printed on the edge of a film. */
function monoLine(
  k: CoverKit,
  words: string,
  frame: BookFrame,
  color: string,
  align: 'left' | 'right',
): BookTextElement {
  const text = coverText(k, words, frame, { slot: 'heading', max: 8, color, align, tracking: 0.2 });
  const mono: BookTextElement = { ...text, font: 'mono', weight: 500, transform: 'upper', fitMax: 8 };
  return { ...mono, size: solveBookTextFit(mono, 8) };
}

export function nightFilm(k: CoverKit): CoverDraft {
  const { c, W, H, b, m } = k;
  const night = nightOf(c.look.paper, c.look.ink);
  const draft: CoverDraft = { elements: [], groups: [], ...(night === c.look.paper ? {} : { background: night }) };
  const light = inkOn(c, night);
  const neon = accentOn(c, night);
  // Down the page: the timecode line, the still, the title, the strip.
  const metaH = mmOn(k, 6);
  const stillY = m + metaH + mmOn(k, 4);
  const stillH = Math.min(H * k.rng.range(0.36, 0.42), W * 0.46);
  const rest = H - m - (stillY + stillH) - mmOn(k, 12);
  const stripH = Math.min(rest * 0.5, W * 0.24);
  const stripY = H - m - stripH;
  const titleY = stillY + stillH + mmOn(k, 6);
  const titleBox = frameOf(m, titleY, W - m * 2, stripY - mmOn(k, 6) - titleY);
  const [photo, ...more] = k.photos;
  if (photo) draft.elements.push(bandPhoto(k, photo, frameOf(-b, stillY, W + b * 2, stillH)));
  // The film: a band a shade off the night, sprockets along both edges, the frames between them.
  const film = mixHex(night, light, 0.1);
  const hole = Math.max(0.6, stripH * 0.09);
  draft.elements.push(
    shapeEl(k, 'rect', frameOf(-b, stripY, W + b * 2, stripH), film),
    sprockets(k, frameOf(-b, stripY + stripH * 0.12 - hole / 2, W + b * 2, hole), mixHex(light, film, 0.3)),
    sprockets(k, frameOf(-b, stripY + stripH * 0.88 - hole / 2, W + b * 2, hole), mixHex(light, film, 0.3)),
  );
  const frames = more.slice(0, 3);
  const gap = mmOn(k, 3);
  const fw = frames.length ? (W - m * 2 - gap * (frames.length - 1)) / frames.length : 0;
  frames.forEach((p, i) => {
    draft.elements.push(printEl(k, p, frameOf(m + i * (fw + gap), stripY + stripH * 0.22, fw, stripH * 0.56)));
  });
  const meta: BookElement[] = [];
  const when = k.words.dates || k.words.year || '';
  const place = k.words.place ?? '';
  const half = (W - m * 2) / 2 - mmOn(k, 2);
  if (when) meta.push(monoLine(k, when, frameOf(m, m, half, metaH), neon, 'left'));
  if (place && place !== when) meta.push(monoLine(k, place, frameOf(W - m - half, m, half, metaH), neon, 'right'));
  draft.elements.push(...meta);
  if (meta.length > 1) draft.groups.push(meta.map((e) => e.id));
  if (addLockup(k, draft, { box: titleBox, ground: night }).length) return draft;
  const head: BookElement[] = [];
  const sub = k.sub.words.trim();
  const subH = sub ? mmOn(k, 7) : 0;
  if (k.title.words.trim()) {
    const box = frameOf(titleBox.x, titleBox.y, titleBox.w, titleBox.h - subH - mmOn(k, 3));
    head.push(
      titleText(k, box, {
        max: mmToPt(box.h * 0.85),
        color: light,
        transform: 'upper',
        tracking: 0.14,
        leading: 0.9,
        align: 'left',
      }),
    );
  }
  const ruleY = titleBox.y + titleBox.h - subH - mmOn(k, 1.5);
  head.push(shapeEl(k, 'rect', frameOf(m, ruleY, W * 0.16, Math.max(0.6, mmOn(k, 0.8))), neon));
  if (sub) {
    const line = spacedLine(k, sub, frameOf(m, titleBox.y + titleBox.h - subH, W * 0.6, subH), neon, 9);
    head.push({ ...line, align: 'left', ...(k.sub.bound ? { binding: { source: 'journey.subtitle' as const } } : {}) });
  }
  draft.elements.push(...head);
  if (head.length > 1) draft.groups.push(head.map((e) => e.id));
  return draft;
}
