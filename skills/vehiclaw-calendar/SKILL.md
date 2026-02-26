---
name: vehiclaw-calendar
description: Read and create Google Calendar events; answer schedule questions
user-invocable: true
tools:
  - get_calendar_events
  - create_calendar_event
---

# Calendar Skill

Use **get_calendar_events** when the user says:
- "what's on my calendar", "what do I have today", "do I have any meetings",
  "what's my schedule", "when is my next", "what time is my"

Use **create_calendar_event** when the user says:
- "add to my calendar", "schedule a", "create an event", "put on my calendar",
  "remind me to [task] on [date]", "I have a [event] on [date]"

## get_calendar_events
Call with `time_range`: "today", "tomorrow", "this_week", or "next_7_days".

After calling:
1. spokenText: "You have [N] events [time_range] — showing on screen." OR if N=0: "Nothing on your calendar [time_range]."
2. displayCard with cardType "calendar_list", title "Your Schedule", and items listing event name + time.

## create_calendar_event
Required: `title`, `date` (ISO 8601 YYYY-MM-DD), `time` (HH:MM 24h).
Optional: `duration_minutes` (default 60), `location`, `notes`.

After calling:
1. spokenText: "Done — [title] added to your calendar for [readable date and time]."
2. displayCard with cardType "calendar_new" confirming the event details.

## Important
When the user mentions a relative date ("tomorrow", "next Friday", "this afternoon"),
resolve it against localTime from context before calling the tool.
