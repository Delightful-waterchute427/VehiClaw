// skills/vehiclaw-contacts/impl.ts
// Local contacts.json lookup with fuzzy name matching + tel: URI generation

import fs from 'fs';
import path from 'path';
import { config } from '../../src/config.js';
import { log } from '../../src/logger.js';

export interface Contact {
  name: string;
  mobile?: string;
  home?: string;
  work?: string;
  notes?: string;
}

export interface ContactResult {
  contact: Contact;
  phoneNumber: string;
  phoneType: string;
  telUri: string;
}

let _contacts: Contact[] | null = null;

function loadContacts(): Contact[] {
  if (_contacts) return _contacts;

  const contactsPath = path.resolve(config.dataDir, 'contacts.json');

  if (!fs.existsSync(contactsPath)) {
    log(`No contacts.json found at ${contactsPath}. Creating empty file.`, 'warn');
    const dir = path.dirname(contactsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(contactsPath, JSON.stringify([], null, 2));
    _contacts = [];
    return _contacts;
  }

  _contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf-8')) as Contact[];
  return _contacts;
}

/** Simple fuzzy match: check if all words in the query appear in the contact name */
function fuzzyMatch(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();

  // Exact match
  if (n === q) return 100;

  // Starts with
  if (n.startsWith(q)) return 90;

  // All query words present in name
  const qWords = q.split(/\s+/);
  const matches = qWords.filter(w => n.includes(w));
  if (matches.length === qWords.length) return 70;

  // Partial word match
  if (matches.length > 0) return 40 * (matches.length / qWords.length);

  return 0;
}

// ── find_contact ──────────────────────────────────────────────────────────────

export function findContact(params: { name: string }): Contact | null {
  const contacts = loadContacts();
  const query = params.name;

  let bestMatch: Contact | null = null;
  let bestScore = 0;

  for (const contact of contacts) {
    const score = fuzzyMatch(query, contact.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = contact;
    }
  }

  if (bestScore < 30) return null;
  return bestMatch;
}

// ── call_contact ──────────────────────────────────────────────────────────────

export function callContact(params: {
  name: string;
  contact_type?: 'mobile' | 'home' | 'work';
}): ContactResult {
  const contact = findContact({ name: params.name });

  if (!contact) {
    throw new Error(`No contact found for "${params.name}"`);
  }

  const preferredType = params.contact_type ?? 'mobile';
  const phoneNumber =
    contact[preferredType] ??
    contact.mobile ??
    contact.home ??
    contact.work;

  if (!phoneNumber) {
    throw new Error(`No phone number found for ${contact.name}`);
  }

  const phoneType = contact[preferredType]
    ? preferredType
    : contact.mobile ? 'mobile' : contact.home ? 'home' : 'work';

  // Normalize: remove all non-digit chars for the tel: URI
  const normalized = phoneNumber.replace(/\D/g, '');
  const telUri = `tel:+1${normalized}`;

  log(`Contact: ${contact.name} → ${telUri}`);

  return {
    contact,
    phoneNumber,
    phoneType,
    telUri,
  };
}

export const contactTools = {
  call_contact: callContact,
  find_contact: findContact,
};
