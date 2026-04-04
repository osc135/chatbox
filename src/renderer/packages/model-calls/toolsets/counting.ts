import { tool } from 'ai'
import z from 'zod'

// Counting is an inline component bundled with the main app — no external URL needed.
const COUNTING_APP_BASE = 'internal://counting'

export const countingTools = {
  counting__open: tool({
    description:
      'Open the counting mini-app for K-2 students. Use this when a young student wants to practice counting, addition, or subtraction. The app renders inline — do not tell the user to visit a link. Specify a level: 1 = just counting objects, 2 = addition on a number line, 3 = subtraction on a number line.',
    inputSchema: z.object({
      level: z
        .union([z.literal(1), z.literal(2), z.literal(3)])
        .optional()
        .describe('Starting level. 1=count, 2=add, 3=subtract. Defaults to 1.'),
    }),
    execute: async (input: { level?: 1 | 2 | 3 }) => {
      const level = input.level ?? 1
      return {
        action: 'render_app',
        appId: 'counting',
        appUrl: `${COUNTING_APP_BASE}?level=${level}`,
        level,
      }
    },
  }),

  counting__set_level: tool({
    description:
      'Change the level in the counting app that is already open. Level 1 = counting objects, Level 2 = addition, Level 3 = subtraction.',
    inputSchema: z.object({
      level: z
        .union([z.literal(1), z.literal(2), z.literal(3)])
        .describe('1=count, 2=add, 3=subtract'),
    }),
    execute: async (input: { level: 1 | 2 | 3 }) => {
      return {
        action: 'tool_invoke',
        appId: 'counting',
        tool: 'set_level',
        params: { level: input.level },
      }
    },
  }),
}
