/**
 * Arabic, Hebrew, Persian and Urdu labels need two things a GL engine does not do
 * on its own: the bidirectional algorithm, and Arabic contextual shaping (a letter
 * is drawn differently depending on its neighbours). Without them the engine lays
 * the codepoints out one by one, left to right, in isolated forms — so القاهرة
 * comes out as ة ر ه ا ق ل ا, unjoined and reversed. Raster basemaps never showed
 * this because their labels are drawn server-side, which is why it only surfaced
 * once the default basemap became a vector style.
 *
 * Mapbox GL exposes the fix as an optional plugin and does not load it by
 * default. Registering is global to the engine, so it happens once in the engine
 * module rather than at each map's construction site. MapLibre needed the same
 * plugin up to version 5; since 6.9 it shapes and reorders the text itself, and
 * its engine module registers nothing.
 *
 * The call itself stays with the caller: Mapbox GL 3 takes
 * `(url, callback, deferred)` and returns nothing, while MapLibre took
 * `(url, lazy)` and returned a promise, so the guard below accepts either rather
 * than guessing an arity.
 *
 * Deliberately no getRTLTextPluginStatus() pre-check: reading it made MapLibre
 * build its worker pool, which is an eager side effect for a module that is
 * imported for its default export, and throws outright under jsdom. Registering
 * twice is reported — by a throw or a rejected promise depending on the engine —
 * and both are handled below, so the probe bought nothing.
 */

/**
 * Runs a GL engine's RTL-plugin registration, swallowing the ways it can fail.
 *
 * Callers register lazily, so the payload is only fetched once a map actually
 * paints RTL text and a user who never leaves Latin script downloads nothing.
 *
 * @returns whether the registration call completed without throwing.
 */
export function registerRtlTextPlugin(register: () => void | Promise<unknown>): boolean {
  try {
    const pending = register()
    // MapLibre reports a failed or duplicate registration by rejecting; Mapbox
    // routes the same through its callback. Neither is worth surfacing: a map
    // with unshaped labels still renders, and an unhandled rejection would not
    // give the user anything to act on.
    if (pending instanceof Promise) pending.catch(() => {})
    return true
  } catch {
    // Already registered, or the engine refused outright. Registering the plugin
    // must never be able to break map creation.
    return false
  }
}
