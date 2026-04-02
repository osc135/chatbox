// Types for platform <-> chess app communication

export type IncomingMessage = {
  type: 'TOOL_INVOKE'
  tool: string
  params: Record<string, unknown>
  invocationId: string
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
