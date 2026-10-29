import type { AssistantChangeRow } from '@trek/shared';
import {
  CircleDot,
  CloudSun,
  Eye,
  EyeOff,
  Footprints,
  Luggage,
  MapPin,
  Palette,
  Route,
  Smile,
  Sparkles,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react';

/**
 * The pure side of a change of a journal itself: the glyph and name of each
 * setting a change row names (under the tool's own field names), and how its
 * value reads, a status by its name, a switch as on or off, a cleared status
 * override as following the trip dates. The names are the journal's own,
 * as its settings dialog writes them.
 */

interface FieldLook {
  Icon: LucideIcon;
  labelKey: string;
}

const FIELDS: Readonly<Record<string, FieldLook>> = {
  status: { Icon: CircleDot, labelKey: 'journey.settings.status' },
  status_override: { Icon: Eye, labelKey: 'assistant.card.journeyHeader.field.statusOverride' },
  show_verdict: { Icon: ThumbsUp, labelKey: 'journey.settings.showVerdict' },
  show_mood: { Icon: Smile, labelKey: 'journey.settings.showMood' },
  show_weather: { Icon: CloudSun, labelKey: 'journey.settings.showWeather' },
  photo_location: { Icon: MapPin, labelKey: 'journey.settings.photoLocation' },
  show_trip_tracks: { Icon: Route, labelKey: 'journey.settings.showTripTracks' },
  auto_prepare_recordings: { Icon: Footprints, labelKey: 'journey.settings.autoPrepare' },
  cover_gradient: { Icon: Palette, labelKey: 'assistant.card.journeyHeader.field.coverGradient' },
  trip: { Icon: Luggage, labelKey: 'assistant.card.journeyHeader.field.trip' },
  suggestions: { Icon: Sparkles, labelKey: 'assistant.card.journeyHeader.field.suggestions' },
  hide_skeletons: { Icon: EyeOff, labelKey: 'journey.skeletons.hide' },
};

const STATUSES: Readonly<Record<string, string>> = {
  draft: 'journey.status.draft',
  active: 'journey.status.active',
  completed: 'journey.status.completed',
  archived: 'journey.status.archived',
  live: 'journey.frontpage.live',
};

const FLAG_ON = '✓';
const FLAG_OFF = '✗';

function own<T>(table: Readonly<Record<string, T>>, key: string | null | undefined): T | null {
  if (!key || !Object.prototype.hasOwnProperty.call(table, key)) return null;
  return table[key] ?? null;
}

/** The look of a setting a row names; null for a field the card has no name for. */
export function headerFieldOf(field: string | undefined): FieldLook | null {
  return own(FIELDS, field);
}

/**
 * The key a value of a setting reads by, or null for one that reads as it is
 * (a name, a count). A cleared status override follows the trip dates again.
 */
export function headerValueKey(field: string | undefined, value: string | null): string | null {
  if (value === FLAG_ON) return 'settings.on';
  if (value === FLAG_OFF) return 'settings.off';
  if (field === 'status_override' && !value) return 'journey.settings.statusAuto';
  if (field === 'status' || field === 'status_override') return own(STATUSES, value);
  return null;
}

/** The setting rows of a change, the trips aside: the card draws those as its own chips. */
export function settingRows(rows: readonly AssistantChangeRow[]): AssistantChangeRow[] {
  return rows.filter((row) => row.labelKey === 'field' && row.field !== 'trip' && headerFieldOf(row.field) !== null);
}
