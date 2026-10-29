/**
 * The trip map without WebGL2 (FE-COMP-MAPAUTO-WEBGL-*).
 *
 * A browser that cannot give a GL engine its WebGL2 context sees the Leaflet map
 * with the user's tiles, never a map that fails to start: up front when the probe
 * says no, and the moment the GL map's own constructor is refused when it said yes.
 */
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../../tests/helpers/render';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { useSettingsStore } from '../../store/settingsStore';
import { resetWebGLProbe } from '../../utils/webgl';
import { buildGlMap } from './glSupport';
import { MapViewAuto } from './MapViewAuto';

const gl = vi.hoisted(() => ({ refuse: false }));

vi.mock('./MapView', () => ({
  MapView: () => <div data-testid="leaflet-map" />,
}));

/** Stands in for MapViewGL: builds its map the way the real one does, through buildGlMap. */
function FakeGlMap() {
  useEffect(() => {
    buildGlMap(() => {
      if (!gl.refuse) return {};
      const err = new Error('WebGL2 is required to display this map.');
      err.name = 'GPUInitializationError';
      throw err;
    });
  }, []);
  return <div data-testid="gl-map" />;
}

vi.mock('./glLazy', () => ({ MapViewGLMaplibre: FakeGlMap, MapViewGLMapbox: FakeGlMap }));
vi.mock('./useRoadtripHazards', () => ({ useRoadtripHazards: () => ({ feed: null }) }));

const realGetContext = HTMLCanvasElement.prototype.getContext;

function browserWithWebGL2(available: boolean) {
  const ctx = { getExtension: () => ({ loseContext: () => {} }) };
  HTMLCanvasElement.prototype.getContext = vi.fn((type: string) =>
    available && type === 'webgl2' ? ctx : null
  ) as unknown as typeof realGetContext;
}

beforeEach(() => {
  resetAllStores();
  resetWebGLProbe();
  gl.refuse = false;
  seedStore(useSettingsStore, { settings: { map_provider: 'maplibre-gl', mapbox_access_token: '' } });
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext;
  resetWebGLProbe();
});

describe('MapViewAuto without WebGL2', () => {
  it('FE-COMP-MAPAUTO-WEBGL-001: draws the MapLibre map where WebGL2 is there', async () => {
    browserWithWebGL2(true);

    render(<MapViewAuto places={[]} />);

    expect(await screen.findByTestId('gl-map')).toBeInTheDocument();
    expect(screen.queryByTestId('leaflet-map')).not.toBeInTheDocument();
  });

  it('FE-COMP-MAPAUTO-WEBGL-002: draws the Leaflet map when the browser has no WebGL2', () => {
    browserWithWebGL2(false);

    render(<MapViewAuto places={[]} />);

    expect(screen.getByTestId('leaflet-map')).toBeInTheDocument();
    expect(screen.queryByTestId('gl-map')).not.toBeInTheDocument();
  });

  it('FE-COMP-MAPAUTO-WEBGL-003: falls back to Leaflet when the GPU refuses the context the probe promised', async () => {
    browserWithWebGL2(true);
    gl.refuse = true;

    render(<MapViewAuto places={[]} />);

    expect(await screen.findByTestId('leaflet-map')).toBeInTheDocument();
    expect(screen.queryByTestId('gl-map')).not.toBeInTheDocument();
  });
});
