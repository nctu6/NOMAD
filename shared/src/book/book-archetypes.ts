/**
 * The twelve cover archetypes a decorated book starts from: the Studio's cover
 * templates are drawn in them, and the assistant's art direction names one.
 *
 * - spine-band: a bleed photo with a coloured band on the binding side.
 * - poster-pop: a two-tone colour block, a heavy two-line title, a tilted inset photo.
 * - cutout: a saturated page, organic cut-out shapes around a bordered portrait photo.
 * - postcard: a pastel page, a landmark drawing, a display serif title and a script line.
 * - grid-badge: a two by two photo grid with a round title badge at its centre.
 * - minimal-serif: a white page, a large photo with a hairline, a very large thin serif title.
 * - stamp-collage: photos in arches and stamps over a checker band, with a round postmark.
 * - riso: a risograph print, spot inks overprinted a little out of register, halftone dots, bold type.
 * - editorial: a travel magazine, a huge masthead, thin rules, an issue line, a photo edge to edge.
 * - vintage-poster: a 1950s travel poster, flat layered mountains under a sun, a stacked title, a thin frame.
 * - night-film: a dark cinematic page, a letterboxed photo, a film strip with sprocket holes, a neon accent.
 * - field-notes: a traveller's notebook, squared paper, prints taped in at an angle, pressed leaves.
 */
export const BOOK_COVER_ARCHETYPES = [
  'spine-band',
  'poster-pop',
  'cutout',
  'postcard',
  'grid-badge',
  'minimal-serif',
  'stamp-collage',
  'riso',
  'editorial',
  'vintage-poster',
  'night-film',
  'field-notes',
] as const;
export type BookCoverArchetype = (typeof BOOK_COVER_ARCHETYPES)[number];
