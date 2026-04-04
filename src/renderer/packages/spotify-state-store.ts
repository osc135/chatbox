/**
 * Module-level store for the last known Spotify state.
 * Written by AppEmbed on every STATE_UPDATE from the Spotify iframe.
 * Read by spotify__get_state so the LLM gets current playlist data.
 */

let lastState: Record<string, unknown> | null = null

export function setSpotifyState(state: Record<string, unknown>): void {
  lastState = state
}

export function getSpotifyState(): Record<string, unknown> | null {
  return lastState
}
