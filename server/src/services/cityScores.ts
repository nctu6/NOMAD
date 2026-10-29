// NOMAD city scores are normalizations of stored measurements.
// A null input stays null. Nothing here fills a gap with a guess.
// Formulas are also documented in docs/cities-data-sources.md.

export const SCORE_VERSION = 1;

export const METRIC = {
  PRICE: 'price_level_ratio',
  HOMICIDE: 'homicide_per_100k',
  PHYSICIANS: 'physicians_per_1000',
  PM25_COUNTRY: 'pm25_country',
  PM25_RECENT: 'pm25_recent',
  DOWN: 'internet_download_mbps',
  UP: 'internet_upload_mbps',
  LATENCY: 'internet_latency_ms',
  POI: 'poi_count',
} as const;

export const SCORE_CATEGORIES = ['cost', 'internet', 'safety', 'climate', 'healthcare', 'air', 'things_to_do'] as const;
export type ScoreCategory = typeof SCORE_CATEGORIES[number];

export const COMFORT_MIN_C = 18;
export const COMFORT_MAX_C = 28;
export const BEST_MONTH_MAX_PRECIP_MM = 150;
export const WARM_MONTH_MIN_C = 20;
export const CHEAP_SCORE_MIN = 60;
export const FAST_MBPS_MIN = 50;
export const SAFE_HOMICIDE_MAX = 3;
export const HEALTHCARE_SCORE_MIN = 70;

export const FILTERS = {
  warm_temp_c: WARM_MONTH_MIN_C,
  cheap_score: CHEAP_SCORE_MIN,
  fast_mbps: FAST_MBPS_MIN,
  safe_homicide_max: SAFE_HOMICIDE_MAX,
  healthcare_score: HEALTHCARE_SCORE_MIN,
};

export interface MetricInput {
  metric: string;
  value: number | null;
  unit: string | null;
  source: string;
  source_url: string | null;
  license: string | null;
  fetched_at: string;
  period: string | null;
  scope: string;
  detail_json: string | null;
}

export interface ClimateInput {
  month: number;
  temp_mean_c: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  precip_mm: number | null;
  source?: string | null;
  source_url?: string | null;
  license?: string | null;
  fetched_at?: string | null;
  period?: string | null;
}

export interface CityScores {
  cost: number | null;
  internet: number | null;
  safety: number | null;
  climate: number | null;
  healthcare: number | null;
  air: number | null;
  things_to_do: number | null;
}

export interface ScoreBundle {
  scores: CityScores;
  overall_score: number | null;
  score_count: number;
  typical_temp_c: number | null;
  price_level_ratio: number | null;
  download_mbps: number | null;
  upload_mbps: number | null;
  latency_ms: number | null;
  homicide_per_100k: number | null;
  physicians_per_1000: number | null;
  pm25: number | null;
  pm25_scope: 'city' | 'country' | null;
  pm25_country: number | null;
  poi_count: number | null;
  comfort_months: number | null;
  climate_complete: boolean;
  best_months: number[];
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function finiteOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

// Country price level ratio, United States ≈ 1. 0 → 100, 1.5 → 0.
export function costScore(ratio: number | null): number | null {
  const value = finiteOrNull(ratio);
  if (value == null || value < 0) return null;
  return clampScore((1.5 - value) / 1.5 * 100);
}

// Fixed download. 100 Mbps → 100. Faster connections stay at 100.
export function internetScore(mbps: number | null): number | null {
  const value = finiteOrNull(mbps);
  if (value == null || value < 0) return null;
  return clampScore(value / 100 * 100);
}

// National homicide rate per 100,000. 0 → 100, 15 → 0.
export function safetyScore(homicidePer100k: number | null): number | null {
  const value = finiteOrNull(homicidePer100k);
  if (value == null || value < 0) return null;
  return clampScore((15 - value) / 15 * 100);
}

// Share of months whose mean temperature is inside 18–28°C. Needs all 12 months.
export function climateScore(comfortMonths: number | null, complete: boolean): number | null {
  if (!complete || comfortMonths == null || !Number.isFinite(comfortMonths)) return null;
  return clampScore(comfortMonths / 12 * 100);
}

// Physicians per 1,000 people. 5 → 100.
export function healthcareScore(physiciansPer1000: number | null): number | null {
  const value = finiteOrNull(physiciansPer1000);
  if (value == null || value < 0) return null;
  return clampScore(value / 5 * 100);
}

// PM2.5 µg/m³. WHO 2021 guideline 5 → 100, interim target 35 → 0.
export function airScore(pm25: number | null): number | null {
  const value = finiteOrNull(pm25);
  if (value == null || value < 0) return null;
  return clampScore((35 - value) / (35 - 5) * 100);
}

// OSM node count within 5 km. 2,000 nodes → 100, on a log scale.
export function thingsToDoScore(count: number | null): number | null {
  const value = finiteOrNull(count);
  if (value == null || value < 0) return null;
  const cap = 2000;
  return clampScore(Math.log10(value + 1) / Math.log10(cap + 1) * 100);
}

export function monthInTimeZone(timeZone: string | null | undefined, now = new Date()): number {
  if (timeZone) {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' })
        .formatToParts(now)
        .find(item => item.type === 'month');
      const month = Number(part?.value);
      if (month >= 1 && month <= 12) return month;
    } catch {
      // Unknown timezone names fall through to UTC.
    }
  }
  return now.getUTCMonth() + 1;
}

