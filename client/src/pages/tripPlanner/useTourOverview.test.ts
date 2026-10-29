// FE-TP-TOUROVERVIEW-001 to 003: the trip's tours on the Tours map while none is open.
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetAllStores } from '../../../tests/helpers/store';
import type { Place } from '../../types';
import { useTourOverview } from './useTourOverview';

const OPEN = {
  activeTab: 'tour-planner',
  tourPlanner: { mode: { type: 'neutral' } },
  wandererBrowser: { open: false },
} as const;
const EDITING = { ...OPEN, tourPlanner: { mode: { type: 'new-draft' } } } as const;

const PLACES = [
  { id: 1, lat: 46.6, lng: 12.1, route_geometry: '[[46.5,12.0],[46.7,12.2],[46.6,12.3]]' },
  { id: 2, lat: 45.4, lng: 12.3, route_geometry: '[[45.43,12.32],[45.44,12.34]]' },
  { id: 3, lat: 45.4, lng: 12.3, route_geometry: null },
  { id: 4, lat: 48, lng: 11, route_geometry: '[[48,11],[48.1,11.1]]' },
] as unknown as Place[];
const TOURS: ReadonlySet<number> = new Set([1, 2, 3]);

describe('useTourOverview', () => {
  beforeEach(() => resetAllStores());

  it('FE-TP-TOUROVERVIEW-001: shows the tours with a line, not the other places', () => {
    const { result } = renderHook(() => useTourOverview(5, PLACES, TOURS, OPEN));
    expect(result.current.tourPlaces.map((place) => place.id)).toEqual([1, 2]);
  });

  it('FE-TP-TOUROVERVIEW-002: frames each line by its corners', () => {
    const { result } = renderHook(() => useTourOverview(5, PLACES, TOURS, OPEN));
    expect(result.current.framePoints).toEqual([
      [46.5, 12.0],
      [46.7, 12.3],
      [45.43, 12.32],
      [45.44, 12.34],
    ]);
    expect(result.current.focusSuffix).toBe(':tours:1,2');
  });

  it('FE-TP-TOUROVERVIEW-003: shows nothing while a tour is open', () => {
    const { result } = renderHook(() => useTourOverview(5, PLACES, TOURS, EDITING));
    expect(result.current).toEqual({ tourPlaces: [], framePoints: [], focusSuffix: '' });
  });
});
