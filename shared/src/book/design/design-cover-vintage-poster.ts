import { deltaE } from '../book-colour';
import type { BookElement } from '../book.schema';
import { mixHex } from '../theme/book-theme';
import { frameOf } from './design-compose';
import {
  addLockup,
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
 * Vintage poster: a travel poster of the 1950s. A thin rule framing the
 * page, and inside it a scenic panel of flat colour: a sky, a sun with its
 * rays at the horizon, two ranges of mountains and a band of sea, the cover
 * photo standing in an arch before the sun with a white cut edge, and under
 * the panel the title stacked in the display face with the month at the foot.
 */

const WHITE = '#ffffff';

/** A colour of the palette that stands apart from another (delta E over 18), else the fallback. */
const apart = (want: string, from: string, fallback: string) => (deltaE(want, from) > 18 ? want : fallback);

export function vintagePoster(k: CoverKit): CoverDraft {
  const { c, W, H, m } = k;
  const p = c.look.theme.palette;
  const draft: CoverDraft = { elements: [], groups: [] };
  const ground = c.look.paper;
  const ink = inkOn(c, ground);
  const sun = c.look.accent;
  const sky = apart(mixHex(p.accent3, ground, 0.3), sun, mixHex(p.accent2, ground, 0.45));
  const near = apart(p.accent2, sky, mixHex(ink, sky, 0.35));
  const far = mixHex(near, sky, 0.45);
  const sea = mixHex(near, ink, 0.25);
  const hair = Math.max(0.3, mmOn(k, 0.6));
  const edge = mmOn(k, 3.5);
  const border = { ...shapeEl(k, 'rect', frameOf(edge, edge, W - edge * 2, H - edge * 2), ink), fill: null };
  draft.elements.push({ ...border, stroke: ink, strokeWidth: hair });
  const inset = mmOn(k, 7);
  const panel = frameOf(inset, inset, W - inset * 2, H * k.rng.range(0.6, 0.64) - inset);
  const horizon = panel.y + panel.h * k.rng.range(0.5, 0.56);
  const rays = Math.min(panel.w, panel.h) * 0.92;
  const ry = Math.min(Math.max(horizon - rays / 2, panel.y), panel.y + panel.h - rays);
  const disc = rays * 0.6;
  draft.elements.push(
    shapeEl(k, 'rect', panel, sky),
    { ...shapeEl(k, 'sunburst-24', frameOf(W / 2 - rays / 2, ry, rays, rays), mixHex(sun, sky, 0.5)), opacity: 0.7 },
    shapeEl(k, 'ellipse', frameOf(W / 2 - disc / 2, ry + (rays - disc) / 2, disc, disc), sun),
  );
  // The ranges from the horizon down to the panel's foot, the far one paler, the sea in front of them.
  const foot = panel.y + panel.h;
  const farW = panel.w * k.rng.range(0.6, 0.7);
  const nearW = panel.w * k.rng.range(0.62, 0.72);
  const left = k.rng.chance(0.5);
  const seaH = panel.h * 0.12;
  const farX = left ? panel.x : panel.x + panel.w - farW;
  const nearX = left ? panel.x + panel.w - nearW : panel.x;
  const nearY = horizon + (foot - horizon) * 0.25;
  draft.elements.push(
    shapeEl(k, 'mountain', frameOf(farX, horizon, farW, foot - horizon), far),
    shapeEl(k, 'mountain', frameOf(nearX, nearY, nearW, foot - nearY), near),
    shapeEl(k, 'rect', frameOf(panel.x, foot - seaH, panel.w, seaH), sea),
  );
  const photo = k.photos[0];
  if (photo) {
    const ph = panel.h * 0.74;
    const pw = Math.min(ph * 0.58, panel.w * 0.42);
    const arch = printEl(k, photo, frameOf(W / 2 - pw / 2, foot - ph - mmOn(k, 3), pw, ph), {
      mask: 'arch-tall',
      cutout: { width: mmOn(k, 2), color: WHITE },
    });
    draft.elements.push(arch);
  }
  // Under the panel: the title stacked in the display face, the month or the year at the foot.
  const line = k.words.dates || k.words.year || '';
  const lineH = line ? mmOn(k, 7) : 0;
  const top = foot + mmOn(k, 5);
  const box = frameOf(m, top, W - m * 2, H - m - top - lineH - mmOn(k, 2));
  const words: BookElement[] = [];
  if (!addLockup(k, draft, { box: frameOf(box.x, box.y, box.w, H - m - top), ground }).length) {
    if (k.title.words.trim()) {
      words.push(titleText(k, box, { max: mmToPt(box.h * 0.8), color: ink, transform: 'upper', leading: 0.92 }));
    }
    if (line) words.push(spacedLine(k, line, frameOf(m, H - m - lineH, W - m * 2, lineH), ink, 9));
    draft.elements.push(...words);
    if (words.length > 1) draft.groups.push(words.map((e) => e.id));
  }
  return draft;
}
