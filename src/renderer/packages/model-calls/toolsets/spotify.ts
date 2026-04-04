import { tool } from 'ai'
import z from 'zod'
import { getSpotifyState } from '@/packages/spotify-state-store'

// Dev: localhost:3003. Prod (Railway): VITE_SPOTIFY_APP_URL=/spotify (same-origin subpath).
const SPOTIFY_APP_URL = (import.meta.env.VITE_SPOTIFY_APP_URL as string | undefined) || 'http://localhost:3003'

export const spotifyTools = {
  spotify__open: tool({
    description:
      'Open the Spotify playlist app in the chat window. Use this when the user wants to create a playlist, add songs to Spotify, manage their music, or interact with Spotify in any way. The app renders inline — do not tell the user to click a link.',
    inputSchema: z.object({}),
    execute: async () => {
      return {
        action: 'render_app',
        appId: 'spotify',
        appUrl: SPOTIFY_APP_URL,
        tool: 'open',
        params: {},
        message: 'Opening Spotify...',
      }
    },
  }),

  spotify__search_tracks: tool({
    description:
      'Search for tracks on Spotify. The Spotify app must be open first (use spotify__open if not). Results will appear in the app. Use this when the user asks to find specific songs or artists.',
    inputSchema: z.object({
      query: z.string().describe('Search query, e.g. "Taylor Swift Anti-Hero" or "upbeat study music"'),
      limit: z.number().optional().describe('Number of results (1-10, default 8)'),
    }),
    execute: async (input: { query: string; limit?: number }) => {
      return {
        action: 'tool_invoke',
        appId: 'spotify',
        tool: 'search_tracks',
        params: input,
      }
    },
  }),

  spotify__create_playlist: tool({
    description:
      'Create a new Spotify playlist. Requires the user to be connected to Spotify. The Spotify app must be open first. Use this when the user asks to create a playlist.',
    inputSchema: z.object({
      name: z.string().describe('Playlist name, e.g. "Morning Run" or "Chill Study Session"'),
      description: z.string().optional().describe('Short playlist description'),
    }),
    execute: async (input: { name: string; description?: string }) => {
      return {
        action: 'tool_invoke',
        appId: 'spotify',
        tool: 'create_playlist',
        params: input,
      }
    },
  }),

  spotify__add_tracks: tool({
    description:
      'Add tracks to the current Spotify playlist. Use the track URIs from spotify__search_tracks results. A playlist must exist first (use spotify__create_playlist). Always search for tracks before adding them.',
    inputSchema: z.object({
      trackUris: z.array(z.string()).describe('Array of Spotify track URIs from search results, e.g. ["spotify:track:abc123"]'),
    }),
    execute: async (input: { trackUris: string[] }) => {
      return {
        action: 'tool_invoke',
        appId: 'spotify',
        tool: 'add_tracks',
        params: input,
      }
    },
  }),

  spotify__get_state: tool({
    description:
      'Get the current state of the Spotify app — whether the user is authenticated, what playlist exists, and what tracks are in it. Use this when you need to know the current playlist contents before taking action.',
    inputSchema: z.object({}),
    execute: async () => {
      const state = getSpotifyState()
      if (!state) return { error: 'Spotify app is not open. Use spotify__open first.' }
      return state
    },
  }),
}
