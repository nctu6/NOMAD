import { bookSpreadSchema, type BookDocument, type BookSpread } from '../book.schema';
import { matchDecoratedTemplate } from '../templates/template-match';
import { bookThemeOf } from '../theme/book-theme';
import { emptyBook } from './auto-book';
import {
  AUTO_DEFAULT_THEME,
  autoDesignedBook,
  autoRelayoutKind,
  autoRelayoutSpread,
  type AutoDesignedInput,
} from './auto-designed';
import type { AutoPhoto } from './auto-types';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The Studio's Auto layout on the designed templates: the whole book, and one spread again. */

interface Fixture {
  input: AutoDesignedInput;
  gallery?: AutoPhoto[];
}

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));
const fixtures = JSON.parse(readFileSync(here('./auto-layout.parity-inputs.json'), 'utf8')) as Record<string, Fixture>;
const fx = fixtures.A as Fixture;

const counter = () => {
  let n = 0;
  return (p: string) => `${p}-a${++n}`;
};
const input = (): AutoDesignedInput => ({ ...fx.input, gallery: fx.gallery, newId: counter() });
const book = (seed = 1, theme = bookThemeOf('riso')) => autoDesignedBook(emptyBook(input()), input(), { theme, seed });

/** The index of the first page of a kind, or -1. */
const indexOf = (doc: BookDocument, kind: ReturnType<typeof autoRelayoutKind>) =>
  doc.spreads.findIndex((s) => autoRelayoutKind(s) === kind);

