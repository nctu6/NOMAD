import type { AutoPhoto } from '../auto/auto-types';
import { BOOK_COVER_ARCHETYPES } from '../book-archetypes';
import { bookPageSetupForPreset } from '../book-pages';
import { decoratedTemplatesFor, findDecoratedTemplate } from '../templates/template-catalogue';
import { templatePhotoSlots, templateRoles, type BookDecoratedTemplate } from '../templates/template-format';
import { bookThemeOf } from '../theme/book-theme';
import { BOOK_THEME_IDS } from '../theme/book-theme.schema';
import {
  ARCHETYPE_KIN,
  THEME_ARCHETYPE,
  archetypeOfTheme,
  bodyCapacity,
  chunkPhotos,
  chunkSizesOf,
  innerPool,
  pickCoverTemplate,
  pickInnerTemplate,
  templateEnergy,
  type TemplateChunk,
  type TemplatePickCtx,
} from './design-template-pick';

import { describe, expect, it } from 'vitest';

/** Picking a decorated spread for a page's photos and words. */

const page = bookPageSetupForPreset('square-210');
const wide = (photoId: number): AutoPhoto => ({ photoId, width: 4000, height: 3000 });
const tall = (photoId: number): AutoPhoto => ({ photoId, width: 3000, height: 4000 });
const photos = (n: number, at = 1) => Array.from({ length: n }, (_, i) => (i % 3 === 2 ? tall(at + i) : wide(at + i)));
const STORY = 'We walked up from the harbour in the morning and found the old town still asleep. ';

const ctxOf = (over: Partial<TemplatePickCtx> = {}): TemplatePickCtx => ({
  archetype: 'spine-band',
  page,
  theme: bookThemeOf('fabric-classic'),
  history: [],
  calm: false,
  seed: 7,
  key: 'k',
  ...over,
});

const chunk = (n: number, story = '', mappable = false): TemplateChunk => ({ photos: photos(n), story, mappable });
const roles = (t: BookDecoratedTemplate) => templateRoles(t) as readonly string[];

/** A book of pages picked one after the other, as the auto layout picks them. */
function book(chunks: readonly TemplateChunk[], over: Partial<TemplatePickCtx> = {}): BookDecoratedTemplate[] {
  const out: BookDecoratedTemplate[] = [];
  chunks.forEach((c, i) => {
    const pick = pickInnerTemplate(c, ctxOf({ ...over, history: out.map((t) => t.id), key: `e${i}` }));
    if (pick) out.push(pick);
  });
  return out;
}

const varied = Array.from({ length: 20 }, (_, i) =>
  chunk(i % 9, i % 3 === 0 ? STORY.repeat(1 + (i % 4)) : '', i % 5 === 0),
);

