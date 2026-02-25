// src/auth/google-oauth.ts
// Google OAuth2 flow for Calendar and Contacts APIs.
// First run: opens a browser URL for user consent; tokens saved to data/google-token.json.

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { log } from '../logger.js';
import { config } from '../config.js';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts.readonly',
];

let _cachedAuth: OAuth2Client | null = null;

export async function loadGoogleAuth(): Promise<OAuth2Client> {
  if (_cachedAuth) return _cachedAuth;

  const credPath = path.resolve(config.googleCredentialsFile);
  const tokenPath = path.resolve(config.googleTokenFile);

  if (!fs.existsSync(credPath)) {
    throw new Error(
      `Google credentials not found at ${credPath}.\n` +
      `Download credentials.json from Google Cloud Console → APIs & Services → Credentials.\n` +
      `Run: npm run setup-google`
    );
  }

  const credentials = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed ?? credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris?.[0] ?? 'urn:ietf:wg:oauth:2.0:oob'
  );

  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    oauth2Client.setCredentials(token);
    log('Google OAuth token loaded');
    _cachedAuth = oauth2Client;
    return oauth2Client;
  }

  // First-time setup
  log('No Google token found — starting OAuth flow');
  const newClient = await runFirstTimeOAuthFlow(oauth2Client, tokenPath);
  _cachedAuth = newClient;
  return newClient;
}

async function runFirstTimeOAuthFlow(
  oauth2Client: OAuth2Client,
  tokenPath: string
): Promise<OAuth2Client> {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  VehiClaw — Google Calendar Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nOpen this URL in your browser and authorize VehiClaw:\n');
  console.log(`  ${authUrl}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const code = await new Promise<string>((resolve) => {
    rl.question('Paste the authorization code here: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const tokenDir = path.dirname(tokenPath);
  if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokens), { mode: 0o600 });
  log(`Google tokens saved to ${tokenPath}`);

  return oauth2Client;
}
