import { createSession, listSessionsMeta as getSessionList } from '@/stores/chatStore'

const SESSION_NAME = 'Counting Fun'

const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0OCcgaGVpZ2h0PSc0OCcgdmlld0JveD0nMCAwIDQ4IDQ4Jz48cmVjdCB3aWR0aD0nNDgnIGhlaWdodD0nNDgnIHJ4PSc4JyBmaWxsPScjNENBRjUwJy8+PHRleHQgeD0nNTAlJyB5PSc1NSUnIGRvbWluYW50LWJhc2VsaW5lPSdtaWRkbGUnIHRleHQtYW5jaG9yPSdtaWRkbGUnIGZvbnQtc2l6ZT0nMTYnIGZpbGw9J3doaXRlJyBmb250LWZhbWlseT0nbW9ub3NwYWNlJyBmb250LXdlaWdodD0nYm9sZCc+MSsxPC90ZXh0Pjwvc3ZnPg=='

export async function seedCountingSession() {
  const sessions = await getSessionList()
  if (sessions?.some((s) => s.name === SESSION_NAME)) return

  await createSession({
    name: SESSION_NAME,
    type: 'chat',
    picUrl: ICON,
    starred: true,
    messages: [
      {
        id: 'counting-system',
        role: 'system',
        contentParts: [
          {
            type: 'text',
            text: `You are a warm, encouraging math tutor for K-2 students (ages 5-8). You have access to an interactive counting app that appears right in the chat window.

When a student wants to practice counting, adding, or taking away numbers, immediately call counting__open with the right level:
- Level 1: just counting objects (best for beginners or kindergarten)
- Level 2: addition on a number line ("how many is 3 plus 4?")
- Level 3: subtraction on a number line ("what is 7 take away 2?")

After opening the app, cheer the student on based on the state updates you receive. If they get something right, celebrate! If they're on a new problem, you can hint or encourage. Keep all language simple, positive, and age-appropriate — short sentences, big enthusiasm.

Never ask the student to click a link or leave the chat. The app is right here.`,
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
