/**
 * The WebGL probe (#2288).
 *
 * What is under test is the contract the basemap depends on: ask the browser
 * once, ask it the way maplibre-gl asks, give the context straight back, and
 * never throw whatever the browser does.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hasWebGL, resetWebGLProbe } from './webgl'

const realGetContext = HTMLCanvasElement.prototype.getContext

/** A context that records whether its lose-context extension was used. */
function fakeContext() {
  const loseContext = vi.fn()
  return { ctx: { getExtension: vi.fn(() => ({ loseContext })) }, loseContext }
}

beforeEach(() => {
  resetWebGLProbe()
  vi.restoreAllMocks()
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext
  resetWebGLProbe()
})

describe('hasWebGL', () => {
  it('FE-UTIL-WEBGL-001: says yes when the browser hands back a context', () => {
    const { ctx } = fakeContext()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof realGetContext

    expect(hasWebGL()).toBe(true)
  })

  it('FE-UTIL-WEBGL-002: says no when it hands back null, which is WebGL switched off', () => {
    // jsdom answers this way too, so the whole suite would take the raster path
    // if this were the other way round.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof realGetContext

    expect(hasWebGL()).toBe(false)
  })

  it('FE-UTIL-WEBGL-003: says no when only webgl1 is on offer', () => {
    // MapLibre 6 asks for webgl2 and nothing else. A probe that settled for
    // webgl1 would wave the map through to a GPUInitializationError.
    const { ctx } = fakeContext()
    const getContext = vi.fn((type: string) => (type === 'webgl2' ? null : ctx))
    HTMLCanvasElement.prototype.getContext = getContext as unknown as typeof realGetContext

    expect(hasWebGL()).toBe(false)
    expect(getContext.mock.calls.map((c) => c[0])).toEqual(['webgl2'])
  })

  it('FE-UTIL-WEBGL-004: gives the probe context straight back', () => {
    // Contexts are a capped resource, around sixteen in Chrome. A probe that
    // keeps one is a context the map behind it may not get.
    const { ctx, loseContext } = fakeContext()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof realGetContext

    hasWebGL()

    expect(ctx.getExtension).toHaveBeenCalledWith('WEBGL_lose_context')
    expect(loseContext).toHaveBeenCalled()
  })

  it('FE-UTIL-WEBGL-005: asks once and remembers, however often it is called', () => {
    const { ctx } = fakeContext()
    const getContext = vi.fn(() => ctx)
    HTMLCanvasElement.prototype.getContext = getContext as unknown as typeof realGetContext

    hasWebGL()
    hasWebGL()
    hasWebGL()

    // One probe, one context. A planner holding a map and a settings preview
    // would otherwise spend three.
    expect(getContext).toHaveBeenCalledTimes(1)
  })

  it('FE-UTIL-WEBGL-006: a browser that throws out of getContext counts as no', () => {
    // Some locked-down builds throw rather than returning null, and an answer is
    // never worth an exception.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      throw new Error('WebGL is disabled by policy')
    }) as unknown as typeof realGetContext

    expect(hasWebGL()).toBe(false)
  })
})
