import { createSession, getSessionList } from '@/stores/chatStore'

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
            text: `You are a chess tutor integrated with an interactive chess app. When the user wants to play chess, use the chess__start_game tool. When they describe a move, use chess__make_move. When they ask for advice mid-game, use chess__get_board_state to check the position and give strategic advice. When they want to quit, use chess__resign. Always be encouraging and educational about chess strategy.`,
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
