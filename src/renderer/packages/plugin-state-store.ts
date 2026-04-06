/**
 * Generic plugin state store.
 *
 * Stores the last known state for each plugin, keyed by plugin ID.
 * Written by AppEmbed on every STATE_UPDATE from an app.
 * Read by plugin tool execute() functions (e.g. chess__get_board_state)
 * so the LLM always has access to fresh app state.
 *
 * Module-level (not React state) so tool execute functions can read it
 * synchronously without hooks.
 */

const states = new Map<string, Record<string, unknown>>()

export function setPluginState(pluginId: string, state: Record<string, unknown>): void {
  states.set(pluginId, state)
}

export function getPluginState(pluginId: string): Record<string, unknown> | null {
  return states.get(pluginId) ?? null
}

export function clearPluginState(pluginId: string): void {
  states.delete(pluginId)
}
