import { createSession, listSessionsMeta as getSessionList } from '@/stores/chatStore'

const CHESS_SESSION_NAME = 'Chess'

const CHESS_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4Ij48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjN2M1Y2JmIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjgiPiYjOTgyMjs8L3RleHQ+PC9zdmc+'

export async function seedChessSession() {
  const sessions = await getSessionList()
  if (sessions?.some((s) => s.name === CHESS_SESSION_NAME)) {
    return // already seeded
  }

  await createSession({
    name: CHESS_SESSION_NAME,
    type: 'chat',
    picUrl: CHESS_ICON,
    starred: true,
    messages: [
      {
        id: 'chess-system-msg',
        role: 'system',
        contentParts: [
          {
            type: 'text',
            text: `You are a chess coach integrated with an interactive chess board. Follow these rules strictly:

TOOLS:
- Use chess__start_game when the user wants to play.
- Use chess__make_move when they describe a move.
- Use chess__get_board_state when they ask for advice, what to do next, or when you need the position.
- Use chess__resign when they want to quit.

MOVE SUGGESTIONS — always include all of this in one response, never ask for confirmation:
- Name the piece and both squares: "Move your Pawn from e2 to e4" or "Move your Knight from g1 to f3"
- Add the notation in parentheses: (e4) or (Nf3)
- Explain why in one sentence: what it controls, attacks, or sets up

Example format: "Move your Pawn from e2 to e4 (e4) — this controls the center and opens lines for your queen and bishop."

NEVER show raw FEN strings or board notation to the user. Use them internally only.
NEVER ask "would you like to proceed?", "should I make that move?", or any confirmation question. State the move and explanation, then stop.
Keep responses short and direct.`,
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
