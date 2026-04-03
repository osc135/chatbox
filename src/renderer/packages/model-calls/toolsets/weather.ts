import { tool } from 'ai'
import z from 'zod'

const WEATHER_APP_URL = 'http://localhost:3002'

export const weatherTools = {
  weather__show_weather: tool({
    description:
      'Show current weather and a 7-day forecast for a location. Call this tool immediately whenever the user mentions weather, temperature, forecast, rain, snow, or asks about conditions in any place. Do not ask for clarification — if a location is clear from context, call the tool right away.',
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
