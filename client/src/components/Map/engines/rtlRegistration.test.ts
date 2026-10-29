import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * What each engine module does on import. Everything else is a helper: the guard
 * in rtlText.ts has its own tests, but a guard nobody calls looks exactly like a
 * working fix from the outside. Deleting the mapbox registration, swapping an
 * argument or dropping the deferred flag left the whole suite green, and so would
 * a maplibre engine that forgot its worker URL.
 *
 * The engines are mocked because importing them for real builds a worker pool
 * under jsdom, and the plugin URL is mocked so the 133 KB payload never loads.
 */
const { mapboxSet, maplibreSet, maplibreWorker } = vi.hoisted(() => ({
  mapboxSet: vi.fn(),
  maplibreSet: vi.fn(),
  maplibreWorker: vi.fn(),
}));

vi.mock('mapbox-gl', () => ({ default: { setRTLTextPlugin: mapboxSet } }));
vi.mock('maplibre-gl', () => ({ setRTLTextPlugin: maplibreSet, setWorkerUrl: maplibreWorker }));
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '/assets/maplibre-worker.js' }));
vi.mock('@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js?url', () => ({ default: '/assets/rtl-plugin.js' }));

beforeEach(() => {
  vi.resetModules();
  mapboxSet.mockReset();
  maplibreSet.mockReset();
  maplibreWorker.mockReset();
});

describe('the GL engines register the RTL text plugin (#2235)', () => {
  it('FE-MAP-RTL-001: importing the mapbox engine registers it deferred, with a null callback', async () => {
    await import('./mapbox');

    expect(mapboxSet).toHaveBeenCalledTimes(1);
    // Mapbox GL 3 takes (url, callback, deferred). The third argument is what
    // keeps the payload off the wire until a map paints RTL text; dropping it
    // would fetch 133 KB for every user on every map.
    expect(mapboxSet).toHaveBeenCalledWith(expect.stringContaining('rtl'), null, true);
  });

  it('FE-MAP-RTL-002: importing the maplibre engine registers no plugin', async () => {
    await import('./maplibre');

    // MapLibre 6.9 shapes right-to-left text itself. The plugin would replace
    // that, and a v6 worker could only run its UMD build through eval.
    expect(maplibreSet).not.toHaveBeenCalled();
  });

  it('FE-MAP-RTL-003: an engine still loads when its registration throws', async () => {
    mapboxSet.mockImplementation(() => { throw new Error('already registered'); });

    const engine = await import('./mapbox');

    expect(engine.default).toBeDefined();
  });

  it('FE-MAP-RTL-004: importing the maplibre engine points it at the bundled worker', async () => {
    const engine = await import('./maplibre');

    // MapLibre 6 looks for its worker next to its own module, which in a bundle
    // is a chunk with no worker beside it. Without this no map draws a tile.
    expect(maplibreWorker).toHaveBeenCalledTimes(1);
    expect(maplibreWorker).toHaveBeenCalledWith('/assets/maplibre-worker.js');
    expect(engine.default.setWorkerUrl).toBe(maplibreWorker);
  });
});
