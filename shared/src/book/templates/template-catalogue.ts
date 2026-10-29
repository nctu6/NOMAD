import type { BookCoverArchetype } from '../book-archetypes';
import { findBookTemplate } from '../book-layouts';
import { COVERS_CUTOUT } from './data/covers-cutout.data';
import { COVERS_GRID_BADGE } from './data/covers-grid-badge.data';
import { COVERS_MINIMAL_SERIF } from './data/covers-minimal-serif.data';
import { COVERS_POSTCARD } from './data/covers-postcard.data';
import { COVERS_POSTER_POP } from './data/covers-poster-pop.data';
import { COVERS_SPINE_BAND } from './data/covers-spine-band.data';
import { COVERS_STAMP_COLLAGE } from './data/covers-stamp-collage.data';
import { INNER_CHAPTERS } from './data/inner-chapters.data';
import { INNER_COLLAGE } from './data/inner-collage.data';
import { INNER_EPHEMERA } from './data/inner-ephemera.data';
import { INNER_GRIDS } from './data/inner-grids.data';
import { INNER_STORY } from './data/inner-story.data';
import { MORE_CUTOUT } from './data/more-cutout.data';
import { MORE_GRID_BADGE } from './data/more-grid-badge.data';
import { MORE_MINIMAL_SERIF } from './data/more-minimal-serif.data';
import { MORE_POSTCARD } from './data/more-postcard.data';
import { MORE_POSTER_POP } from './data/more-poster-pop.data';
import { MORE_SPINE_BAND } from './data/more-spine-band.data';
import { MORE_STAMP_COLLAGE } from './data/more-stamp-collage.data';
import { NEW_EDITORIAL } from './data/new-editorial.data';
import { NEW_FIELD_NOTES } from './data/new-field-notes.data';
import { NEW_NIGHT_FILM } from './data/new-night-film.data';
import { NEW_RISO } from './data/new-riso.data';
import { NEW_VINTAGE_POSTER } from './data/new-vintage-poster.data';
import {
  templatePhotoSlots,
  templateRoles,
  type BookDecoratedTemplate,
  type BookTemplateKind,
} from './template-format';

/** The covers or the spreads of a data file that holds both. */
function ofKind(set: readonly BookDecoratedTemplate[], kind: BookTemplateKind): BookDecoratedTemplate[] {
  return set.filter((t) => t.kind === kind);
}

/**
 * The decorated templates the Studio offers and the assistant lays pages
 * on: 48 covers, four in each of the twelve archetypes, and 60 double
 * spreads, five in the manner of each. The data files hold them as drawn
 * (template-format.ts); this is the one list the Studio's panel, the page
 * operations and `list_book_layouts` read. Its order is the panel's: the
 * covers archetype by archetype, then the spreads.
 */
export const BOOK_DECORATED_TEMPLATES: readonly BookDecoratedTemplate[] = [
  ...COVERS_SPINE_BAND,
  ...ofKind(MORE_SPINE_BAND, 'single'),
  ...COVERS_POSTER_POP,
  ...ofKind(MORE_POSTER_POP, 'single'),
  ...COVERS_CUTOUT,
  ...ofKind(MORE_CUTOUT, 'single'),
  ...COVERS_POSTCARD,
  ...ofKind(MORE_POSTCARD, 'single'),
  ...COVERS_GRID_BADGE,
  ...ofKind(MORE_GRID_BADGE, 'single'),
  ...COVERS_MINIMAL_SERIF,
  ...ofKind(MORE_MINIMAL_SERIF, 'single'),
  ...COVERS_STAMP_COLLAGE,
  ...ofKind(MORE_STAMP_COLLAGE, 'single'),
  ...ofKind(NEW_RISO, 'single'),
  ...ofKind(NEW_EDITORIAL, 'single'),
  ...ofKind(NEW_VINTAGE_POSTER, 'single'),
  ...ofKind(NEW_NIGHT_FILM, 'single'),
  ...ofKind(NEW_FIELD_NOTES, 'single'),
  ...INNER_STORY,
  ...INNER_CHAPTERS,
  ...INNER_COLLAGE,
  ...INNER_EPHEMERA,
  ...INNER_GRIDS,
  ...ofKind(MORE_SPINE_BAND, 'inner'),
  ...ofKind(MORE_POSTER_POP, 'inner'),
  ...ofKind(MORE_CUTOUT, 'inner'),
  ...ofKind(MORE_POSTCARD, 'inner'),
  ...ofKind(MORE_GRID_BADGE, 'inner'),
  ...ofKind(MORE_MINIMAL_SERIF, 'inner'),
  ...ofKind(MORE_STAMP_COLLAGE, 'inner'),
  ...ofKind(NEW_RISO, 'inner'),
  ...ofKind(NEW_EDITORIAL, 'inner'),
  ...ofKind(NEW_VINTAGE_POSTER, 'inner'),
  ...ofKind(NEW_NIGHT_FILM, 'inner'),
  ...ofKind(NEW_FIELD_NOTES, 'inner'),
];

const BY_ID = new Map(BOOK_DECORATED_TEMPLATES.map((t) => [t.id, t]));

/** A decorated template by id, or undefined. */
export function findDecoratedTemplate(id: string): BookDecoratedTemplate | undefined {
  return BY_ID.get(id);
}

/** The decorated templates for a single page or a double spread, of one archetype when one is named. */
export function decoratedTemplatesFor(
  kind: BookTemplateKind,
  archetype?: BookCoverArchetype | null,
): BookDecoratedTemplate[] {
  return BOOK_DECORATED_TEMPLATES.filter((t) => t.kind === kind && (!archetype || t.archetype === archetype));
}

/** Whether a layout id names a template of either set: a built-in layout or a decorated one. */
export function isBookTemplateId(id: string): boolean {
  return BY_ID.has(id) || findBookTemplate(id) !== undefined;
}

/** One decorated template as `list_book_layouts` lists it. */
export function decoratedTemplateRow(tpl: BookDecoratedTemplate) {
  const roles = templateRoles(tpl);
  return {
    id: tpl.id,
    archetype: tpl.archetype,
    tags: [...tpl.tags],
    descr: tpl.descr,
    photoSlots: templatePhotoSlots(tpl),
    roles: roles.filter((r) => !r.startsWith('photo:')),
  };
}
