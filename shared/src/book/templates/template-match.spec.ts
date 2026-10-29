import { bookPageSetupForPreset } from '../book-pages';
import { bookPhotoElementSchema, type BookSpread } from '../book.schema';
import { bookThemeOf } from '../theme/book-theme';
import { applyDecoratedTemplate } from './template-apply';
import { BOOK_DECORATED_TEMPLATES } from './template-catalogue';
import { matchDecoratedTemplate } from './template-match';

import { describe, expect, it } from 'vitest';

/** A laid page knows which decorated template it is. */

const words = {
  title: { text: 'Portugal' },
  subtitle: { text: 'Lisbon to the Algarve' },
  date: { text: '2026', binding: { source: 'entry.date' as const, entryId: 7, value: '2026-05-14' } },
  body: { text: 'We took the early train out of Lisbon and walked up through the fog to the palace.' },
  caption: { text: 'Pena Palace in the fog' },
};

const photo = (id: string, photoId: number) =>
  bookPhotoElementSchema.parse({ id, kind: 'photo', frame: { x: 0, y: 0, w: 10, h: 10 }, photoId });

const page = (role: BookSpread['role'], photos: number): BookSpread => ({
  id: 'sp',
  role,
  background: null,
  elements: Array.from({ length: photos }, (_, i) => photo(`p${i}`, i + 1)),
  parked: [],
  entryId: null,
});

let n = 0;
const newId = (p: string) => `${p}-${++n}`;

describe('matchDecoratedTemplate', () => {
  it('TPLMATCH-001: recognises every shipped template laid on every page format', () => {
    for (const preset of ['square-210', 'a4-landscape', 'a4-portrait', 'a5-landscape'] as const) {
      const format = bookPageSetupForPreset(preset);
      for (const tpl of BOOK_DECORATED_TEMPLATES) {
        const laid = applyDecoratedTemplate(page(tpl.kind === 'single' ? 'cover' : 'inner', 8), tpl, format, {
          words,
          newId,
        });
        expect(matchDecoratedTemplate(laid, format)?.id, `${tpl.id} on ${preset}`).toBe(tpl.id);
      }
    }
  });

  it("TPLMATCH-002: recognises it in a theme's colours and with fewer words and photos than it takes", () => {
    const format = bookPageSetupForPreset('square-210');
    const theme = bookThemeOf('midnight');
    for (const tpl of BOOK_DECORATED_TEMPLATES) {
      const laid = applyDecoratedTemplate(page(tpl.kind === 'single' ? 'cover' : 'inner', 1), tpl, format, {
        theme,
        words: { title: words.title },
        newId,
      });
      expect(matchDecoratedTemplate(laid, format)?.id, tpl.id).toBe(tpl.id);
    }
  });

  it('TPLMATCH-003: a page rearranged by hand is no template', () => {
    const format = bookPageSetupForPreset('square-210');
    const tpl = BOOK_DECORATED_TEMPLATES.find((t) => t.id === 'stamp-row');
    if (!tpl) throw new Error('stamp-row is shipped');
    const laid = applyDecoratedTemplate(page('inner', 4), tpl, format, { words, newId });
    const moved = { ...laid, elements: laid.elements.map((e) => ({ ...e, frame: { ...e.frame, x: e.frame.x + 9 } })) };
    expect(matchDecoratedTemplate(moved, format)).toBeUndefined();
    expect(matchDecoratedTemplate({ ...laid, elements: [] }, format)).toBeUndefined();
  });

  it('TPLMATCH-004: a cover is matched among the covers, a spread among the spreads', () => {
    const format = bookPageSetupForPreset('square-210');
    for (const tpl of BOOK_DECORATED_TEMPLATES) {
      const laid = applyDecoratedTemplate(page(tpl.kind === 'single' ? 'back' : 'inner', 3), tpl, format, { newId });
      expect(matchDecoratedTemplate(laid, format)?.kind ?? tpl.kind).toBe(tpl.kind);
    }
  });
});
