import { useState, useEffect, useCallback, useRef } from 'react'

const SPOTIFY_CLIENT_ID = 'bca3e654dde64837a47142233164d6be'
const REDIRECT_URI = 'https://chatbridge-production-8cbb.up.railway.app/spotify-callback'
const SCOPES = 'playlist-modify-public playlist-modify-private playlist-read-private user-read-private user-read-email'

// ── Types ────────────────────────────────────────────────────────────────────

interface Track {
  uri: string
  id: string
  name: string
  artists: string
  album: string
  albumArt: string | null
  durationMs: number
}

interface Playlist {
  id: string
  name: string
  url: string
  tracks: Track[]
}

type AuthStatus = 'checking' | 'unauthed' | 'authed'

// ── postMessage helpers ───────────────────────────────────────────────────────

type OutgoingMsg =
  | { type: 'STATE_UPDATE'; pluginId: 'spotify'; invocationId: string; payload: Record<string, unknown> }
  | { type: 'COMPLETION'; pluginId: 'spotify'; payload: Record<string, unknown> }
  | { type: 'ERROR'; pluginId: 'spotify'; invocationId: string; payload: { code: string; message: string } }
  | { type: 'REQUEST_AUTH'; pluginId: 'spotify'; authUrl: string }

function sendToParent(msg: OutgoingMsg) {
  if (window.parent !== window) window.parent.postMessage(msg, '*')
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateVerifier(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier: string): Promise<string> {
  const enc = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── Spotify API helpers ───────────────────────────────────────────────────────

async function getValidToken(): Promise<string | null> {
  const token = localStorage.getItem('spotify_access_token')
  const expiresAt = Number(localStorage.getItem('spotify_expires_at') || '0')

  if (!token) return null

  // Refresh if expiring within 5 minutes
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const refresh = localStorage.getItem('spotify_refresh_token')
    if (!refresh) {
      localStorage.removeItem('spotify_access_token')
      return null
    }
    try {
      const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refresh,
        }),
      })
      if (!resp.ok) {
        localStorage.removeItem('spotify_access_token')
        localStorage.removeItem('spotify_refresh_token')
        localStorage.removeItem('spotify_expires_at')
        return null
      }
      const data = await resp.json() as { access_token: string; refresh_token?: string; expires_in: number }
      localStorage.setItem('spotify_access_token', data.access_token)
      if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token)
      localStorage.setItem('spotify_expires_at', String(Date.now() + data.expires_in * 1000))
      return data.access_token
    } catch {
      return null
    }
  }

  return token
}

async function spotifyFetch(path: string, options?: RequestInit): Promise<unknown> {
  const token = await getValidToken()
  if (!token) throw new Error('Not authenticated with Spotify')

  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })

  if (resp.status === 204) return null
  const json = await resp.json()
  if (!resp.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message
    throw new Error(msg || `Spotify API error ${resp.status}`)
  }
  return json
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function serializePlaylist(p: Playlist) {
  return {
    id: p.id,
    name: p.name,
    url: p.url,
    trackCount: p.tracks.length,
    tracks: p.tracks.map((t) => ({ uri: t.uri, name: t.name, artists: t.artists })),
  }
}

