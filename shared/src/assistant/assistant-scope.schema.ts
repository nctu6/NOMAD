import { idSchema } from '../common/primitives.schema';

import { z } from 'zod';

/**
 * What an assistant conversation is about: a trip (the planner's chat), a
 * journey (the chat in TREK Studio, which works on the journey's book) or no
 * single one (`home`, the chat on the dashboard, Vacay, Atlas, collections and
 * settings, which knows all of the user's trips and works on what belongs to
 * none of them). A thread belongs to exactly one of them, and the tools a turn
 * offers, the context it reads and the routes it is reached under follow from
 * it: `/api/trips/:tripId/assistant`, `/api/journeys/:journeyId/assistant` and
 * `/api/assistant`.
 */
/**
 * The two pages a journey's conversation is held on: the book in TREK Studio,
 * and the journal itself (its entries, photos and settings). They share the
 * journey's threads; what a turn offers and what it is told follow the page.
 */
export const ASSISTANT_JOURNEY_SURFACES = ['studio', 'journal'] as const;
export const assistantJourneySurfaceSchema = z.enum(ASSISTANT_JOURNEY_SURFACES);
export type AssistantJourneySurface = z.infer<typeof assistantJourneySurfaceSchema>;

export const assistantScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('trip'), tripId: idSchema }).strict(),
  z
    .object({
      kind: z.literal('journey'),
      journeyId: idSchema,
      /** The page a request comes from; left out, the Studio's. Never part of the key: both pages keep one list. */
      surface: assistantJourneySurfaceSchema.optional(),
    })
    .strict(),
  z.object({ kind: z.literal('home') }).strict(),
]);
export type AssistantScope = z.infer<typeof assistantScopeSchema>;

/** The scope of the chat outside any one trip or journey. */
export const HOME_ASSISTANT_SCOPE: AssistantScope = { kind: 'home' };

/** The key a scope's conversations are kept under on a client: `trip:5`, `journey:12`, `home`. */
export function assistantScopeKey(scope: AssistantScope): string {
  if (scope.kind === 'trip') return `trip:${scope.tripId}`;
  return scope.kind === 'journey' ? `journey:${scope.journeyId}` : 'home';
}
