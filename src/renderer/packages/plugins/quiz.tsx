import { tool } from 'ai'
import z from 'zod'
import QuizApp from '@/components/apps/QuizApp'
import { getPluginState } from '@/packages/plugin-state-store'
import type { InlinePlugin, InlinePluginProps } from '@/packages/plugin-sdk/types'

const QuestionSchema = z.object({
  q: z.string().describe('The question text'),
  options: z
    .array(z.string())
    .length(4)
    .describe('Exactly four answer choices'),
  answer: z
    .number()
    .int()
    .min(0)
    .max(3)
    .describe('Index of the correct answer (0–3)'),
  explanation: z
    .string()
    .optional()
    .describe('Brief explanation of why the answer is correct'),
})

function QuizWrapper({ state, onStateUpdate }: InlinePluginProps) {
  const questions = state['questions'] as Array<{
    q: string
    options: string[]
    answer: number
    explanation?: string
  }> | undefined
  const topic = state['topic'] as string | undefined
  return <QuizApp questions={questions ?? []} topic={topic} onStateUpdate={onStateUpdate} />
}

export const quizPlugin: InlinePlugin = {
  id: 'quiz',
  name: 'Subject Quiz',
  description: 'Interactive multiple-choice quiz — you generate the questions based on topic and grade',
  version: '2.0.0',
  author: 'TutorMeAI',
  type: 'inline',
  component: QuizWrapper,
  systemPromptHint:
    '- Quiz: call quiz__start when a student wants to be tested or review material; generate questions yourself tailored to their grade and the current topic. Call quiz__get_results to retrieve their answers and score after they finish.',

  tools: {
    quiz__start: tool({
      description:
        'Open an interactive multiple-choice quiz with questions you generate. Create 3–8 questions appropriate for the student\'s grade level and the topic you\'ve been discussing. Each question has four options and one correct answer. The quiz renders inline — do not tell the user to visit a link.',
      inputSchema: z.object({
        questions: z
          .array(QuestionSchema)
          .min(3)
          .max(8)
          .describe('The quiz questions. Generate them yourself based on grade level and topic.'),
        topic: z
          .string()
          .optional()
          .describe('Label shown at the top of the quiz, e.g. "Chapter 4: Photosynthesis"'),
      }),
      execute: async (input: {
        questions: Array<{ q: string; options: string[]; answer: number; explanation?: string }>
        topic?: string
      }) => ({
        action: 'render_app',
        appId: 'quiz',
        questions: input.questions,
        topic: input.topic,
      }),
    }),

    quiz__get_results: tool({
      description:
        'Retrieve the student\'s quiz results — their score, which questions they missed, and the correct answers. Call this after the student finishes the quiz to give them feedback or discuss what they got wrong.',
      inputSchema: z.object({}),
      execute: async () => getPluginState('quiz') ?? { status: 'no quiz results yet' },
    }),
  },
}
