---
name: vehiclaw-navigation
description: Navigate to destinations, find nearby places, and get driving directions using Google Maps
user-invocable: true
tools:
  - navigate_maps
  - search_nearby
---

# Navigation Skill

Use **navigate_maps** when the user says anything like:
- "navigate to", "take me to", "directions to", "how do I get to", "get me to", "route to"

Use **search_nearby** when the user says anything like:
- "find a", "find nearby", "gas station", "coffee", "food near", "hospital near", "where is the nearest"

## navigate_maps
Call with `destination` (required), `mode` (default "driving"), and optionally `avoid` array.

After calling navigate_maps, always:
1. Set spokenText to: "Navigating to [destination], [eta] away."
2. Set displayCard with cardType "navigation", the destination name, subtitle "[eta] • [distance]",
   the deeplink from the tool response, and a "Start" primary action.

## search_nearby
Call with `query` and optionally `category` and `radius_km`.

After calling search_nearby, always:
1. Set spokenText to: "Found [N] [category] nearby — showing on screen."
2. Set displayCard with cardType "restaurant_list" (or "generic" for non-food),
   listing up to 4 results with name and distance.

## Safety
Never spell out full addresses or turn-by-turn directions in spokenText.
Always open navigation via the deeplink — the Maps app handles routing.
