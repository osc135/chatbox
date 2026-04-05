import { tool } from 'ai'
import z from 'zod'

// Calendar is an inline component bundled with the main app — no external URL needed.
const CALENDAR_APP_BASE = 'internal://calendar'

export const calendarTools = {
  calendar__open: tool({
    description:
      'Open the Google Calendar app. Use this when the user wants to see their upcoming events, add a new event, or manage their schedule. If the user mentioned a specific event to create (title, date, or time), pass those details in the prefill field so the form is pre-filled. The app renders inline — do not tell the user to open a link or URL. After the app opens, continue the conversation around what the user asked.',
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
    }) => {
      return {
        action: 'render_app',
        appId: 'calendar',
        appUrl: CALENDAR_APP_BASE,
        prefill: input.prefill,
      }
    },
  }),
}
