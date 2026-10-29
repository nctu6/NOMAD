/**
 * How many times a place already sits on a day, and whether a lodging booking
 * holds it there.
 *
 * The server stores one row per visit, so the same place can be on a day more
 * than once (a cafe at breakfast and again after the museum). A stop a booking
 * wrote is not one of those visits: a second row would sit beside the night
 * with no way back except saving the booking again.
 */

export interface DayStopRef {
  id?: number | null;
  place_id?: number | null;
  place?: { id?: number | null } | null;
  accommodation_id?: number | string | null;
}

export interface DayPlaceCounts {
  /** Ordinary visits of each place. A booked night is not counted. */
  counts: Map<number, number>;
  /** Places a lodging booking already put on the day. */
  blocked: Set<number>;
}

function placeIdOf(row: DayStopRef): number | null {
  const id = row.place?.id ?? row.place_id;
  return typeof id === 'number' ? id : null;
}

function isBookedNight(row: DayStopRef): boolean {
  return row.accommodation_id != null && row.accommodation_id !== '';
}

/**
 * Rows are deduped by assignment id when they have one, so a day list and the
 * store copy of the same stop are not counted twice.
 */
export function dayPlaceCounts(rows: readonly DayStopRef[]): DayPlaceCounts {
  const counts = new Map<number, number>();
  const blocked = new Set<number>();
  const seen = new Set<number>();
  for (const row of rows) {
    if (typeof row.id === 'number') {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
    }
    const placeId = placeIdOf(row);
    if (placeId == null) continue;
    if (isBookedNight(row)) {
      blocked.add(placeId);
      continue;
    }
    counts.set(placeId, (counts.get(placeId) ?? 0) + 1);
  }
  return { counts, blocked };
}
