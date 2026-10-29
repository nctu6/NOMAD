import { presenceSet } from '../../db/repositories/_shared/presence-set';

/**
 * A journey's own settings as an update sets them: what the REST route and
 * the MCP tool hand in, and the columns that answer. One reading of the
 * input for both surfaces: a status outside the allow-list and a status
 * override outside its own are left alone, every flag is stored as 0 or 1,
 * and a field absent from the input never reaches the update.
 */

/** What an update of a journey's settings may carry. Flags come as booleans (or the stored 0/1). */
export type JourneySettingsInput = Partial<{
  title: string;
  subtitle: string | null;
  cover_gradient: string | null;
  cover_image: string;
  status: string;
  status_override: string | null;
  show_trip_tracks: boolean | number;
  photo_location: boolean | number;
  show_verdict: boolean | number;
  show_mood: boolean | number;
  show_weather: boolean | number;
  auto_prepare_recordings: boolean | number;
}>;

/** The columns an update writes, as they are stored. */
type JourneySettingsColumns = {
  title: string;
  subtitle: string | null;
  cover_gradient: string | null;
  cover_image: string | null;
  status: string;
  status_override: string | null;
  show_trip_tracks: number;
  photo_location: number;
  show_verdict: number;
  show_mood: number;
  show_weather: number;
  auto_prepare_recordings: number;
};

const ALLOWED_STATUSES: readonly string[] = ['draft', 'active', 'completed', 'archived'];
// null hands the state back to the trip dates (#762).
const ALLOWED_OVERRIDES: readonly (string | null)[] = [null, 'draft', 'live', 'completed'];

/** The flag columns, stored 0/1 and spoken as booleans. */
const JOURNEY_SETTING_FLAGS = [
  'show_trip_tracks',
  'photo_location',
  'show_verdict',
  'show_mood',
  'show_weather',
  'auto_prepare_recordings',
] as const;

/** The columns an update of `data` writes, each resolved to its stored value (JG24). */
export function journeySettingsPatch(data: JourneySettingsInput): Partial<JourneySettingsColumns> {
  const flag = (value: boolean | number | undefined): number => (value ? 1 : 0);
  return presenceSet<JourneySettingsColumns>({
    title: [data.title !== undefined, data.title as string],
    subtitle: [data.subtitle !== undefined, data.subtitle as string | null],
    cover_gradient: [data.cover_gradient !== undefined, data.cover_gradient as string | null],
    cover_image: [data.cover_image !== undefined, data.cover_image as string],
    status: [data.status !== undefined && ALLOWED_STATUSES.includes(data.status as string), data.status as string],
    status_override: [
      data.status_override !== undefined && ALLOWED_OVERRIDES.includes(data.status_override as string | null),
      data.status_override as string | null,
    ],
    show_trip_tracks: [data.show_trip_tracks !== undefined, flag(data.show_trip_tracks)],
    photo_location: [data.photo_location !== undefined, flag(data.photo_location)],
    show_verdict: [data.show_verdict !== undefined, flag(data.show_verdict)],
    show_mood: [data.show_mood !== undefined, flag(data.show_mood)],
    show_weather: [data.show_weather !== undefined, flag(data.show_weather)],
    auto_prepare_recordings: [data.auto_prepare_recordings !== undefined, flag(data.auto_prepare_recordings)],
  });
}

/** What the settings an update wrote held before, by column, as the MCP tool takes them back (flags as booleans). */
export type JourneySettingsPrevious = Partial<Record<keyof JourneySettingsColumns, string | number | boolean | null>>;

/** The stored values of exactly the columns `patch` writes, read off the row before it, flags as booleans. */
export function previousSettings(
  row: Readonly<Record<string, unknown>> | undefined,
  patch: Partial<JourneySettingsColumns>,
): JourneySettingsPrevious {
  const previous: JourneySettingsPrevious = {};
  for (const key of Object.keys(patch) as (keyof JourneySettingsColumns)[]) {
    const value = row?.[key];
    const isFlag = (JOURNEY_SETTING_FLAGS as readonly string[]).includes(key);
    previous[key] = isFlag ? Number(value) === 1 : ((value ?? null) as string | number | null);
  }
  return previous;
}
