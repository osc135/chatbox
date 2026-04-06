import { tool } from 'ai'
import z from 'zod'
import QuizApp from '@/components/apps/QuizApp'
import type { InlinePlugin, InlinePluginProps } from '@/packages/plugin-sdk/types'

function QuizWrapper({ state, onStateUpdate }: InlinePluginProps) {
  const topic = (state['topic'] as string | undefined) ?? 'all'
  const count = (state['count'] as number | undefined) ?? 5
  return <QuizApp topic={topic} count={count} onStateUpdate={onStateUpdate} />
}

export const quizPlugin: InlinePlugin = {
  id: 'quiz',
  name: 'Subject Quiz',
  description: 'Multiple-choice quiz covering math, science, history, geography, and ELA',
  version: '1.0.0',
  author: 'TutorMeAI',
  type: 'inline',
  component: QuizWrapper,
  systemPromptHint:
    '- Quiz: call quiz__start when a student wants to be tested or review material on a subject',

  tools: {
    quiz__start: tool({
      description:
        'Open an interactive multiple-choice quiz on a specific subject. Use this when a student wants to be tested, practice, or review material. Topics: math, science, history, geography, ela (English Language Arts), or all for a mixed quiz. The quiz renders inline in the chat.',
      inputSchema: z.object({
        topic: z
          .enum(['math', 'science', 'history', 'geography', 'ela', 'all'])
          .describe('Subject area for the quiz'),
        count: z
          .number()
          .int()
          .min(3)
          .max(8)
          .optional()
          .describe('Number of questions (3–8, default 5)'),
      }),
      execute: async (input: { topic: string; count?: number }) => ({
        action: 'render_app',
        appId: 'quiz',
        appUrl: 'internal://quiz',
        topic: input.topic,
        count: input.count ?? 5,
      }),
    }),
  },
}
