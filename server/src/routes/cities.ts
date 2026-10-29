import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import { db } from '../db/database';
import { authenticate } from '../middleware/auth';
import {
  ClimateInput,
  FILTERS,
  MetricInput,
  SCORE_CATEGORIES,
  SCORE_VERSION,
  CHEAP_SCORE_MIN,
  FAST_MBPS_MIN,
  HEALTHCARE_SCORE_MIN,
  SAFE_HOMICIDE_MAX,
  WARM_MONTH_MIN_C,
  monthInTimeZone,
  scoreCity,
} from '../services/cityScores';

const router = express.Router();
router.use(authenticate);

interface CityRow {
  id: number;
  slug: string;
  name: string;
  country_code: string;
  country_name: string | null;
  regions_json: string | null;
  lat: number;
  lng: number;
  population: number | null;
  timezone: string | null;
  elevation_m: number | null;
  geoname_id: number | null;
  geo_name: string | null;
  languages_json: string | null;
  english_official: number | null;
  english_used: number | null;
  facts_source: string | null;
  facts_license: string | null;
  facts_fetched_at: string | null;
  geo_source: string | null;
  geo_license: string | null;
  geo_fetched_at: string | null;
}

interface MetricRow extends MetricInput {
  city_id: number;
}

interface ClimateRow extends ClimateInput {
  city_id: number;
}

const SORTS = new Set(['overall', 'name', 'cost', 'internet', 'safety', 'climate', 'healthcare', 'air', 'things_to_do', 'temp']);

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function flag(value: number | null): boolean | null {
  if (value == null) return null;
  return value === 1;
}

function presentMetric(row: MetricRow) {
  return {
    metric: row.metric,
    value: row.value,
    unit: row.unit,
    source: row.source,
    source_url: row.source_url,
    license: row.license,
    fetched_at: row.fetched_at,
    period: row.period,
    scope: row.scope,
    detail: parseJson<unknown>(row.detail_json, null),
  };
}

interface PresentedCity {
  id: number;
  slug: string;
  name: string;
  country_code: string;
  country_name: string | null;
  regions: string[];
  lat: number;
  lng: number;
  population: number | null;
  timezone: string | null;
  elevation_m: number | null;
  languages: string[];
  english_official: boolean | null;
  english_used: boolean | null;
  overall_score: number | null;
  score_count: number;
  scores: ReturnType<typeof scoreCity>['scores'];
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
  current_month: number;
}

function present(city: CityRow, metrics: MetricRow[], climate: ClimateRow[], now = new Date()): PresentedCity {
  const regions = parseJson<string[]>(city.regions_json, []);
  const languages = parseJson<string[]>(city.languages_json, []);
  const month = monthInTimeZone(city.timezone, now);
  const scored = scoreCity(metrics, climate, month);
  return {
    id: city.id,
    slug: city.slug,
    name: city.name,
    country_code: city.country_code,
    country_name: city.country_name,
    regions: Array.isArray(regions) ? regions : [],
    lat: city.lat,
    lng: city.lng,
    population: city.population,
    timezone: city.timezone,
    elevation_m: city.elevation_m,
    languages: Array.isArray(languages) ? languages : [],
    english_official: flag(city.english_official),
    english_used: flag(city.english_used),
    current_month: month,
    ...scored,
  };
}

function loadAll() {
  const cities = db.prepare('SELECT * FROM cities').all() as CityRow[];
  const metrics = db.prepare('SELECT * FROM city_metrics').all() as MetricRow[];
  const climate = db.prepare(`
    SELECT city_id, month, temp_mean_c, temp_min_c, temp_max_c, precip_mm, source, source_url, license, fetched_at, period
    FROM city_climate
  `).all() as ClimateRow[];
  const metricsByCity = new Map<number, MetricRow[]>();
  for (const row of metrics) {
    const list = metricsByCity.get(row.city_id) || [];
    list.push(row);
    metricsByCity.set(row.city_id, list);
  }
  const climateByCity = new Map<number, ClimateRow[]>();
  for (const row of climate) {
    const list = climateByCity.get(row.city_id) || [];
    list.push(row);
    climateByCity.set(row.city_id, list);
  }
  return { cities, metricsByCity, climateByCity };
}

