import { useEffect, useRef, useState, useCallback } from 'react'
import type { MessageAppPart } from '@shared/types'
import { fetchChessOpponentMove } from '@/packages/chess-opponent-move'
import { setChessState } from '@/packages/chess-state-store'
import CountingApp from '@/components/apps/CountingApp'
import VocabApp from '@/components/apps/VocabApp'
import type { VocabCard } from '@/components/apps/VocabApp'
import CalendarApp from '@/components/apps/CalendarApp'

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
  // ── Inline apps (bundled with main app, no iframe needed) ─────────────────
  if (part.appId === 'counting') {
    const match = part.appUrl.match(/[?&]level=(\d)/)
    const level = match ? (parseInt(match[1]!) as 1 | 2 | 3) : 1
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <CountingApp initialLevel={level} onStateUpdate={onStateUpdate} />
      </div>
    )
  }

  if (part.appId === 'vocab') {
    const words = (part.state?.words as VocabCard[]) ?? []
    const topic = part.state?.topic as string | undefined
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <VocabApp initialCards={words} topic={topic} onStateUpdate={onStateUpdate} />
      </div>
    )
  }

  if (part.appId === 'calendar') {
    const prefill = part.state?.prefill as { title?: string; date?: string; startTime?: string; endTime?: string; description?: string } | undefined
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <CalendarApp prefill={prefill} onStateUpdate={onStateUpdate} />
      </div>
    )
  }

  const iframeRef = useRef<HTMLIFrameElement>(null)
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
          if (onStateUpdate) onStateUpdate(payload)
        }
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

  // Loading timeout — 10 s to load, then show error with retry
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) setError(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [loaded])

  const appLabel = part.appId.charAt(0).toUpperCase() + part.appId.slice(1)

  if (error) {
    return (
      <div
        style={{
          padding: '24px 20px',
          borderRadius: 10,
          background: '#1a1a1f',
          border: '1px solid rgba(232,93,93,0.2)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 28 }}>⚠️</div>
        <div style={{ color: '#e85d5d', fontSize: 13.5, fontWeight: 600 }}>
          {appLabel} failed to load
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12.5, lineHeight: 1.5, maxWidth: 260 }}>
          The app took too long to respond. This can happen if the server is slow or offline.
        </div>
        <button
          onClick={() => { setError(false); setLoaded(false) }}
          style={{
            marginTop: 4,
            padding: '7px 16px',
            background: 'rgba(232,93,93,0.12)',
            border: '1px solid rgba(232,93,93,0.3)',
            borderRadius: 6,
            color: '#e85d5d',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#141414' }}>
      {!loaded && (
        <div
          style={{
            padding: '24px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{
            width: 24, height: 24,
            border: '2.5px solid rgba(255,255,255,0.08)',
            borderTopColor: 'rgba(255,255,255,0.5)',
            borderRadius: '50%',
            animation: 'app-spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes app-spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Loading {appLabel}…
          </div>
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
