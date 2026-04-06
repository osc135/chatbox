# ChatBridge Plugin SDK

This guide explains how to build a third-party app that integrates with ChatBridge. All type definitions live in [`src/renderer/packages/plugin-sdk/types.ts`](src/renderer/packages/plugin-sdk/types.ts).

---

## Overview

A ChatBridge plugin is a plain object that satisfies the `PluginManifest` type. It declares:
- A unique ID, name, and description
- A set of **tools** — AI SDK tool definitions the LLM can call
- A **system prompt hint** — one line that tells the LLM when/how to use the app
- Either a **React component** (InlinePlugin) or a **URL** (IframePlugin)

The platform discovers all tools automatically, injects the hints into every session's system prompt, routes invocations to the right app, renders the UI, and keeps the LLM aware of state changes — with no per-app code in the core platform.

---

## Choosing a Plugin Type

| Type | When to use |
|------|-------------|
| `InlinePlugin` | App is a React component compiled with the platform. Best for tightly coupled apps. |
| `IframePlugin` | App is hosted at any URL — an external domain, a CDN, or a static file. Best for third-party apps. |

The Focus Timer (`src/renderer/packages/plugins/timer.ts`) is a working `IframePlugin` example. Its app code is a single HTML file with no build step.

---

## Building an IframePlugin

### 1. Build your app

Your app can be any HTML page. It communicates with the platform via `window.postMessage`. The only rules:
- You must include the plugin ID in every message you send (`pluginId: 'your-id'`)
- Don't assume `allow-same-origin` in the sandbox — your app won't have access to the parent's localStorage/cookies

```html
<!DOCTYPE html>
<html>
<body>
  <div id="app">...</div>
  <script>
    // ── Receive tool invocations from the platform ───────────────────────────
    window.addEventListener('message', (e) => {
      const msg = e.data
      if (!msg || msg.type !== 'TOOL_INVOKE') return

      if (msg.tool === 'do_something') {
        // handle it...
        // then report state back:
        window.parent.postMessage({
          type: 'STATE_UPDATE',
          pluginId: 'myapp',
          invocationId: msg.invocationId,
          payload: { result: 'done', value: 42 },
        }, '*')
      }
    })

    // ── Report completion so the chatbot resumes ─────────────────────────────
    function finish(result) {
      window.parent.postMessage({
        type: 'COMPLETION',
        pluginId: 'myapp',
        payload: result,
      }, '*')
    }

    // ── Report errors ────────────────────────────────────────────────────────
    function fail(code, message) {
      window.parent.postMessage({
        type: 'ERROR',
        pluginId: 'myapp',
        invocationId: 'current',
        payload: { code, message },
      }, '*')
    }
  </script>
</body>
</html>
```

### 2. Host your app

The app can be hosted anywhere:
- On a CDN (e.g. `https://my-company.com/apps/my-app/`)
- As a static file in the ChatBridge `public/apps/` directory (served from the same origin)
- On Railway, Vercel, or any static host

### 3. Create the manifest

```ts
// src/renderer/packages/plugins/myapp.ts
import { tool } from 'ai'
import z from 'zod'
import type { IframePlugin } from '@/packages/plugin-sdk/types'

export const myAppPlugin: IframePlugin = {
  id: 'myapp',
  name: 'My App',
  description: 'One sentence description.',
  version: '1.0.0',
  author: 'My Company',
  type: 'iframe',
  url: 'https://my-company.com/apps/my-app/',
  // Optional: override the default sandbox. 'allow-scripts' is the minimum.
  // Add 'allow-same-origin' ONLY if your app genuinely needs it (security risk).
  sandbox: 'allow-scripts',

  systemPromptHint:
    '- My App (myapp): use myapp__open when the user wants to do X.',

  tools: {
    myapp__open: tool({
      description: 'Open my app.',
      inputSchema: z.object({
        topic: z.string().describe('The topic to load.'),
      }),
      execute: async (input) => ({
        action: 'render_app',
        appId: 'myapp',
        // You can encode init params as query strings — the iframe reads them on load.
        appUrl: `https://my-company.com/apps/my-app/?topic=${encodeURIComponent(input.topic)}`,
      }),
    }),

    myapp__submit: tool({
      description: 'Submit a value to the app.',
      inputSchema: z.object({ value: z.string() }),
      execute: async (input) => ({
        action: 'tool_invoke',
        appId: 'myapp',
        tool: 'submit',
        params: { value: input.value },
      }),
    }),
  },
}
```

### 4. Register it

```ts
// src/renderer/packages/pluginRegistry.ts
import { myAppPlugin } from './plugins/myapp'