function sortValue(city: PresentedCity, sort: string): number | string | null {
  if (sort === 'name') return city.name;
  if (sort === 'temp') return city.typical_temp_c;
  if (sort === 'overall') return city.overall_score;
  if (sort === 'cost' || sort === 'internet' || sort === 'safety' || sort === 'climate' || sort === 'healthcare' || sort === 'air' || sort === 'things_to_do') {
    return city.scores[sort];
  }
  return city.overall_score;
}

function compareCities(a: PresentedCity, b: PresentedCity, sort: string, order: 'asc' | 'desc'): number {
  if (sort === 'name') {
    const delta = a.name.localeCompare(b.name);
    return order === 'desc' ? -delta : delta;
  }
  const av = sortValue(a, sort);
  const bv = sortValue(b, sort);
  const aMissing = av == null || (typeof av === 'number' && Number.isNaN(av));
  const bMissing = bv == null || (typeof bv === 'number' && Number.isNaN(bv));
  if (aMissing && bMissing) return a.name.localeCompare(b.name);
  if (aMissing) return 1;
  if (bMissing) return -1;
  const delta = Number(av) - Number(bv);
  if (delta === 0) return a.name.localeCompare(b.name);
  return order === 'asc' ? delta : -delta;
}

router.get('/', (req: Request, res: Response) => {
  try {
    const { cities, metricsByCity, climateByCity } = loadAll();
    const now = new Date();
    const presented = cities.map(city => present(
      city,
      metricsByCity.get(city.id) || [],
      climateByCity.get(city.id) || [],
      now,
    ));

    const regionSet = new Set<string>();
    for (const city of presented) {
      for (const region of city.regions) regionSet.add(region);
    }

    const search = String(req.query.q || '').trim().toLowerCase();
    const region = String(req.query.region || '').trim();
    const warm = req.query.warm === '1';
    const cheap = req.query.cheap === '1';
    const fast = req.query.fast === '1';
    const safe = req.query.safe === '1';
    const healthcare = req.query.healthcare === '1';
    const english = req.query.english === 'official' ? 'official' : '';
    const sort = SORTS.has(String(req.query.sort)) ? String(req.query.sort) : 'overall';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    const limitRaw = Number.parseInt(String(req.query.limit ?? '200'), 10);
    const offsetRaw = Number.parseInt(String(req.query.offset ?? '0'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 200;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    const filtered = presented.filter(city => {
      if (region && !city.regions.includes(region)) return false;
      if (warm && !(city.typical_temp_c != null && city.typical_temp_c >= WARM_MONTH_MIN_C)) return false;
      if (cheap && !(city.scores.cost != null && city.scores.cost >= CHEAP_SCORE_MIN)) return false;
      if (fast && !(city.download_mbps != null && city.download_mbps >= FAST_MBPS_MIN)) return false;
      if (safe && !(city.homicide_per_100k != null && city.homicide_per_100k <= SAFE_HOMICIDE_MAX)) return false;
      if (healthcare && !(city.scores.healthcare != null && city.scores.healthcare >= HEALTHCARE_SCORE_MIN)) return false;
      if (english === 'official' && city.english_official !== true) return false;
      if (search) {
        const haystack = `${city.name} ${city.country_name || ''} ${city.country_code} ${city.slug}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => compareCities(a, b, sort, order));
    const page = filtered.slice(offset, offset + limit).map(city => ({
      id: city.id,
      slug: city.slug,
      name: city.name,
      country_code: city.country_code,
      country_name: city.country_name,
      regions: city.regions,
      lat: city.lat,
      lng: city.lng,
      population: city.population,
      timezone: city.timezone,
      languages: city.languages,
      english_official: city.english_official,
      english_used: city.english_used,
      overall_score: city.overall_score,
      score_count: city.score_count,
      scores: city.scores,
      typical_temp_c: city.typical_temp_c,
      current_month: city.current_month,
      price_level_ratio: city.price_level_ratio,
      download_mbps: city.download_mbps,
      homicide_per_100k: city.homicide_per_100k,
      physicians_per_1000: city.physicians_per_1000,
      pm25: city.pm25,
      pm25_scope: city.pm25_scope,
      poi_count: city.poi_count,
      comfort_months: city.comfort_months,
      best_months: city.best_months,
    }));

    res.json({
      cities: page,
      total: filtered.length,
      available: presented.length,
      regions: [...regionSet].sort(),
      scoring: {
        version: SCORE_VERSION,
        categories: SCORE_CATEGORIES,
        weights: 'equal',
        filters: FILTERS,
      },
    });
  } catch (err: unknown) {
    console.error('[cities] list error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to load cities' });
  }
});

interface LiveWeather {
  temp_c: number;
  observed_at: string | null;
  source: string;
  source_url: string;
  license: string;
  fetched_at: string;
}

const liveCache = new Map<string, { expires: number; data: LiveWeather | null }>();

async function fetchLiveTemp(lat: number, lng: number): Promise<LiveWeather | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = liveCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m&timezone=auto`;
  try {
    const response = await fetch(url, { timeout: 4000 } as RequestInit & { timeout: number });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = await response.json() as { current?: { temperature_2m?: number; time?: string } };
    const temp = body.current?.temperature_2m;
    if (typeof temp !== 'number' || !Number.isFinite(temp)) throw new Error('missing temperature');
    const data: LiveWeather = {
      temp_c: temp,
      observed_at: body.current?.time || null,
      source: 'Open-Meteo forecast API',
      source_url: 'https://open-meteo.com/',
      license: 'CC BY 4.0 (underlying models) — Open-Meteo non-commercial API terms',
      fetched_at: new Date().toISOString(),
    };
    liveCache.set(key, { expires: Date.now() + 15 * 60 * 1000, data });
    return data;
  } catch (err: unknown) {
    console.warn('[cities] live weather failed:', err instanceof Error ? err.message : err);
    liveCache.set(key, { expires: Date.now() + 60 * 1000, data: null });
    return null;
  }
}

router.get('/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '');
  if (!/^[a-z0-9-]+$/.test(slug)) {
    res.status(404).json({ error: 'City not found' });
    return;
  }

  try {
    const city = db.prepare('SELECT * FROM cities WHERE slug = ?').get(slug) as CityRow | undefined;
    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }
    const metrics = db.prepare('SELECT * FROM city_metrics WHERE city_id = ? ORDER BY metric').all(city.id) as MetricRow[];
    const climate = db.prepare(`
      SELECT city_id, month, temp_mean_c, temp_min_c, temp_max_c, precip_mm, source, source_url, license, fetched_at, period
      FROM city_climate WHERE city_id = ? ORDER BY month
    `).all(city.id) as ClimateRow[];
    const presented = present(city, metrics, climate);
    const live = await fetchLiveTemp(city.lat, city.lng);
    const climateMeta = climate[0] ? {
      source: climate[0].source || null,
      source_url: climate[0].source_url || null,
      license: climate[0].license || null,
      fetched_at: climate[0].fetched_at || null,
      period: climate[0].period || null,
    } : null;

    res.json({
      city: {
        ...presented,
        geoname_id: city.geoname_id,
        geo_name: city.geo_name,
        facts_source: city.facts_source,
        facts_license: city.facts_license,
        facts_fetched_at: city.facts_fetched_at,
        geo_source: city.geo_source,
        geo_license: city.geo_license,
        geo_fetched_at: city.geo_fetched_at,
      },
      metrics: metrics.map(presentMetric),
      climate: climate.map(row => ({
        month: row.month,
        temp_mean_c: row.temp_mean_c,
        temp_min_c: row.temp_min_c,
        temp_max_c: row.temp_max_c,
        precip_mm: row.precip_mm,
      })),
      climate_meta: climateMeta,
      live,
      monthly_cost: null,
      scoring: {
        version: SCORE_VERSION,
        categories: SCORE_CATEGORIES,
        weights: 'equal',
        filters: FILTERS,
      },
    });
  } catch (err: unknown) {
    console.error('[cities] detail error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to load city' });
  }
});

export default router;
