# ChatBridge — TutorMeAI Plugin Platform

A production-grade AI chat platform with embedded third-party app integration, built for K-12 education. Forked from [Chatbox Community Edition](https://github.com/chatboxai/chatbox) (GPLv3).

**Live demo:** [https://chatbox-production-7f34.up.railway.app/](https://chatbox-production-7f34.up.railway.app/) · [Backend API](https://chatbridge-backend-production.up.railway.app/health)

---

## What This Is

ChatBridge turns Chatbox into a mini-app platform for classrooms. The AI assistant can launch interactive educational tools directly inside the chat window and stay contextually aware of what's happening inside them — so a student can say "what should I do here?" mid-chess-game and get a real answer, or finish a vocab quiz and have the chatbot summarize their results.

Third-party apps register via a **plugin manifest**. The platform discovers their tools, injects them into the LLM's context, routes invocations, renders the UI, and persists state — all without knowing anything about the app in advance.

---

## Apps

Six apps ship with the platform, covering a range of complexity levels, integration patterns, and auth requirements:

| App | Type | Auth | Grades | Pattern |
|-----|------|------|--------|---------|
| ♟ Chess | Inline React | None | 3–12 | Complex bidirectional state, LLM opponent |
| 🌤 Weather | Inline React | None | All | External public API, read-only |
| 🔢 Counting | Inline React | None | K–2 | K-2 math practice, Web Audio API |
| 📖 Vocab | Inline React | None | All | LLM-generated flashcard sets + quiz |
| 📅 Google Calendar | Inline React | OAuth 2.0 | All | OAuth flow, token refresh, event CRUD |
| ❓ Quiz | Inline React | None | All | LLM-generated questions, score reporting |
| ⏱ Focus Timer | **Iframe** | None | All | Standalone HTML/JS app — demonstrates IframePlugin protocol |

### ♟ Chess
Full chess board (react-chessboard + chess.js) with legal move validation. The LLM plays as opponent via a direct API call — no postMessage round-trip. Four difficulty levels including a random-move "super dumb" mode that works offline.

| Tool | What it does |
|------|-------------|
| `chess__start_game` | Launch board, begin a new game |
| `chess__make_move` | Submit a move by algebraic notation |
| `chess__get_board_state` | Return FEN + turn + status for LLM analysis |
| `chess__resign` | Forfeit the current game |

### 🌤 Weather
Current conditions + 7-day forecast from [Open-Meteo](https://open-meteo.com/) (free, no API key). Animated SVG weather icons, sunrise/sunset arc, temperature range bars.

| Tool | What it does |
|------|-------------|
| `weather__show_weather` | Open the weather panel for a location |
| `weather__update_location` | Switch to a different city while panel is open |
| `weather__get_state` | Read current conditions for LLM context |

### 🔢 Counting
K-2 math practice (ages 5–8). Three levelled activities using a ten-frame grid and a number line. Wrong answers trigger a shake animation + audio feedback; correct answers play a Web Audio API arpeggio. All sounds are synthesized — no audio files.

| Tool | What it does |
|------|-------------|
| `counting__open` | Launch at a specific level (1–3) |
| `counting__set_level` | Switch levels mid-session |

### 📖 Vocab
Flashcard deck + quiz mode. The LLM generates word/definition pairs on any topic; students flip through them then take a scored quiz. On quiz completion the chatbot receives the score and missed words automatically.

| Tool | What it does |
|------|-------------|
| `vocab__start` | Generate a flashcard set for a topic |

### 📅 Google Calendar
Connect a Google account and manage calendar events without leaving the chat. Full OAuth 2.0 flow: user clicks "Connect Calendar" → Google consent screen → tokens stored server-side → subsequent calls use the stored token automatically with refresh.

| Tool | What it does |
|------|-------------|
| `calendar__open` | Open calendar panel (optionally pre-fill a new event) |

### ❓ Quiz
Multiple-choice quiz with LLM-generated questions on any topic. Score and wrong answers are reported back to the chatbot for follow-up discussion.

| Tool | What it does |
|------|-------------|
| `quiz__start` | Generate and launch a quiz on a topic |

### ⏱ Focus Timer
A Pomodoro-style countdown timer served as a **standalone static HTML file** at `/apps/timer/index.html`. This is the platform's `IframePlugin` example — it has no React or build step, communicates entirely via postMessage, and could be hosted on any URL. It demonstrates that third-party apps don't need to be compiled into the platform.

| Tool | What it does |
|------|-------------|
| `timer__start` | Open and start the timer (optional duration in minutes) |
| `timer__pause` | Pause a running timer |
| `timer__resume` | Resume a paused timer |
| `timer__reset` | Reset to the starting duration |

---

## Architecture

### Plugin Registry

Every app is a **`PluginManifest`** — a plain TypeScript object that declares its id, tools, system prompt hint, and either a React component (inline) or a URL (iframe). The registry is the only place apps are registered; no other file needs to change to add an app.

```
src/renderer/packages/
├── plugin-sdk/
│   ├── types.ts          ← PluginManifest, InlinePlugin, IframePlugin, all message shapes
│   └── sanitize.ts       ← strips prompt-injection patterns from tool descriptions at registration
├── plugin-state-store.ts ← generic Map<pluginId, state> — all apps share one store
├── pluginRegistry.ts     ← imports all manifests, exposes getPlugin / buildToolSet / buildSystemPromptHints
└── plugins/
    ├── chess.ts           ← InlinePlugin manifest
    ├── weather.ts         ← InlinePlugin manifest
    ├── counting.tsx       ← InlinePlugin manifest
    ├── vocab.tsx          ← InlinePlugin manifest
    ├── calendar.tsx       ← InlinePlugin manifest
    └── quiz.tsx           ← InlinePlugin manifest
```

`stream-text.ts` calls `buildToolSet()` and `buildSystemPromptHints()` once at stream start — the LLM automatically knows about every registered app with no per-app code in the streaming layer.

### Two App Types

**Inline (all current apps)**
Rendered as a React component inside `AppEmbed`. No iframe, no postMessage:
- Tool invocations arrive via `window.dispatchEvent(new CustomEvent('app:toolInvoke', { detail }))`, dispatched by the AI SDK layer
- State changes call the `onStateUpdate(payload)` prop, which writes to the plugin state store and updates LLM context
- Initial state (e.g. the location for weather) is passed via the `state` prop from the tool call result

**Iframe (Focus Timer is a working example)**
For apps that need full isolation or are hosted at an external URL. Communication uses `window.postMessage` with strict origin validation. The sandbox defaults to `allow-scripts` only — no `allow-same-origin` — preventing co-located iframes from accessing the parent's auth tokens even when served from the same domain. The timer app at `/apps/timer/index.html` is a self-contained HTML/JS file with no build step that demonstrates this path end-to-end.

### Full Lifecycle

```
User: "let's play chess"
  → LLM calls chess__start_game
    → execute() returns { action: 'render_app', appId: 'chess' }
      → abstract-ai-sdk creates a MessageAppPart in the message stream
        → $sessionId.tsx detects new app part, opens side panel
          → AppEmbed looks up 'chess' in pluginRegistry
            → renders <ChessApp state={...} sessionId={...} onStateUpdate={...} />
              → player moves a piece
                → onStateUpdate({ fen, turn, status }) is called
                  → setPluginState('chess', payload)
                    → LLM context updated

User: "what should I do here?"
  → chess__get_board_state tool is called
    → getPluginState('chess') returns current FEN + status
      → LLM analyzes position and responds
```

### Security Model

| Concern | Mitigation |
|---------|-----------|
| Prompt injection via tool descriptions | `sanitizePluginManifest()` strips injection patterns at registration time |
| Iframe auth token leakage | `sandbox="allow-scripts"` only — no `allow-same-origin` |
| Spoofed postMessage from other frames | `event.source` validated against the specific iframe's `contentWindow` |
| Cross-origin iframe messages | `event.origin` validated against the registered plugin URL |
| Student data exposure | No PII sent to third-party app URLs; state store is in-process only |

### Side Panel Layout

When an app opens, the chat column shrinks to 40% and the app takes 60%:

```
┌──────────────────────────────────────────────┐
│   Chat (40%)         │   App Panel (60%)      │
│                      │  ┌──────────────────┐  │
│   messages...        │  │   [app renders]  │  │
│                      │  └──────────────────┘  │
│   [input box]        │                        │
└──────────────────────────────────────────────┘
```

---

## Setup

### Prerequisites

- Node.js v20–v22
- pnpm v10 (`corepack enable && corepack prepare pnpm@latest --activate`)
- PostgreSQL (local or Railway)

### Run locally

```bash
# 1. Install dependencies
cd chatbox
pnpm install

# 2. Configure frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:3002

# 3. Start the frontend (web mode)
pnpm run dev:web
# → http://localhost:1212
```

```bash
# In a second terminal — start the backend
cd backend
cp .env.example .env   # fill in values (see table below)
npm install
npm run dev
# → http://localhost:3002
```

### Environment Variables

**Backend (`backend/.env`)**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Random secret for signing auth tokens (32+ chars) |
| `BETTER_AUTH_URL` | Yes | Public base URL of the backend |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth2 client ID (for Calendar) |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth2 client secret |
| `CORS_ORIGIN` | Yes | Frontend origin (e.g. `http://localhost:1212`) |
| `RESEND_API_KEY` | No | [Resend](https://resend.com) key — enables welcome emails for new students |
| `PORT` | No | Port to listen on (default: `3002`) |

**Frontend (`chatbox/.env`)**

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend base URL (default: `http://localhost:3002`) |

### Build for production

```bash
cd chatbox
docker build -t chatbridge .
docker run -p 8080:8080 -e PORT=8080 \
  -e VITE_API_URL=https://your-backend.railway.app \
  chatbridge
```

The Dockerfile builds the main SPA and the quiz app, then serves both from a single nginx container. Chess and weather are bundled directly into the main SPA (inline components) — no separate servers needed.

---

## Adding a New Plugin

Adding an app requires exactly two files and one line in the registry.

### 1. Create the component

```tsx
// src/renderer/components/apps/MyApp.tsx
import './myapp.css'

export interface MyAppProps {
  state: Record<string, unknown>   // tool call result passed as initial state
  onStateUpdate?: (s: Record<string, unknown>) => void
  sessionId?: string
}

export default function MyApp({ state, onStateUpdate }: MyAppProps) {
  // Listen for tool invocations from the AI SDK
  useEffect(() => {
    const handler = (e: Event) => {
      const { tool, params } = (e as CustomEvent).detail
      if (tool === 'do_something') {
        // ... handle it ...
        onStateUpdate?.({ result: 'done' })
      }
    }
    window.addEventListener('app:toolInvoke', handler)
    return () => window.removeEventListener('app:toolInvoke', handler)
  }, [onStateUpdate])

  return <div>...</div>
}
```

### 2. Create the manifest

```ts
// src/renderer/packages/plugins/myapp.ts
import { tool } from 'ai'
import z from 'zod'
import type { InlinePlugin } from '@/packages/plugin-sdk/types'
import MyApp from '@/components/apps/MyApp'

export const myAppPlugin: InlinePlugin = {
  id: 'myapp',
  name: 'My App',
  description: 'One sentence description',
  version: '1.0.0',
  author: 'TutorMeAI',
  type: 'inline',
  component: MyApp as InlinePlugin['component'],
  systemPromptHint: '- My App: call myapp__open when the user asks about X',

  tools: {
    myapp__open: tool({
      description: 'Open my app.',
      inputSchema: z.object({ topic: z.string() }),
      execute: async (input) => ({
        action: 'render_app',
        appId: 'myapp',
        topic: input.topic,   // becomes state.topic in the component
      }),
    }),
  },
}
```

### 3. Register it

```ts
// src/renderer/packages/pluginRegistry.ts  — add one import and one entry
import { myAppPlugin } from './plugins/myapp'

const ALL_PLUGINS: PluginManifest[] = [
  chessPlugin,
  weatherPlugin,
  countingPlugin,
  vocabPlugin,
  calendarPlugin,
  quizPlugin,
  myAppPlugin,   // ← add this
]
```

That's it. The LLM discovers the tools automatically on the next stream start. No changes to `stream-text.ts`, `AppEmbed.tsx`, or the session route.

### Current limitation: registration requires source access

All plugin registration — including `IframePlugin` apps hosted at external URLs — currently requires editing `pluginRegistry.ts` and `backend/src/config/plugins.ts`, then redeploying. There is no runtime HTTP registration API.

This means a genuine third-party developer cannot integrate their app without forking the repo. The architecture is designed for it (the `IframePlugin` type accepts any URL, the postMessage protocol is fully documented, and `execute()` functions for iframe tools follow a predictable pattern that the platform could generate automatically) — but the registration pathway was not built.

What a runtime registration system would look like:
- A `POST /api/plugins` endpoint (teacher-authenticated) that accepts a JSON manifest — plugin ID, name, URL, tool schemas as JSON Schema, system prompt hint
- Dynamic plugins stored in the database alongside teacher-controlled app toggles
- The frontend fetches dynamic plugins at startup and merges them with bundled ones
- IframePlugin execute functions are generated by the platform (they always dispatch `render_app` or `tool_invoke` — no custom logic needed)

The postMessage protocol and sandbox model work today for any external URL. Only the self-registration step is missing.

---

## Plugin SDK Reference

### `PluginManifest` fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier. All tool names must be prefixed with this id (`{id}__{toolName}`) |
| `name` | `string` | Yes | Display name shown in the panel header |
| `description` | `string` | Yes | One-sentence description of the app |
| `version` | `string` | Yes | Semver string |
| `author` | `string` | Yes | Developer or organization name |
| `type` | `'inline' \| 'iframe'` | Yes | Rendering mode |
| `tools` | `ToolSet` | Yes | AI SDK tool definitions keyed by `{id}__{name}` |
| `systemPromptHint` | `string` | Yes | Fragment injected into the LLM system prompt. Keep it to one line. |
| `gradeRange` | `string[]` | No | Grades this app is appropriate for. Omit to allow all. |
| `requiresAuth` | `boolean` | No | Set `true` if the app requires an OAuth flow before use |

### `InlinePluginProps`

```ts
interface InlinePluginProps {
  state: Record<string, unknown>   // tool call result from execute()
  onStateUpdate?: (state: Record<string, unknown>) => void
  sessionId?: string               // current chat session (for LLM calls)
}
```

### Tool return values

Tools return a plain object from `execute()`. Two `action` values are handled specially:

| `action` | Effect |
|----------|--------|
| `render_app` | Opens the side panel and renders the component. The full return value becomes `state`. |
| `tool_invoke` | Dispatches `app:toolInvoke` to an already-open component. Does not re-render. |

Anything else is treated as a tool result and shown inline in the chat (no panel opens).

### Prompt injection protection

Tool descriptions are sanitized at registration time by `sanitize.ts`. Patterns blocked include: "ignore previous instructions", "disregard", "you are now", "DAN", "jailbreak", "reveal student data", and similar. Apps that fail sanitization are rejected with an error log at startup.

---

## API Reference

### Auth (`/api/auth/*`)

Handled by [Better Auth](https://better-auth.com). Token is returned in the `set-auth-token` response header.

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/sign-up/email` | `{ name, email, password, school? }` | Create teacher account |
| `POST` | `/api/auth/sign-in/email` | `{ email, password }` | Sign in |

### Teacher (`/api/teacher/*`)

All routes require `Authorization: Bearer <token>` and `role = 'teacher'`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teacher/students` | List students |
| `POST` | `/api/teacher/students` | Create student (`{ name, email, grade, password }`) |
| `PATCH` | `/api/teacher/students/:id` | Update name or grade |
| `DELETE` | `/api/teacher/students/:id` | Delete student |
| `GET` | `/api/teacher/apps` | Get enabled app list |
| `PATCH` | `/api/teacher/apps` | Update enabled app list (`{ enabledApps: string[] }`) |

### Google Calendar (`/api/calendar/*`, `/api/oauth/google/*`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/oauth/google/authorize` | Returns Google OAuth consent URL |
| `GET` | `/api/oauth/google/callback` | OAuth callback — handled automatically |
| `GET` | `/api/calendar/status` | Check if calendar is connected |
| `DELETE` | `/api/calendar/disconnect` | Revoke access |
| `GET` | `/api/calendar/events` | List upcoming events |
| `POST` | `/api/calendar/events` | Create event |

---

## Tests

```bash
cd chatbox && pnpm test
```

| File | What it covers |
|------|---------------|
| `chess-state-store.test.ts` | Plugin state store (get/set/clear) |
| `chess-opponent-move.test.ts` | UCI move extraction from raw LLM output |
| `chess-postmessage.test.ts` | postMessage round-trip: timeout, error, requestId mismatch |
| `tutorAuthStore.test.ts` | `setAuth` / `clearAuth` state transitions |
| `tutorApi.test.ts` | Login/signup, auth header injection, error propagation |
| `AppEmbed.test.tsx` | Inline routing, iframe load states, 10s timeout + retry, STATE_UPDATE and REQUEST_OPPONENT_MOVE handlers |

---

## Upstream

Forked from [Chatbox Community Edition](https://github.com/chatboxai/chatbox) under [GPLv3](./LICENSE). This fork targets the web build only and replaces the Electron update system with Railway deployment.
