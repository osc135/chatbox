/**
 * Chess state store — thin wrapper around the generic plugin-state-store.
 * Kept for backward compatibility with existing tests and direct callers.
 */
import { setPluginState, getPluginState } from './plugin-state-store'

export function setChessState(state: Record<string, unknown>): void {
  setPluginState('chess', state)
}

export function getChessState(): Record<string, unknown> | null {
  return getPluginState('chess')
}
