import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

const SPOTIFY_CLIENT_ID = 'bca3e654dde64837a47142233164d6be'
const REDIRECT_URI = 'https://chatbridge-production-8cbb.up.railway.app/spotify-callback'

export const Route = createFileRoute('/spotify-callback')({
  component: SpotifyCallbackPage,
})

function SpotifyCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const errParam = params.get('error')

    if (errParam) {
      setStatus('error')
      setError(errParam === 'access_denied' ? 'You cancelled the Spotify connection.' : errParam)
      return
    }

    if (!code) {
      setStatus('error')
      setError('No authorization code received from Spotify.')
      return
    }

    const verifier = localStorage.getItem('spotify_pkce_verifier')
    if (!verifier) {
      setStatus('error')
      setError('Authentication session expired. Please try again.')
      return
    }

    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    })
      .then((r) => r.json())
      .then((data: { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }) => {
        if (data.error || !data.access_token) {
          throw new Error(data.error_description ?? data.error ?? 'Token exchange failed')
        }
        localStorage.setItem('spotify_access_token', data.access_token)
        if (data.refresh_token) localStorage.setItem('spotify_refresh_token', data.refresh_token)
        localStorage.setItem('spotify_expires_at', String(Date.now() + (data.expires_in ?? 3600) * 1000))
        localStorage.removeItem('spotify_pkce_verifier')
        setStatus('success')
        // Notify the opener (AppEmbed) and close
        if (window.opener) {
          window.opener.postMessage({ type: 'SPOTIFY_AUTH_COMPLETE' }, '*')
          setTimeout(() => window.close(), 400)
        }
      })
      .catch((err: Error) => {
        setStatus('error')
        setError(err.message)
        localStorage.removeItem('spotify_pkce_verifier')
      })
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#121212',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        gap: 16,
      }}
    >
      {status === 'loading' && (
        <>
          <div style={{ fontSize: 48 }}>♪</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Connecting to Spotify...</div>
          <div style={{ fontSize: 13, color: '#b3b3b3' }}>Please wait</div>
        </>
      )}
      {status === 'success' && (
        <>
          <div style={{ fontSize: 48, color: '#1db954' }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Connected!</div>
          <div style={{ fontSize: 13, color: '#b3b3b3' }}>Closing window...</div>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 48 }}>✗</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Connection failed</div>
          <div style={{ fontSize: 13, color: '#b3b3b3', maxWidth: 280, textAlign: 'center' }}>{error}</div>
          <button
            onClick={() => window.close()}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              background: '#1db954',
              color: '#000',
              border: 'none',
              borderRadius: 24,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Close
          </button>
        </>
      )}
    </div>
  )
}
