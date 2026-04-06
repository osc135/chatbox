import { tool } from 'ai'
import z from 'zod'
import VocabApp, { type VocabCard } from '@/components/apps/VocabApp'
import type { InlinePlugin, InlinePluginProps } from '@/packages/plugin-sdk/types'

function VocabWrapper({ state, onStateUpdate }: InlinePluginProps) {
  const words = (state['words'] as VocabCard[] | undefined) ?? []
  const topic = state['topic'] as string | undefined
  return <VocabApp initialCards={words} topic={topic} onStateUpdate={onStateUpdate} />
}

const VocabCardSchema = z.object({
  word: z.string().describe('The vocabulary word'),
  definition: z.string().describe('A clear, age-appropriate definition'),
  example: z.string().describe('A sentence using the word in context'),
  hint: z.string().optional().describe('Optional memory hint or etymology note'),
})

export const vocabPlugin: InlinePlugin = {
  id: 'vocab',
  name: 'Vocabulary Flashcards',
  description: 'Flashcard-based vocabulary study with built-in quiz, for any grade level',
  version: '1.0.0',
  author: 'TutorMeAI',
  type: 'inline',
  component: VocabWrapper,
  systemPromptHint:
    '- Vocabulary: call vocab__open when any student wants to study vocabulary words — you generate the word list based on their topic and grade level',

  tools: {
    vocab__open: tool({
      description:
        'Open the vocabulary flashcard app with a set of word cards. Generate the word list yourself based on the topic, subject area, and student grade level. Each card has a word, definition, and example sentence. The app renders inline — do not tell the user to visit a link.',
      inputSchema: z.object({
        words: z
          .array(VocabCardSchema)
          .min(1)
          .describe("The vocabulary cards to study. Generate 6–12 cards appropriate for the student's grade level."),
        topic: z
          .string()
          .optional()
          .describe('Topic label shown at the top of the app, e.g. "Chapter 5: The Water Cycle"'),
      }),
      execute: async (input: {
        words: Array<{ word: string; definition: string; example: string; hint?: string }>
        topic?: string
      }) => ({
        action: 'render_app',
        appId: 'vocab',
        appUrl: 'internal://vocab',
        words: input.words,
        topic: input.topic,
      }),
    }),

    vocab__add_words: tool({
      description:
        'Add more vocabulary cards to the flashcard deck that is already open. Use this when the student has mastered the current set and wants more, or when you want to extend the session.',
      inputSchema: z.object({
        words: z.array(VocabCardSchema).min(1).describe('New vocabulary cards to add to the existing deck'),
      }),
      execute: async (input: {
        words: Array<{ word: string; definition: string; example: string; hint?: string }>
      }) => ({
        action: 'tool_invoke',
        appId: 'vocab',
        tool: 'add_words',
        params: { words: input.words },
      }),
    }),
  },
}
