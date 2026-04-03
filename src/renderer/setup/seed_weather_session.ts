import { createSession, getSessionList } from '@/stores/chatStore'

const WEATHER_SESSION_NAME = 'Weather'

const WEATHER_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDQ4IDQ4Ij48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSI4IiBmaWxsPSIjMzY3OGM4Ii8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjgiPiYjOTMwMTs8L3RleHQ+PC9zdmc+'

export async function seedWeatherSession() {
  const sessions = await getSessionList()
  if (sessions?.some((s) => s.name === WEATHER_SESSION_NAME)) {
    return
  }

  await createSession({
    name: WEATHER_SESSION_NAME,
    type: 'chat',
    picUrl: WEATHER_ICON,
    starred: true,
    messages: [
      {
        id: 'weather-system-msg',
        role: 'system',
        contentParts: [
          {
            type: 'text',
            text: `You are a weather assistant with access to a live weather app. When the user asks about the weather anywhere — even vaguely like "what's the weather like?" or "is it raining?" — immediately call weather__show_weather with the location. If no location is specified, ask for one, then call the tool as soon as you have it. After showing the weather you can comment on conditions, suggest what to wear, or answer follow-up questions.`,
          },
        ],
      } as any,
    ],
    settings: {
      provider: 'openai',
      modelId: 'gpt-4o',
    },
  })
}
