import { tool } from 'ai'
import z from 'zod'

// Quiz is an inline component bundled with the main app — no external URL needed.
const QUIZ_APP_BASE = 'internal://quiz'

export const quizTools = {
  quiz__start: tool({
    description:
      'Open an interactive multiple-choice quiz on a specific subject. Use this when a student wants to be tested, practice, or review material. Topics: math, science, history, geography, ela (English Language Arts), or all for a mixed quiz. The quiz renders inline in the chat — do not tell the student to visit a link.',
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
    execute: async (input: { topic: string; count?: number }) => {
      return {
        action: 'render_app',
        appId: 'quiz',
        appUrl: QUIZ_APP_BASE,
        topic: input.topic,
        count: input.count ?? 5,
      }
    },
  }),
}