export function inComfortBand(tempMean: number | null): boolean {
  return tempMean != null && Number.isFinite(tempMean) && tempMean >= COMFORT_MIN_C && tempMean <= COMFORT_MAX_C;
}

export function isBestMonth(tempMean: number | null, precipMm: number | null): boolean {
  if (!inComfortBand(tempMean)) return false;
  if (precipMm == null || !Number.isFinite(precipMm)) return false;
  return precipMm <= BEST_MONTH_MAX_PRECIP_MM;
}

export function scoreCity(metrics: MetricInput[], climate: ClimateInput[], month: number): ScoreBundle {
  const byMetric = new Map(metrics.map(row => [row.metric, row]));
  const num = (key: string): number | null => finiteOrNull(byMetric.get(key)?.value);

  const months = new Map(climate.map(row => [row.month, row]));
  const tempMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(index => months.get(index)?.temp_mean_c ?? null);
  const climateComplete = tempMonths.every(value => value != null && Number.isFinite(value));
  const comfortMonths = climateComplete
    ? tempMonths.filter(value => inComfortBand(value)).length
    : null;
  const bestMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(index => {
    const row = months.get(index);
    return !!row && isBestMonth(row.temp_mean_c, row.precip_mm);
  });

  const current = months.get(month);
  const typical = finiteOrNull(current?.temp_mean_c ?? null);
  const recentPm = num(METRIC.PM25_RECENT);
  const countryPm = num(METRIC.PM25_COUNTRY);
  const pm25 = recentPm ?? countryPm;
  const pm25Scope = recentPm != null ? 'city' : countryPm != null ? 'country' : null;

  const price = num(METRIC.PRICE);
  const download = num(METRIC.DOWN);
  const homicide = num(METRIC.HOMICIDE);
  const physicians = num(METRIC.PHYSICIANS);
  const poi = num(METRIC.POI);

  const scores: CityScores = {
    cost: costScore(price),
    internet: internetScore(download),
    safety: safetyScore(homicide),
    climate: climateScore(comfortMonths, climateComplete),
    healthcare: healthcareScore(physicians),
    air: airScore(pm25),
    things_to_do: thingsToDoScore(poi),
  };

  const present = SCORE_CATEGORIES.map(key => scores[key]).filter((value): value is number => value != null);
  const overall = present.length
    ? clampScore(present.reduce((sum, value) => sum + value, 0) / present.length)
    : null;

  return {
    scores,
    overall_score: overall,
    score_count: present.length,
    typical_temp_c: typical,
    price_level_ratio: price,
    download_mbps: download,
    upload_mbps: num(METRIC.UP),
    latency_ms: num(METRIC.LATENCY),
    homicide_per_100k: homicide,
    physicians_per_1000: physicians,
    pm25,
    pm25_scope: pm25Scope,
    pm25_country: countryPm,
    poi_count: poi,
    comfort_months: comfortMonths,
    climate_complete: climateComplete,
    best_months: bestMonths,
  };
}
