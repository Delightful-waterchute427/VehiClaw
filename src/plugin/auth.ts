// src/plugin/auth.ts
// Generates and validates the static UI access token (displayed as QR code on first run).

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import qrcode from 'qrcode-terminal';
import { log } from '../logger.js';
import { config } from '../config.js';

let _token: string | null = null;

export function loadOrCreateToken(): string {
  if (_token) return _token;

  const tokenPath = path.resolve(config.authTokenFile);
  const dir = path.dirname(tokenPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(tokenPath)) {
    _token = fs.readFileSync(tokenPath, 'utf-8').trim();
    log(`Auth token loaded from ${tokenPath}`);
  } else {
    _token = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(tokenPath, _token, { mode: 0o600 });
    log(`New auth token generated and saved to ${tokenPath}`);
  }

  return _token;
}

export function rotateToken(): string {
  const tokenPath = path.resolve(config.authTokenFile);
  _token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(tokenPath, _token, { mode: 0o600 });
  log('Auth token rotated');
  return _token;
}

export function validateToken(token: string): boolean {
  const expected = loadOrCreateToken();
  return crypto.timingSafeEqual(
    Buffer.from(token, 'utf-8'),
    Buffer.from(expected, 'utf-8')
  );
}

export function printQRCode(serverUrl: string) {
  const token = loadOrCreateToken();
  const setupUrl = `${serverUrl}?token=${token}`;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  VehiClaw — Scan to connect your head unit');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  qrcode.generate(setupUrl, { small: true });
  console.log(`\n  Or open: ${setupUrl}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
