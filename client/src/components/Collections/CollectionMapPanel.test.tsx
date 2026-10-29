/**
 * The collections page's map panel tells the map whether its bar floats over it (FE-COMP-COLMAPPANEL-*).
 *
 * The frame itself is CollectionMap.test.tsx's. The page tests stand the panel in with a double,
 * so this is where the bar's height reaches the frame: without it the top pins land under the bar.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '../../../tests/helpers/render';
import CollectionMapPanel from './CollectionMapPanel';

const handedToMap = vi.hoisted(() => ({ underBar: undefined as boolean | undefined }));
vi.mock('./CollectionMap', () => ({
  default: (props: { underBar?: boolean }) => {
    handedToMap.underBar = props.underBar;
    return null;
  },
}));

function panel(overlay: boolean) {
  return (
    <CollectionMapPanel
      places={[]}
      selectedPlaceId={null}
      onSelect={vi.fn()}
      onDeselect={vi.fn()}
      dark={false}
      overlay={overlay}
      view="list"
      onToggleView={vi.fn()}
      search=""
      onSearch={vi.fn()}
      t={(key) => key}
    />
  );
}

describe('CollectionMapPanel', () => {
  it('FE-COMP-COLMAPPANEL-001: the desktop split floats its bar over the map, which frames its places below it', () => {
    const { container } = render(panel(true));

    expect(container.querySelector('.col-map-topbar')).not.toBeNull();
    expect(handedToMap.underBar).toBe(true);
  });

  it('FE-COMP-COLMAPPANEL-002: a map without the bar frames its places from its own top edge', () => {
    const { container } = render(panel(false));

    expect(container.querySelector('.col-map-topbar')).toBeNull();
    expect(handedToMap.underBar).toBe(false);
  });
});
