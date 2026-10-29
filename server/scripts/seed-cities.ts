/**
 * Fetch open data for the starter city set and store it in NOMAD's SQLite database.
 *
 *   cd server && npm run seed:cities
 *   cd server && npm run seed:cities -- --refresh
 *   cd server && npm run seed:cities -- --skip=internet,places
 *   cd server && npm run seed:cities -- --limit=5
 *
 * Re-running fills gaps. --refresh replaces measurements that are already stored.
 * Missing sources are left empty. This script does not invent values.
 *
 * Licenses and formulas: docs/cities-data-sources.md
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { METRIC } from '../src/services/cityScores';

const dbFile = process.env.TREK_DB_FILE || path.join(__dirname, '../data/travel.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const UA = 'NOMAD-city-seed/1.0 (self-hosted travel planner; +https://github.com/mauriceboe/NOMAD)';

const CLIMATE_START = '2021-01-01';
const CLIMATE_END = '2023-12-31';
const CLIMATE_PERIOD = '2021-2023';
const CLIMATE_SOURCE = 'Open-Meteo Historical Weather API (ERA5)';
const CLIMATE_URL = 'https://open-meteo.com/en/docs/historical-weather-api';
const CLIMATE_LICENSE = 'CC BY 4.0 (Copernicus ERA5) via Open-Meteo';

const AIR_SOURCE = 'Open-Meteo Air Quality API (CAMS)';
const AIR_URL = 'https://open-meteo.com/en/docs/air-quality-api';
const AIR_LICENSE = 'Copernicus CAMS via Open-Meteo';

const WB_SOURCE = 'World Bank Open Data';
const WB_LICENSE = 'CC BY 4.0';

const OSM_SOURCE = 'OpenStreetMap via the Overpass API';
const OSM_URL = 'https://www.openstreetmap.org/copyright';
const OSM_LICENSE = 'ODbL 1.0';

const GEO_SOURCE = 'Open-Meteo Geocoding API (GeoNames)';
const GEO_LICENSE = 'CC BY 4.0 (GeoNames) via Open-Meteo';

const FACTS_SOURCE = 'Wikidata';
const FACTS_URL = 'https://www.wikidata.org/';
const FACTS_LICENSE = 'CC0';

const OOKLA_SOURCE = 'Speedtest by Ookla Global Fixed Network Performance Map';
const OOKLA_LICENSE = 'CC BY-NC-SA 4.0';
const OOKLA_ZOOM = 16;
const OOKLA_RADIUS = 2;

interface SeedCity {
  name: string;
  country: string;
  search?: string;
}

interface GeoHit {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  country_code: string;
  country?: string;
  timezone?: string;
  population?: number;
  admin1?: string;
  feature_code?: string;
}

interface CityRecord {
  id: number;
  slug: string;
  name: string;
  country_code: string;
  lat: number;
  lng: number;
  timezone: string | null;
}

interface CountryFacts {
  regions: string[];
  languages: string[];
  englishOfficial: number | null;
  englishUsed: number | null;
}

interface WbPoint {
  year: string;
  value: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const skip = new Set<string>();
  let limit = Number.POSITIVE_INFINITY;
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run seed:cities -- [--refresh] [--skip=geo,facts,worldbank,climate,air,places,internet] [--limit=N]');
      process.exit(0);
    }
    if (arg.startsWith('--skip=')) {
      for (const part of arg.slice(7).split(',')) {
        if (part.trim()) skip.add(part.trim());
      }
    }
    if (arg.startsWith('--limit=')) limit = Number(arg.slice(8));
  }
  return { refresh: args.includes('--refresh'), skip, limit };
}

async function getJson(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number }): Promise<any> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init?.timeout ?? 60000);
    try {
      const response = await fetch(url, {
        method: init?.method,
        headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers || {}) },
        body: init?.body,
        signal: controller.signal,
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        await sleep(1000 * attempt * attempt);
        continue;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} for ${url} ${text.slice(0, 180)}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt === 4) break;
      await sleep(1000 * attempt * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function pool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
}

function slugify(name: string, country: string): string {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${country.toLowerCase()}`;
}

function round(value: number | null, digits: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function wbIndicatorUrl(code: string): string {
  return `https://data.worldbank.org/indicator/${code}`;
}

const upsertCity = db.prepare(`
  INSERT INTO cities (
    slug, name, country_code, country_name, lat, lng, population, timezone, elevation_m,
    geoname_id, geo_name, geo_source, geo_license, geo_fetched_at, updated_at
  ) VALUES (
    @slug, @name, @country_code, @country_name, @lat, @lng, @population, @timezone, @elevation_m,
    @geoname_id, @geo_name, @geo_source, @geo_license, @geo_fetched_at, @updated_at
  )
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    country_code = excluded.country_code,
    country_name = excluded.country_name,
    lat = excluded.lat,
    lng = excluded.lng,
    population = excluded.population,
    timezone = excluded.timezone,
    elevation_m = excluded.elevation_m,
    geoname_id = excluded.geoname_id,
    geo_name = excluded.geo_name,
    geo_source = excluded.geo_source,
    geo_license = excluded.geo_license,
    geo_fetched_at = excluded.geo_fetched_at,
    updated_at = excluded.updated_at
`);

const updateFacts = db.prepare(`
  UPDATE cities SET
    regions_json = @regions_json,
    languages_json = @languages_json,
    english_official = @english_official,
    english_used = @english_used,
    facts_source = @facts_source,
    facts_license = @facts_license,
    facts_fetched_at = @facts_fetched_at,
    updated_at = @updated_at
  WHERE id = @id
`);

const upsertMetric = db.prepare(`
  INSERT INTO city_metrics (
    city_id, metric, value, unit, source, source_url, license, fetched_at, period, scope, detail_json
  ) VALUES (
    @city_id, @metric, @value, @unit, @source, @source_url, @license, @fetched_at, @period, @scope, @detail_json
  )
  ON CONFLICT(city_id, metric) DO UPDATE SET
    value = excluded.value,
    unit = excluded.unit,
    source = excluded.source,
    source_url = excluded.source_url,
    license = excluded.license,
    fetched_at = excluded.fetched_at,
    period = excluded.period,
    scope = excluded.scope,
    detail_json = excluded.detail_json
`);

const countClimate = db.prepare(`
  SELECT COUNT(*) AS n FROM city_climate
  WHERE city_id = ? AND temp_mean_c IS NOT NULL
`);
const deleteClimate = db.prepare('DELETE FROM city_climate WHERE city_id = ?');
const insertClimate = db.prepare(`
  INSERT INTO city_climate (
    city_id, month, temp_mean_c, temp_min_c, temp_max_c, precip_mm, source, source_url, license, fetched_at, period
  ) VALUES (
    @city_id, @month, @temp_mean_c, @temp_min_c, @temp_max_c, @precip_mm, @source, @source_url, @license, @fetched_at, @period
  )
`);
const metricExists = db.prepare('SELECT 1 AS ok FROM city_metrics WHERE city_id = ? AND metric = ?');
const findCity = db.prepare('SELECT id, slug, name, country_code, lat, lng, timezone, facts_fetched_at FROM cities WHERE slug = ?');

function hasMetric(cityId: number, metric: string): boolean {
  return !!metricExists.get(cityId, metric);
}

function writeMetric(row: {
  city_id: number;
  metric: string;
  value: number;
  unit: string;
  source: string;
  source_url: string;
  license: string;
  fetched_at: string;
  period: string | null;
  scope: string;
  detail?: unknown;
}): void {
  if (!Number.isFinite(row.value)) return;
  const { detail, ...rest } = row;
  upsertMetric.run({
    ...rest,
    detail_json: detail == null ? null : JSON.stringify(detail),
  });
}

async function sparql(query: string): Promise<any[]> {
  const data = await getJson('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/sparql-query',
    },
    body: query,
    timeout: 90000,
  });
  return data?.results?.bindings || [];
}

function valuesClause(codes: string[]): string {
  return codes.map(code => `"${code}"`).join(' ');
}

async function loadFacts(codes: string[]): Promise<Map<string, CountryFacts> | null> {
  const values = valuesClause(codes);
  try {
    const continents = await sparql(`
      SELECT ?iso2 ?continentLabel ?rank WHERE {
        VALUES ?iso2 { ${values} }
        ?country wdt:P297 ?iso2 .
        ?country p:P30 ?stmt .
        ?stmt ps:P30 ?continent .
        ?stmt wikibase:rank ?rank .
        FILTER NOT EXISTS { ?stmt wikibase:rank wikibase:DeprecatedRank }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
    `);
    await sleep(1000);
    const languages = await sparql(`
      SELECT ?iso2 ?lang ?langLabel WHERE {
        VALUES ?iso2 { ${values} }
        ?country wdt:P297 ?iso2 ;
                 wdt:P37 ?lang .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
    `);
    await sleep(1000);
    const used = await sparql(`
      SELECT ?iso2 WHERE {
        VALUES ?iso2 { ${values} }
        ?country wdt:P297 ?iso2 ;
                 wdt:P2936 wd:Q1860 .
      }
    `);

    const regionRank = new Map<string, { weight: number; labels: Set<string> }>();
    for (const row of continents) {
      const iso = row.iso2?.value;
      const label = row.continentLabel?.value;
      const rank = String(row.rank?.value || '');
      if (!iso || !label) continue;
      const weight = rank.endsWith('PreferredRank') ? 2 : rank.endsWith('NormalRank') ? 1 : 0;
      if (weight === 0) continue;
      const current = regionRank.get(iso) || { weight: 0, labels: new Set<string>() };
      if (weight > current.weight) {
        current.weight = weight;
        current.labels = new Set([label]);
      } else if (weight === current.weight) {
        current.labels.add(label);
      }
      regionRank.set(iso, current);
    }

    const languageMap = new Map<string, { labels: Set<string>; english: boolean }>();
    for (const row of languages) {
      const iso = row.iso2?.value;
      const label = row.langLabel?.value;
      const lang = String(row.lang?.value || '');
      if (!iso || !label) continue;
      const current = languageMap.get(iso) || { labels: new Set<string>(), english: false };
      current.labels.add(label);
      if (lang.endsWith('/Q1860')) current.english = true;
      languageMap.set(iso, current);
    }

    const usedSet = new Set<string>(used.map(row => row.iso2?.value).filter(Boolean));
    const facts = new Map<string, CountryFacts>();
    for (const code of codes) {
      const langs = languageMap.get(code);
      facts.set(code, {
        regions: [...(regionRank.get(code)?.labels || [])].sort(),
        languages: [...(langs?.labels || [])].sort(),
        englishOfficial: langs ? (langs.english ? 1 : 0) : null,
        englishUsed: usedSet.has(code) ? 1 : null,
      });
    }
    console.log(`[cities] Wikidata facts for ${facts.size} countries`);
    return facts;
  } catch (err: unknown) {
    console.error('[cities] Wikidata failed, country facts will stay empty:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchIndicator(code: string, date: string | null): Promise<any[]> {
  const rows: any[] = [];
  let page = 1;
  for (;;) {
    const dateQuery = date ? `&date=${date}` : '&mrnev=1';
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=1000&page=${page}${dateQuery}`;
    const data = await getJson(url, { timeout: 60000 });
    if (!Array.isArray(data) || !Array.isArray(data[1])) break;
    rows.push(...data[1]);
    const pages = Number(data[0]?.pages || 1);
    if (page >= pages) break;
    page += 1;
  }
  return rows;
}

function seriesByCountry(rows: any[]): Map<string, WbPoint[]> {
  const map = new Map<string, WbPoint[]>();
  for (const row of rows) {
    const code = String(row?.country?.id || '');
    if (!/^[A-Z]{2}$/.test(code)) continue;
    if (row.value == null || !Number.isFinite(Number(row.value))) continue;
    const list = map.get(code) || [];
    list.push({ year: String(row.date), value: Number(row.value) });
    map.set(code, list);
  }
  return map;
}

function latestPoint(rows: WbPoint[] | undefined): WbPoint | null {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => b.year.localeCompare(a.year))[0];
}

function latestRatio(ppp: WbPoint[] | undefined, fx: WbPoint[] | undefined): { year: string; ratio: number; ppp: number; fx: number } | null {
  if (!ppp?.length || !fx?.length) return null;
  const fxByYear = new Map(fx.map(point => [point.year, point.value]));
  const years = [...new Set(ppp.map(point => point.year))].sort().reverse();
  for (const year of years) {
    const pppPoint = ppp.find(point => point.year === year);
    const fxValue = fxByYear.get(year);
    if (!pppPoint || fxValue == null || fxValue === 0) continue;
    return { year, ratio: pppPoint.value / fxValue, ppp: pppPoint.value, fx: fxValue };
  }
  return null;
}

interface WorldBankData {
  price: Map<string, { year: string; ratio: number; ppp: number; fx: number }>;
  homicide: Map<string, WbPoint>;
  physicians: Map<string, WbPoint>;
  pm25: Map<string, WbPoint>;
}

async function loadWorldBank(codes: string[]): Promise<WorldBankData | null> {
  try {
    const [pppRows, fxRows, homicideRows, physicianRows, pmRows] = await Promise.all([
      fetchIndicator('PA.NUS.PPP', '2015:2026'),
      fetchIndicator('PA.NUS.FCRF', '2015:2026'),
      fetchIndicator('VC.IHR.PSRC.P5', null),
      fetchIndicator('SH.MED.PHYS.ZS', null),
      fetchIndicator('EN.ATM.PM25.MC.M3', null),
    ]);
    const ppp = seriesByCountry(pppRows);
    const fx = seriesByCountry(fxRows);
    const price = new Map<string, { year: string; ratio: number; ppp: number; fx: number }>();
    for (const code of codes) {
      const ratio = latestRatio(ppp.get(code), fx.get(code));
      if (ratio) price.set(code, ratio);
    }
    const asLatest = (rows: any[]) => {
      const map = new Map<string, WbPoint>();
      for (const [code, points] of seriesByCountry(rows)) {
        const point = latestPoint(points);
        if (point) map.set(code, point);
      }
      return map;
    };
    const data = {
      price,
      homicide: asLatest(homicideRows),
      physicians: asLatest(physicianRows),
      pm25: asLatest(pmRows),
    };
    const sample = price.get('TH');
    console.log(`[cities] World Bank price levels ${price.size}, homicide ${data.homicide.size}, physicians ${data.physicians.size}, PM2.5 ${data.pm25.size}`);
    if (sample) console.log(`[cities] Thailand price level ratio ${sample.year}: ${sample.ratio.toFixed(3)} (PPP ${sample.ppp} / FX ${sample.fx})`);
    return data;
  } catch (err: unknown) {
    console.error('[cities] World Bank failed, country metrics will stay empty:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function geocode(search: string, country: string): Promise<GeoHit | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(search)}&count=10&language=en&format=json`;
  const data = await getJson(url, { timeout: 20000 });
  const matches = (data.results || []).filter((row: GeoHit) => String(row.country_code || '').toUpperCase() === country);
  if (matches.length === 0) return null;
  // Prefer populated places so "Vancouver" is the city, not Vancouver Island.
  const places = matches.filter((row: GeoHit) => String(row.feature_code || '').startsWith('PPL'));
  const pool = places.length ? places : matches;
  pool.sort((a: GeoHit, b: GeoHit) => (b.population || 0) - (a.population || 0));
  return pool[0];
}

function applyCountryData(city: CityRecord, facts: Map<string, CountryFacts> | null, bank: WorldBankData | null, refresh: boolean, fetchedAt: string): void {
  if (facts) {
    const fact = facts.get(city.country_code);
    updateFacts.run({
      id: city.id,
      regions_json: JSON.stringify(fact?.regions || []),
      languages_json: JSON.stringify(fact?.languages || []),
      english_official: fact?.englishOfficial ?? null,
      english_used: fact?.englishUsed ?? null,
      facts_source: FACTS_SOURCE,
      facts_license: FACTS_LICENSE,
      facts_fetched_at: fetchedAt,
      updated_at: fetchedAt,
    });
  }

  if (!bank) return;
  const writeIfNeeded = (metric: string, value: number | null, unit: string, period: string | null, sourceUrl: string, detail?: unknown) => {
    if (value == null || !Number.isFinite(value)) return;
    if (!refresh && hasMetric(city.id, metric)) return;
    writeMetric({
      city_id: city.id,
      metric,
      value,
      unit,
      source: WB_SOURCE,
      source_url: sourceUrl,
      license: WB_LICENSE,
      fetched_at: fetchedAt,
      period,
      scope: 'country',
      detail,
    });
  };

  const price = bank.price.get(city.country_code);
  if (price) {
    writeIfNeeded(METRIC.PRICE, round(price.ratio, 4), 'US=1', price.year, wbIndicatorUrl('PA.NUS.PPP'), {
      formula: 'PA.NUS.PPP / PA.NUS.FCRF for the same year',
      year: price.year,
      ppp_lcu_per_intl_dollar: price.ppp,
      fx_lcu_per_usd: price.fx,
      note: 'Country price level. Not a city monthly budget.',
    });
  }
  const homicide = bank.homicide.get(city.country_code);
  if (homicide) {
    writeIfNeeded(METRIC.HOMICIDE, round(homicide.value, 4), 'per 100,000 people', homicide.year, wbIndicatorUrl('VC.IHR.PSRC.P5'), {
      indicator: 'VC.IHR.PSRC.P5',
      note: 'Intentional homicides, UNODC via the World Bank. Country figure.',
    });
  }
  const physicians = bank.physicians.get(city.country_code);
  if (physicians) {
    writeIfNeeded(METRIC.PHYSICIANS, round(physicians.value, 3), 'per 1,000 people', physicians.year, wbIndicatorUrl('SH.MED.PHYS.ZS'), {
      indicator: 'SH.MED.PHYS.ZS',
    });
  }
  const pm25 = bank.pm25.get(city.country_code);
  if (pm25) {
    writeIfNeeded(METRIC.PM25_COUNTRY, round(pm25.value, 3), 'µg/m³', pm25.year, wbIndicatorUrl('EN.ATM.PM25.MC.M3'), {
      indicator: 'EN.ATM.PM25.MC.M3',
      note: 'Mean annual exposure. Country figure, not a city monitor.',
    });
  }
}

async function fetchClimate(city: CityRecord, refresh: boolean, fetchedAt: string): Promise<void> {
  const existing = countClimate.get(city.id) as { n: number };
  if (!refresh && existing.n >= 12) return;
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat.toFixed(4)}&longitude=${city.lng.toFixed(4)}&start_date=${CLIMATE_START}&end_date=${CLIMATE_END}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  const data = await getJson(url, { timeout: 60000 });
  const daily = data.daily;
  if (!daily?.time?.length) throw new Error('empty climate response');
  const years = new Set<string>(daily.time.map((day: string) => day.slice(0, 4)));
  const yearCount = years.size || 1;
  const buckets = new Map<number, { means: number[]; mins: number[]; maxes: number[]; precip: number; precipDays: number }>();
  for (let i = 0; i < daily.time.length; i++) {
    const month = Number(String(daily.time[i]).slice(5, 7));
    const bucket = buckets.get(month) || { means: [], mins: [], maxes: [], precip: 0, precipDays: 0 };
    if (typeof daily.temperature_2m_mean[i] === 'number') bucket.means.push(daily.temperature_2m_mean[i]);
    if (typeof daily.temperature_2m_min[i] === 'number') bucket.mins.push(daily.temperature_2m_min[i]);
    if (typeof daily.temperature_2m_max[i] === 'number') bucket.maxes.push(daily.temperature_2m_max[i]);
    if (typeof daily.precipitation_sum[i] === 'number') {
      bucket.precip += daily.precipitation_sum[i];
      bucket.precipDays += 1;
    }
    buckets.set(month, bucket);
  }
  const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const replace = db.transaction(() => {
    deleteClimate.run(city.id);
    for (let month = 1; month <= 12; month++) {
      const bucket = buckets.get(month);
      const enough = !!bucket && bucket.means.length >= 60;
      insertClimate.run({
        city_id: city.id,
        month,
        temp_mean_c: enough ? round(avg(bucket!.means), 2) : null,
        temp_min_c: enough ? round(avg(bucket!.mins), 2) : null,
        temp_max_c: enough ? round(avg(bucket!.maxes), 2) : null,
        precip_mm: enough && bucket!.precipDays > 0 ? round(bucket!.precip / yearCount, 1) : null,
        source: CLIMATE_SOURCE,
        source_url: CLIMATE_URL,
        license: CLIMATE_LICENSE,
        fetched_at: fetchedAt,
        period: CLIMATE_PERIOD,
      });
    }
  });
  replace();
}

async function fetchAir(city: CityRecord, refresh: boolean, fetchedAt: string): Promise<void> {
  if (!refresh && hasMetric(city.id, METRIC.PM25_RECENT)) return;
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat.toFixed(4)}&longitude=${city.lng.toFixed(4)}&hourly=pm2_5&past_days=30&forecast_days=0`;
  const data = await getJson(url, { timeout: 60000 });
  const values = (data.hourly?.pm2_5 || []).filter((value: unknown) => typeof value === 'number') as number[];
  const times = (data.hourly?.time || []).filter((_: string, index: number) => typeof data.hourly.pm2_5[index] === 'number') as string[];
  if (values.length < 24 * 7) {
    console.warn(`[cities] ${city.name}: air sample too short (${values.length} hours), left empty`);
    return;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  writeMetric({
    city_id: city.id,
    metric: METRIC.PM25_RECENT,
    value: round(mean, 2) as number,
    unit: 'µg/m³',
    source: AIR_SOURCE,
    source_url: AIR_URL,
    license: AIR_LICENSE,
    fetched_at: fetchedAt,
    period: times.length ? `${times[0]} to ${times[times.length - 1]} UTC` : 'past 30 days',
    scope: 'city',
    detail: { hours: values.length, past_days_requested: 30 },
  });
}

async function fetchPlaces(city: CityRecord, refresh: boolean, fetchedAt: string): Promise<void> {
  if (!refresh && hasMetric(city.id, METRIC.POI)) return;
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"^(cafe|bar|restaurant|pub|cinema|theatre|nightclub|arts_centre)$"](around:5000,${city.lat.toFixed(5)},${city.lng.toFixed(5)});
      node["tourism"~"^(attraction|museum|gallery|viewpoint|theme_park|zoo|aquarium|artwork)$"](around:5000,${city.lat.toFixed(5)},${city.lng.toFixed(5)});
      node["leisure"~"^(park|garden|stadium|sports_centre|nature_reserve)$"](around:5000,${city.lat.toFixed(5)},${city.lng.toFixed(5)});
    );
    out count;
  `;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let data: any = null;
  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      data = await getJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ data: query }).toString(),
        timeout: 40000,
      });
      break;
    } catch (err) {
      lastError = err;
      await sleep(5000);
    }
  }
  if (!data) throw lastError instanceof Error ? lastError : new Error('Overpass failed');
  const count = (data.elements || []).find((element: { type?: string }) => element.type === 'count');
  const nodes = Number(count?.tags?.nodes);
  if (!Number.isFinite(nodes)) throw new Error('Overpass count missing');
  writeMetric({
    city_id: city.id,
    metric: METRIC.POI,
    value: nodes,
    unit: 'nodes',
    source: OSM_SOURCE,
    source_url: OSM_URL,
    license: OSM_LICENSE,
    fetched_at: fetchedAt,
    period: null,
    scope: 'city',
    detail: {
      radius_m: 5000,
      nodes,
      ways: Number(count.tags.ways || 0),
      total: Number(count.tags.total || nodes),
      note: 'OSM nodes tagged amenity, tourism, or leisure within 5 km. Not a survey of fun.',
    },
  });
}

function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const latRad = lat * Math.PI / 180;
  let x = Math.floor((lng + 180) / 360 * n);
  let y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  x = Math.min(n - 1, Math.max(0, x));
  y = Math.min(n - 1, Math.max(0, y));
  return { x, y };
}

function tileToQuadkey(x: number, y: number, zoom: number): string {
  let quadkey = '';
  for (let i = zoom; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadkey += String(digit);
  }
  return quadkey;
}

function neighborhood(lat: number, lng: number): string[] {
  const { x, y } = latLngToTile(lat, lng, OOKLA_ZOOM);
  const n = 2 ** OOKLA_ZOOM;
  const keys: string[] = [];
  for (let dx = -OOKLA_RADIUS; dx <= OOKLA_RADIUS; dx++) {
    for (let dy = -OOKLA_RADIUS; dy <= OOKLA_RADIUS; dy++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
      keys.push(tileToQuadkey(xx, yy, OOKLA_ZOOM));
    }
  }
  return keys;
}

function nextQuadkeyPrefix(prefix: string): string | null {
  const digits = prefix.split('').map(digit => Number(digit));
  for (let i = digits.length - 1; i >= 0; i--) {
    if (digits[i] < 3) {
      digits[i] += 1;
      for (let j = i + 1; j < digits.length; j++) digits[j] = 0;
      return digits.join('');
    }
  }
  return null;
}

async function findOoklaFile(): Promise<{ url: string; period: string } | null> {
  const candidates = [
    ['2026', '3', '2026-07-01'],
    ['2026', '2', '2026-04-01'],
    ['2026', '1', '2026-01-01'],
    ['2025', '4', '2025-10-01'],
  ];
  for (const [year, quarter, date] of candidates) {
    const url = `https://ookla-open-data.s3.amazonaws.com/parquet/performance/type=fixed/year=${year}/quarter=${quarter}/${date}_performance_fixed_tiles.parquet`;
    try {
      const response = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
      if (response.ok) return { url, period: `${year} Q${quarter}` };
    } catch {
      // Try the next quarter.
    }
  }
  return null;
}

async function fetchInternet(cities: CityRecord[], refresh: boolean, fetchedAt: string): Promise<void> {
  const pending = cities.filter(city => refresh || !hasMetric(city.id, METRIC.DOWN));
  if (pending.length === 0) {
    console.log('[cities] Internet already stored');
    return;
  }
  const fileInfo = await findOoklaFile();
  if (!fileInfo) {
    console.warn('[cities] No Ookla parquet file found, internet left empty');
    return;
  }
  console.log(`[cities] Ookla ${fileInfo.period}: ${fileInfo.url}`);
  const keyToCities = new Map<string, number[]>();
  for (const city of pending) {
    for (const key of neighborhood(city.lat, city.lng)) {
      const list = keyToCities.get(key) || [];
      list.push(city.id);
      keyToCities.set(key, list);
    }
  }
  const groups = new Map<string, string[]>();
  for (const key of keyToCities.keys()) {
    const prefix = key.slice(0, 5);
    const list = groups.get(prefix) || [];
    list.push(key);
    groups.set(prefix, list);
  }
  console.log(`[cities] Looking up ${keyToCities.size} Ookla tiles in ${groups.size} groups`);

  const hy = await import('hyparquet');
  const file = await hy.asyncBufferFromUrl({ url: fileInfo.url });
  const found = new Map<string, { download: number; upload: number; latency: number | null; tests: number; devices: number }>();
  const groupList = [...groups.entries()];
  let done = 0;
  // One query at a time. Parallel reads on one HTTP buffer were failing mid-fetch.
  await pool(groupList, 1, async ([prefix, keys]) => {
    const upper = nextQuadkeyPrefix(prefix);
    const range = upper
      ? [{ quadkey: { $gte: prefix } }, { quadkey: { $lt: upper } }, { quadkey: { $in: keys } }]
      : [{ quadkey: { $in: keys } }];
    let rows: Record<string, unknown>[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        rows = await hy.parquetReadObjects({
          file,
          columns: ['quadkey', 'avg_d_kbps', 'avg_u_kbps', 'avg_lat_ms', 'tests', 'devices'],
          rowFormat: 'object',
          filter: { $and: range },
          useBloomFilters: true,
          usePageIndex: true,
        });
        break;
      } catch (err: unknown) {
        console.warn(`[cities] Ookla prefix ${prefix} attempt ${attempt}:`, err instanceof Error ? err.message : err);
        if (attempt === 3) return;
        await sleep(2000 * attempt);
      }
    }
    for (const row of rows) {
      const quadkey = String(row.quadkey || '').trim();
      if (!keyToCities.has(quadkey)) continue;
      const tests = Number(row.tests) || 0;
      if (tests <= 0) continue;
      found.set(quadkey, {
        download: Number(row.avg_d_kbps),
        upload: Number(row.avg_u_kbps),
        latency: row.avg_lat_ms == null ? null : Number(row.avg_lat_ms),
        tests,
        devices: Number(row.devices) || 0,
      });
    }
    done += 1;
    if (done === 1 || done === groupList.length || done % 10 === 0) {
      console.log(`[cities] Ookla groups ${done}/${groupList.length}, tiles matched ${found.size}`);
    }
  });

  for (const city of pending) {
    const keys = neighborhood(city.lat, city.lng);
    const tiles = keys.map(key => found.get(key)).filter((row): row is NonNullable<typeof row> => !!row);
    if (tiles.length === 0) {
      console.warn(`[cities] ${city.name}: no Ookla tiles, internet left empty`);
      continue;
    }
    let download = 0;
    let upload = 0;
    let latency = 0;
    let latencyTests = 0;
    let tests = 0;
    let devices = 0;
    for (const tile of tiles) {
      download += tile.download * tile.tests;
      upload += tile.upload * tile.tests;
      if (tile.latency != null && Number.isFinite(tile.latency)) {
        latency += tile.latency * tile.tests;
        latencyTests += tile.tests;
      }
      tests += tile.tests;
      devices += tile.devices;
    }
    if (tests <= 0) continue;
    const detail = {
      tiles: tiles.length,
      tests,
      devices,
      zoom: OOKLA_ZOOM,
      radius_tiles: OOKLA_RADIUS,
      note: 'Tests-weighted mean of fixed-broadband tiles in the 5×5 zoom-16 neighborhood of the city center.',
    };
    writeMetric({
      city_id: city.id,
      metric: METRIC.DOWN,
      value: round(download / tests / 1000, 2) as number,
      unit: 'Mbps',
      source: OOKLA_SOURCE,
      source_url: fileInfo.url,
      license: OOKLA_LICENSE,
      fetched_at: fetchedAt,
      period: fileInfo.period,
      scope: 'tile',
      detail,
    });
    writeMetric({
      city_id: city.id,
      metric: METRIC.UP,
      value: round(upload / tests / 1000, 2) as number,
      unit: 'Mbps',
      source: OOKLA_SOURCE,
      source_url: fileInfo.url,
      license: OOKLA_LICENSE,
      fetched_at: fetchedAt,
      period: fileInfo.period,
      scope: 'tile',
      detail,
    });
    if (latencyTests > 0) {
      writeMetric({
        city_id: city.id,
        metric: METRIC.LATENCY,
        value: round(latency / latencyTests, 1) as number,
        unit: 'ms',
        source: OOKLA_SOURCE,
        source_url: fileInfo.url,
        license: OOKLA_LICENSE,
        fetched_at: fetchedAt,
        period: fileInfo.period,
        scope: 'tile',
        detail,
      });
    }
  }
}

async function main(): Promise<void> {
  const { refresh, skip, limit } = parseArgs();
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'nomad-cities.json'), 'utf8')) as SeedCity[];
  const selected = raw.filter(city => city.name && /^[A-Z]{2}$/.test(city.country)).slice(0, limit);
  const countries = [...new Set(selected.map(city => city.country))].sort();
  console.log(`[cities] Seeding ${selected.length} cities in ${countries.length} countries${refresh ? ' (refresh)' : ''}`);

  const fetchedAt = new Date().toISOString();
  const [facts, bank] = await Promise.all([
    skip.has('facts') ? Promise.resolve(null) : loadFacts(countries),
    skip.has('worldbank') ? Promise.resolve(null) : loadWorldBank(countries),
  ]);

  const stored: CityRecord[] = [];
  const missed: string[] = [];
  for (const entry of selected) {
    const slug = slugify(entry.name, entry.country);
    const existing = findCity.get(slug) as (CityRecord & { facts_fetched_at: string | null }) | undefined;
    let record: CityRecord | null = existing
      ? { id: existing.id, slug, name: entry.name, country_code: entry.country, lat: existing.lat, lng: existing.lng, timezone: existing.timezone }
      : null;

    if (!skip.has('geo') && (refresh || !existing)) {
      try {
        const hit = await geocode(entry.search || entry.name, entry.country);
        if (!hit || !Number.isFinite(hit.latitude) || !Number.isFinite(hit.longitude)) {
          missed.push(`${entry.name} (${entry.country})`);
          console.warn(`[cities] No geocode for ${entry.name}, ${entry.country}`);
        } else {
          upsertCity.run({
            slug,
            name: entry.name,
            country_code: entry.country,
            country_name: hit.country || null,
            lat: hit.latitude,
            lng: hit.longitude,
            population: hit.population || null,
            timezone: hit.timezone || null,
            elevation_m: typeof hit.elevation === 'number' ? hit.elevation : null,
            geoname_id: hit.id || null,
            geo_name: hit.name || null,
            geo_source: GEO_SOURCE,
            geo_license: GEO_LICENSE,
            geo_fetched_at: fetchedAt,
            updated_at: fetchedAt,
          });
          const saved = findCity.get(slug) as CityRecord;
          record = { id: saved.id, slug, name: entry.name, country_code: entry.country, lat: saved.lat, lng: saved.lng, timezone: saved.timezone };
          console.log(`[cities] ${entry.name} → ${hit.name}, ${hit.admin1 || ''} (${hit.latitude.toFixed(3)}, ${hit.longitude.toFixed(3)}, pop ${hit.population || 'n/a'})`);
        }
      } catch (err: unknown) {
        missed.push(`${entry.name} (${entry.country})`);
        console.warn(`[cities] Geocode failed for ${entry.name}:`, err instanceof Error ? err.message : err);
      }
    }

    if (!record) continue;
    if ((facts || bank) && (refresh || !existing?.facts_fetched_at || bank)) {
      applyCountryData(record, facts, bank, refresh, fetchedAt);
    } else if (facts && existing && !existing.facts_fetched_at) {
      applyCountryData(record, facts, null, refresh, fetchedAt);
    }
    stored.push(record);
  }
  console.log(`[cities] ${stored.length} cities ready, ${missed.length} without coordinates`);

  if (!skip.has('climate')) {
    let climateDone = 0;
    await pool(stored, 2, async city => {
      await sleep(300);
      try {
        await fetchClimate(city, refresh, fetchedAt);
      } catch (err: unknown) {
        console.warn(`[cities] Climate failed for ${city.name}:`, err instanceof Error ? err.message : err);
      }
      climateDone += 1;
      if (climateDone % 10 === 0 || climateDone === stored.length) console.log(`[cities] Climate ${climateDone}/${stored.length}`);
    });
  }

  if (!skip.has('air')) {
    let airDone = 0;
    await pool(stored, 2, async city => {
      await sleep(200);
      try {
        await fetchAir(city, refresh, fetchedAt);
      } catch (err: unknown) {
        console.warn(`[cities] Air quality failed for ${city.name}:`, err instanceof Error ? err.message : err);
      }
      airDone += 1;
      if (airDone % 10 === 0 || airDone === stored.length) console.log(`[cities] Air ${airDone}/${stored.length}`);
    });
  }

  if (!skip.has('places')) {
    for (let i = 0; i < stored.length; i++) {
      const city = stored[i];
      try {
        await fetchPlaces(city, refresh, fetchedAt);
      } catch (err: unknown) {
        console.warn(`[cities] Places failed for ${city.name}:`, err instanceof Error ? err.message : err);
      }
      if ((i + 1) % 10 === 0 || i + 1 === stored.length) console.log(`[cities] Places ${i + 1}/${stored.length}`);
      await sleep(1200);
    }
  }

  if (!skip.has('internet')) {
    try {
      await fetchInternet(stored, refresh, fetchedAt);
    } catch (err: unknown) {
      console.error('[cities] Internet step failed, those metrics stay empty:', err instanceof Error ? err.message : err);
    }
  }

  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM cities) AS cities,
      (SELECT COUNT(DISTINCT city_id) FROM city_climate WHERE temp_mean_c IS NOT NULL) AS climate,
      (SELECT COUNT(*) FROM city_metrics WHERE metric = 'pm25_recent') AS air,
      (SELECT COUNT(*) FROM city_metrics WHERE metric = 'poi_count') AS places,
      (SELECT COUNT(*) FROM city_metrics WHERE metric = 'internet_download_mbps') AS internet,
      (SELECT COUNT(*) FROM city_metrics WHERE metric = 'price_level_ratio') AS price,
      (SELECT COUNT(*) FROM city_metrics WHERE metric = 'homicide_per_100k') AS safety,
      (SELECT COUNT(*) FROM city_metrics WHERE metric = 'physicians_per_1000') AS healthcare
  `).get();
  console.log('[cities] Done', totals);
}

main()
  .catch((err: unknown) => {
    console.error('[cities] Seed failed:', err instanceof Error ? err.stack || err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    try { db.close(); } catch { /* already closed */ }
  });
