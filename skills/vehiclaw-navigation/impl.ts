// skills/vehiclaw-navigation/impl.ts
// Google Maps Directions API + Places Nearby Search

import axios from 'axios';
import { config } from '../../src/config.js';
import { log } from '../../src/logger.js';

export interface NavigationResult {
  destinationName: string;
  address: string;
  etaMinutes: number;
  distanceMiles: number;
  deeplink: string;  // Android intent: google.navigation:q=lat,lng
}

export interface NearbyPlace {
  name: string;
  address: string;
  distanceMiles: number;
  rating?: number;
  isOpen?: boolean;
  placeId: string;
}

// ── navigate_maps ─────────────────────────────────────────────────────────────

export async function navigateMaps(params: {
  destination: string;
  mode?: 'driving' | 'walking';
  avoid?: ('tolls' | 'highways' | 'ferries')[];
  origin?: string;  // defaults to current location hint
}): Promise<NavigationResult> {
  const apiKey = config.googleMapsApiKey;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not configured');

  const { destination, mode = 'driving', avoid = [] } = params;

  const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
    params: {
      origin: params.origin ?? 'current+location',
      destination,
      mode,
      avoid: avoid.join('|') || undefined,
      key: apiKey,
    },
    timeout: 8000,
  });

  if (response.data.status !== 'OK') {
    throw new Error(`Directions API: ${response.data.status}`);
  }

  const route = response.data.routes[0];
  const leg = route.legs[0];

  const etaSeconds = leg.duration_in_traffic?.value ?? leg.duration.value;
  const etaMinutes = Math.round(etaSeconds / 60);
  const distanceMeters = leg.distance.value;
  const distanceMiles = +(distanceMeters / 1609.34).toFixed(1);

  const endLat = leg.end_location.lat;
  const endLng = leg.end_location.lng;
  const deeplink = `google.navigation:q=${endLat},${endLng}&mode=d`;

  log(`Navigation: ${destination} → ${etaMinutes}min / ${distanceMiles}mi`);

  return {
    destinationName: leg.end_address.split(',')[0],
    address: leg.end_address,
    etaMinutes,
    distanceMiles,
    deeplink,
  };
}

// ── search_nearby ─────────────────────────────────────────────────────────────

export async function searchNearby(params: {
  query: string;
  category?: string;
  radius_km?: number;
  open_now?: boolean;
  location?: { lat: number; lng: number };
}): Promise<NearbyPlace[]> {
  const apiKey = config.googleMapsApiKey;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not configured');

  const { query, radius_km = 5, open_now = true, location } = params;

  const searchParams: Record<string, unknown> = {
    query,
    radius: radius_km * 1000,
    key: apiKey,
  };

  if (open_now) searchParams.opennow = true;
  if (location) searchParams.location = `${location.lat},${location.lng}`;

  const response = await axios.get(
    'https://maps.googleapis.com/maps/api/place/textsearch/json',
    { params: searchParams, timeout: 8000 }
  );

  if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places API: ${response.data.status}`);
  }

  return (response.data.results as Array<Record<string, unknown>>).slice(0, 6).map((place) => ({
    name: place.name as string,
    address: (place.formatted_address as string) ?? '',
    distanceMiles: 0,  // Not available in text search — would need distance matrix for exact
    rating: place.rating as number | undefined,
    isOpen: (place.opening_hours as { open_now?: boolean } | undefined)?.open_now,
    placeId: place.place_id as string,
  }));
}

// ── Tool registry entries (used by gateway-client when OpenClaw calls the tool) ──

export const navigationTools = {
  navigate_maps: navigateMaps,
  search_nearby: searchNearby,
};
