// skills/vehiclaw-restaurant/impl.ts
// Yelp Fusion API v3 — business search and reservation deeplinks

import axios from 'axios';
import { config } from '../../src/config.js';
import { log } from '../../src/logger.js';

export interface Restaurant {
  businessId: string;
  name: string;
  rating: number;
  reviewCount: number;
  priceLevel?: string;       // "$", "$$", "$$$", "$$$$"
  categories: string[];
  address: string;
  distance?: number;         // meters from search location
  phone?: string;
  isOpen: boolean;
  imageUrl?: string;
  yelpUrl: string;
  reservationUrl?: string;
}

const PRICE_MAP: Record<string, string> = {
  cheap: '1',
  moderate: '2',
  expensive: '3',
  very_expensive: '4',
};

// ── find_restaurant ───────────────────────────────────────────────────────────

export async function findRestaurant(params: {
  cuisine?: string;
  price_level?: 'cheap' | 'moderate' | 'expensive' | 'very_expensive';
  party_size?: number;
  near: string;
  open_now?: boolean;
}): Promise<Restaurant[]> {
  const apiKey = config.yelpApiKey;
  if (!apiKey) throw new Error('YELP_API_KEY not configured');

  const { cuisine, price_level, near, open_now = true } = params;

  const searchParams: Record<string, unknown> = {
    term: cuisine ? `${cuisine} restaurant` : 'restaurant',
    location: near === 'current' ? 'current location' : near,
    limit: 6,
    sort_by: 'best_match',
  };

  if (price_level) searchParams.price = PRICE_MAP[price_level];
  if (open_now) searchParams.open_now = true;

  const response = await axios.get('https://api.yelp.com/v3/businesses/search', {
    headers: { Authorization: `Bearer ${apiKey}` },
    params: searchParams,
    timeout: 8000,
  });

  const businesses: Array<Record<string, unknown>> = response.data.businesses ?? [];

  return businesses.slice(0, 6).map((b) => {
    const location = b.location as Record<string, unknown>;
    const address = [
      location.address1,
      location.city,
    ].filter(Boolean).join(', ');

    return {
      businessId: b.id as string,
      name: b.name as string,
      rating: b.rating as number,
      reviewCount: b.review_count as number,
      priceLevel: b.price as string | undefined,
      categories: ((b.categories as Array<{ title: string }>) ?? []).map(c => c.title),
      address,
      distance: b.distance as number | undefined,
      phone: b.phone as string | undefined,
      isOpen: !(b.is_closed as boolean),
      imageUrl: b.image_url as string | undefined,
      yelpUrl: b.url as string,
    };
  });
}

// ── make_reservation ──────────────────────────────────────────────────────────

export interface ReservationResult {
  businessId: string;
  name: string;
  deeplink: string;   // Yelp reservation URL or intent
  confirmed: false;   // Always false — user must tap to confirm
}

export async function makeReservation(params: {
  business_id: string;
  party_size: number;
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
}): Promise<ReservationResult> {
  const apiKey = config.yelpApiKey;
  if (!apiKey) throw new Error('YELP_API_KEY not configured');

  const { business_id, party_size, date, time } = params;

  // Look up the business to get its name and reservation URL
  const response = await axios.get(`https://api.yelp.com/v3/businesses/${business_id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 5000,
  });

  const business = response.data;
  const businessName: string = business.name;

  // Build Yelp reservation deeplink
  // Format: https://www.yelp.com/reservations/{alias}?date={date}&time={time}&covers={party_size}
  const alias: string = business.alias ?? business_id;
  const reservationUrl = `https://www.yelp.com/reservations/${alias}?date=${date}&time=${time}&covers=${party_size}`;

  log(`Reservation link: ${businessName} — ${reservationUrl}`);

  return {
    businessId: business_id,
    name: businessName,
    deeplink: reservationUrl,
    confirmed: false,
  };
}

export const restaurantTools = {
  find_restaurant: findRestaurant,
  make_reservation: makeReservation,
};
