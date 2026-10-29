import { haversineMetres } from '../geo/haversine';

/** One decoded `route_geometry` point: `[lat, lng]` or `[lat, lng, ele]`. */
export type GeometryPoint = [number, number] | [number, number, number];

export interface TourMetrics {
  /** Sum of segment haversine distances, in km. */
  distanceKm: number;
  /** Ascent in metres, jitter under ELEVATION_NOISE_M left out. Null when the track carries no elevation. */
  elevationGainM: number | null;
  /** Descent in metres, counted the same way. Null when no elevation. */
  elevationLossM: number | null;
  /** Whether every point in the geometry carried a 3rd (elevation) value. */
  hasElevation: boolean;
}

/**
 * How far, in metres, a height has to move from the last one that counted before
 * it counts as climbing or descending. Elevation models jitter a few metres from
 * one point to the next, and summed as it came, that jitter was the whole ascent
 * of a flat city walk: 121 m across Venice, whose highest point is 16 m. Measured
 * this way a real climb still adds up in full; only moves smaller than this that
 * turn back are left out.
 */
const ELEVATION_NOISE_M = 5;

/**
 * Ascent and descent over a run of heights, in metres, with the noise above
 * filtered out. The server's stored tour figures and the client's live analysis
 * both count with this, so a tour reads the same in the list and in its detail.
 */
export function elevationGainLoss(heights: readonly number[]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  let [ref] = heights;
  if (ref === undefined) return { gain, loss };
  for (const height of heights) {
    const delta = height - ref;
    if (delta >= ELEVATION_NOISE_M) gain += delta;
    else if (delta <= -ELEVATION_NOISE_M) loss -= delta;
    else continue;
    ref = height;
  }
  return { gain, loss };
}

/**
 * Derives distance/elevation from a parsed `route_geometry` array. Never throws:
 * a track with fewer than 2 points, or with missing/mixed elevation, still
 * yields a usable (if partial) result rather than blocking import.
 *
 * The server stores these numbers on every tour; the client computes the same
 * ones for a tour saved offline, so both read them from here.
 */
export function computeTourMetrics(points: readonly GeometryPoint[]): TourMetrics {
  const [first, ...rest] = points;
  if (!first || rest.length === 0) {
    return { distanceKm: 0, elevationGainM: null, elevationLossM: null, hasElevation: false };
  }
  const hasElevation = points.every((p) => p.length === 3 && Number.isFinite(p[2]));

  let distanceKm = 0;
  let prev = first;
  for (const point of rest) {
    distanceKm += haversineMetres(prev[0], prev[1], point[0], point[1]) / 1000;
    prev = point;
  }
  const elevation = hasElevation ? elevationGainLoss(points.map((point) => point[2] as number)) : null;

  return {
    distanceKm,
    elevationGainM: elevation ? elevation.gain : null,
    elevationLossM: elevation ? elevation.loss : null,
    hasElevation,
  };
}
