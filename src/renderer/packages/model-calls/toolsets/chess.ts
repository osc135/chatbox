import { tool } from 'ai'
import z from 'zod'

// Chess app URL — in dev it runs on 3001, in prod it'll be a deployed URL
const CHESS_APP_URL = 'http://localhost:3001'

export const chessTools = {
  chess__start_game: tool({
    description:
      'Start a new chess game. Use this when the user wants to play chess. A chess board will appear in the chat.',
    inputSchema: z.object({}),
    execute: async () => {
      return {
        action: 'render_app',
        appId: 'chess',
        appUrl: CHESS_APP_URL,
        tool: 'start_game',
        params: {},
        message: 'Starting a new chess game! The board is ready — you play as White. Drag pieces to make your move, or tell me a move like "e2 to e4".',
      }
    },
  }),

  chess__make_move: tool({
    description:
      'Make a move in the current chess game. Takes algebraic notation like "e2e4", "Nf3", or "e2 to e4". Use this when the user describes a chess move in conversation.',
    inputSchema: z.object({
      move: z.string().describe('The move in algebraic notation, e.g. "e2e4", "Nf3", "O-O"'),
    }),
    execute: async (input: { move: string }) => {
      return {
        action: 'tool_invoke',
        appId: 'chess',
        tool: 'make_move',
        params: { move: input.move },
      }
    },
  }),

  chess__get_board_state: tool({
    description:
      'Get the current state of the chess board. Use this when the user asks about the current position, wants advice, or asks "what should I do?".',
    inputSchema: z.object({}),
    execute: async () => {
      return {
        action: 'tool_invoke',
        appId: 'chess',
        tool: 'get_board_state',
        params: {},
      }
    },
  }),

  chess__resign: tool({
    description: 'Resign the current chess game. Use when the user wants to give up or quit the game.',
    inputSchema: z.object({}),
    execute: async () => {
      return {
        action: 'tool_invoke',
        appId: 'chess',
        tool: 'resign',
        params: {},
      }
    },
  }),
}
