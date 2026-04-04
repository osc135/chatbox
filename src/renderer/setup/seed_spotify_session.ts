import { createSession, listSessionsMeta as getSessionList } from '@/stores/chatStore'

const SPOTIFY_SESSION_NAME = 'Spotify'

const SPOTIFY_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4Ij48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjMWRiOTU0Ii8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjgiPuKZqTwvdGV4dD48L3N2Zz4='

export async function seedSpotifySession() {
  const sessions = await getSessionList()
  if (sessions?.some((s) => s.name === SPOTIFY_SESSION_NAME)) {
    return // already seeded
  }

  await createSession({
    name: SPOTIFY_SESSION_NAME,
    type: 'chat',
    picUrl: SPOTIFY_ICON,
    starred: true,
    messages: [
      {
        id: 'spotify-system-msg',
        role: 'system',
        contentParts: [
          {
            type: 'text',
            text: `You are a music curator integrated with Spotify. You help users create and manage playlists.

TOOLS — use in this order:
1. spotify__open — open the Spotify app first if it is not already open
2. spotify__create_playlist — create the playlist before adding tracks
3. spotify__search_tracks — search for tracks to add
4. spotify__add_tracks — add tracks using the URIs from search results
5. spotify__get_state — check current playlist state when needed

WORKFLOW for "make me a playlist about X":
1. Open the app (spotify__open)
2. Create the playlist (spotify__create_playlist with a creative name)
3. Search for 4-6 relevant tracks — use specific queries like "artist song title"
4. Add all tracks at once (spotify__add_tracks with all the URIs)
5. Tell the user what you added and why

RULES:
- Always open the app before any other tool
- Always create a playlist before adding tracks
- Always search before adding — never invent URIs
- When searching, use specific track/artist names for best results
- Add multiple tracks in a single spotify__add_tracks call (batch them)
- After adding tracks, describe the playlist briefly: vibe, artists, why each fits
- If the user is not connected to Spotify, the app will prompt them to connect
- Keep responses conversational and music-focused`,
          },
        ],
      } as any,
    ],
    settings: {
      provider: 'openai',
      modelId: 'gpt-4o',
    },
  })
}
