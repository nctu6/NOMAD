import express, { Request, Response } from 'express';
import fetch from 'node-fetch';
import { db } from '../db/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

interface NominatimResult {
  osm_type: string;
  osm_id: string;
  name?: string;
  display_name?: string;
  lat: string;
  lon: string;
}

interface GooglePlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  types?: string[];
}

interface GooglePlaceDetails extends GooglePlaceResult {
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  googleMapsUri?: string;
  editorialSummary?: { text: string };
  reviews?: { authorAttribution?: { displayName?: string; photoUri?: string }; rating?: number; text?: { text?: string }; relativePublishTimeDescription?: string }[];
  photos?: { name: string; authorAttributions?: { displayName?: string }[] }[];
}

const router = express.Router();

const MAPS_HTTP_TIMEOUT_MS = 10000;
const MAPS_HTTP_RETRIES = 2;
const RETRYABLE_NETWORK_CODES = new Set([
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ERR_STREAM_PREMATURE_CLOSE',
]);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableFetchError(err: any): boolean {
  if (!err) return false;
  if (err.type === 'request-timeout') return true;
  if (RETRYABLE_NETWORK_CODES.has(err.code)) return true;
  const message = String(err.message || '').toLowerCase();
  return message.includes('premature close') || message.includes('socket hang up');
}

async function fetchJsonWithRetry(url: string, options: Record<string, any> = {}) {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAPS_HTTP_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        timeout: MAPS_HTTP_TIMEOUT_MS,
        compress: false,
      });
      const data = await response.json();
      return { response, data };
    } catch (err) {
      lastErr = err;
      if (!isRetryableFetchError(err) || attempt >= MAPS_HTTP_RETRIES) throw err;
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr || new Error('Unknown maps fetch error');
}

function getMapsKey(userId: number): string | null {
  const user = db.prepare('SELECT maps_api_key FROM users WHERE id = ?').get(userId) as { maps_api_key: string | null } | undefined;
  if (user?.maps_api_key) return user.maps_api_key;
  const admin = db.prepare("SELECT maps_api_key FROM users WHERE role = 'admin' AND maps_api_key IS NOT NULL AND maps_api_key != '' LIMIT 1").get() as { maps_api_key: string } | undefined;
  return admin?.maps_api_key || null;
}

const photoCache = new Map<string, { photoUrl: string; attribution: string | null; fetchedAt: number }>();
const PHOTO_TTL = 12 * 60 * 60 * 1000; // 12 hours
const CACHE_MAX_ENTRIES = 1000;
const CACHE_PRUNE_TARGET = 500;
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of photoCache) {
    if (now - entry.fetchedAt > PHOTO_TTL) photoCache.delete(key);
  }
  if (photoCache.size > CACHE_MAX_ENTRIES) {
    const entries = [...photoCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
    const toDelete = entries.slice(0, entries.length - CACHE_PRUNE_TARGET);
    toDelete.forEach(([key]) => photoCache.delete(key));
  }
}, CACHE_CLEANUP_INTERVAL);

async function searchNominatim(query: string, lang?: string) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '10',
    'accept-language': lang || 'en',
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'NOMAD Travel Planner (https://github.com/mauriceboe/NOMAD)' },
  });
  if (!response.ok) throw new Error('Nominatim API error');
  const data = await response.json() as NominatimResult[];
  return data.map(item => ({
    google_place_id: null,
    osm_id: `${item.osm_type}/${item.osm_id}`,
    name: item.name || item.display_name?.split(',')[0] || '',
    address: item.display_name || '',
    lat: parseFloat(item.lat) || null,
    lng: parseFloat(item.lon) || null,
    rating: null,
    website: null,
    phone: null,
    source: 'openstreetmap',
  }));
}

