import { tool } from 'ai'
import z from 'zod'
import CalendarApp from '@/components/apps/CalendarApp'
import type { InlinePlugin, InlinePluginProps } from '@/packages/plugin-sdk/types'

function CalendarWrapper({ state, onStateUpdate }: InlinePluginProps) {
  const prefill = state['prefill'] as
    | { title?: string; date?: string; startTime?: string; endTime?: string; description?: string }
    | undefined
  return <CalendarApp prefill={prefill} onStateUpdate={onStateUpdate} />
}

export const calendarPlugin: InlinePlugin = {
  id: 'calendar',
  name: 'Google Calendar',
  description: 'View and create Google Calendar events directly in the chat',
  version: '1.0.0',
  author: 'TutorMeAI',
  type: 'inline',
  component: CalendarWrapper,
  requiresAuth: true,
  systemPromptHint:
    '- Google Calendar: call calendar__open when the user wants to see their schedule, upcoming events, or add a new event; if they describe a specific event to create, prefill the form with the details',

  tools: {
    calendar__open: tool({
      description:
        'Open the Google Calendar app. Use this when the user wants to see their upcoming events, add a new event, or manage their schedule. If the user mentioned a specific event to create, pass those details in the prefill field so the form is pre-filled.',
      inputSchema: z.object({
        prefill: z
          .object({
            title: z.string().optional().describe('Pre-filled event title'),
            date: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional()
              .describe('Pre-filled date in YYYY-MM-DD format'),
            startTime: z
              .string()
              .regex(/^\d{2}:\d{2}$/)
              .optional()
              .describe('Pre-filled start time in HH:MM (24-hour) format'),
            endTime: z
              .string()
              .regex(/^\d{2}:\d{2}$/)
              .optional()
              .describe('Pre-filled end time in HH:MM (24-hour) format'),
            description: z.string().optional().describe('Pre-filled event description or notes'),
          })
          .optional()
          .describe('Optional data to pre-fill the new event form. Omit if the user just wants to view events.'),
      }),
      execute: async (input: {
        prefill?: {
          title?: string
          date?: string
          startTime?: string
          endTime?: string
          description?: string
        }
      }) => ({
        action: 'render_app',
        appId: 'calendar',
        appUrl: 'internal://calendar',
        prefill: input.prefill,
      }),
    }),
  },
}
