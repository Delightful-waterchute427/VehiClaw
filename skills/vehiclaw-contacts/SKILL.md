---
name: vehiclaw-contacts
description: Look up contacts by name and initiate phone calls via tel: URI
user-invocable: true
tools:
  - call_contact
  - find_contact
---

# Contacts Skill

Use **call_contact** when the user says:
- "call [name]", "phone [name]", "dial [name]", "ring [name]"

Use **find_contact** when the user says:
- "what's [name]'s number", "find [name]'s contact"

## call_contact
Parameter: `name` (string).
Fuzzy-matches against the local contacts list.

After calling:
1. spokenText: "Calling [full name]." OR "No contact found for [name]."
2. displayCard with cardType "contact_call", showing the contact name and number,
   with a "Call" primary action using a `tel:` URI deeplink.
   The user taps the card to initiate the call from their phone or head unit.

## find_contact
Parameter: `name`.
Returns the best match from contacts.

## Notes
Contacts are loaded from data/contacts.json (a simple array the user maintains).
VehiClaw does not place calls itself — it provides the tel: URI for the system to dial.
