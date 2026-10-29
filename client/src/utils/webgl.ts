/**
 * Whether this browser will hand a GL map a WebGL2 context. MapLibre 6 and
 * Mapbox GL 3 both ask for webgl2 and nothing else.
 *
 * The default basemap has been a vector style since 4.1.0, and maplibre-gl builds
 * its GL context inside the Map constructor: no context, no map, and the throw
 * lands in a place no error boundary was ever meant to see (#2288). Asking a
 * one-pixel probe first is cheaper and quieter than finding out from a stack
 * trace, and it keeps the maplibre chunk, about a megabyte, off the wire for a
 * browser that could never have used it.
 *
 * "Cannot" is a bigger group than broken hardware: hardware acceleration turned
 * off in Chrome or Firefox, webgl.disabled in about:config, a driver on the
 * browser's blocklist, a VM or remote desktop with no GL at all, and privacy
 * builds that switch it off against fingerprinting.
 */

/**
 * Probed once per page load, then remembered.
 *
 * A repeat probe costs a live WebGL context each time, and every browser caps how
 * many it keeps: Chrome evicts the oldest at around sixteen. On a planner with a
 * map and a settings preview open, a chatty probe is a map going blank.
 */
let probed: boolean | null = null

export function hasWebGL(): boolean {
  if (probed === null) probed = probe()
  return probed
}

const listeners = new Set<() => void>()
let failures = 0

/**
 * A GL map that failed to build although the probe said yes: a GPU that offers
 * WebGL2 and then cannot create the context, or a context budget that ran out.
 * From here on the answer is no, and every map that asked is told, so it can
 * redraw itself without WebGL instead of waiting for the next page load.
 */
export function reportWebGLFailure(): void {
  if (probed === false) return
  probed = false
  failures++
  for (const listener of listeners) listener()
}

/** For useSyncExternalStore: tells a map when reportWebGLFailure changed the answer. */
export function subscribeWebGL(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** For useSyncExternalStore: changes each time reportWebGLFailure turned the answer to no. */
export function webGLFailures(): number {
  return failures
}

/**
 * Test seam. The app never clears this, it only turns it to no through
 * reportWebGLFailure: a browser does not gain WebGL2 mid-session.
 */
export function resetWebGLProbe(): void {
  probed = null
}

function probe(): boolean {
  // jsdom and anything SSR-ish have no canvas implementation, and "no WebGL" is
  // the honest answer for them rather than a special case.
  if (typeof document === 'undefined') return false

  try {
    const canvas = document.createElement('canvas')
    // One pixel. The probe never draws, and a full backing store would allocate
    // megabytes for an answer that is one bit wide.
    canvas.width = 1
    canvas.height = 1

    // Exactly what maplibre-gl asks for (Map._setupPainter): WebGL2 and nothing
    // else, since MapLibre 6 dropped WebGL1. A browser that only offers WebGL1
    // passes a looser probe and then throws GPUInitializationError out of the Map
    // constructor, which is the crash this probe exists to prevent.
    const gl = canvas.getContext('webgl2')
    if (!gl) {
      console.warn('[basemap] this browser refuses a WebGL2 context, vector basemaps are unavailable')
      return false
    }

    // Hand the context back now instead of waiting for the canvas to be
    // collected. Contexts are a capped resource and the GC is under no obligation
    // to hurry, so a probe that keeps one is a context the map behind it may not
    // get.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    // A few locked-down builds throw out of getContext rather than returning
    // null, and an answer is never worth an exception.
    return false
  }
}
