import { tool } from 'ai'
import z from 'zod'
import { getPluginState } from '@/packages/plugin-state-store'
import type { InlinePlugin } from '@/packages/plugin-sdk/types'
import ChessApp from '@/components/apps/ChessApp'

export const chessPlugin: InlinePlugin = {
  id: 'chess',
  name: 'Chess',
  description: 'Interactive chess game with legal move validation and AI opponent',
  version: '1.0.0',
  author: 'TutorMeAI',
  type: 'inline',
  component: ChessApp as InlinePlugin['component'],
  gradeRange: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  systemPromptHint:
    '- Chess: call chess__start_game when the user wants to play chess',

  tools: {
    chess__start_game: tool({
      description:
        'Start a new chess game. Use this when the user wants to play chess. A chess board will appear in the chat.',
      inputSchema: z.object({}),
      execute: async () => ({
        action: 'render_app',
        appId: 'chess',
        message:
          'Starting a new chess game! The board is ready — you play as White. Drag pieces to make your move, or tell me a move like "e2 to e4".',
      }),
    }),

    chess__make_move: tool({
      description:
        'Make a move in the current chess game. Takes algebraic notation like "e2e4", "Nf3", or "e2 to e4". Use this when the user describes a chess move in conversation.',
      inputSchema: z.object({
        move: z.string().describe('The move in algebraic notation, e.g. "e2e4", "Nf3", "O-O"'),
      }),
      execute: async (input: { move: string }) => ({
        action: 'tool_invoke',
        appId: 'chess',
        tool: 'make_move',
        params: { move: input.move },
      }),
    }),

    chess__get_board_state: tool({
      description:
        'Get the current state of the chess board. Use this when the user asks about the current position, wants advice, or asks "what should I do?".',
      inputSchema: z.object({}),
      execute: async () => {
        const state = getPluginState('chess')
        if (!state) return { error: 'No active chess game. Start a game first.' }
        return state
      },
    }),

    chess__resign: tool({
      description: 'Resign the current chess game. Use when the user wants to give up or quit the game.',
      inputSchema: z.object({}),
      execute: async () => ({
        action: 'tool_invoke',
        appId: 'chess',
        tool: 'resign',
        params: {},
      }),
    }),
  },
}