const REGISTRY: PluginManifest[] = [
  // ... existing plugins ...
  myAppPlugin,
].map(sanitizePluginManifest)
```

Also add `'myapp'` to `backend/src/config/plugins.ts` → `AVAILABLE_APP_IDS` so teachers can enable/disable it.

---

## Building an InlinePlugin

For apps that need direct access to React, Zustand, or platform APIs:

```tsx
// src/renderer/components/apps/MyApp.tsx
import { useEffect } from 'react'
import type { InlinePluginProps } from '@/packages/plugin-sdk/types'

export default function MyApp({ state, onStateUpdate, sessionId }: InlinePluginProps) {
  // state = whatever execute() returned (minus action/appId/appUrl)

  // Listen for tool invocations from the LLM
  useEffect(() => {
    const handler = (e: Event) => {
      const { appId, tool, params } = (e as CustomEvent).detail
      if (appId !== 'myapp') return
      if (tool === 'do_something') {
        // handle it
        onStateUpdate?.({ result: 'done' })
      }
    }
    window.addEventListener('app:toolInvoke', handler)
    return () => window.removeEventListener('app:toolInvoke', handler)
  }, [onStateUpdate])

  return <div>...</div>
}
```

Then create the manifest (same as IframePlugin but with `type: 'inline'` and `component: MyApp`):

```ts
import type { InlinePlugin } from '@/packages/plugin-sdk/types'
import MyApp from '@/components/apps/MyApp'

export const myAppPlugin: InlinePlugin = {
  id: 'myapp',
  // ...
  type: 'inline',
  component: MyApp as InlinePlugin['component'],
  tools: { /* ... */ },
}
```

---

## postMessage Protocol Reference

All messages are plain JSON. The `pluginId` field must match your plugin's `id`.

### Platform → App

```ts
// Tool invocation
{
  type: 'TOOL_INVOKE',
  tool: string,        // tool name WITHOUT the plugin prefix
  params: object,
  invocationId: string
}
```

### App → Platform

```ts
// Report state change (LLM reads this on its next tool call)
{ type: 'STATE_UPDATE', pluginId, invocationId, payload: object }

// Signal task completion (chatbot resumes conversation)
{ type: 'COMPLETION', pluginId, payload: object }

// Report an error
{ type: 'ERROR', pluginId, invocationId, payload: { code, message } }
```

---

## Tool Return Values

Tools return a plain object from `execute()`:

| `action` | Effect |
|----------|--------|
| `render_app` | Opens side panel, renders the component/iframe. `appUrl` is required for IframePlugins. All other fields become `state` (inline) or are readable from `URLSearchParams` (iframe). |
| `tool_invoke` | Dispatches `app:toolInvoke` event (inline) or `TOOL_INVOKE` postMessage (iframe). Use this for subsequent commands on an already-open app. |
| _(anything else)_ | Treated as a tool result, shown inline in chat. No panel opens. |

---

## Security

| Concern | Mitigation |
|---------|-----------|
| Prompt injection via tool descriptions | `sanitizePluginManifest()` rejects descriptions containing known injection patterns at registration time |
| Iframe auth token leakage | `sandbox="allow-scripts"` only — no `allow-same-origin` by default |
| Spoofed postMessage from other tabs | `event.source` validated against the specific iframe `contentWindow` |
| Cross-origin message spoofing | `event.origin` validated against the registered `plugin.url` origin |

---

## Grade Range Filtering

If your app is only appropriate for certain grades, set `gradeRange`:

```ts
gradeRange: ['3', '4', '5', '6', '7', '8']
```

The platform will exclude your app's tools from the LLM's tool set when a student outside this range is logged in. Use `'K'` for Kindergarten.

---

## Auth-Required Apps

If your app requires the user to connect an external account (like Google Calendar), set:

```ts
requiresAuth: true
```

The teacher dashboard will surface this to teachers. Your tool's `execute()` should check whether the user has authorized and return a meaningful error or prompt if not.
