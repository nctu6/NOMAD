const express = require('express');
const fetch = require('node-fetch');
const { authenticate } = require('../middleware/auth');
const { db } = require('../db/database');

const router = express.Router();

const WEATHER_HTTP_TIMEOUT_MS = 10000;
const WEATHER_HTTP_RETRIES = 2;
const STALE_WEATHER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GOOGLE_WEATHER_DISABLE_MS = 30 * 60 * 1000;
const RETRYABLE_NETWORK_CODES = new Set([
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
]);
let googleWeatherDisabledUntil = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableFetchError(err) {
  if (!err) return false;
  if (err.type === 'request-timeout') return true;
  if (RETRYABLE_NETWORK_CODES.has(err.code)) return true;
  return false;
}

async function fetchJsonWithRetry(url, options = {}) {
  const retries = Number.isInteger(options.retries) ? options.retries : WEATHER_HTTP_RETRIES;
  const timeout = Number.isInteger(options.timeoutMs) ? options.timeoutMs : WEATHER_HTTP_TIMEOUT_MS;
  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { timeout });
      const data = await response.json();
      return { response, data };
    } catch (err) {
      lastErr = err;
      if (!isRetryableFetchError(err) || attempt >= retries) throw err;
      // short backoff to absorb transient upstream/network hiccups
      await sleep(300 * (attempt + 1));
    }
  }

  throw lastErr || new Error('Unknown weather fetch error');
}

// --------------- In-memory weather cache ---------------
const weatherCache = new Map();

const TTL_FORECAST_MS = 60 * 60 * 1000;   // 1 hour
const TTL_CURRENT_MS  = 15 * 60 * 1000;   // 15 minutes
const TTL_CLIMATE_MS  = 24 * 60 * 60 * 1000; // 24 hours (historical data doesn't change)

function cacheKey(lat, lng, date) {
  const rlat = parseFloat(lat).toFixed(2);
  const rlng = parseFloat(lng).toFixed(2);
  return `${rlat}_${rlng}_${date || 'current'}`;
}

function getCached(key) {
  const entry = weatherCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    if (Date.now() > entry.expiresAt + STALE_WEATHER_MAX_AGE_MS) weatherCache.delete(key);
    return null;
  }
  return entry.data;
}

function getStaleCached(key, maxAgeMs = STALE_WEATHER_MAX_AGE_MS) {
  const entry = weatherCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt + maxAgeMs) {
    weatherCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs) {
  weatherCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function shouldUseGoogleWeather() {
  return Date.now() >= googleWeatherDisabledUntil;
}

function isGoogleWeatherDisabledError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('weather api has not been used') || msg.includes('it is disabled') || msg.includes('api weather.googleapis.com');
}

function noteGoogleWeatherDisabled(err) {
  googleWeatherDisabledUntil = Date.now() + GOOGLE_WEATHER_DISABLE_MS;
  console.error('Google Weather temporarily disabled; skipping calls for 30m:', err?.message || err);
}

