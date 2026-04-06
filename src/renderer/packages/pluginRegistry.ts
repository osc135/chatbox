/**
 * ChatBridge Plugin Registry
 *
 * This is the single source of truth for all registered plugins.
 *
 * ─── Adding a new plugin ──────────────────────────────────────────────────────
 * 1. Create a manifest file in packages/plugins/ (see existing files as examples)
 * 2. Import it here and add it to the REGISTRY array
 * 3. That's it — no other files need to change
 *
 * The registry automatically:
 *  - Sanitizes all tool descriptions against prompt injection at startup
 *  - Exposes the combined tool set to the LLM
 *  - Tells AppEmbed how to render each app (iframe vs inline component)
 *  - Provides the app list to the teacher dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { IframePlugin, PluginManifest } from './plugin-sdk/types'
import { sanitizePluginManifest } from './plugin-sdk/sanitize'
import { chessPlugin } from './plugins/chess'
import { weatherPlugin } from './plugins/weather'
import { countingPlugin } from './plugins/counting'
import { vocabPlugin } from './plugins/vocab'
import { calendarPlugin } from './plugins/calendar'
import { quizPlugin } from './plugins/quiz'

/**
 * All registered plugins, sanitized at module load time.
 * Import order determines the order apps appear in the teacher dashboard.
 */
const REGISTRY: PluginManifest[] = [
  chessPlugin,
  weatherPlugin,
  countingPlugin,
  vocabPlugin,
  calendarPlugin,
  quizPlugin,
].map(sanitizePluginManifest)

/** Look up a plugin by its ID. Returns undefined if not registered. */
export function getPlugin(id: string): PluginManifest | undefined {
  return REGISTRY.find((p) => p.id === id)
}

/** All registered plugins. */
export function getAllPlugins(): PluginManifest[] {
  return REGISTRY
}

/**
 * Build the combined AI SDK tool set from all registered plugins.
 * Pass the result directly to model.chat({ tools }).
 */
export function buildToolSet(): Record<string, unknown> {
  return REGISTRY.reduce<Record<string, unknown>>(
    (acc, plugin) => ({ ...acc, ...plugin.tools }),
    {}
  )
}

/**
 * Build the system prompt fragment describing available apps.
 * Each plugin contributes one hint line; the full block is injected into
 * every session's system prompt so the LLM knows when to invoke each tool.
 */
export function buildSystemPromptHints(): string {
  return REGISTRY.map((p) => p.systemPromptHint).join('\n')
}

/**
 * All registered plugin IDs — used by the backend to validate teacher app
 * selections. Keep this in sync with the REGISTRY above.
 */
export const AVAILABLE_APP_IDS: string[] = REGISTRY.map((p) => p.id)

/**
 * Derive the expected postMessage origin for an iframe plugin.
 * Used to restrict outgoing postMessage calls and validate incoming ones.
 *
 * Returns '*' as a safe fallback if the URL is unparseable (dev/test scenarios).
 */
export function getPluginOrigin(plugin: IframePlugin): string {
  try {
    return new URL(plugin.url).origin
  } catch {
    return '*'
  }
}
