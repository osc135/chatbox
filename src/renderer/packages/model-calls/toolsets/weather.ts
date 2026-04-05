import { tool } from 'ai'
import z from 'zod'
import { getWeatherState } from '@/packages/weather-state-store'

// Dev: localhost:3002. Prod (Railway): VITE_WEATHER_APP_URL=/weather (same-origin subpath).
const WEATHER_APP_URL = (import.meta.env.VITE_WEATHER_APP_URL as string | undefined) || 'http://localhost:3002'

export const weatherTools = {
  weather__update_location: tool({
    description:
      'Update the weather display to show a different location. Use this when the weather app is already open and the user asks about weather somewhere else. The iframe updates automatically — do not tell the user to click anything or provide a link.',
    inputSchema: z.object({
      location: z.string().describe('City or place name, e.g. "London", "Sydney"'),
    }),
    execute: async (input: { location: string }) => {
      return {
        action: 'render_app',
        appId: 'weather',
        appUrl: `${WEATHER_APP_URL}?location=${encodeURIComponent(input.location)}`,
        location: input.location,
      }
    },
  }),

  weather__get_state: tool({
    description:
      'Get the current weather data being displayed in the weather panel. Use this when the user asks about the weather, temperature, conditions, or anything related to what is currently shown — for example "is it cold?", "will it rain?", "what\'s the humidity?". Call this before answering so your response reflects the actual data on screen.',
    inputSchema: z.object({}),
    execute: async () => {
      const state = getWeatherState()
      if (!state) return { error: 'No weather data loaded yet. Show a location first.' }
      return state
    },
  }),

  weather__show_weather: tool({
    description:
      'Show current weather and a 7-day forecast for a location. The weather app renders inline in the chat — do not tell the user to click a link or visit a URL. Call this tool immediately whenever the user mentions weather, temperature, forecast, rain, snow, or asks about conditions in any place. Do not ask for clarification — if a location is clear from context, call the tool right away.',
    inputSchema: z.object({
      location: z.string().describe('City or place name, e.g. "Tokyo", "New York", "Paris"'),
    }),
    execute: async (input: { location: string }) => {
      return {
        action: 'render_app',
        appId: 'weather',
        appUrl: `${WEATHER_APP_URL}?location=${encodeURIComponent(input.location)}`,
        location: input.location,
      }
    },
  }),
}
