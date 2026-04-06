import { tool } from 'ai'
import z from 'zod'
import { getPluginState } from '@/packages/plugin-state-store'
import type { InlinePlugin } from '@/packages/plugin-sdk/types'
import WeatherApp from '@/components/apps/WeatherApp'

export const weatherPlugin: InlinePlugin = {
  id: 'weather',
  name: 'Weather',
  description: 'Live weather conditions and 7-day forecast for any location worldwide',
  version: '1.0.0',
  author: 'TutorMeAI',
  type: 'inline',
  component: WeatherApp as InlinePlugin['component'],
  systemPromptHint:
    '- Weather: call weather__show_weather when the user asks about weather, temperature, or forecasts for any location',

  tools: {
    weather__show_weather: tool({
      description:
        'Show current weather and a 7-day forecast for a location. The weather app renders inline in the chat — do not tell the user to click a link or visit a URL. Call this tool immediately whenever the user mentions weather, temperature, forecast, rain, snow, or asks about conditions in any place.',
      inputSchema: z.object({
        location: z.string().describe('City or place name, e.g. "Tokyo", "New York", "Paris"'),
      }),
      execute: async (input: { location: string }) => ({
        action: 'render_app',
        appId: 'weather',
        location: input.location,
      }),
    }),

    weather__update_location: tool({
      description:
        'Update the weather display to show a different location. Use this when the weather app is already open and the user asks about weather somewhere else.',
      inputSchema: z.object({
        location: z.string().describe('City or place name, e.g. "London", "Sydney"'),
      }),
      execute: async (input: { location: string }) => ({
        action: 'tool_invoke',
        appId: 'weather',
        tool: 'update_location',
        params: { location: input.location },
      }),
    }),

    weather__get_state: tool({
      description:
        'Get the current weather data being displayed in the weather panel. Use this when the user asks about the weather, temperature, conditions, or anything related to what is currently shown — for example "is it cold?", "will it rain?", "what\'s the humidity?".',
      inputSchema: z.object({}),
      execute: async () => {
        const state = getPluginState('weather')
        if (!state) return { error: 'No weather data loaded yet. Show a location first.' }
        return state
      },
    }),
  },
}
