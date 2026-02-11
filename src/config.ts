// src/config.ts — VehiClaw configuration loader

import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ConfigSchema = z.object({
  // Server
  port: z.number().default(3000),
  bindHost: z.string().default('0.0.0.0'),
  enableSsl: z.boolean().default(false),

  // OpenClaw Gateway
  gatewayUrl: z.string().default('ws://127.0.0.1:18789'),
  gatewayToken: z.string().optional(),

  // Auth token file path (generated on first run)
  authTokenFile: z.string().default('./data/auth.token'),

  // Google APIs
  googleMapsApiKey: z.string().optional(),
  googleCredentialsFile: z.string().default('./data/google-credentials.json'),
  googleTokenFile: z.string().default('./data/google-token.json'),

  // OpenWeatherMap
  openWeatherApiKey: z.string().optional(),

  // Yelp
  yelpApiKey: z.string().optional(),

  // Agent behavior
  maxHistoryTurns: z.number().default(10),

  // User profile (optional defaults)
  userName: z.string().default('Driver'),
  userTimezone: z.string().default('America/New_York'),
  locationCity: z.string().default(''),

  // Data directory
  dataDir: z.string().default('./data'),
});

type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const raw = {
    port: parseInt(process.env.PORT || '3000', 10),
    bindHost: process.env.BIND_HOST,
    enableSsl: process.env.ENABLE_SSL === 'true',
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL,
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN,
    authTokenFile: process.env.AUTH_TOKEN_FILE,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    googleCredentialsFile: process.env.GOOGLE_CREDENTIALS_FILE,
    googleTokenFile: process.env.GOOGLE_TOKEN_FILE,
    openWeatherApiKey: process.env.OPENWEATHERMAP_API_KEY,
    yelpApiKey: process.env.YELP_API_KEY,
    maxHistoryTurns: parseInt(process.env.MAX_HISTORY_TURNS || '10', 10),
    userName: process.env.USER_NAME,
    userTimezone: process.env.USER_TIMEZONE,
    locationCity: process.env.LOCATION_CITY,
    dataDir: process.env.DATA_DIR,
  };

  // Filter undefined so zod defaults apply
  const filtered = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== '')
  );

  return ConfigSchema.parse(filtered);
}

export const config = loadConfig();