function buildStatePayload(
  authenticated: boolean,
  userId: string | null,
  playlist: Playlist | null,
  searchResults: Track[],
  lastAction: string,
) {
  return {
    authenticated,
    userId,
    playlist: playlist ? serializePlaylist(playlist) : null,
    searchResults: searchResults.length > 0
      ? searchResults.map((t) => ({ uri: t.uri, name: t.name, artists: t.artists, album: t.album }))
      : null,
    lastAction,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SpotifyApp() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [userId, setUserId] = useState<string | null>(null)
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [addingUri, setAddingUri] = useState<string | null>(null)

  // Keep mutable refs so the message handler always has latest values
  const playlistRef = useRef(playlist)
  const userIdRef = useRef(userId)
  const authStatusRef = useRef(authStatus)
  const searchResultsRef = useRef(searchResults)
  useEffect(() => { playlistRef.current = playlist }, [playlist])
  useEffect(() => { userIdRef.current = userId }, [userId])
  useEffect(() => { authStatusRef.current = authStatus }, [authStatus])
  useEffect(() => { searchResultsRef.current = searchResults }, [searchResults])

  // ── Auth check on mount ──
  useEffect(() => {
    const token = localStorage.getItem('spotify_access_token')
    if (!token) { setAuthStatus('unauthed'); return }

    void (async () => {
      const t = await getValidToken()
      if (!t) { setAuthStatus('unauthed'); return }
      try {
        const user = await spotifyFetch('/me') as { id: string }
        setUserId(user.id)
        setAuthStatus('authed')
      } catch {
        setAuthStatus('unauthed')
      }
    })()
  }, [])

  // ── Request auth from parent ──
  const requestAuth = useCallback(async () => {
    const verifier = generateVerifier()
    const challenge = await generateChallenge(verifier)
    localStorage.setItem('spotify_pkce_verifier', verifier)
    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    })
    sendToParent({
      type: 'REQUEST_AUTH',
      pluginId: 'spotify',
      authUrl: `https://accounts.spotify.com/authorize?${params}`,
    })
  }, [])

  // ── postMessage handler ──
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | undefined
      if (!data) return

      // Auth complete from parent
      if (data.type === 'AUTH_COMPLETE' && data.pluginId === 'spotify') {
        try {
          const t = await getValidToken()
          if (!t) { setAuthStatus('unauthed'); return }
          const user = await spotifyFetch('/me') as { id: string }
          setUserId(user.id)
          setAuthStatus('authed')
          sendToParent({
            type: 'STATE_UPDATE',
            pluginId: 'spotify',
            invocationId: 'auth',
            payload: buildStatePayload(true, user.id, playlistRef.current, [], 'auth_complete'),
          })
        } catch {
          setAuthStatus('unauthed')
        }
        return
      }

      // Tool invocation from platform
      if (data.type === 'TOOL_INVOKE') {
        const tool = data.tool as string
        const params = (data.params ?? {}) as Record<string, unknown>
        const invocationId = data.invocationId as string
        await handleTool(tool, params, invocationId)
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, []) // stable — uses refs for latest state

  // ── Tool handler ──
  const handleTool = useCallback(async (
    tool: string,
    params: Record<string, unknown>,
    invocationId: string,
  ) => {
    setLoading(true)
    try {
      switch (tool) {
        case 'open': {
          sendToParent({
            type: 'STATE_UPDATE',
            pluginId: 'spotify',
            invocationId,
            payload: buildStatePayload(
              authStatusRef.current === 'authed',
              userIdRef.current,
              playlistRef.current,
              [],
              'opened',
            ),
          })
          break
        }

        case 'search_tracks': {
          setLoadingMsg('Searching Spotify...')
          const query = params.query as string
          const limit = Math.min((params.limit as number) || 8, 10)
          const data = await spotifyFetch(
            `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
          ) as { tracks: { items: SpotifyTrackItem[] } }

          const tracks: Track[] = data.tracks.items.map(mapTrack)
          setSearchResults(tracks)

          sendToParent({
            type: 'STATE_UPDATE',
            pluginId: 'spotify',
            invocationId,
            payload: buildStatePayload(
              true,
              userIdRef.current,
              playlistRef.current,
              tracks,
              `searched: "${query}"`,
            ),
          })
          break
        }

        case 'create_playlist': {
          if (!userIdRef.current) throw new Error('Not authenticated with Spotify')
          setLoadingMsg('Creating playlist...')
          const name = params.name as string
          const description = (params.description as string) || 'Created with ChatBridge'
          const data = await spotifyFetch(`/users/${userIdRef.current}/playlists`, {
            method: 'POST',
            body: JSON.stringify({ name, description, public: false }),
          }) as { id: string; name: string; external_urls: { spotify: string } }

          const newPlaylist: Playlist = { id: data.id, name: data.name, url: data.external_urls.spotify, tracks: [] }
          setPlaylist(newPlaylist)
          playlistRef.current = newPlaylist

          sendToParent({
            type: 'STATE_UPDATE',
            pluginId: 'spotify',
            invocationId,
            payload: buildStatePayload(true, userIdRef.current, newPlaylist, searchResultsRef.current, `created_playlist: "${name}"`),
          })
          break
        }

        case 'add_tracks': {
          if (!playlistRef.current) throw new Error('No playlist exists yet. Create a playlist first.')
          setLoadingMsg('Adding tracks...')
          const uris = params.trackUris as string[]
          await spotifyFetch(`/playlists/${playlistRef.current.id}/tracks`, {
            method: 'POST',
            body: JSON.stringify({ uris }),
          })

          const tracksData = await spotifyFetch(`/playlists/${playlistRef.current.id}/tracks`) as { items: { track: SpotifyTrackItem }[] }
          const updatedTracks: Track[] = tracksData.items.map((item) => mapTrack(item.track))
          const updated: Playlist = { ...playlistRef.current, tracks: updatedTracks }
          setPlaylist(updated)
          playlistRef.current = updated
          setSearchResults([])

          sendToParent({
            type: 'STATE_UPDATE',
            pluginId: 'spotify',
            invocationId,
            payload: buildStatePayload(true, userIdRef.current, updated, [], `added ${uris.length} track(s)`),
          })
          break
        }

        case 'get_state': {
          sendToParent({
            type: 'STATE_UPDATE',
            pluginId: 'spotify',
            invocationId,
            payload: buildStatePayload(
              authStatusRef.current === 'authed',
              userIdRef.current,
              playlistRef.current,
              searchResultsRef.current,
              'get_state',
            ),
          })
          break
        }

        default:
          sendToParent({
            type: 'ERROR',
            pluginId: 'spotify',
            invocationId,
            payload: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${tool}` },
          })
      }
    } catch (err) {
      sendToParent({
        type: 'ERROR',
        pluginId: 'spotify',
        invocationId,
        payload: { code: 'TOOL_ERROR', message: err instanceof Error ? err.message : String(err) },
      })
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, [])

  // ── Manual search ──
  const runSearch = useCallback(async () => {
    if (!searchQuery.trim() || loading) return
    setLoading(true)
    setLoadingMsg('Searching...')
    try {
      const data = await spotifyFetch(
        `/search?q=${encodeURIComponent(searchQuery.trim())}&type=track&limit=8`,
      ) as { tracks: { items: SpotifyTrackItem[] } }
      setSearchResults(data.tracks.items.map(mapTrack))
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
      setLoadingMsg('')
    }
  }, [searchQuery, loading])

  // ── Manual add track ──
  const addTrack = useCallback(async (track: Track) => {
    if (!playlist) return
    setAddingUri(track.uri)
    try {
      await spotifyFetch(`/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris: [track.uri] }),
      })
      const updated: Playlist = { ...playlist, tracks: [...playlist.tracks, track] }
      setPlaylist(updated)
      playlistRef.current = updated
    } catch (err) {
      console.error('Add track error:', err)
    } finally {
      setAddingUri(null)
    }
  }, [playlist])

  // ── Manual remove track ──
  const removeTrack = useCallback(async (uri: string) => {
    if (!playlist) return
    try {
      await spotifyFetch(`/playlists/${playlist.id}/tracks`, {
        method: 'DELETE',
        body: JSON.stringify({ tracks: [{ uri }] }),
      })
      const updated: Playlist = { ...playlist, tracks: playlist.tracks.filter((t) => t.uri !== uri) }
      setPlaylist(updated)
      playlistRef.current = updated
    } catch (err) {
      console.error('Remove track error:', err)
    }
  }, [playlist])

  // ── Render ──
  if (authStatus === 'checking') {
    return (
      <div className="app">
        <div className="loading-overlay" style={{ position: 'relative', flex: 1 }}>
          <div className="spinner" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (authStatus === 'unauthed') {
    return (
      <div className="app">
        <div className="auth-screen">
          <div className="auth-logo">♪</div>
          <div className="auth-title">Spotify Playlists</div>
          <div className="auth-subtitle">
            Connect your Spotify account to let the AI create and manage playlists for you.
          </div>
          <button className="btn-spotify" onClick={requestAuth}>
            Connect Spotify
          </button>
        </div>
      </div>
    )
  }

  const isTrackInPlaylist = (uri: string) => playlist?.tracks.some((t) => t.uri === uri) ?? false

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-title">
          <span className="topbar-dot" />
          Spotify
        </div>
        <div className="topbar-status">
          {playlist ? `${playlist.tracks.length} track${playlist.tracks.length !== 1 ? 's' : ''}` : 'No playlist yet'}
        </div>
      </div>

      <div className="main">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            {loadingMsg && <span>{loadingMsg}</span>}
          </div>
        )}

        {!playlist && !searchResults.length ? (
          <div className="ready-state">
            <div className="ready-icon">🎵</div>
            <div className="ready-title">Ready</div>
            <div className="ready-hint">Ask me to create a playlist, or search for tracks below.</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {playlist && (
              <>
                <div className="playlist-header">
                  <div className="playlist-name">{playlist.name}</div>
                  <div className="playlist-meta">
                    <span>{playlist.tracks.length} tracks</span>
                    <a className="playlist-link" href={playlist.url} target="_blank" rel="noopener noreferrer">
                      Open in Spotify ↗
                    </a>
                  </div>
                </div>
                <div className="track-list">
                  {playlist.tracks.length === 0 && (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                      No tracks yet — ask me to add some!
                    </div>
                  )}
                  {playlist.tracks.map((track) => (
                    <div key={track.uri} className="track-row">
                      {track.albumArt ? (
                        <img src={track.albumArt} alt="" className="track-art" />
                      ) : (
                        <div className="track-art-placeholder">♪</div>
                      )}
                      <div className="track-info">
                        <div className="track-name">{track.name}</div>
                        <div className="track-artist">{track.artists}</div>
                      </div>
                      <span className="track-duration">{fmtDuration(track.durationMs)}</span>
                      <button className="track-remove" onClick={() => void removeTrack(track.uri)} title="Remove">×</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {searchResults.length > 0 && (
              <>
                <div className="search-results-header">Search Results</div>
                <div className="track-list" style={{ maxHeight: playlist ? '180px' : undefined }}>
                  {searchResults.map((track) => (
                    <div key={track.uri} className="track-row">
                      {track.albumArt ? (
                        <img src={track.albumArt} alt="" className="track-art" />
                      ) : (
                        <div className="track-art-placeholder">♪</div>
                      )}
                      <div className="track-info">
                        <div className="track-name">{track.name}</div>
                        <div className="track-artist">{track.artists}</div>
                      </div>
                      {playlist && (
                        <button
                          className="track-add"
                          onClick={() => void addTrack(track)}
                          disabled={isTrackInPlaylist(track.uri) || addingUri === track.uri}
                        >
                          {isTrackInPlaylist(track.uri) ? '✓' : addingUri === track.uri ? '...' : 'Add'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="search-bar">
        <input
          className="search-input"
          type="text"
          placeholder="Search for songs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void runSearch() }}
        />
        <button className="search-submit" onClick={() => void runSearch()} disabled={loading || !searchQuery.trim()}>
          ▶
        </button>
      </div>
    </div>
  )
}

// ── Spotify API types ─────────────────────────────────────────────────────────

interface SpotifyTrackItem {
  uri: string
  id: string
  name: string
  artists: Array<{ name: string }>
  album: { name: string; images: Array<{ url: string }> }
  duration_ms: number
}

function mapTrack(t: SpotifyTrackItem): Track {
  return {
    uri: t.uri,
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name).join(', '),
    album: t.album.name,
    albumArt: t.album.images[0]?.url ?? null,
    durationMs: t.duration_ms,
  }
}
