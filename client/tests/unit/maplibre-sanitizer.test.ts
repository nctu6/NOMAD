import { describe, expect, it } from 'vitest'
import { AttributionControl, type Map } from 'maplibre-gl'

/**
 * GHSA-jrc7-96c5-q579: MapLibre's attribution sanitizer let a second dangerous
 * attribute through after removing the first, so a tile source's attribution
 * could run script. TREK carried a patch for this on 5.x; 6.x replaced the
 * sanitizer with an allow list, and these cases hold the upgrade to it.
 */
function attribution(html: string, fromSource = false) {
  const control = new AttributionControl({
    compact: false,
    customAttribution: fromSource ? undefined : html,
  })
  const map = {
    style: {
      tileManagers: fromSource
        ? { tiles: { used: true, getSource: () => ({ attribution: html }) } }
        : {},
    },
    _getUIString: () => 'Toggle attribution',
    on: () => {},
    off: () => {},
    getCanvasContainer: () => document.createElement('div'),
  } as unknown as Map
  return control.onAdd(map)
}

describe('MapLibre attribution sanitizer', () => {
  it.each([false, true])('leaves no event handler behind (source: %s)', fromSource => {
    const container = attribution('<details open onload="1" ontoggle="alert(1)">Credit</details>', fromSource)
    const inner = container.querySelector('.maplibregl-ctrl-attrib-inner')!
    // <details> is not on the allow list, so it goes with its subtree.
    expect(inner.querySelector('details')).toBeNull()
    expect(inner.querySelectorAll('[onload], [ontoggle]')).toHaveLength(0)
  })

  it('removes consecutive dangerous URLs and handlers in nested markup', () => {
    const container = attribution('<span><a href="javascript:alert(1)" onclick="alert(2)" onfocus="alert(3)">Credit</a></span>')
    const link = container.querySelector('.maplibregl-ctrl-attrib-inner a')!
    expect(link.attributes.length).toBe(0)
  })

  it('preserves provider credit and safe links', () => {
    const container = attribution('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>')
    const link = container.querySelector('.maplibregl-ctrl-attrib-inner a')!
    expect(link.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright')
    expect(link.getAttribute('rel')).toBe('noopener')
    expect(link.textContent).toBe('OpenStreetMap')
  })
})
