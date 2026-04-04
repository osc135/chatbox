import { useEffect, useRef, useState, useCallback } from 'react'
import type { MessageAppPart } from '@shared/types'
import { fetchChessOpponentMove } from '@/packages/chess-opponent-move'
import { setChessState } from '@/packages/chess-state-store'
import { setSpotifyState } from '@/packages/spotify-state-store'

type ChessOpponentMoveResultMsg = {
  type: 'OPPONENT_MOVE_RESULT'
  pluginId: 'chess'
  requestId: string
  uci?: string
  error?: string
}

interface AppEmbedProps {
  part: MessageAppPart
  /** Required for chess LLM opponent (REQUEST_OPPONENT_MOVE). */
  sessionId?: string
  onStateUpdate?: (state: Record<string, unknown>) => void
}

export default function AppEmbed({ part, sessionId, onStateUpdate }: AppEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const authPopupRef = useRef<Window | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  // Send tool invocations to the iframe
  const sendToolInvoke = useCallback(
    (tool: string, params: Record<string, unknown>) => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'TOOL_INVOKE',
            tool,
            params,
            invocationId: `${Date.now()}`,
          },
          '*'
        )
      }
    },
    []
  )

  // Listen for messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | undefined
      if (!data || data.pluginId !== part.appId) return
      // Only handle messages originating from this AppEmbed's iframe to avoid
      // multiple AppEmbed instances (one per chess message in history) all
      // responding to the same events.
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return

      if (data.type === 'STATE_UPDATE') {
        if (data.payload && typeof data.payload === 'object') {
          const payload = data.payload as Record<string, unknown>
          if (part.appId === 'chess') setChessState(payload)
          if (part.appId === 'spotify') setSpotifyState(payload)
          if (onStateUpdate) onStateUpdate(payload)
        }
      }

      if (data.type === 'REQUEST_AUTH' && part.appId === 'spotify') {
        const authUrl = data.authUrl as string | undefined
        if (!authUrl) return
        const popup = window.open(authUrl, 'spotify-auth', 'width=500,height=700,noopener=0')
        if (popup) authPopupRef.current = popup
        return
      }

      if (data.type === 'COMPLETION') {
        console.log(`[AppEmbed] ${part.appId} completed:`, data.payload)
      }

      if (data.type === 'ERROR') {
        console.error(`[AppEmbed] ${part.appId} error:`, data.payload)
      }

      if (data.type === 'REQUEST_OPPONENT_MOVE' && part.appId === 'chess') {
        const requestId = data.requestId as string | undefined
        const fen = data.fen as string | undefined
        const difficulty = data.difficulty as string | undefined
        if (
          !requestId ||
          !fen ||
          (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard')
        ) {
          return
        }

        const replyToIframe = (msg: ChessOpponentMoveResultMsg) => {
          iframeRef.current?.contentWindow?.postMessage(msg, '*')
        }

        if (!sessionId) {
          replyToIframe({
            type: 'OPPONENT_MOVE_RESULT',
            pluginId: 'chess',
            requestId,
            error: 'no_session',
          })
          return
        }

        void fetchChessOpponentMove(sessionId, fen, difficulty).then((moveResult) => {
          if ('uci' in moveResult) {
            replyToIframe({
              type: 'OPPONENT_MOVE_RESULT',
              pluginId: 'chess',
              requestId,
              uci: moveResult.uci,
            })
          } else {
            replyToIframe({
              type: 'OPPONENT_MOVE_RESULT',
              pluginId: 'chess',
              requestId,
              error: moveResult.error,
            })
          }
        })
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [part.appId, sessionId, onStateUpdate])

  // Listen for SPOTIFY_AUTH_COMPLETE from the OAuth popup, then forward AUTH_COMPLETE to the iframe.
  useEffect(() => {
    if (part.appId !== 'spotify') return
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'SPOTIFY_AUTH_COMPLETE') return
      if (authPopupRef.current && event.source === authPopupRef.current) {
        authPopupRef.current = null
      }
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'AUTH_COMPLETE', pluginId: 'spotify' },
        '*',
      )
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [part.appId])

  // Forward tool invocations dispatched by abstract-ai-sdk to the iframe.
  // Only the AppEmbed whose iframe is actively loaded handles the event,
  // which prevents old/stale instances from double-invoking.
  useEffect(() => {
    const handler = (event: Event) => {
      if (!loaded) return
      const { appId, tool, params } = (event as CustomEvent<{ appId: string; tool: string; params: Record<string, unknown> }>).detail
      if (appId === part.appId) {
        sendToolInvoke(tool, params)
      }
    }
    window.addEventListener('app:toolInvoke', handler)
    return () => window.removeEventListener('app:toolInvoke', handler)
  }, [part.appId, loaded, sendToolInvoke])

  // Loading timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) setError(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [loaded])

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          background: '#1e1e1e',
          color: '#e85d5d',
          textAlign: 'center',
          fontSize: 13,
        }}
      >
        Failed to load {part.appId}. Please try again.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#141414' }}>
      {!loaded && (
        <div
          style={{
            padding: 20,
            textAlign: 'center',
            color: '#666',
            fontSize: 13,
          }}
        >
          Loading...
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={part.appUrl}
        onLoad={() => setLoaded(true)}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          display: loaded ? 'block' : 'none',
        }}
      />
    </div>
  )
}
