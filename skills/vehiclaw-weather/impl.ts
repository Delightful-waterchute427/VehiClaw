// skills/vehiclaw-weather/impl.ts
// OpenWeatherMap One Call API 3.0 integration

import axios from 'axios';
import { config } from '../../src/config.js';
import { log } from '../../src/logger.js';

export interface WeatherResult {
  location: string;
  tempF: number;
  feelsLikeF: number;
  description: string;
  humidity: number;
  windMph: number;
  icon: string;
  forecast?: ForecastHour[];
}

export interface ForecastHour {
  time: string;
  tempF: number;
  description: string;
  precipChance: number;
}

// Convert Kelvin → Fahrenheit
const toF = (k: number) => Math.round((k - 273.15) * 9/5 + 32);
// Convert m/s → mph
const toMph = (ms: number) => Math.round(ms * 2.237);

export async function getWeather(params: {
  location: string;
  forecast_hours?: number;
  coords?: { lat: number; lng: number };
}): Promise<WeatherResult> {
  const apiKey = config.openWeatherApiKey;
  if (!apiKey) throw new Error('OPENWEATHERMAP_API_KEY not configured');

  const { location, forecast_hours = 0, coords } = params;

  let lat: number, lng: number, cityName: string;

  if (coords) {
    lat = coords.lat;
    lng = coords.lng;
    cityName = location === 'current' ? config.locationCity || 'Your Location' : location;
  } else if (location === 'current') {
    throw new Error('No GPS coordinates available for current location weather');
  } else {
    // Geocode the city name
    const geoResp = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
      params: { q: location, limit: 1, appid: apiKey },
      timeout: 5000,
    });
    if (!geoResp.data.length) throw new Error(`City not found: ${location}`);
    lat = geoResp.data[0].lat;
    lng = geoResp.data[0].lon;
    cityName = geoResp.data[0].name;
  }

  const parts = forecast_hours > 0 ? 'current,hourly' : 'current';
  const weatherResp = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
    params: { lat, lon: lng, exclude: 'minutely,daily,alerts', appid: apiKey },
    timeout: 8000,
  });

  const current = weatherResp.data.current;
  const result: WeatherResult = {
    location: cityName,
    tempF: toF(current.temp),
    feelsLikeF: toF(current.feels_like),
    description: current.weather[0].description,
    humidity: current.humidity,
    windMph: toMph(current.wind_speed),
    icon: current.weather[0].icon,
  };

  if (forecast_hours > 0 && weatherResp.data.hourly) {
    const hoursToShow = Math.min(Math.ceil(forecast_hours / 3), 8);
    result.forecast = weatherResp.data.hourly
      .slice(0, hoursToShow * 3)
      .filter((_: unknown, i: number) => i % 3 === 0)
      .slice(0, hoursToShow)
      .map((h: Record<string, unknown>) => ({
        time: new Date((h.dt as number) * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
        tempF: toF(h.temp as number),
        description: (h.weather as Array<{ description: string }>)[0].description,
        precipChance: Math.round(((h.pop as number) ?? 0) * 100),
      }));
  }

  log(`Weather: ${cityName} ${result.tempF}°F ${result.description}`);
  return result;
}

export const weatherTools = {
  get_weather: getWeather,
};
