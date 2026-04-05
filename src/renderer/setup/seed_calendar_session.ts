import { createSession, listSessionsMeta as getSessionList } from '@/stores/chatStore'

const SESSION_NAME = 'Calendar'

const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0OCcgaGVpZ2h0PSc0OCcgdmlld0JveD0nMCAwIDQ4IDQ4Jz48cmVjdCB3aWR0aD0nNDgnIGhlaWdodD0nNDgnIHJ4PSc4JyBmaWxsPScjZTc0YzNjJy8+PHJlY3QgeD0nOCcgeT0nMTQnIHdpZHRoPSczMicgaGVpZ2h0PScyNicgcng9JzMnIGZpbGw9J3doaXRlJyBvcGFjaXR5PScwLjknLz48cmVjdCB4PSc4JyB5PScxNCcgd2lkdGg9JzMyJyBoZWlnaHQ9JzknIHJ4PSczJyBmaWxsPScjYzAzOTJiJy8+PHJlY3QgeD0nMTYnIHk9JzgnIHdpZHRoPSc0JyBoZWlnaHQ9JzEwJyByeD0nMicgZmlsbD0nI2MwMzkyYicvPjxyZWN0IHg9JzI4JyB5PSc4JyB3aWR0aD0nNCcgaGVpZ2h0PScxMCcgcng9JzInIGZpbGw9JyNjMDM5MmInLz48L3N2Zz4='

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
