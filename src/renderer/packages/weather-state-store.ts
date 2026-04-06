/**
 * Weather state store — thin wrapper around the generic plugin-state-store.
 */
import { setPluginState, getPluginState } from './plugin-state-store'

export function setWeatherState(state: Record<string, unknown>): void {
  setPluginState('weather', state)
}

export function getWeatherState(): Record<string, unknown> | null {
  return getPluginState('weather')
}
