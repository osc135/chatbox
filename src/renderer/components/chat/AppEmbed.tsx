import { useEffect, useRef, useState, useCallback } from 'react'
import type { MessageAppPart } from '@shared/types'

interface AppEmbedProps {
  part: MessageAppPart
  onStateUpdate?: (state: Record<string, unknown>) => void
}

export default function AppEmbed({ part, onStateUpdate }: AppEmbedProps) {
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
      const data = event.data
      if (!data?.pluginId || data.pluginId !== part.appId) return

      if (data.type === 'STATE_UPDATE' && onStateUpdate) {
        onStateUpdate(data.payload)
      }

      if (data.type === 'COMPLETION') {
        console.log(`[AppEmbed] ${part.appId} completed:`, data.payload)
      }

      if (data.type === 'ERROR') {
        console.error(`[AppEmbed] ${part.appId} error:`, data.payload)
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [part.appId, onStateUpdate])

  // Auto-invoke start_game once the iframe loads
  useEffect(() => {
    if (loaded && part.appId === 'chess') {
      // Small delay to let the app initialize
      const timer = setTimeout(() => {
        sendToolInvoke('start_game', {})
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [loaded, part.appId, sendToolInvoke])

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
          background: '#2a2a3e',
          color: '#ff6b6b',
          textAlign: 'center',
        }}
      >
        Failed to load {part.appId} app. Please try again.
      </div>
    )
  }

  return (
    <div style={{ margin: '8px 0', borderRadius: 12, overflow: 'hidden', border: '1px solid #333' }}>
      {!loaded && (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            background: '#1a1a2e',
            color: '#aaa',
          }}
        >
          Loading {part.appId}...
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={part.appUrl}
        onLoad={() => setLoaded(true)}
        sandbox="allow-scripts allow-same-origin"
        style={{
          width: '100%',
          height: loaded ? 620 : 0,
          border: 'none',
          display: loaded ? 'block' : 'none',
          borderRadius: 12,
        }}
      />
    </div>
  )
}
