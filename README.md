# ChatBridge — TutorMeAI Plugin Platform

A production-grade AI chat platform with embedded third-party app integration, built for K-12 education. Forked from [Chatbox Community Edition](https://github.com/chatboxai/chatbox) (GPLv3).

**Live demo:** deploy via Docker (see below)

---

## What This Is

ChatBridge extends Chatbox into a mini-app platform. The AI assistant can launch interactive educational tools directly inside the chat window. Apps communicate bidirectionally with the chatbot — the LLM knows what's happening inside an app and can respond to it.

**Use case:** A student says "I want to practice adding" → the chatbot opens the counting app at the right level → student works through problems → the chatbot can see the score, encourage them, or switch levels.

---

## Apps

### ♟ Chess (iframe)
Full chess board with legal move validation. The LLM plays as opponent, analyzing board state on request.

| Tool | What it does |
|------|-------------|
| `chess__start_game` | Launch board, set player color |
| `chess__make_move` | Submit a move (UCI notation) |
| `chess__get_board_state` | Get FEN + move history for LLM analysis |

### 🌤 Weather (iframe)
Current conditions + 5-day forecast for any location. Pulls from OpenWeatherMap API.

| Tool | What it does |
|------|-------------|
| `weather__show` | Open weather panel for a city |

### 🔢 Counting (inline React component)
K-2 math practice app (ages 5–8). Three leveled activities with audio feedback and celebration animations. Does **not** use an iframe — rendered as a direct React component for zero-latency and tighter integration.

| Tool | What it does |
|------|-------------|
| `counting__open` | Launch the app at a specific level |
| `counting__set_level` | Switch levels mid-session |

#### Counting App Levels

**Level 1 — Count Objects**
- 1–10 emoji objects displayed in a ten-frame grid (rows of 5 — standard K-2 subitizing layout)
- "How many [emoji] do you see?"
- Student picks from 4 large number buttons (correct + 3 nearby distractors)
- Wrong answer: shake animation + "Oops! Try again!" — 800ms lockout then retry

**Level 2 — Add (Count On)**
- Number line 0–10
- Frog 🐸 starts at a position (0–5); student presses HOP to move it right
- After all hops: "Where did 🐸 land?" — student picks from 4 choices before celebration

**Level 3 — Subtract (Count Back)**
- Same number line; frog starts at 5–10 and hops left
- Same answer-confirmation step before celebration

#### Audio
All sounds use Web Audio API — no external files.

| Event | Sound |
|-------|-------|
| Correct answer | Ascending C–E–G–C arpeggio (triangle wave) |
| Wrong answer | Soft descending slide (340 Hz → 210 Hz) |
| Frog hop | Two-syllable "rib-bit" (sawtooth with amplitude gap) |

---

## Architecture

### Plugin Communication

**iframe apps (Chess, Weather)**
Apps run as separate Vite builds served at `/chess/` and `/weather/`. Communication uses `window.postMessage`:

```
Parent → App:   { type: 'TOOL_INVOKE', pluginId, invocationId, tool, params }
App → Parent:   { type: 'STATE_UPDATE', pluginId, invocationId, payload }
                { type: 'COMPLETION',   pluginId, invocationId, result }
                { type: 'ERROR',        pluginId, invocationId, error }
```

**Inline apps (Counting)**
Rendered as a React component inside `AppEmbed`. No postMessage hop:
- State updates via `onStateUpdate` prop callback
- Tool invocations via `window.dispatchEvent(new CustomEvent('app:toolInvoke', { detail }))`

### Tool → Panel Lifecycle

```
LLM returns { action: 'render_app', appId, appUrl }
  → abstract-ai-sdk creates MessageAppPart
    → $sessionId.tsx detects new app part, opens side panel (60% width)
      → AppEmbed renders iframe OR inline component
        → app sends STATE_UPDATE on every significant change
          → LLM context is updated with app state
```

### Side Panel Layout

```
┌─────────────────────────────────────┐
│  Chat (40%)   │  App Panel (60%)    │
│               │  ┌───────────────┐  │
│  messages...  │  │  [app here]   │  │
│               │  └───────────────┘  │
│  [input box]  │                     │
└─────────────────────────────────────┘
```

### Key Files

```
src/renderer/
├── components/
│   ├── apps/
│   │   ├── CountingApp.tsx         # Inline counting mini-app
│   │   └── counting.css            # Scoped styles (all .cnt-* prefixed)
│   └── chat/
│       └── AppEmbed.tsx            # Renders iframe apps OR inline components
├── packages/model-calls/
│   ├── stream-text.ts              # Tool registry + system prompt
│   └── toolsets/
│       ├── chess.ts                # Chess tool definitions
│       ├── weather.ts              # Weather tool definitions
│       └── counting.ts             # Counting tool definitions
├── routes/session/$sessionId.tsx   # Side panel layout + app panel
└── setup/
    └── seed_counting_session.ts    # Seeds "Counting Fun" demo session

apps/
├── chess/      # Standalone Vite app (served at /chess/)
└── weather/    # Standalone Vite app (served at /weather/)
```

---

## Development

### Prerequisites

- Node.js v20–v22
- pnpm v10+ (`corepack enable && corepack prepare pnpm@latest --activate`)

### Run locally (web mode)

```bash
pnpm install
pnpm run dev:web
```

App runs at `http://localhost:1212`. The chess and weather sidecar apps need to be running separately if you're developing them:

```bash
# Terminal 2
cd apps/chess && npm install && npm run dev   # port 5173

# Terminal 3
cd apps/weather && npm install && npm run dev # port 5174
```

### Build & run with Docker

```bash
docker build -t chatbridge .
docker run -p 8080:8080 -e PORT=8080 chatbridge
```

The Dockerfile builds all three apps (chess, weather, main) and serves them from a single nginx container:
- `/` → main ChatBridge SPA
- `/chess/` → chess app
- `/weather/` → weather app

---

## Adding a New App

### Option A: Iframe app (external UI, full isolation)

1. Create `apps/yourapp/` as a Vite project
2. Implement the postMessage protocol (listen for `TOOL_INVOKE`, send `STATE_UPDATE` / `COMPLETION`)
3. Add a build stage in `Dockerfile` + location block in `nginx.conf`
4. Add tool definitions in `src/renderer/packages/model-calls/toolsets/yourapp.ts`
5. Register tools in `stream-text.ts`
6. Add `appId` icon mapping in `$sessionId.tsx`

### Option B: Inline React component (no iframe, tighter integration)

1. Create `src/renderer/components/apps/YourApp.tsx` + scoped CSS
2. Accept `onStateUpdate` prop and listen to `app:toolInvoke` custom events
3. Add early-return render in `AppEmbed.tsx` for your `appId`
4. Add tool definitions returning `{ action: 'render_app', appId: 'yourapp', appUrl: 'internal://yourapp' }`

---

## Security Notes

- iframe apps are sandboxed with `sandbox="allow-scripts allow-same-origin allow-forms"`
- postMessage origin is validated in `AppEmbed.tsx`
- Inline apps (like Counting) run in the same React tree — only use for fully-trusted first-party code
- No student PII is sent to third-party app URLs

---

## Upstream

This project is a fork of [Chatbox Community Edition](https://github.com/chatboxai/chatbox), used under the [GPLv3 license](./LICENSE). The original Chatbox supports Windows, macOS, Linux, iOS, and Android desktop/mobile clients. This fork focuses on the web build only.
