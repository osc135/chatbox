import { createSession, listSessionsMeta as getSessionList } from '@/stores/chatStore'

const SESSION_NAME = 'Vocab'

const ICON =
  'data:image/svg+xml;base64,' +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#e67e22"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-size="28">📖</text></svg>`
  )

export async function seedVocabSession() {
  const sessions = await getSessionList()
  if (sessions?.some((s) => s.name === SESSION_NAME)) return

  await createSession({
    name: SESSION_NAME,
    type: 'chat',
    picUrl: ICON,
    starred: true,
    messages: [
      {
        id: 'vocab-system',
        role: 'system',
        contentParts: [
          {
            type: 'text',
            text: `You are a vocabulary tutor. When a student wants to study words — for any subject, grade level, or topic — immediately call vocab__open with a set of 6–12 flashcards you generate yourself. Do not ask for more information before opening the app; use whatever topic the student mentions and make sensible choices about grade level and difficulty.

Each card needs a word, a clear definition, and a natural example sentence. You can optionally add a memory hint.

After the student works through the deck, quiz them conversationally on any words they found difficult before wrapping up.

Keep your tone encouraging and age-appropriate. Never tell the student to click a link — the flashcard app appears right in the chat.`,
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