describe('the template picker', () => {
  it('AUTOTPL-001: never picks a template that would leave a photo frame empty', () => {
    for (const archetype of BOOK_COVER_ARCHETYPES) {
      for (let n = 0; n <= 9; n++) {
        for (const story of ['', STORY]) {
          const pick = pickInnerTemplate(chunk(n, story), ctxOf({ archetype }));
          if (pick) expect(templatePhotoSlots(pick), `${archetype} ${n}`).toBeLessThanOrEqual(n);
        }
      }
    }
  });

  it('AUTOTPL-002: a story always lands on a template with a story frame', () => {
    for (const archetype of BOOK_COVER_ARCHETYPES) {
      for (let n = 0; n <= 8; n++) {
        const pick = pickInnerTemplate(chunk(n, STORY), ctxOf({ archetype }));
        expect(pick, `${archetype} ${n}`).toBeDefined();
        expect(roles(pick as BookDecoratedTemplate)).toContain('body');
      }
    }
  });

  it('AUTOTPL-003: a map template only where there is a place to draw', () => {
    for (const archetype of BOOK_COVER_ARCHETYPES) {
      for (let n = 1; n <= 8; n++) {
        const pick = pickInnerTemplate(chunk(n), ctxOf({ archetype }));
        if (pick) expect(roles(pick), `${archetype} ${n}`).not.toContain('map');
      }
    }
    const mapped = [1, 2, 3, 4, 5].map((n) =>
      pickInnerTemplate(chunk(n, '', true), ctxOf({ archetype: 'field-notes' })),
    );
    expect(mapped.every((t) => t !== undefined)).toBe(true);
  });

  it('AUTOTPL-004: never the same template twice running, never loud after busy, unless only that keeps every photo framed in the style', () => {
    const busy = (t: BookDecoratedTemplate) => ['loud', 'lively'].includes(templateEnergy(t));
    for (const archetype of BOOK_COVER_ARCHETYPES) {
      const picks = book(varied, { archetype, theme: null });
      expect(picks.length, archetype).toBe(varied.length);
      picks.forEach((t, i) => {
        const before = picks[i - 1];
        const page = varied[i];
        if (!before || !page) return;
        const keeps = (x: BookDecoratedTemplate) =>
          x.id !== before.id && !(templateEnergy(x) === 'loud' && busy(before));
        if (keeps(t)) return;
        // The rhythm gives way only where no template of the book's styles frames every photo and keeps it.
        const fits = (x: BookDecoratedTemplate) =>
          templatePhotoSlots(x) === page.photos.length &&
          (!page.story || roles(x).includes('body')) &&
          (!roles(x).includes('map') || page.mappable);
        expect(
          innerPool(archetype)
            .filter((x) => fits(x) && keeps(x))
            .map((x) => x.id),
          `${archetype} at ${i}`,
        ).toEqual([]);
      });
    }
  });

  it('AUTOTPL-005: twenty varied entries are laid on at least eight different templates', () => {
    for (const archetype of BOOK_COVER_ARCHETYPES) {
      const picks = book(varied, { archetype });
      expect(new Set(picks.map((t) => t.id)).size, archetype).toBeGreaterThanOrEqual(8);
    }
  });

  it("AUTOTPL-006: the theme's own archetype wins over a kin one that fits as well", () => {
    for (const archetype of BOOK_COVER_ARCHETYPES) {
      for (const tpl of decoratedTemplatesFor('inner', archetype)) {
        if (roles(tpl).includes('map')) continue;
        const n = templatePhotoSlots(tpl);
        const pick = pickInnerTemplate(
          { photos: photos(n), story: '', mappable: true },
          ctxOf({ archetype, theme: null }),
        );
        expect(pick?.archetype, `${archetype} ${n}`).toBe(archetype);
      }
    }
  });

  it('AUTOTPL-007: the same seed picks the same templates, another seed others', () => {
    const one = book(varied, { seed: 1 }).map((t) => t.id);
    expect(book(varied, { seed: 1 }).map((t) => t.id)).toEqual(one);
    const others = [2, 3, 4, 5, 6].map((seed) =>
      book(varied, { seed })
        .map((t) => t.id)
        .join(),
    );
    expect(others.some((o) => o !== one.join())).toBe(true);
  });

  it('AUTOTPL-008: every theme has an archetype, and every archetype kin of its own kind', () => {
    for (const id of BOOK_THEME_IDS) expect(BOOK_COVER_ARCHETYPES).toContain(THEME_ARCHETYPE[id]);
    expect(THEME_ARCHETYPE).toMatchObject({
      riso: 'riso',
      magazine: 'editorial',
      'retro-travel': 'vintage-poster',
      midnight: 'night-film',
      'field-notes': 'field-notes',
    });
    for (const a of BOOK_COVER_ARCHETYPES) {
      expect(ARCHETYPE_KIN[a].length).toBeGreaterThan(0);
      expect(ARCHETYPE_KIN[a]).not.toContain(a);
    }
    expect(ARCHETYPE_KIN['night-film']).toEqual(['editorial', 'minimal-serif']);
  });

  it('AUTOTPL-009: a story frame holds more the larger it is drawn', () => {
    const base = findDecoratedTemplate('story-quote') as BookDecoratedTemplate;
    const grown = (k: number): BookDecoratedTemplate => ({
      ...base,
      id: `story-quote-x${k}`,
      elements: base.elements.map((e) => (e.role === 'body' ? { ...e, frame: { ...e.frame, h: e.frame.h * k } } : e)),
    });
    const sizes = [0.5, 1, 1.5, 2].map((k) => bodyCapacity(grown(k), page));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i] as number).toBeGreaterThanOrEqual(sizes[i - 1] as number);
    expect(sizes[3] as number).toBeGreaterThan(sizes[0] as number);
    expect(bodyCapacity(findDecoratedTemplate('grid-tight') as BookDecoratedTemplate, page)).toBe(0);
  });

  it('AUTOTPL-010: photos are cut into pages that leave no frame empty and park as few as there can be', () => {
    const sizes = { any: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]), story: new Set([0, 1, 2, 3, 4, 6]) };
    for (let n = 1; n <= 20; n++) {
      for (const story of [false, true]) {
        const cut = chunkPhotos(n, story, sizes);
        expect(cut.sizes.reduce((a, b) => a + b, 0) + cut.parked).toBe(n);
        expect(cut.parked, `${n}`).toBe(0);
        if (story) expect(sizes.story.has(cut.sizes[0] as number)).toBe(true);
      }
    }
    expect(chunkPhotos(12, false, sizes).sizes).toEqual([6, 6]);
    expect(chunkPhotos(5, true, sizes).sizes).toEqual([2, 3]);
    // A story too long for a small page's frame goes on a page of words of its own.
    expect(chunkPhotos(2, true, { ...sizes, pageCost: (s, first) => (first && s > 0 ? 30 : 0) }).sizes).toEqual([0, 2]);
    expect(chunkPhotos(3, false, { any: new Set([2]), story: new Set() })).toEqual({ sizes: [2], parked: 1 });
  });

  it('AUTOTPL-011: a cover template never leaves a frame empty, and with no photo only one drawn for none', () => {
    for (const archetype of BOOK_COVER_ARCHETYPES) {
      for (let n = 0; n <= 5; n++) {
        const pick = pickCoverTemplate({ archetype, photos: n, portrait: false, seed: 3 });
        if (pick) expect(templatePhotoSlots(pick)).toBeLessThanOrEqual(n);
        if (n >= 4) expect(pick, `${archetype} ${n}`).toBeDefined();
      }
    }
    expect(pickCoverTemplate({ archetype: 'postcard', photos: 0, portrait: false, seed: 1 })?.id).toBe(
      'postcard-coast',
    );
    expect(pickCoverTemplate({ archetype: 'riso', photos: 0, portrait: false, seed: 1 })).toBeUndefined();
    expect(pickCoverTemplate({ archetype: 'minimal-serif', photos: 1, portrait: true, seed: 1 })?.id).toBe(
      'minimal-serif-portrait',
    );
  });

  it("AUTOTPL-012: a theme of the book's own takes the archetype of the theme it still sets the faces of", () => {
    expect(archetypeOfTheme({ ...bookThemeOf('midnight'), id: null })).toBe('night-film');
    const odd = bookThemeOf('riso');
    const own = { ...odd, id: null, fonts: { ...odd.fonts, display: { font: 'bodoni' }, heading: { font: 'bodoni' } } };
    expect(archetypeOfTheme(own)).toBe('spine-band');
    expect(archetypeOfTheme(null)).toBe('spine-band');
    expect(innerPool('riso').every((t) => ['riso', 'poster-pop', 'cutout'].includes(t.archetype))).toBe(true);
    expect([...chunkSizesOf(innerPool('riso')).story]).toContain(0);
  });

  it("AUTOTPL-013: a page the book's own styles can frame every photo of stays in them, whatever the rhythm", () => {
    for (const archetype of BOOK_COVER_ARCHETYPES) {
      const kin = [archetype, ...ARCHETYPE_KIN[archetype]];
      for (let n = 0; n <= 12; n++) {
        for (const story of ['', STORY]) {
          const frames = (t: BookDecoratedTemplate) =>
            templatePhotoSlots(t) === n && (!story || roles(t).includes('body')) && !roles(t).includes('map');
          if (!innerPool(archetype).some(frames)) continue;
          const pick = pickInnerTemplate(chunk(n, story), ctxOf({ archetype, theme: null }));
          expect(pick && templatePhotoSlots(pick), `${archetype} ${n}`).toBe(n);
          expect(kin, `${archetype} ${n} ${story ? 'story' : ''}`).toContain(pick?.archetype);
          // The page before on its own is given up rather than a frame or the style.
          const again = pickInnerTemplate(chunk(n, story), ctxOf({ archetype, theme: null, history: [pick!.id] }));
          expect(again && templatePhotoSlots(again), `${archetype} ${n} again`).toBe(n);
          expect(kin).toContain(again?.archetype);
        }
      }
    }
  });
});
