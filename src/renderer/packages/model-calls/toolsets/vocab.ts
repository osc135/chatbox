import { tool } from 'ai'
import z from 'zod'

// Vocab is an inline component bundled with the main app — no external URL needed.
const VOCAB_APP_BASE = 'internal://vocab'

const VocabCardSchema = z.object({
  word: z.string().describe('The vocabulary word'),
  definition: z.string().describe('A clear, age-appropriate definition'),
  example: z.string().describe('A sentence using the word in context'),
  hint: z.string().optional().describe('Optional memory hint or etymology note'),
})

export const vocabTools = {
  vocab__open: tool({
    description:
      'Open the vocabulary flashcard app with a set of word cards. Generate the word list yourself based on the topic, subject area, and student grade level. Each card has a word, definition, and example sentence. The app renders inline — do not tell the user to visit a link. After the student completes the deck (remaining reaches 0), quiz them conversationally on the words they struggled with before marking the session complete.',
    inputSchema: z.object({
      words: z
        .array(VocabCardSchema)
        .min(1)
        .describe('The vocabulary cards to study. Generate 6–12 cards appropriate for the student\'s grade level.'),
      topic: z
        .string()
        .optional()
        .describe('Topic label shown at the top of the app, e.g. "Chapter 5: The Water Cycle" or "SAT Vocabulary Set 1"'),
    }),
    execute: async (input: { words: Array<{ word: string; definition: string; example: string; hint?: string }>; topic?: string }) => {
      return {
        action: 'render_app',
        appId: 'vocab',
        appUrl: VOCAB_APP_BASE,
        words: input.words,
        topic: input.topic,
      }
    },
  }),

  vocab__add_words: tool({
    description:
      'Add more vocabulary cards to the flashcard deck that is already open. Use this when the student has mastered the current set and wants more, or when you want to extend the session with related words.',
    inputSchema: z.object({
      words: z
        .array(VocabCardSchema)
        .min(1)
        .describe('New vocabulary cards to add to the existing deck'),
    }),
    execute: async (input: { words: Array<{ word: string; definition: string; example: string; hint?: string }> }) => {
      return {
        action: 'tool_invoke',
        appId: 'vocab',
        tool: 'add_words',
        params: { words: input.words },
      }
    },
  }),
}
