---
name: vehiclaw-reminders
description: Set, list, and delete voice reminders that play aloud at the specified time
user-invocable: true
tools:
  - set_reminder
  - list_reminders
  - delete_reminder
---

# Reminders Skill

Use **set_reminder** when the user says:
- "remind me to", "set a reminder", "don't let me forget", "remember to"
- "alert me at", "ping me when"

Use **list_reminders** when the user says:
- "what reminders do I have", "show my reminders"

Use **delete_reminder** when the user says:
- "cancel that reminder", "delete reminder", "remove reminder"

## set_reminder
Required: `message` (what to say aloud when the reminder fires), `remind_at` (ISO 8601 datetime).
Optional: `repeat` ("none", "daily", "weekly").

Always resolve relative times ("in 30 minutes", "at 5pm", "tomorrow morning") against
localTime from context before calling.

After calling:
1. spokenText: "Reminder set for [human-readable time]."
2. displayCard with cardType "reminder_set", confirming the message and time.

## When a reminder fires
The server sends a `reminder_alert` event to the car UI, which speaks the message aloud
and shows a dismissible card.

## Safety
Do not set reminders for times in the past. If the time is ambiguous, assume future.
