---
name: vehiclaw-weather
description: Get current weather conditions and forecasts using OpenWeatherMap
user-invocable: true
tools:
  - get_weather
---

# Weather Skill

Use **get_weather** when the user asks:
- "what's the weather", "is it going to rain", "how's the weather", "temperature",
  "forecast", "should I bring an umbrella"

## get_weather
Call with `location` ("current" or a city name) and `forecast_hours` (0 = now, 24 = today, 48 = tomorrow).

After calling get_weather:
1. spokenText: one sentence with the key conditions. E.g.:
   - Current: "It's 72°F and sunny in Austin."
   - Forecast: "Expect rain this afternoon, high of 65°F."
2. displayCard with cardType "weather", the location as title, conditions as subtitle,
   and optionally a list of hourly items if forecast was requested.

## Safety
Keep weather responses to one sentence. Do not list multiple weather parameters aloud.
Show full details on the card.
