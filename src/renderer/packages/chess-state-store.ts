/**
 * Module-level store for the last known chess board state.
 * Written by AppEmbed on every STATE_UPDATE from the chess iframe.
 * Read by chess__get_board_state so the LLM gets real board data.
 */

let lastState: Record<string, unknown> | null = null

export function setChessState(state: Record<string, unknown>): void {
  lastState = state
}

export function getChessState(): Record<string, unknown> | null {
  return lastState
}
