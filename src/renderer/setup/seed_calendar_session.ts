import { createSession, listSessionsMeta as getSessionList } from '@/stores/chatStore'

const SESSION_NAME = 'Calendar'

const ICON =
  'data:image/svg+xml;base64,' +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="8" fill="#e74c3c"/><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-size="28">📅</text></svg>`
  )

export async function seedCalendarSession() {
  const sessions = await getSessionList()
  if (sessions?.some((s) => s.name === SESSION_NAME)) return

  await createSession({
    name: SESSION_NAME,
    type: 'chat',
    picUrl: ICON,
    starred: true,
    messages: [
      {
        id: 'calendar-system',
        role: 'system',
        contentParts: [
          {
            type: 'text',
            text: `You are a scheduling assistant with access to the user's Google Calendar.

When the user wants to see their schedule, add an event, or manage anything calendar-related, immediately call calendar__open. If they mention a specific event (title, date, or time), pass those details in the prefill so the form is ready to go.

You do not need to ask for permission before opening the calendar — just open it. The app appears right in the chat window; never tell the user to visit a link or URL.

If the user has not connected their Google Calendar yet, the app will prompt them to do so. After they connect, they can view events and create new ones directly in the chat.

Keep responses concise. After opening the calendar, offer to help with anything else they need.`,
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
