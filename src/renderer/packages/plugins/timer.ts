import { tool } from 'ai'
import z from 'zod'
import type { IframePlugin } from '@/packages/plugin-sdk/types'

/**
 * Focus Timer — an IframePlugin example.
 *
 * This app is served as a static HTML file at /apps/timer/index.html and
 * communicates with the platform via the postMessage protocol defined in
 * plugin-sdk/types.ts. It demonstrates how a third-party app hosted at any
 * URL can integrate with ChatBridge without being compiled into the platform.
 */
export const timerPlugin: IframePlugin = {
  id: 'timer',
  name: 'Focus Timer',
  description: 'Pomodoro-style countdown timer for classroom focus sessions.',
  version: '1.0.0',
  author: 'TutorMeAI',
  type: 'iframe',
  url: '/apps/timer/index.html',
  // allow-scripts only: the timer does not need same-origin storage access
  sandbox: 'allow-scripts',

  systemPromptHint:
    '- Focus Timer (timer): use timer__start when the student wants to focus, study, or time an activity. Use timer__pause / timer__resume to control a running timer.',

  tools: {
    timer__start: tool({
      description:
        'Open the Focus Timer and start a countdown. Use this when the student wants to focus, do homework, study, or time an activity.',
      inputSchema: z.object({
        minutes: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe('Duration in minutes (1–60). Defaults to 25 if not specified.'),
      }),
      execute: async (input) => {
        const minutes = input.minutes ?? 25
        return {
          action: 'render_app',
          appId: 'timer',
          // minutes and autostart are encoded in the URL so the iframe can read
          // them from URLSearchParams on load — no postMessage round-trip needed.
          appUrl: `/apps/timer/index.html?minutes=${minutes}&autostart=1`,
        }
      },
    }),

    timer__pause: tool({
      description: 'Pause the currently running Focus Timer.',
      inputSchema: z.object({}),
      execute: async () => ({
        action: 'tool_invoke',
        appId: 'timer',
        tool: 'pause',
        params: {},
      }),
    }),

    timer__resume: tool({
      description: 'Resume a paused Focus Timer.',
      inputSchema: z.object({}),
      execute: async () => ({
        action: 'tool_invoke',
        appId: 'timer',
        tool: 'resume',
        params: {},
      }),
    }),

    timer__reset: tool({
      description: 'Reset the Focus Timer back to its starting duration.',
      inputSchema: z.object({}),
      execute: async () => ({
        action: 'tool_invoke',
        appId: 'timer',
        tool: 'reset',
        params: {},
      }),
    }),
  },
}
