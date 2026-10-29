import { useMemo } from 'react';
import type { TourPlannerController } from '../../components/Tours/planner/useTourPlanner';
import { useTourMapVisibility } from '../../components/Tours/useTourMapVisibility';
import type { Place } from '../../types';
import { parseRenderableRouteGeometry } from '../../utils/routeGeometry';

/**
 * The trip's tours on the Tours map while none is open, as the plan map shows them:
 * each tour's place, whose line and marker the map draws in the tour's colour, and the
 * corners of those lines for the camera to frame. A tour hidden from the map in the
 * list stays off it here too. Empty off the Tours tab and while a tour is open, an
 * import viewed or the wanderer browser up, so the map then shows that alone.
 */
export function useTourOverview(
  tripId: number,
  places: readonly Place[],
  tourPlaceIds: ReadonlySet<number>,
  view: {
    activeTab: string;
    tourPlanner: Pick<TourPlannerController, 'mode'>;
    wandererBrowser: { open: boolean };
  }
) {
  const showing =
    view.activeTab === 'tour-planner' && view.tourPlanner.mode.type === 'neutral' && !view.wandererBrowser.open;
  const { hiddenIds } = useTourMapVisibility(tripId, tourPlaceIds);
  const tourPlaces = useMemo(
    () =>
      showing
        ? places.filter((place) => tourPlaceIds.has(place.id) && !hiddenIds.has(place.id) && !!place.route_geometry)
        : [],
    [showing, places, tourPlaceIds, hiddenIds]
  );
  const framePoints = useMemo(() => tourPlaces.flatMap((place) => cornersOf(place.route_geometry)), [tourPlaces]);
  return {
    tourPlaces,
    framePoints,
    // Part of the camera's key, so the map frames the tours again once they are loaded or one is shown or hidden.
    focusSuffix: tourPlaces.length ? `:tours:${tourPlaces.map((place) => place.id).join(',')}` : '',
  };
}

/** The south-west and north-east corners of a stored line, or nothing for a line that does not parse. */
function cornersOf(routeGeometry: string | null | undefined): [number, number][] {
  const points = parseRenderableRouteGeometry(routeGeometry);
  if (!points?.length) return [];
  const lats = points.map(([lat]) => lat);
  const lngs = points.map(([, lng]) => lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}
