---
name: vehiclaw-restaurant
description: Find nearby restaurants by cuisine, price, or features; assist with reservations
user-invocable: true
tools:
  - find_restaurant
  - make_reservation
---

# Restaurant Skill

Use **find_restaurant** when the user says:
- "find a restaurant", "where should I eat", "I'm hungry", "good [cuisine] near me",
  "cheap eats nearby", "places to eat", "coffee shop near me"

Use **make_reservation** after find_restaurant, when the user says:
- "book a table", "make a reservation", "I want to eat there", "reserve a table"

## find_restaurant
Parameters: `cuisine` (optional), `price_level` (cheap/moderate/expensive), `party_size`,
`near` (location or "current"), `open_now` (default true).

After calling:
1. spokenText: "Found [N] [cuisine] spots nearby — showing on screen."
2. displayCard with cardType "restaurant_list", listing up to 4 results.
   Each item: restaurant name, rating, distance, price indicator.

## make_reservation
Parameters: `business_id` (from find_restaurant result), `party_size`, `date` (YYYY-MM-DD),
`time` (HH:MM).

After calling:
1. spokenText: "I've got a link to book your table — tap to confirm."
2. displayCard with cardType "restaurant_detail" and a "Reserve" primary action
   linking to the Yelp reservation page.

## Notes
Reservations are completed via deeplink to Yelp (user taps to confirm).
VehiClaw does not store payment info or complete reservations on the user's behalf.
