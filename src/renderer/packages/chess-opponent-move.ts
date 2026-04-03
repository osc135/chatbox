import * as Sentry from '@sentry/react'
import { getModel } from '@shared/models'
import { ApiError, NetworkError } from '@shared/models/errors'
import type { Message, ModelProvider, SessionSettings, Settings } from '@shared/types'
import { createModelDependencies } from '@/adapters'
import { generateText } from '@/packages/model-calls'
import platform from '@/platform'
import { getSessionSettings } from '@/stores/chatStore'
import * as settingActions from '@/stores/settingActions'
import { settingsStore } from '@/stores/settingsStore'

function chessOpponentModelSettings(globalSettings: Settings, sessionSettings: SessionSettings): SessionSettings & Settings {
  const remoteConfig = settingActions.getRemoteConfig()
  const fastModel = (remoteConfig as { fastModel?: { provider: string; model: string } })?.fastModel
  if (fastModel?.provider && fastModel?.model) {
    return {
      ...globalSettings,
      ...sessionSettings,
      provider: fastModel.provider as ModelProvider,
      modelId: fastModel.model,
    }
  }
  if (globalSettings.threadNamingModel?.provider && globalSettings.threadNamingModel?.model) {
    return {
      ...globalSettings,
      ...sessionSettings,
      provider: globalSettings.threadNamingModel.provider as ModelProvider,
      modelId: globalSettings.threadNamingModel.model,
    }
  }
  return { ...globalSettings, ...sessionSettings }
}

function difficultyHint(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy':
      return 'Play like a beginner (~1000 Elo): develop pieces simply, occasional small mistakes, avoid deep tactics.'
    case 'medium':
      return 'Play like an intermediate club player (~1500 Elo): solid development, reasonable tactics.'
    case 'hard':
      return 'Play like a strong player (~2000+ Elo): accurate tactics and principled play.'
    default:
      return 'Play reasonably well.'
  }
}

/** First UCI-like token in model output (handles optional hyphen in e2-e4). */
export function extractUciFromModelText(raw: string): string | null {
  const cleaned = raw.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim()
  const normalized = cleaned.replace(/([a-h][1-8])-([a-h][1-8])/gi, '$1$2')
  const m = normalized.match(/\b([a-h][1-8][a-h][1-8][qrnb]?)\b/i)
  return m ? m[1].toLowerCase() : null
}

export type ChessOpponentMoveResult = { uci: string } | { error: string }

/**
 * One non-streaming model call: side to move in FEN should play a single UCI move.
 * Uses fast/thread-naming model when configured (same idea as conversation summaries) to reduce cost vs the main chat model.
 */
export async function fetchChessOpponentMove(
  sessionId: string,
  fen: string,
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<ChessOpponentMoveResult> {
  const globalSettings = settingsStore.getState().getSettings()
  const sessionSettings = await getSessionSettings(sessionId)
  const settings = chessOpponentModelSettings(globalSettings, sessionSettings)

  try {
    const dependencies = await createModelDependencies()
    const configs = await platform.getConfig()
    const model = getModel(settings, globalSettings, configs, dependencies)

    const systemText = `You are the chess opponent for the side to move in the FEN below (the human plays White in this app; you usually play Black).
Reply with exactly one legal move in UCI format only: four characters (e.g. e7e5), or five when promoting (e7e8q).
No punctuation, no explanation, no algebraic notation — UCI only.`

    const userText = `FEN: ${fen}
Difficulty: ${difficulty}
${difficultyHint(difficulty)}

It is your turn. Output one UCI move.`

    const messages: Message[] = [
      {
        id: 'chess-opp-sys',
        role: 'system',
        contentParts: [{ type: 'text', text: systemText }],
        tokenCalculatedAt: {},
      },
      {
        id: 'chess-opp-user',
        role: 'user',
        contentParts: [{ type: 'text', text: userText }],
        tokenCalculatedAt: {},
      },
    ]

    const result = await generateText(model, messages)
    const text =
      result.contentParts
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('') ?? ''

    const uci = extractUciFromModelText(text.trim())
    if (!uci) {
      return { error: 'Model did not return a UCI move.' }
    }
    return { uci }
  } catch (e: unknown) {
    if (!(e instanceof ApiError || e instanceof NetworkError)) {
      Sentry.captureException(e)
    }
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
