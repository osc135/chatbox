import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Button } from '@mantine/core'
import type { Message, MessageAppPart, ModelProvider } from '@shared/types'
import { IconX } from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import AppEmbed from '@/components/chat/AppEmbed'
import MessageList, { type MessageListRef } from '@/components/chat/MessageList'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import InputBox from '@/components/InputBox/InputBox'
import Header from '@/components/layout/Header'
import ThreadHistoryDrawer from '@/components/session/ThreadHistoryDrawer'
import * as remote from '@/packages/remote'
import { updateSession as updateSessionStore, useSession } from '@/stores/chatStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import * as scrollActions from '@/stores/scrollActions'
import { modifyMessage, removeCurrentThread, startNewThread, submitNewUserMessage } from '@/stores/sessionActions'
import { getAllMessageList } from '@/stores/sessionHelpers'

export const Route = createFileRoute('/session/$sessionId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const { sessionId: currentSessionId } = Route.useParams()
  const navigate = useNavigate()
  const { session: currentSession, isFetching } = useSession(currentSessionId)
  const setLastUsedChatModel = useStore(lastUsedModelStore, (state) => state.setChatModel)
  const setLastUsedPictureModel = useStore(lastUsedModelStore, (state) => state.setPictureModel)

  const currentMessageList = useMemo(() => (currentSession ? getAllMessageList(currentSession) : []), [currentSession])
  const lastGeneratingMessage = useMemo(
    () => currentMessageList.find((m: Message) => m.generating),
    [currentMessageList]
  )

  const messageListRef = useRef<MessageListRef>(null)

  // Side panel app state
  const [activeApp, setActiveApp] = useState<MessageAppPart | null>(null)
  const lastAppPartRef = useRef<MessageAppPart | null>(null)

  // Open/replace panel when a new render_app part appears in the message list
  useEffect(() => {
    for (let i = currentMessageList.length - 1; i >= 0; i--) {
      const parts = currentMessageList[i]?.contentParts ?? []
      const appPart = parts.find((p): p is MessageAppPart => p.type === 'app')
      if (appPart) {
        if (appPart !== lastAppPartRef.current) {
          lastAppPartRef.current = appPart
          setActiveApp(appPart)
        }
        break
      }
    }
  }, [currentMessageList])

  const goHome = useCallback(() => {
    navigate({ to: '/', replace: true })
  }, [navigate])

  useEffect(() => {
    setTimeout(() => {
      scrollActions.scrollToBottom('auto') // 每次启动时自动滚动到底部
    }, 200)
  }, [])

  // currentSession变化时（包括session settings变化），存下当前的settings作为新Session的默认值
  useEffect(() => {
    if (currentSession) {
      if (currentSession.type === 'chat' && currentSession.settings) {
        const { provider, modelId } = currentSession.settings
        if (provider && modelId) {
          setLastUsedChatModel(provider, modelId)
        }
      }
      if (currentSession.type === 'picture' && currentSession.settings) {
        const { provider, modelId } = currentSession.settings
        if (provider && modelId) {
          setLastUsedPictureModel(provider, modelId)
        }
      }
    }
  }, [currentSession?.settings, currentSession?.type, currentSession, setLastUsedChatModel, setLastUsedPictureModel])

  const onSelectModel = useCallback(
    (provider: ModelProvider, modelId: string) => {
      if (!currentSession) {
        return
      }
      void updateSessionStore(currentSession.id, {
        settings: {
          ...(currentSession.settings || {}),
          provider,
          modelId,
        },
      })
    },
    [currentSession]
  )

  const onStartNewThread = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void startNewThread(currentSession.id)
    if (currentSession.copilotId) {
      void remote
        .recordCopilotUsage({ id: currentSession.copilotId, action: 'create_thread' })
        .catch((error) => console.warn('[recordCopilotUsage] failed', error))
    }
    return true
  }, [currentSession])

  const onRollbackThread = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void removeCurrentThread(currentSession.id)
    return true
  }, [currentSession])

  const onSubmit = useCallback(
    async ({
      constructedMessage,
      needGenerating = true,
      onUserMessageReady,
    }: {
      constructedMessage: Message
      needGenerating?: boolean
      onUserMessageReady?: () => void
    }) => {
      messageListRef.current?.setIsNewMessage(true)

      if (!currentSession) {
        return
      }
      messageListRef.current?.scrollToBottom('instant')

      if (currentSession.copilotId) {
        void remote
          .recordCopilotUsage({ id: currentSession.copilotId, action: 'create_message' })
          .catch((error) => console.warn('[recordCopilotUsage] failed', error))
      }

      await submitNewUserMessage(currentSession.id, {
        newUserMsg: constructedMessage,
        needGenerating,
        onUserMessageReady,
      })
    },
    [currentSession]
  )

  const onClickSessionSettings = useCallback(() => {
    if (!currentSession) {
      return false
    }
    NiceModal.show('session-settings', {
      session: currentSession,
    })
    return true
  }, [currentSession])

  const onStopGenerating = useCallback(() => {
    if (!currentSession) {
      return false
    }
    if (lastGeneratingMessage?.generating) {
      lastGeneratingMessage?.cancel?.()
      void modifyMessage(currentSession.id, { ...lastGeneratingMessage, generating: false }, true)
    }
    return true
  }, [currentSession, lastGeneratingMessage])

  const model = useMemo(() => {
    if (!currentSession?.settings?.modelId || !currentSession?.settings?.provider) {
      return undefined
    }
    return {
      provider: currentSession.settings.provider,
      modelId: currentSession.settings.modelId,
    }
  }, [currentSession?.settings?.provider, currentSession?.settings?.modelId])

  return currentSession ? (
    <div className="flex flex-row h-full overflow-hidden">
      {/* Chat column */}
      <div className="flex flex-col h-full min-w-0" style={{ flex: activeApp ? '0 0 50%' : '1 1 100%', transition: 'flex-basis 0.2s ease' }}>
        <Header session={currentSession} />
        <MessageList ref={messageListRef} key={`message-list${currentSessionId}`} currentSession={currentSession} />
        <ErrorBoundary name="session-inputbox">
          <InputBox
            key={`input-box${currentSession.id}`}
            sessionId={currentSession.id}
            sessionType={currentSession.type}
            model={model}
            onStartNewThread={onStartNewThread}
            onRollbackThread={onRollbackThread}
            onSelectModel={onSelectModel}
            onClickSessionSettings={onClickSessionSettings}
            generating={!!lastGeneratingMessage}
            onSubmit={onSubmit}
            onStopGenerating={onStopGenerating}
          />
        </ErrorBoundary>
        <ThreadHistoryDrawer session={currentSession} />
      </div>

      {/* App panel */}
      {activeApp && (
        <div
          className="flex flex-col h-full"
          style={{
            flex: '0 0 50%',
            borderLeft: '1px solid #2a2a2a',
            background: '#141414',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid #2a2a2a',
              background: '#1a1a1a',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>
                {activeApp.appId === 'chess' ? '♟' : activeApp.appId === 'weather' ? '🌤' : '◻'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', textTransform: 'capitalize' }}>
                {activeApp.appId}
              </span>
            </div>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setActiveApp(null)} title="Close panel">
              <IconX size={14} />
            </ActionIcon>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AppEmbed part={activeApp} sessionId={currentSession.id} />
          </div>
        </div>
      )}
    </div>
  ) : (
    !isFetching && (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh]">
        <div className="text-2xl font-semibold text-gray-700 mb-4">{t('Conversation not found')}</div>
        <Button variant="outline" onClick={goHome}>
          {t('Back to HomePage')}
        </Button>
      </div>
    )
  )
}
