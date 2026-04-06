import { useEffect, useRef, useState, useCallback } from 'react'
import type { MessageAppPart } from '@shared/types'
import { fetchChessOpponentMove } from '@/packages/chess-opponent-move'
import { setPluginState } from '@/packages/plugin-state-store'
import { getPlugin, getPluginOrigin } from '@/packages/pluginRegistry'
import type { IframePlugin, OpponentMoveResultMessage } from '@/packages/plugin-sdk/types'

interface AppEmbedProps {
  part: MessageAppPart
  /** Required for chess LLM opponent (REQUEST_OPPONENT_MOVE). */
  sessionId?: string
  onStateUpdate?: (state: Record<string, unknown>) => void
}

export default function AppEmbed({ part, sessionId, onStateUpdate }: AppEmbedProps) {
  const plugin = getPlugin(part.appId)

  // ── Inline apps (bundled React components) ───────────────────────────────────
  // The plugin registry provides a wrapper component for each inline app.
  // No per-app if/else needed — the manifest carries the component.
  if (plugin?.type === 'inline') {
    const Component = plugin.component
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <Component state={part.state ?? {}} sessionId={sessionId} onStateUpdate={onStateUpdate} />
      </div>
    )
  }

  // ── Iframe apps ───────────────────────────────────────────────────────────────
  return (
    <IframeEmbed
      part={part}
      plugin={plugin?.type === 'iframe' ? plugin : undefined}
      sessionId={sessionId}
      onStateUpdate={onStateUpdate}
    />
  )
}

// ─── IframeEmbed ──────────────────────────────────────────────────────────────
// Extracted as a separate component so hooks are called unconditionally
// (React rules of hooks forbid calling hooks after an early return).

interface IframeEmbedProps {
  part: MessageAppPart
  /** Undefined for unregistered plugins — we still render but can't validate origins. */
  plugin: IframePlugin | undefined
  sessionId?: string
  onStateUpdate?: (state: Record<string, unknown>) => void
}

function IframeEmbed({ part, plugin, sessionId, onStateUpdate }: IframeEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  // Derive the trusted origin for this iframe.
  // Used to:
  //   (a) restrict outgoing postMessage to the correct target
  //   (b) validate incoming message origins from cross-origin iframes
  // Falls back to '*' for dev/unregistered plugins — acceptable only in dev.
  const trustedOrigin = plugin ? getPluginOrigin(plugin) : '*'

  /** Send a structured message to the iframe, restricted to its trusted origin. */
  const postToIframe = useCallback(
    (msg: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage(msg, trustedOrigin)
    },
    [trustedOrigin]
  )

  /** Send a tool invocation to the iframe. */
  const sendToolInvoke = useCallback(
    (tool: string, params: Record<string, unknown>) => {
      postToIframe({
        type: 'TOOL_INVOKE',
        tool,
        params,
        invocationId: `${Date.now()}`,
      })
    },
    [postToIframe]
  )

  // Listen for messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | undefined
      if (!data || data['pluginId'] !== part.appId) return

      // Security: only accept messages from this embed's own iframe element.
      // This prevents other iframes or tabs from spoofing app state updates.
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return

      // For cross-origin iframe apps, additionally validate the message origin
      // against the registered plugin URL. Same-origin sandboxed iframes (those
      // using sandbox without allow-same-origin) report origin as 'null', which
      // we allow through since we already validated event.source above.
      if (
        trustedOrigin !== '*' &&
        event.origin !== 'null' &&
        event.origin !== trustedOrigin
      ) {
        console.warn(
          `[AppEmbed] Rejected message from unexpected origin ${event.origin} ` +
          `(expected ${trustedOrigin}) for plugin ${part.appId}`
        )
        return
      }

      if (data['type'] === 'STATE_UPDATE') {
        const payload = data['payload'] as Record<string, unknown> | undefined
        if (payload && typeof payload === 'object') {
          // Generic store — no per-plugin if/else needed.
          // Any plugin's state updates are stored and retrievable by the LLM
          // via getPluginState(pluginId) in the plugin's tool execute() function.
          setPluginState(part.appId, payload)
          onStateUpdate?.(payload)
        }
      }

      if (data['type'] === 'COMPLETION') {
        console.log(`[AppEmbed] ${part.appId} completed:`, data['payload'])
      }

      if (data['type'] === 'ERROR') {
        console.error(`[AppEmbed] ${part.appId} error:`, data['payload'])
      }

      // Chess-specific: LLM-powered opponent move request.
      // The chess app sends REQUEST_OPPONENT_MOVE; we call the LLM and reply.
      if (data['type'] === 'REQUEST_OPPONENT_MOVE' && part.appId === 'chess') {
        const requestId = data['requestId'] as string | undefined
        const fen = data['fen'] as string | undefined
        const difficulty = data['difficulty'] as string | undefined
        if (
          !requestId ||
          !fen ||
          (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard')
        ) return

        const reply = (msg: OpponentMoveResultMessage) => postToIframe(msg)

        if (!sessionId) {
          reply({ type: 'OPPONENT_MOVE_RESULT', pluginId: 'chess', requestId, error: 'no_session' })
          return
        }

        void fetchChessOpponentMove(sessionId, fen, difficulty).then((moveResult) => {
          if ('uci' in moveResult) {
            reply({ type: 'OPPONENT_MOVE_RESULT', pluginId: 'chess', requestId, uci: moveResult.uci })
          } else {
            reply({ type: 'OPPONENT_MOVE_RESULT', pluginId: 'chess', requestId, error: moveResult.error })
          }
        })
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [part.appId, sessionId, trustedOrigin, onStateUpdate, postToIframe])

  // Forward tool invocations dispatched by abstract-ai-sdk to the iframe.
  // Only the loaded AppEmbed instance handles the event — prevents stale
  // instances (one per message in history) from double-invoking.
  useEffect(() => {
    const handler = (event: Event) => {
      if (!loaded) return
      const { appId, tool, params } = (
        event as CustomEvent<{ appId: string; tool: string; params: Record<string, unknown> }>
      ).detail
      if (appId === part.appId) sendToolInvoke(tool, params)
    }
    window.addEventListener('app:toolInvoke', handler)
    return () => window.removeEventListener('app:toolInvoke', handler)
  }, [part.appId, loaded, sendToolInvoke])

  // 10-second load timeout — show error + retry button
  useEffect(() => {
    const timer = setTimeout(() => { if (!loaded) setError(true) }, 10000)
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
          <div
            style={{
              width: 24,
              height: 24,
              border: '2.5px solid rgba(255,255,255,0.08)',
              borderTopColor: 'rgba(255,255,255,0.5)',
              borderRadius: '50%',
              animation: 'app-spin 0.7s linear infinite',
            }}
          />
          <style>{`@keyframes app-spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading {appLabel}…</div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={part.appUrl}
        onLoad={() => setLoaded(true)}
        // Security: 'allow-scripts' only — no allow-same-origin.
        //
        // Without allow-same-origin, sandboxed iframes are treated as a unique
        // null origin even when served from the same domain. This prevents a
        // co-located iframe from accessing the parent's localStorage, sessionStorage,
        // or cookies — which would otherwise expose the user's auth token.
        //
        // Individual plugins can override this by setting sandbox: 'allow-scripts allow-same-origin'
        // in their manifest, but should do so only with explicit justification.
        sandbox={plugin?.sandbox ?? 'allow-scripts'}
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
