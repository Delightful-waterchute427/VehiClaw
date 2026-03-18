# VehiClaw

**Open-source AI assistant for Android car head units.**

VehiClaw doesn't just react to commands — it anticipates needs, learns your habits, and runs quietly in the background so the right information surfaces at the right moment. Say "Hey Claw" or just drive.

Built on top of [OpenClaw](https://openclaw.ai), the open-source autonomous AI agent platform.

---

## How It Works

VehiClaw runs a Node.js server on any machine (home server, laptop, or cloud VPS). Your Android car stereo opens the VehiClaw URL in its built-in browser — no app install needed. Compatible with any Android head unit that has a browser, such as the [Vevor 9" Android Auto Stereo](https://www.vevor.com/digital-media-receivers-c_13979/car-stereo-radio-carplay-touchscreen-9-in-apple-android-auto-backup-camera-p_010891506969) and similar units.

```
[Android Head Unit]  ──browser──▶  [VehiClaw Server]  ──WebSocket──▶  [OpenClaw Gateway]
   Web Speech API                    Express + WS                        LLM Agent
   Touch UI                          Skills bridge                       Tool execution
```

The server handles all AI reasoning and API calls. Your API keys never leave the server.

---

## Features

### Core
- **Voice-first** — "Hey Claw" wake word, or tap the mic button
- **Navigation** — "Navigate to Whole Foods" → ETA + tap to open Google Maps
- **Calendar** — "What's on my calendar tomorrow?" / "Add dentist Friday at 2pm"
- **Weather** — "Will it rain today?" → current conditions + forecast card
- **Restaurants** — "Find Italian food nearby" → rated list + reservation link
- **Reminders** — "Remind me to pick up groceries at 5pm" → fires aloud in the car
- **Contacts** — "Call Sarah" → one-tap call card
- **Driving mode** — Strict 1-2 sentence response limit for safety; toggle with one tap

### Proactive Intelligence
VehiClaw monitors context and speaks up before you have to ask.
- **Traffic awareness** — "Traffic is heavy on your usual route — you should leave 10 minutes early"
- **Fuel alerts** — "You're low on gas. Cheapest station ahead is 2 miles away"
- **Habit suggestions** — "You usually stop for coffee here — want me to order your regular?"
- **Hazard memory** — "This stretch typically has speed enforcement around this time"

### Memory & Context Engine
VehiClaw builds a picture of your routines and recalls it when it's useful.
- **Location memory** — "Last time you came here you liked that restaurant — want to go again?"
- **Deferred reminders** — "You asked to be reminded next time you're near this store"
- **Routine learning** — Recognizes recurring trips and preloads relevant info

### Context-Aware Entertainment
Audio that fits the drive, not just the queue.
- **Long drive** → switches to podcasts or audiobooks automatically
- **Short trip** → quick news or traffic summary
- **Mood detection** → adjusts music genre based on time of day, pace, and past behavior

### Social Coordination
- **Proximity alerts** — "John is 0.3 miles away — want me to text him?"
- **Shared location sync** — Integrates with friends' shared locations to suggest meetups in real time
- **In-route planning** — "You pass near her on the way — should I suggest stopping?"

### Car Maintenance Intelligence
Connect an OBD-II Bluetooth adapter and VehiClaw watches your car for you.
- **Live diagnostics** — Reads engine codes and explains them in plain English
- **Predictive alerts** — Flags patterns before they become failures (e.g. coolant temp trending high)
- **Service tracking** — Remembers your last oil change, tire rotation, and upcoming service intervals
- **Fuel economy** — Tracks MPG over time and flags unusual drops

### Security & Deployment
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
# Install globally (once)
npm install -g openclaw@latest

# Start the Gateway daemon
openclaw gateway
```

### 4. Set up Google Calendar (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → enable **Google Calendar API** and **Google People API**
3. Create OAuth 2.0 credentials (type: **Desktop app**)
4. Download `credentials.json` → save to `./data/google-credentials.json`
5. Run: `npm run setup-google` and follow the browser prompt

### 5. Add your contacts

Edit `./data/contacts.json`:

```json
[
  { "name": "Sarah Johnson", "mobile": "5551234567" },
  { "name": "Mom",           "mobile": "5559876543", "home": "5551112222" },
  { "name": "Work",          "work":   "5550001111" }
]
```

### 6. Start VehiClaw

```bash
npm run dev
```

The server prints a **QR code** on startup. Scan it with your head unit's browser (or type the URL). You'll only need to do this once — the token is saved in the browser.

### 7. Connect your head unit

1. Make sure your head unit and VehiClaw server are on the same WiFi/hotspot
2. Open the browser on your head unit
3. Scan the QR code (or go to `http://YOUR_SERVER_IP:3000`)
4. Paste the auth token when prompted
5. Say **"Hey Claw"** — you're ready

---

## Docker Deployment

```bash
docker compose up -d

# View logs
docker compose logs -f vehiclaw
```

---

## File Structure

```
vehiclaw/
├── AGENTS.md                    # Driving-safety system prompt for OpenClaw
├── SOUL.md                      # VehiClaw personality config
├── src/
│   ├── plugin/
│   │   ├── index.ts             # Entry point + skill registration
│   │   ├── server.ts            # Express + WebSocket bridge
│   │   ├── gateway-client.ts    # OpenClaw Gateway connection
│   │   ├── message-adapter.ts   # UI ↔ Gateway protocol translation
│   │   ├── session-store.ts     # Per-client session tracking
│   │   └── auth.ts              # Token generation + QR code
│   ├── auth/
│   │   └── google-oauth.ts      # Google Calendar OAuth2 flow
│   ├── config.ts
│   └── logger.ts
├── skills/
│   ├── vehiclaw-navigation/     # Google Maps: navigate + search nearby
│   ├── vehiclaw-calendar/       # Google Calendar: read + create events
│   ├── vehiclaw-weather/        # OpenWeatherMap: current + forecast
│   ├── vehiclaw-restaurant/     # Yelp: find restaurants + reservations
│   ├── vehiclaw-reminders/      # SQLite + cron: set + fire reminders
│   └── vehiclaw-contacts/       # Local JSON: look up + call contacts
└── public/                      # Car UI (served to head unit browser)
    ├── index.html
    ├── css/car.css
    ├── css/animations.css
    └── js/
        ├── main.js              # App bootstrap
        ├── voice.js             # Web Speech API (STT + TTS)
        ├── socket.js            # WebSocket client
        ├── wake-word.js         # "Hey Claw" detector
        └── ui.js                # Screen & card rendering
```

---

## API Keys

| Service | Required For | Free Tier | Sign Up |
|---|---|---|---|
| Google Maps (Directions + Places) | Navigation, nearby search | $200/mo credit | [console.cloud.google.com](https://console.cloud.google.com) |
| OpenWeatherMap | Weather | 1000 calls/day | [openweathermap.org](https://openweathermap.org/api) |
| Yelp Fusion | Restaurant search | 500 calls/day | [yelp.com/developers](https://www.yelp.com/developers) |
| Google Calendar OAuth2 | Calendar read/write | Free | [console.cloud.google.com](https://console.cloud.google.com) |

---

## Driving Mode

Tap the steering wheel icon in the bottom-left to toggle **driving mode**:
- Limits all spoken responses to **1-2 sentences**
- Defers complex visual tasks until parked
- Shown in the status bar when active

---

## Security

- Auth token is generated locally on first run (32 random bytes)
- Token is shown as a QR code — scan once on your head unit
- Token is saved in `localStorage` — you don't re-authenticate after that
- All API keys live on the server — the browser never sees them
- Server defaults to LAN-only; set `BIND_HOST` to your local IP for extra restriction
- Rate limiting: 20 requests/minute per client

---

## Contributing

VehiClaw is open source. Pull requests welcome.

Ideas for contribution:
- Spotify / Apple Music skill (context-aware playback)
- OBD-II skill improvements (deeper fault code library, CAN bus parsing)
- Better wake word (WebAssembly Porcupine or Picovoice — offline, no cloud)
- Offline STT fallback (WebAssembly Whisper)
- Multi-language support
- iOS Safari compatibility for iPhone head units
- Home automation skill (arrive home → unlock, adjust thermostat)
- Shared location integration (Life360, Google Maps sharing API)

---

## License

MIT
