/**
 * ChatBridge Plugin SDK — Type Definitions
 *
 * This file is the authoritative contract between the ChatBridge platform and
 * any third-party app that wants to integrate. It defines:
 *
 *  1. PluginManifest — what every app must declare when registering
 *  2. postMessage protocol — the message shapes used to communicate between
 *     the platform and iframe-based apps
 *
 * Third-party developers: build your app against these types, serve a manifest
 * that satisfies PluginManifest, and follow the postMessage protocol below.
 * See PLUGIN_SDK.md for the full integration guide.
 */

import type { ToolSet } from 'ai'
import type { ComponentType } from 'react'

// ─── postMessage Protocol ─────────────────────────────────────────────────────
//
// iframe apps communicate with the ChatBridge host via window.postMessage.
// All messages are plain JSON objects with a `type` discriminant.
//
// SECURITY: The host validates event.source against the known iframe element
// before processing any message. Apps should send messages only to their
// parent window (window.parent.postMessage), never to '*' target origins
// that could leak data to other frames.

/** Sent by the host to invoke a tool inside the iframe. */
export interface ToolInvokeMessage {
  type: 'TOOL_INVOKE'
  /** Tool name without the plugin prefix (e.g. "make_move", not "chess__make_move") */
  tool: string
  params: Record<string, unknown>
  /** Correlates this invocation with the response/state update */
  invocationId: string
}

/** Sent by the host to deliver an LLM-generated opponent move (chess-specific). */
export interface OpponentMoveResultMessage {
  type: 'OPPONENT_MOVE_RESULT'
  pluginId: string
  requestId: string
  uci?: string
  error?: string
}

/** Sent by the app whenever its internal state changes in a way the LLM should know about. */
export interface StateUpdateMessage {
  type: 'STATE_UPDATE'
  pluginId: string
  invocationId: string
  payload: Record<string, unknown>
}

/** Sent by the app when the user has finished their task and the chatbot should resume. */
export interface CompletionMessage {
  type: 'COMPLETION'
  pluginId: string
  payload: Record<string, unknown>
}

/** Sent by the app when an unrecoverable error occurs. */
export interface ErrorMessage {
  type: 'ERROR'
  pluginId: string
  invocationId: string
  payload: { code: string; message: string }
}

/**
 * Chess-specific: asks the host to generate an LLM opponent move.
 * The host replies with OpponentMoveResultMessage.
 */
export interface RequestOpponentMoveMessage {
  type: 'REQUEST_OPPONENT_MOVE'
  pluginId: string
  requestId: string
  fen: string
  difficulty: 'easy' | 'medium' | 'hard'
}

/** All messages the host sends to an iframe app. */
export type HostToPluginMessage = ToolInvokeMessage | OpponentMoveResultMessage

/** All messages an iframe app sends to the host. */
export type PluginToHostMessage =
  | StateUpdateMessage
  | CompletionMessage
  | ErrorMessage
  | RequestOpponentMoveMessage

// ─── Plugin Manifest Types ────────────────────────────────────────────────────

/** Props passed to every inline (bundled React) plugin component. */
export interface InlinePluginProps {
  /**
   * The full tool-call result stored on the message part.
   * Contains whatever the tool's execute() function returned,
   * e.g. { words: [...], topic: "..." } for the vocab plugin.
   */
  state: Record<string, unknown>
  /** Called whenever the app's state changes so the LLM stays in sync. */
  onStateUpdate?: (state: Record<string, unknown>) => void
  /** The current chat session ID, passed through for LLM-dependent features (e.g. chess opponent). */
  sessionId?: string
}

interface BasePluginManifest {
  /**
   * Unique plugin identifier. Lowercase letters, numbers, and hyphens only.
   * All tool names must be prefixed with this id, e.g. chess__start_game.
   */
  id: string
  /** Human-readable display name shown in the teacher dashboard. */
  name: string
  /** One-sentence description of what the app does. */
  description: string
  version: string
  /** Developer or organization that built this plugin. */
  author: string
  /**
   * Fragment injected into the LLM system prompt to guide when/how to invoke
   * this plugin's tools. Keep it concise — it affects every token in the session.
   * Use noun phrases, not imperative sentences, to reduce prompt injection risk.
   */
  systemPromptHint: string
  /**
   * AI SDK tool definitions. Keys must follow the {pluginId}__{toolName} pattern.
   * Tool descriptions are sanitized for prompt injection at registration time.
   */
  tools: ToolSet
  /** Grades this app is appropriate for. Omit to allow all grades. */
  gradeRange?: string[]
  /** True if this app requires the user to complete an OAuth flow before use. */
  requiresAuth?: boolean
}

/**
 * An app hosted at an external URL and rendered inside a sandboxed iframe.
 * This is the correct type for any app with its own build + deployment.
 */
export interface IframePlugin extends BasePluginManifest {
  type: 'iframe'
  /**
   * The URL where the app is served. Used as the iframe src and to derive
   * the expected postMessage origin for security validation.
   */
  url: string
  /**
   * iframe sandbox attribute string.
   * Defaults to 'allow-scripts' — the minimum required for a functional app.
   * Do NOT add 'allow-same-origin' unless the app genuinely needs it, as this
   * allows the iframe to access the parent's localStorage and cookies when
   * served from the same origin.
   */
  sandbox?: string
}

/**
 * An app bundled with the main platform and rendered as a React component.
 * Use this for apps that are tightly coupled to the platform or need
 * unrestricted access to platform internals.
 */
export interface InlinePlugin extends BasePluginManifest {
  type: 'inline'
  /**
   * A React component that renders the app. Receives the tool-call result as
   * `state` and an `onStateUpdate` callback for reporting state changes.
   * Wrap your existing component here rather than changing its interface.
   */
  component: ComponentType<InlinePluginProps>
}

/** Union of all plugin types. */
export type PluginManifest = IframePlugin | InlinePlugin
