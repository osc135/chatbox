// Types for platform <-> chess app communication

export type IncomingMessage = {
  type: 'TOOL_INVOKE'
  tool: string
  params: Record<string, unknown>
  invocationId: string
}

/** Parent → iframe: reply to REQUEST_OPPONENT_MOVE */
export type OpponentMoveResultMessage = {
  type: 'OPPONENT_MOVE_RESULT'
  pluginId: 'chess'
  requestId: string
  uci?: string
  error?: string
}

export type OutgoingStateUpdate = {
  type: 'STATE_UPDATE'
  pluginId: 'chess'
  invocationId: string
  payload: {
    fen: string
    turn: string
    status: 'in_progress' | 'checkmate' | 'stalemate' | 'draw' | 'resigned'
    lastMove?: string
  }
}

export type OutgoingCompletion = {
  type: 'COMPLETION'
  pluginId: 'chess'
  payload: {
    result: string
    winner?: string
    reason: 'game_over' | 'user_switched' | 'resigned'
  }
}

export type OutgoingError = {
  type: 'ERROR'
  pluginId: 'chess'
  invocationId: string
  payload: {
    code: string
    message: string
  }
}

export type OutgoingMessage = OutgoingStateUpdate | OutgoingCompletion | OutgoingError

export function sendToParent(message: OutgoingMessage) {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*')
  }
}

export type OpponentDifficulty = 'easy' | 'medium' | 'hard'

/**
 * Ask the host (Chatbox) for one UCI move via LLM. Resolves to empty string on timeout or missing parent.
 */
export function waitForOpponentUci(
  fen: string,
  difficulty: OpponentDifficulty,
  options?: { timeoutMs?: number }
): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 120_000
  if (typeof window === 'undefined' || window.parent === window) {
    console.warn('[chess] No chat shell — LLM opponent unavailable; using random legal move.')
    return Promise.resolve('')
  }

  return new Promise((resolve) => {
    const requestId = crypto.randomUUID()
    const t = window.setTimeout(() => {
      window.removeEventListener('message', onReply)
      resolve('')
    }, timeoutMs)

    const onReply = (event: MessageEvent) => {
      const d = event.data as OpponentMoveResultMessage | undefined
      if (d?.type !== 'OPPONENT_MOVE_RESULT' || d.pluginId !== 'chess' || d.requestId !== requestId) {
        return
      }
      window.clearTimeout(t)
      window.removeEventListener('message', onReply)
      resolve(typeof d.uci === 'string' ? d.uci : '')
    }

    window.addEventListener('message', onReply)
    window.parent.postMessage(
      {
        type: 'REQUEST_OPPONENT_MOVE',
        pluginId: 'chess',
        requestId,
        fen,
        difficulty,
      },
      '*'
    )
  })
}
