import { tool } from 'ai'
import z from 'zod'
import CountingApp from '@/components/apps/CountingApp'
import type { InlinePlugin, InlinePluginProps } from '@/packages/plugin-sdk/types'

function CountingWrapper({ state, onStateUpdate }: InlinePluginProps) {
  const level = (state['level'] as 1 | 2 | 3 | undefined) ?? 1
  return <CountingApp initialLevel={level} onStateUpdate={onStateUpdate} />
}

export const countingPlugin: InlinePlugin = {
  id: 'counting',
  name: 'Counting Practice',
  description: 'K-2 math practice: counting objects, addition, and subtraction on a number line',
  version: '1.0.0',
  author: 'TutorMeAI',
  type: 'inline',
  component: CountingWrapper,
  gradeRange: ['K', '1', '2'],
  systemPromptHint:
    '- Counting: call counting__open when a young student wants to practice counting, adding, or subtracting',

  tools: {
    counting__open: tool({
      description:
        'Open the counting mini-app for K-2 students. Use this when a young student wants to practice counting, addition, or subtraction. The app renders inline — do not tell the user to visit a link. Specify a level: 1 = just counting objects, 2 = addition on a number line, 3 = subtraction on a number line.',
      inputSchema: z.object({
        level: z
          .union([z.literal(1), z.literal(2), z.literal(3)])
          .optional()
          .describe('Starting level. 1=count, 2=add, 3=subtract. Defaults to 1.'),
      }),
      execute: async (input: { level?: 1 | 2 | 3 }) => ({
        action: 'render_app',
        appId: 'counting',
        appUrl: `internal://counting?level=${input.level ?? 1}`,
        level: input.level ?? 1,
      }),
    }),

    counting__set_level: tool({
      description:
        'Change the level in the counting app that is already open. Level 1 = counting objects, Level 2 = addition, Level 3 = subtraction.',
      inputSchema: z.object({
        level: z
          .union([z.literal(1), z.literal(2), z.literal(3)])
          .describe('1=count, 2=add, 3=subtract'),
      }),
      execute: async (input: { level: 1 | 2 | 3 }) => ({
        action: 'tool_invoke',
        appId: 'counting',
        tool: 'set_level',
        params: { level: input.level },
      }),
    }),
  },
}
