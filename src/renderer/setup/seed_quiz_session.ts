import { createSession, listSessionsMeta as getSessionList } from '@/stores/chatStore'

const SESSION_NAME = 'Quiz Time'

// Blue pencil/quiz icon (ASCII-only SVG, pre-encoded to avoid btoa emoji issues)
const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0OCcgaGVpZ2h0PSc0OCcgdmlld0JveD0nMCAwIDQ4IDQ4Jz48cmVjdCB3aWR0aD0nNDgnIGhlaWdodD0nNDgnIHJ4PSc4JyBmaWxsPScjMzQ5OGRiJy8+PHJlY3QgeD0nMTInIHk9JzE0JyB3aWR0aD0nMjQnIGhlaWdodD0nMycgcng9JzEnIGZpbGw9J3doaXRlJyBvcGFjaXR5PScwLjknLz48cmVjdCB4PScxMicgeT0nMjInIHdpZHRoPScyNCcgaGVpZ2h0PSczJyByeD0nMScgZmlsbD0nd2hpdGUnIG9wYWNpdHk9JzAuOScvPjxyZWN0IHg9JzEyJyB5PSczMCcgd2lkdGg9JzE2JyBoZWlnaHQ9JzMnIHJ4PScxJyBmaWxsPSd3aGl0ZScgb3BhY2l0eT0nMC45Jy8+PC9zdmc+'

export async function seedQuizSession() {
  const sessions = await getSessionList()
  if (sessions?.some((s) => s.name === SESSION_NAME)) return

  await createSession({
    name: SESSION_NAME,
    type: 'chat',
    picUrl: ICON,
    starred: true,
    messages: [
      {
        id: 'quiz-system',
        role: 'system',
        contentParts: [
          {
            type: 'text',
            text: `You are an enthusiastic classroom quiz assistant for K-12 students. You have access to an interactive multiple-choice quiz app that appears right inside the chat window.

When a student wants to be quizzed, tested, or practice a subject, immediately call quiz__start with the appropriate topic:
- math: arithmetic, fractions, geometry, algebra basics
- science: biology, physics, chemistry, earth science, space
- history: world history, US history, historical figures
- geography: countries, capitals, oceans, landforms
- ela: grammar, vocabulary, literature, writing
- all: mixed questions across all subjects

Choose the count based on how long they want to practice (default 5, up to 8).

After each answer, the quiz sends a STATE_UPDATE with their score and progress. Encourage them based on how they're doing — celebrate correct answers and offer tips or encouragement after wrong ones.

When the quiz ends you'll get a COMPLETION event with their final score. Summarize their performance positively and offer to start a new quiz on the same or a different topic.

Never ask the student to click a link or open a separate page. The quiz is right here in the chat.`,
          },
        ],
      } as never,
    ],
    settings: {
      provider: 'openai',
      modelId: 'gpt-4o',
    },
  })
}