router.post('/search', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { query } = req.body;

  if (!query) return res.status(400).json({ error: 'Search query is required' });

  const apiKey = getMapsKey(authReq.user.id);

  if (!apiKey) {
    try {
      const places = await searchNominatim(query, req.query.lang as string);
      return res.json({ places, source: 'openstreetmap' });
    } catch (err: unknown) {
      console.error('Nominatim search error:', err);
      return res.status(500).json({ error: 'OpenStreetMap search error' });
    }
  }

  try {
    const { response, data } = await fetchJsonWithRetry('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Keep the mask conservative for broad API-key compatibility.
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating',
      },
      body: JSON.stringify({ textQuery: query, languageCode: (req.query.lang as string) || 'en' }),
    });

    if (!response.ok) {
      const googleError = data.error?.message || 'Google Places API error';
      console.error('Google Places search error:', response.status, googleError);

      // Graceful fallback: if Google fails (e.g. key restrictions), still return results.
      try {
        const places = await searchNominatim(query, req.query.lang);
        return res.json({
          places,
          source: 'openstreetmap',
          fallback_reason: 'google_error',
          google_error: googleError,
        });
      } catch (fallbackErr) {
        console.error('Nominatim fallback after Google error failed:', fallbackErr);
        return res.status(response.status).json({ error: googleError });
      }
    }

    const places = (data.places || []).map((p: GooglePlaceResult) => ({
      google_place_id: p.id,
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      lat: p.location?.latitude || null,
      lng: p.location?.longitude || null,
      rating: p.rating || null,
      website: null,
      phone: null,
      source: 'google',
    }));

    res.json({ places, source: 'google' });
  } catch (err: unknown) {
    console.error('Maps search error:', err);
    try {
      const places = await searchNominatim(query, req.query.lang);
      res.json({ places, source: 'openstreetmap', fallback_reason: 'google_request_failed' });
    } catch (fallbackErr) {
      console.error('Nominatim fallback after request error failed:', fallbackErr);
      res.status(500).json({ error: 'Google Places search error' });
    }
  }
});

router.get('/details/:placeId', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { placeId } = req.params;

  const apiKey = getMapsKey(authReq.user.id);
  if (!apiKey) {
    return res.status(400).json({ error: 'Google Maps API key not configured' });
  }

  try {
    const lang = (req.query.lang as string) || 'de';
    const { response, data } = await fetchJsonWithRetry(`https://places.googleapis.com/v1/places/${placeId}?languageCode=${lang}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,websiteUri,nationalPhoneNumber,regularOpeningHours,googleMapsUri,reviews,editorialSummary',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Google Places API error' });
    }

    const place = {
      google_place_id: data.id,
      name: data.displayName?.text || '',
      address: data.formattedAddress || '',
      lat: data.location?.latitude || null,
      lng: data.location?.longitude || null,
      rating: data.rating || null,
      rating_count: data.userRatingCount || null,
      website: data.websiteUri || null,
      phone: data.nationalPhoneNumber || null,
      opening_hours: data.regularOpeningHours?.weekdayDescriptions || null,
      open_now: data.regularOpeningHours?.openNow ?? null,
      google_maps_url: data.googleMapsUri || null,
      summary: data.editorialSummary?.text || null,
      reviews: (data.reviews || []).slice(0, 5).map((r: NonNullable<GooglePlaceDetails['reviews']>[number]) => ({
        author: r.authorAttribution?.displayName || null,
        rating: r.rating || null,
        text: r.text?.text || null,
        time: r.relativePublishTimeDescription || null,
        photo: r.authorAttribution?.photoUri || null,
      })),
    };

    res.json({ place });
  } catch (err: unknown) {
    console.error('Maps details error:', err);
    res.status(500).json({ error: 'Error fetching place details' });
  }
});

router.get('/place-photo/:placeId', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { placeId } = req.params;

  const cached = photoCache.get(placeId);
  if (cached && Date.now() - cached.fetchedAt < PHOTO_TTL) {
    return res.json({ photoUrl: cached.photoUrl, attribution: cached.attribution });
  }

  const apiKey = getMapsKey(authReq.user.id);
  if (!apiKey) {
    return res.status(400).json({ error: 'Google Maps API key not configured' });
  }

  try {
    const { response: detailsRes, data: details } = await fetchJsonWithRetry(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos',
      },
    });

    if (!detailsRes.ok) {
      console.error('Google Places photo details error:', details.error?.message || detailsRes.status);
      return res.status(404).json({ error: 'Photo could not be retrieved' });
    }

    if (!details.photos?.length) {
      return res.status(404).json({ error: 'No photo available' });
    }

    const photo = details.photos[0];
    const photoName = photo.name;
    const attribution = photo.authorAttributions?.[0]?.displayName || null;

    const { data: mediaData } = await fetchJsonWithRetry(
      `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=600&key=${apiKey}&skipHttpRedirect=true`
    );
    const photoUrl = mediaData.photoUri;

    if (!photoUrl) {
      return res.status(404).json({ error: 'Photo URL not available' });
    }

    photoCache.set(placeId, { photoUrl, attribution, fetchedAt: Date.now() });

    try {
      db.prepare(
        'UPDATE places SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE google_place_id = ? AND (image_url IS NULL OR image_url = ?)'
      ).run(photoUrl, placeId, '');
    } catch (dbErr) {
      console.error('Failed to persist photo URL to database:', dbErr);
    }

    res.json({ photoUrl, attribution });
  } catch (err: unknown) {
    console.error('Place photo error:', err);
    res.status(500).json({ error: 'Error fetching photo' });
  }
});

export default router;