function getMapsKey(userId) {
  const user = db.prepare('SELECT maps_api_key FROM users WHERE id = ?').get(userId);
  if (user?.maps_api_key) return user.maps_api_key;
  const admin = db.prepare("SELECT maps_api_key FROM users WHERE role = 'admin' AND maps_api_key IS NOT NULL AND maps_api_key != '' LIMIT 1").get();
  return admin?.maps_api_key || null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseDateKeyFromGoogleDate(displayDate) {
  if (!displayDate) return null;
  const y = Number(displayDate.year);
  const m = Number(displayDate.month);
  const d = Number(displayDate.day);
  if (!y || !m || !d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseDateKeyFromForecastHour(h) {
  const fromDisplay = parseDateKeyFromGoogleDate(h?.displayDateTime);
  if (fromDisplay) return fromDisplay;
  const ts = h?.interval?.startTime;
  if (typeof ts === 'string' && ts.length >= 10) return ts.slice(0, 10);
  return null;
}

function parseHourFromForecastHour(h) {
  const raw = h?.displayDateTime?.hours;
  const hour = Number(raw);
  if (Number.isFinite(hour)) return hour;
  const ts = h?.interval?.startTime;
  if (typeof ts === 'string') {
    const m = ts.match(/T(\d{2}):/);
    if (m) return Number(m[1]);
  }
  return 0;
}

function parseTimeHM(ts) {
  if (!ts || typeof ts !== 'string') return null;
  const m = ts.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

function tempDeg(t) {
  return typeof t?.degrees === 'number' ? t.degrees : null;
}

function qpfMm(p) {
  return typeof p?.qpf?.quantity === 'number' ? p.qpf.quantity : 0;
}

function pProb(p) {
  return typeof p?.probability?.percent === 'number' ? p.probability.percent : null;
}

function windVal(w) {
  const speed = typeof w?.speed?.value === 'number' ? w.speed.value : null;
  const gust = typeof w?.gust?.value === 'number' ? w.gust.value : null;
  if (speed == null && gust == null) return null;
  if (speed == null) return gust;
  if (gust == null) return speed;
  return Math.max(speed, gust);
}

function googleTypeToMain(type) {
  const t = String(type || '').toUpperCase();
  if (t.includes('THUNDER')) return 'Thunderstorm';
  if (t.includes('SNOW') || t.includes('SLEET')) return 'Snow';
  if (t.includes('RAIN') || t.includes('SHOWERS') || t === 'HAIL' || t === 'HAIL_SHOWERS') return 'Rain';
  if (t.includes('CLOUD')) return 'Clouds';
  if (t.includes('WIND')) return 'Clouds';
  if (t === 'CLEAR' || t === 'MOSTLY_CLEAR') return 'Clear';
  return 'Clouds';
}

function googleDescription(cond) {
  return cond?.description?.text || '';
}

async function fetchGoogleCurrent(lat, lng, lang, apiKey) {
  const params = new URLSearchParams({
    key: apiKey,
    'location.latitude': String(lat),
    'location.longitude': String(lng),
    unitsSystem: 'METRIC',
    languageCode: lang || 'en',
  });
  const url = `https://weather.googleapis.com/v1/currentConditions:lookup?${params}`;
  const { response, data } = await fetchJsonWithRetry(url);
  if (!response.ok || data.error) throw new Error(data.error?.message || data.reason || 'Google Weather API error');
  const currentTemp = tempDeg(data.temperature);
  if (currentTemp == null) throw new Error('Google Weather API returned no temperature');

  return {
    temp: Math.round(currentTemp),
    main: googleTypeToMain(data.weatherCondition?.type),
    description: googleDescription(data.weatherCondition),
    type: 'current',
  };
}

async function fetchGoogleForecastDay(lat, lng, targetDateStr, lang, apiKey) {
  const params = new URLSearchParams({
    key: apiKey,
    'location.latitude': String(lat),
    'location.longitude': String(lng),
    unitsSystem: 'METRIC',
    languageCode: lang || 'en',
    days: '10',
    pageSize: '10',
  });
  const url = `https://weather.googleapis.com/v1/forecast/days:lookup?${params}`;
  const { response, data } = await fetchJsonWithRetry(url);
  if (!response.ok || data.error) throw new Error(data.error?.message || data.reason || 'Google Weather API error');
  const days = data.forecastDays || [];
  return days.find(d => parseDateKeyFromGoogleDate(d.displayDate) === targetDateStr) || null;
}

async function fetchGoogleForecastHours(lat, lng, lang, apiKey, maxPages = 12) {
  const base = {
    key: apiKey,
    'location.latitude': String(lat),
    'location.longitude': String(lng),
    unitsSystem: 'METRIC',
    languageCode: lang || 'en',
    hours: '240',
    pageSize: '24',
  };
  const hours = [];
  let pageToken = null;
  for (let i = 0; i < maxPages; i++) {
    const params = new URLSearchParams(base);
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://weather.googleapis.com/v1/forecast/hours:lookup?${params}`;
    const { response, data } = await fetchJsonWithRetry(url);
    if (!response.ok || data.error) throw new Error(data.error?.message || data.reason || 'Google Weather API error');
    hours.push(...(data.forecastHours || []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return hours;
}

// WMO weather code mapping → condition string used by client icon map
const WMO_MAP = {
  0: 'Clear',
  1: 'Clear',          // mainly clear
  2: 'Clouds',         // partly cloudy
  3: 'Clouds',         // overcast
  45: 'Fog',
  48: 'Fog',
  51: 'Drizzle',
  53: 'Drizzle',
  55: 'Drizzle',
  56: 'Drizzle',       // freezing drizzle
  57: 'Drizzle',
  61: 'Rain',
  63: 'Rain',
  65: 'Rain',          // heavy rain
  66: 'Rain',          // freezing rain
  67: 'Rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Snow',
  77: 'Snow',          // snow grains
  80: 'Rain',          // rain showers
  81: 'Rain',
  82: 'Rain',
  85: 'Snow',          // snow showers
  86: 'Snow',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

const WMO_DESCRIPTION_DE = {
  0: 'Klar',
  1: 'Überwiegend klar',
  2: 'Teilweise bewölkt',
  3: 'Bewölkt',
  45: 'Nebel',
  48: 'Nebel mit Reif',
  51: 'Leichter Nieselregen',
  53: 'Nieselregen',
  55: 'Starker Nieselregen',
  56: 'Gefrierender Nieselregen',
  57: 'Starker gefr. Nieselregen',
  61: 'Leichter Regen',
  63: 'Regen',
  65: 'Starker Regen',
  66: 'Gefrierender Regen',
  67: 'Starker gefr. Regen',
  71: 'Leichter Schneefall',
  73: 'Schneefall',
  75: 'Starker Schneefall',
  77: 'Schneekörner',
  80: 'Leichte Regenschauer',
  81: 'Regenschauer',
  82: 'Starke Regenschauer',
  85: 'Leichte Schneeschauer',
  86: 'Starke Schneeschauer',
  95: 'Gewitter',
  96: 'Gewitter mit Hagel',
  99: 'Starkes Gewitter mit Hagel',
};

const WMO_DESCRIPTION_EN = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snowfall',
  73: 'Snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Light rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  85: 'Light snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
};

// Estimate weather condition from average temperature + precipitation
function estimateCondition(tempAvg, precipMm) {
  if (precipMm > 5) return tempAvg <= 0 ? 'Snow' : 'Rain';
  if (precipMm > 1) return tempAvg <= 0 ? 'Snow' : 'Drizzle';
  if (precipMm > 0.3) return 'Clouds';
  return tempAvg > 15 ? 'Clear' : 'Clouds';
}
// -------------------------------------------------------

// GET /api/weather?lat=&lng=&date=&lang=de
router.get('/', authenticate, async (req, res) => {
  const { lat, lng, date, lang = 'de' } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  const ck = cacheKey(lat, lng, date);
  const mapsApiKey = getMapsKey(req.user.id);

  try {
    // ── Forecast for a specific date ──
    if (date) {
      const cached = getCached(ck);
      if (cached) return res.json(cached);

      const targetDate = new Date(date);
      const now = new Date();
      const diffDays = (targetDate - now) / (1000 * 60 * 60 * 24);

      // Within 16-day forecast window → real forecast
      if (diffDays >= -1 && diffDays <= 16) {
        // Prefer Google Weather API when a Google key is available.
        if (mapsApiKey && shouldUseGoogleWeather() && diffDays <= 10) {
          try {
            const gDay = await fetchGoogleForecastDay(lat, lng, targetDate.toISOString().slice(0, 10), lang, mapsApiKey);
            if (gDay) {
              const tMax = tempDeg(gDay.maxTemperature);
              const tMin = tempDeg(gDay.minTemperature);
              if (tMax == null || tMin == null) throw new Error('Google Weather API returned incomplete daily temperatures');
              const dayPart = gDay.daytimeForecast || gDay.nighttimeForecast || {};
              const result = {
                temp: Math.round((tMax + tMin) / 2),
                temp_max: Math.round(tMax),
                temp_min: Math.round(tMin),
                main: googleTypeToMain(dayPart.weatherCondition?.type),
                description: googleDescription(dayPart.weatherCondition),
                type: 'forecast',
              };
              setCache(ck, result, TTL_FORECAST_MS);
              return res.json(result);
            }
          } catch (gErr) {
            if (isGoogleWeatherDisabledError(gErr)) noteGoogleWeatherDisabled(gErr);
            else console.error('Google Weather daily lookup failed, falling back to Open-Meteo:', gErr.message || gErr);
          }
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=16`;
        const { response, data } = await fetchJsonWithRetry(url);

        if (!response.ok || data.error) {
          return res.status(response.status || 500).json({ error: data.reason || 'Open-Meteo API error' });
        }

        const dateStr = targetDate.toISOString().slice(0, 10);
        const idx = (data.daily?.time || []).indexOf(dateStr);

        if (idx !== -1) {
          const code = data.daily.weathercode[idx];
          const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

          const result = {
            temp: Math.round((data.daily.temperature_2m_max[idx] + data.daily.temperature_2m_min[idx]) / 2),
            temp_max: Math.round(data.daily.temperature_2m_max[idx]),
            temp_min: Math.round(data.daily.temperature_2m_min[idx]),
            main: WMO_MAP[code] || 'Clouds',
            description: descriptions[code] || '',
            type: 'forecast',
          };

          setCache(ck, result, TTL_FORECAST_MS);
          return res.json(result);
        }
        // Forecast didn't include this date — fall through to climate
      }

      // Beyond forecast range or forecast gap → historical climate average
      if (diffDays > -1) {
        const month = targetDate.getMonth() + 1;
        const day = targetDate.getDate();
        // Query a 5-day window around the target date for smoother averages (using last year as reference)
        const refYear = targetDate.getFullYear() - 1;
        const startDate = new Date(refYear, month - 1, day - 2);
        const endDate = new Date(refYear, month - 1, day + 2);
        const startStr = startDate.toISOString().slice(0, 10);
        const endStr = endDate.toISOString().slice(0, 10);

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
        const { response, data } = await fetchJsonWithRetry(url);

        if (!response.ok || data.error) {
          return res.status(response.status || 500).json({ error: data.reason || 'Open-Meteo Climate API error' });
        }

        const daily = data.daily;
        if (!daily || !daily.time || daily.time.length === 0) {
          return res.json({ error: 'no_forecast' });
        }

        // Average across the window
        let sumMax = 0, sumMin = 0, sumPrecip = 0, count = 0;
        for (let i = 0; i < daily.time.length; i++) {
          if (daily.temperature_2m_max[i] != null && daily.temperature_2m_min[i] != null) {
            sumMax += daily.temperature_2m_max[i];
            sumMin += daily.temperature_2m_min[i];
            sumPrecip += daily.precipitation_sum[i] || 0;
            count++;
          }
        }

        if (count === 0) {
          return res.json({ error: 'no_forecast' });
        }

        const avgMax = sumMax / count;
        const avgMin = sumMin / count;
        const avgTemp = (avgMax + avgMin) / 2;
        const avgPrecip = sumPrecip / count;
        const main = estimateCondition(avgTemp, avgPrecip);

        const result = {
          temp: Math.round(avgTemp),
          temp_max: Math.round(avgMax),
          temp_min: Math.round(avgMin),
          main,
          description: '',
          type: 'climate',
        };

        setCache(ck, result, TTL_CLIMATE_MS);
        return res.json(result);
      }

      // Past dates beyond yesterday
      return res.json({ error: 'no_forecast' });
    }

    // ── Current weather (no date) ──
    const cached = getCached(ck);
    if (cached) return res.json(cached);

    // Prefer Google Weather API when a Google key is available.
    if (mapsApiKey && shouldUseGoogleWeather()) {
      try {
        const result = await fetchGoogleCurrent(lat, lng, lang, mapsApiKey);
        setCache(ck, result, TTL_CURRENT_MS);
        return res.json(result);
      } catch (gErr) {
        if (isGoogleWeatherDisabledError(gErr)) noteGoogleWeatherDisabled(gErr);
        else console.error('Google Weather current lookup failed, falling back to Open-Meteo:', gErr.message || gErr);
      }
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode&timezone=auto`;
    const { response, data } = await fetchJsonWithRetry(url);

    if (!response.ok || data.error) {
      return res.status(response.status || 500).json({ error: data.reason || 'Open-Meteo API error' });
    }

    const code = data.current.weathercode;
    const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

    const result = {
      temp: Math.round(data.current.temperature_2m),
      main: WMO_MAP[code] || 'Clouds',
      description: descriptions[code] || '',
      type: 'current',
    };

    setCache(ck, result, TTL_CURRENT_MS);
    res.json(result);
  } catch (err) {
    const stale = getStaleCached(ck);
    if (stale) {
      return res.json({ ...stale, stale: true });
    }
    console.error('Weather error:', err?.code || err?.type || err?.message || err);
    res.status(500).json({ error: 'Error fetching weather data' });
  }
});

// GET /api/weather/detailed?lat=&lng=&date=&lang=de
router.get('/detailed', authenticate, async (req, res) => {
  const { lat, lng, date, lang = 'de' } = req.query;

  if (!lat || !lng || !date) {
    return res.status(400).json({ error: 'Latitude, longitude, and date are required' });
  }

  const ck = `detailed_${cacheKey(lat, lng, date)}`;
  const mapsApiKey = getMapsKey(req.user.id);

  try {
    const cached = getCached(ck);
    if (cached) return res.json(cached);

    const targetDate = new Date(date);
    const now = new Date();
    const diffDays = (targetDate - now) / (1000 * 60 * 60 * 24);
    const dateStr = targetDate.toISOString().slice(0, 10);
    const descriptions = lang === 'de' ? WMO_DESCRIPTION_DE : WMO_DESCRIPTION_EN;

    // Prefer Google Weather API for detailed forecast in its forecast window.
    if (mapsApiKey && shouldUseGoogleWeather() && diffDays >= -1 && diffDays <= 10) {
      try {
        const gDay = await fetchGoogleForecastDay(lat, lng, dateStr, lang, mapsApiKey);
        if (gDay) {
          const tMax = tempDeg(gDay.maxTemperature);
          const tMin = tempDeg(gDay.minTemperature);
          if (tMax == null || tMin == null) throw new Error('Google Weather API returned incomplete daily temperatures');
          const dayPart = gDay.daytimeForecast || {};
          const nightPart = gDay.nighttimeForecast || {};
          const dayProb = pProb(dayPart.precipitation);
          const nightProb = pProb(nightPart.precipitation);
          const precipitationProbabilityMax = Math.max(dayProb ?? 0, nightProb ?? 0);
          const precipitationSum = qpfMm(dayPart.precipitation) + qpfMm(nightPart.precipitation);
          const windMax = Math.max(windVal(dayPart.wind) ?? 0, windVal(nightPart.wind) ?? 0);

          const gHours = await fetchGoogleForecastHours(lat, lng, lang, mapsApiKey);
          const hourlyData = gHours
            .filter(h => parseDateKeyFromForecastHour(h) === dateStr)
            .map(h => ({
              hour: parseHourFromForecastHour(h),
              temp: Math.round(tempDeg(h.temperature) ?? 0),
              precipitation_probability: pProb(h.precipitation) ?? 0,
              precipitation: qpfMm(h.precipitation),
              main: googleTypeToMain(h.weatherCondition?.type),
              wind: Math.round(windVal(h.wind) ?? 0),
              humidity: Math.round(
                typeof h.relativeHumidity === 'number'
                  ? h.relativeHumidity
                  : (typeof h.relativeHumidity?.percent === 'number' ? h.relativeHumidity.percent : 0)
              ),
            }));

          const result = {
            type: 'forecast',
            temp: Math.round((tMax + tMin) / 2),
            temp_max: Math.round(tMax),
            temp_min: Math.round(tMin),
            main: googleTypeToMain((dayPart.weatherCondition || nightPart.weatherCondition)?.type),
            description: googleDescription(dayPart.weatherCondition || nightPart.weatherCondition),
            sunrise: parseTimeHM(gDay.sunEvents?.sunriseTime),
            sunset: parseTimeHM(gDay.sunEvents?.sunsetTime),
            precipitation_sum: Math.round(precipitationSum * 10) / 10,
            precipitation_probability_max: precipitationProbabilityMax,
            wind_max: Math.round(windMax),
            hourly: hourlyData,
          };

          setCache(ck, result, TTL_FORECAST_MS);
          return res.json(result);
        }
      } catch (gErr) {
        if (isGoogleWeatherDisabledError(gErr)) noteGoogleWeatherDisabled(gErr);
        else console.error('Google Weather detailed lookup failed, falling back to Open-Meteo:', gErr.message || gErr);
      }
    }

    // Beyond 16-day forecast window → archive API with hourly data from same date last year
    if (diffDays > 16) {
      const refYear = targetDate.getFullYear() - 1;
      const refDateStr = `${refYear}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}`
        + `&start_date=${refDateStr}&end_date=${refDateStr}`
        + `&hourly=temperature_2m,precipitation,weathercode,windspeed_10m,relativehumidity_2m`
        + `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max,sunrise,sunset`
        + `&timezone=auto`;
      const { response, data } = await fetchJsonWithRetry(url);

      if (!response.ok || data.error) {
        return res.status(response.status || 500).json({ error: data.reason || 'Open-Meteo Climate API error' });
      }

      const daily = data.daily;
      const hourly = data.hourly;
      if (!daily || !daily.time || daily.time.length === 0) {
        return res.json({ error: 'no_forecast' });
      }

      const idx = 0;
      const code = daily.weathercode?.[idx];
      const avgMax = daily.temperature_2m_max[idx];
      const avgMin = daily.temperature_2m_min[idx];

      // Build hourly array
      const hourlyData = [];
      if (hourly?.time) {
        for (let i = 0; i < hourly.time.length; i++) {
          const hour = new Date(hourly.time[i]).getHours();
          const hCode = hourly.weathercode?.[i];
          hourlyData.push({
            hour,
            temp: Math.round(hourly.temperature_2m[i]),
            precipitation: hourly.precipitation?.[i] || 0,
            precipitation_probability: 0, // archive has no probability
            main: WMO_MAP[hCode] || 'Clouds',
            wind: Math.round(hourly.windspeed_10m?.[i] || 0),
            humidity: hourly.relativehumidity_2m?.[i] || 0,
          });
        }
      }

      // Format sunrise/sunset
      let sunrise = null, sunset = null;
      if (daily.sunrise?.[idx]) sunrise = daily.sunrise[idx].split('T')[1]?.slice(0, 5);
      if (daily.sunset?.[idx]) sunset = daily.sunset[idx].split('T')[1]?.slice(0, 5);

      const result = {
        type: 'climate',
        temp: Math.round((avgMax + avgMin) / 2),
        temp_max: Math.round(avgMax),
        temp_min: Math.round(avgMin),
        main: WMO_MAP[code] || estimateCondition((avgMax + avgMin) / 2, daily.precipitation_sum?.[idx] || 0),
        description: descriptions[code] || '',
        precipitation_sum: Math.round((daily.precipitation_sum?.[idx] || 0) * 10) / 10,
        wind_max: Math.round(daily.windspeed_10m_max?.[idx] || 0),
        sunrise,
        sunset,
        hourly: hourlyData,
      };

      setCache(ck, result, TTL_CLIMATE_MS);
      return res.json(result);
    }

    // Within 16-day forecast window → full forecast with hourly data
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
      + `&hourly=temperature_2m,precipitation_probability,precipitation,weathercode,windspeed_10m,relativehumidity_2m`
      + `&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset,precipitation_probability_max,precipitation_sum,windspeed_10m_max`
      + `&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

    const { response, data } = await fetchJsonWithRetry(url);

    if (!response.ok || data.error) {
      return res.status(response.status || 500).json({ error: data.reason || 'Open-Meteo API error' });
    }

    const daily = data.daily;
    const hourly = data.hourly;

    if (!daily || !daily.time || daily.time.length === 0) {
      return res.json({ error: 'no_forecast' });
    }

    const dayIdx = 0; // We requested a single day
    const code = daily.weathercode[dayIdx];

    // Parse sunrise/sunset to HH:MM
    const formatTime = (isoStr) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // Build hourly array
    const hourlyData = [];
    if (hourly && hourly.time) {
      for (let i = 0; i < hourly.time.length; i++) {
        const h = new Date(hourly.time[i]).getHours();
        hourlyData.push({
          hour: h,
          temp: Math.round(hourly.temperature_2m[i]),
          precipitation_probability: hourly.precipitation_probability[i] || 0,
          precipitation: hourly.precipitation[i] || 0,
          main: WMO_MAP[hourly.weathercode[i]] || 'Clouds',
          wind: Math.round(hourly.windspeed_10m[i] || 0),
          humidity: Math.round(hourly.relativehumidity_2m[i] || 0),
        });
      }
    }

    const result = {
      type: 'forecast',
      temp: Math.round((daily.temperature_2m_max[dayIdx] + daily.temperature_2m_min[dayIdx]) / 2),
      temp_max: Math.round(daily.temperature_2m_max[dayIdx]),
      temp_min: Math.round(daily.temperature_2m_min[dayIdx]),
      main: WMO_MAP[code] || 'Clouds',
      description: descriptions[code] || '',
      sunrise: formatTime(daily.sunrise[dayIdx]),
      sunset: formatTime(daily.sunset[dayIdx]),
      precipitation_sum: daily.precipitation_sum[dayIdx] || 0,
      precipitation_probability_max: daily.precipitation_probability_max[dayIdx] || 0,
      wind_max: Math.round(daily.windspeed_10m_max[dayIdx] || 0),
      hourly: hourlyData,
    };

    setCache(ck, result, TTL_FORECAST_MS);
    return res.json(result);
  } catch (err) {
    const stale = getStaleCached(ck);
    if (stale) {
      return res.json({ ...stale, stale: true });
    }
    console.error('Detailed weather error:', err?.code || err?.type || err?.message || err);
    res.status(500).json({ error: 'Error fetching detailed weather data' });
  }
});

module.exports = router;