describe('the Studio auto layout on the designed templates', () => {
  it("AUTODES-001: keeps the book's page format and its theme object, one of its own included", () => {
    const own = {
      ...bookThemeOf('postcard'),
      id: null,
      palette: { ...bookThemeOf('postcard').palette, ink: '#203040' },
    };
    const start = { ...emptyBook(input()), page: { ...fx.input.page, pageWidth: 200, pageHeight: 250 } };
    const doc = autoDesignedBook(start, input(), { theme: own, seed: 3 });
    expect(doc.page.pageWidth).toBe(200);
    expect(doc.page.pageHeight).toBe(250);
    expect(doc.theme).toEqual(own);
    expect(autoDesignedBook(null, input()).theme?.id).toBe(AUTO_DEFAULT_THEME);
  });

  it('AUTODES-002: another seed lays another book, the same seed the same', () => {
    const ids = (doc: BookDocument) => doc.spreads.map((s) => matchDecoratedTemplate(s, doc.page)?.id ?? '-').join();
    expect(ids(book(1))).toBe(ids(book(1)));
    expect([2, 3, 4, 5].some((seed) => ids(book(seed)) !== ids(book(1)))).toBe(true);
  });

  it("AUTODES-003: this spread keeps the page's id and lays an entry's page on another template than its own and its neighbours'", () => {
    const doc = book();
    const at = doc.spreads.findIndex(
      (s, i) => autoRelayoutKind(s) === 'entry' && matchDecoratedTemplate(doc.spreads[i] as BookSpread, doc.page),
    );
    const before = doc.spreads[at] as BookSpread;
    const next = autoRelayoutSpread(doc, at, input(), { seed: 1 });
    expect(next?.id).toBe(before.id);
    expect(next?.entryId).toBe(before.entryId);
    expect(bookSpreadSchema.safeParse(next).success).toBe(true);
    const was = [at - 1, at, at + 1].map(
      (i) => doc.spreads[i] && matchDecoratedTemplate(doc.spreads[i] as BookSpread, doc.page)?.id,
    );
    expect(was).not.toContain(matchDecoratedTemplate(next as BookSpread, doc.page)?.id);
    const photos = (s: BookSpread) =>
      [...s.elements, ...s.parked].flatMap((e) => (e.kind === 'photo' && e.photoId != null ? [e.photoId] : [])).sort();
    expect(photos(next as BookSpread)).toEqual(photos(before));
  });

  it('AUTODES-004: pressed again and again, an entry page keeps moving on', () => {
    let doc = book();
    const at = indexOf(doc, 'entry');
    const seen = new Set<string>();
    for (let n = 0; n < 4; n++) {
      const next = autoRelayoutSpread(doc, at, input(), { seed: n });
      if (!next) throw new Error('an entry page lays again');
      seen.add(matchDecoratedTemplate(next, doc.page)?.id ?? 'composed');
      doc = { ...doc, spreads: doc.spreads.map((s, i) => (i === at ? next : s)) };
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('AUTODES-005: cycles the cover through the covers of its archetype and then its kin', () => {
    let doc = book();
    const seen: string[] = [];
    for (let n = 0; n < 6; n++) {
      const next = autoRelayoutSpread(doc, 0, input(), { seed: 1 });
      if (!next) throw new Error('the cover lays again');
      expect(next.id).toBe(doc.spreads[0]?.id);
      seen.push(matchDecoratedTemplate(next, doc.page)?.id ?? '-');
      doc = { ...doc, spreads: doc.spreads.map((s, i) => (i === 0 ? next : s)) };
    }
    expect(new Set(seen).size).toBeGreaterThan(3);
    expect(seen.some((id) => id.startsWith('riso-'))).toBe(true);
  });

  it('AUTODES-006: cycles the summary and the countries through their looks', () => {
    const doc = book();
    const summary = indexOf(doc, 'summary');
    const looks: string[] = [];
    let cur = doc;
    for (let n = 0; n < 3; n++) {
      const next = autoRelayoutSpread(cur, summary, input()) as BookSpread;
      const stats = next.elements.find((e) => e.kind === 'stats' && e.metrics.length > 2);
      looks.push(stats?.kind === 'stats' ? (stats.look ?? 'classic') : '-');
      cur = { ...cur, spreads: cur.spreads.map((s, i) => (i === summary ? next : s)) };
    }
    expect(new Set(looks).size).toBe(3);
    expect(looks).not.toContain('classic');
    const countries = indexOf(doc, 'countries');
    const again = autoRelayoutSpread(doc, countries, input()) as BookSpread;
    const look = (s: BookSpread) => s.elements.flatMap((e) => (e.kind === 'countries' ? [e.look] : []))[0];
    expect(look(again)).not.toBe(look(doc.spreads[countries] as BookSpread));
  });

  it('AUTODES-007: a page the engine did not make is not laid again', () => {
    const doc = book();
    const back = doc.spreads.findIndex((s) => s.role === 'back');
    expect(autoRelayoutSpread(doc, back, input())).toBeNull();
    const stations = doc.spreads.findIndex(
      (s) => s.role === 'inner' && s.entryId === null && autoRelayoutKind(s) === null,
    );
    if (stations >= 0) expect(autoRelayoutSpread(doc, stations, input())).toBeNull();
    expect(autoRelayoutSpread(doc, 999, input())).toBeNull();
  });

  it('AUTODES-008: keeps a locked element where it is', () => {
    const doc = book();
    const at = indexOf(doc, 'entry');
    const page = doc.spreads[at] as BookSpread;
    const lockedEl = { ...(page.elements[0] as BookSpread['elements'][number]), locked: true };
    const locked = { ...page, elements: [lockedEl, ...page.elements.slice(1)] };
    const withLock = { ...doc, spreads: doc.spreads.map((s, i) => (i === at ? locked : s)) };
    const next = autoRelayoutSpread(withLock, at, input());
    expect(next?.elements).toContainEqual(lockedEl);
  });

  it('AUTODES-009: the whole book keeps a stored page that holds a lock', () => {
    const doc = book();
    const at = indexOf(doc, 'entry');
    const page = doc.spreads[at] as BookSpread;
    const locked = { ...page, elements: page.elements.map((e, i) => (i === 0 ? { ...e, locked: true } : e)) };
    const again = autoDesignedBook({ ...doc, spreads: doc.spreads.map((s, i) => (i === at ? locked : s)) }, input(), {
      theme: doc.theme,
      seed: 9,
    });
    expect(again.spreads).toContainEqual(locked);
  });

  it('AUTODES-010: an old Auto layout summary is laid again in a new look', () => {
    const doc = book();
    const summary = indexOf(doc, 'summary');
    const old = doc.spreads[summary] as BookSpread;
    const classic = {
      ...old,
      elements: old.elements.map((e) => (e.kind === 'stats' ? { ...e, look: undefined } : e)),
    } as BookSpread;
    const next = autoRelayoutSpread(
      { ...doc, spreads: doc.spreads.map((s, i) => (i === summary ? classic : s)) },
      summary,
      input(),
    );
    const looks = next?.elements.flatMap((e) => (e.kind === 'stats' ? [e.look] : []));
    expect(looks?.length).toBeGreaterThan(0);
    expect(looks?.every((l) => l && l !== 'classic')).toBe(true);
  });
});
