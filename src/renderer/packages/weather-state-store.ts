/**
 * Module-level store for the last known weather state.
 * Written by AppEmbed on every STATE_UPDATE from the weather iframe.
 * Read by weather__get_state so the LLM gets real weather data.
 */

interface WeatherState {
  location: string
  temperature: number
  unit: string
  conditions: string
  humidity: number
  wind: number
  summary: string
}

let lastState: WeatherState | null = null

export function setWeatherState(state: Record<string, unknown>): void {
  lastState = state as unknown as WeatherState
}

export function getWeatherState(): WeatherState | null {
  return lastState
}
