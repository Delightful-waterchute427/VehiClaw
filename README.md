# VehiClaw

**Open-source AI assistant for Android car head units.**

Say "Hey Claw" → navigate anywhere, check your calendar, find restaurants, get weather, set reminders, and call contacts — all hands-free while you drive.

Built on top of [OpenClaw](https://openclaw.ai), the open-source autonomous AI agent platform.

---

## How It Works

VehiClaw runs a Node.js server (at home, on a Raspberry Pi in your car, or in the cloud). Your Android head unit opens the VehiClaw URL in its browser — no app install needed.

```
[Android Head Unit]  ──browser──▶  [VehiClaw Server]  ──WebSocket──▶  [OpenClaw Gateway]
   Web Speech API                    Express + WS                        LLM Agent
   Touch UI                          Skills bridge                       Tool execution
```

The server handles all AI reasoning and API calls. Your API keys never leave the server.

---

## Features

- **Voice-first** — "Hey Claw" wake word, or tap the mic button
- **Navigation** — "Navigate to Whole Foods" → ETA + tap to open Google Maps
- **Calendar** — "What's on my calendar tomorrow?" / "Add dentist Friday at 2pm"
- **Weather** — "Will it rain today?" → current conditions + forecast card
- **Restaurants** — "Find Italian food nearby" → rated list + reservation link
- **Reminders** — "Remind me to pick up groceries at 5pm" → fires aloud in the car
- **Contacts** — "Call Sarah" → one-tap call card
- **Driving mode** — Strict 1-2 sentence response limit for safety; toggle with one tap
- **Secure** — Token-based auth, QR code setup, API keys stay server-side
- **Docker** — One-command deployment with `docker compose up`

---

## Requirements

- Node.js 20+ (or Docker)
- [OpenClaw](https://openclaw.ai) installed: `npm install -g openclaw@latest`
- Android head unit with a browser (any modern Android stereo works)
- API keys: Google Maps, OpenWeatherMap, Yelp (all have free tiers)
- Optional: Google Calendar OAuth2 credentials

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/nolanaechan/VehiClaw
cd vehiclaw
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

### 3. Start OpenClaw

```bash
npm install -g openclaw@latest
openclaw gateway
```

### 4. Start VehiClaw

```bash
npm run dev
```

Scan the QR code shown in the console on your head unit's browser.

---

## Docker

```bash
docker compose up -d
```

---

## License

MIT
