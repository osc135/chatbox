import NiceModal from '@ebay/nice-modal-react'
import { ActionIcon, Avatar, Box, Button, Divider, Flex, Paper, ScrollArea, Space, Stack, Text } from '@mantine/core'
import type { CopilotDetail, ImageSource, Session } from '@shared/types'
import { IconChevronLeft, IconChevronRight, IconMessageCircle2Filled, IconX } from '@tabler/icons-react'
import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { trackJkClickEvent } from '@/analytics/jk'
import { JK_EVENTS, JK_PAGE_NAMES } from '@/analytics/jk-events'
import { MessageLayoutSelector } from '@/components/common/MessageLayoutPreview'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { ImageInStorage } from '@/components/Image'
import InputBox, { type InputBoxPayload } from '@/components/InputBox/InputBox'
import HomepageIcon from '@/components/icons/HomepageIcon'
import Page from '@/components/layout/Page'
import { useMyCopilots, useRemoteCopilotsByCursor } from '@/hooks/useCopilots'
import { useProviders } from '@/hooks/useProviders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { navigateToSettings } from '@/modals/Settings'
import * as remote from '@/packages/remote'
import platform from '@/platform'
import { router } from '@/router'
import { useAuthInfoStore } from '@/stores/authInfoStore'
import { createSession as createSessionStore } from '@/stores/chatStore'
import { submitNewUserMessage, switchCurrentSession } from '@/stores/sessionActions'
import { constructUserMessage, initEmptyChatSession } from '@/stores/sessionHelpers'
import { useLanguage, useSettingsStore } from '@/stores/settingsStore'
import { useTutorUser } from '@/stores/tutorAuthStore'
import { useUIStore } from '@/stores/uiStore'
import { getHomeWelcomeCardMode } from '@/utils/homeWelcomeCard'

export const Route = createFileRoute('/')({
  component: Index,
  validateSearch: zodValidator(
    z.object({
      copilotId: z.string().optional(),
      copilot: z.string().optional(),
      settings: z.string().optional(),
    })
  ),
})

function Index() {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const messageLayout = useSettingsStore((s) => s.messageLayout)
  const [tempMessageLayout, setTempMessageLayout] = useState<'left' | 'bubble' | undefined>(undefined)

  const setSettings = useSettingsStore((s) => s.setSettings)
  const newSessionState = useUIStore((s) => s.newSessionState)
  const setNewSessionState = useUIStore((s) => s.setNewSessionState)
  const addSessionKnowledgeBase = useUIStore((s) => s.addSessionKnowledgeBase)
  const showCopilotsInNewSession = useUIStore((s) => s.showCopilotsInNewSession)
  const widthFull = useUIStore((s) => s.widthFull)
  const sessionWebBrowsingMap = useUIStore((s) => s.sessionWebBrowsingMap)
  const setSessionWebBrowsing = useUIStore((s) => s.setSessionWebBrowsing)
  const clearSessionWebBrowsing = useUIStore((s) => s.clearSessionWebBrowsing)
  const [session, setSession] = useState<Session>({
    id: 'new',
    ...initEmptyChatSession(),
  })

  const { providers } = useProviders()
  const language = useLanguage()
  const hasLicense = useSettingsStore((s) => Boolean(s.licenseKey))
  const isLoggedIn = useAuthInfoStore((s) => Boolean(s.accessToken && s.refreshToken))
  const welcomeCardMode = useMemo(
    () => getHomeWelcomeCardMode({ providerCount: providers.length, isLoggedIn, hasLicense }),
    [providers.length, isLoggedIn, hasLicense]
  )

  const selectedModel = useMemo(() => {
    if (session.settings?.provider && session.settings?.modelId) {
      return {
        provider: session.settings.provider,
        modelId: session.settings.modelId,
      }
    }
  }, [session.settings?.provider, session.settings?.modelId])

  const { copilots: myCopilots } = useMyCopilots()
  const { copilots: remoteCopilots } = useRemoteCopilotsByCursor({ limit: 10 })
  const selectedCopilotId = useMemo(() => session?.copilotId, [session?.copilotId])
  const selectedCopilot = useMemo(
    () => myCopilots.find((c) => c.id === selectedCopilotId) || remoteCopilots.find((c) => c.id === selectedCopilotId),
    [myCopilots, remoteCopilots, selectedCopilotId]
  )
  useEffect(() => {
    setSession((old) => ({
      ...old,
      assistantAvatarKey:
        selectedCopilot?.avatar?.type === 'storage-key' ? selectedCopilot.avatar.storageKey : undefined,
      picUrl: selectedCopilot?.avatar?.type === 'url' ? selectedCopilot.avatar.url : selectedCopilot?.picUrl,
      backgroundImage: selectedCopilot?.backgroundImage,
      name: selectedCopilot?.name || 'Untitled',
      messages: selectedCopilot
        ? [
            {
              id: uuidv4(),
              role: 'system',
              contentParts: [
                {
                  type: 'text',
                  text: selectedCopilot.prompt,
                },
              ],
            },
          ]
        : initEmptyChatSession().messages,
    }))
  }, [selectedCopilot])

  const routerState = useRouterState()
  useEffect(() => {
    const { copilotId, copilot } = routerState.location.search
    if (copilot) {
      let c: CopilotDetail | null = null
      try {
        c = JSON.parse(copilot) as CopilotDetail
      } catch (e) {
        return
      }

      setSession((old) => ({
        ...old,
        copilotId: c.id,
        assistantAvatarKey: c.avatar?.type === 'storage-key' ? c.avatar.storageKey : undefined,
        picUrl: c.avatar?.type === 'url' ? c.avatar.url : c.picUrl,
        backgroundImage: c.backgroundImage,
        name: c.name || 'Untitled',
        messages: [
          {
            id: uuidv4(),
            role: 'system',
            contentParts: [
              {
                type: 'text',
                text: c.prompt,
              },
            ],
          },
        ],
      }))
    } else if (copilotId) {
      setSession((old) => ({ ...old, copilotId }))
    }
  }, [routerState.location.search])

  const handleSubmit = useCallback(
    async ({ constructedMessage, needGenerating = true, onUserMessageReady }: InputBoxPayload) => {
      const newSession = await createSessionStore({
        name: session.name,
        type: 'chat',
        assistantAvatarKey: session.assistantAvatarKey,
        picUrl: session.picUrl,
        backgroundImage: session.backgroundImage,
        messages: session.messages,
        copilotId: session.copilotId,
        settings: session.settings,
      })

      if (session.copilotId) {
        void remote
          .recordCopilotUsage({ id: session.copilotId, action: 'create_session' })
          .catch((error) => console.warn('[recordCopilotUsage] failed', error))
      }

      // Transfer knowledge base from newSessionState to the actual session
      if (newSessionState.knowledgeBase) {
        addSessionKnowledgeBase(newSession.id, newSessionState.knowledgeBase)
        // Clear newSessionState after transfer
        setNewSessionState({})
      }

      // Transfer web browsing setting from "new" session to the actual session
      const newSessionWebBrowsing = sessionWebBrowsingMap['new']
      if (newSessionWebBrowsing !== undefined) {
        setSessionWebBrowsing(newSession.id, newSessionWebBrowsing)
        clearSessionWebBrowsing('new')
      }

      switchCurrentSession(newSession.id)

      void submitNewUserMessage(newSession.id, {
        newUserMsg: constructedMessage,
        needGenerating,
        onUserMessageReady,
      })
    },
    [
      session,
      addSessionKnowledgeBase,
      newSessionState.knowledgeBase,
      setNewSessionState,
      sessionWebBrowsingMap,
      setSessionWebBrowsing,
      clearSessionWebBrowsing,
    ]
  )

  const onSelectModel = useCallback((p: string, m: string) => {
    setSession((old) => ({
      ...old,
      settings: {
        ...(old.settings || {}),
        provider: p,
        modelId: m,
      },
    }))
  }, [])

  const onClickSessionSettings = useCallback(async () => {
    const res: Session = await NiceModal.show('session-settings', {
      session,
      disableAutoSave: true,
    })
    if (res) {
      setSession((old) => ({
        ...old,
        ...res,
      }))
    }
    return true
  }, [session])

  const tutorUser = useTutorUser()

  const timeGreeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const suggestions = [
    { emoji: '♟️', label: "Let's play chess", prompt: "Let's play chess" },
    { emoji: '📝', label: 'Quiz me on something', prompt: 'Quiz me on something interesting' },
    { emoji: '🌤️', label: 'Check the weather', prompt: "What's the weather today?" },
    { emoji: '📚', label: 'Vocab practice', prompt: 'Help me practice some vocabulary words' },
    { emoji: '🗓️', label: "What's on my calendar", prompt: "What's on my calendar today?" },
    { emoji: '🔢', label: 'Help with math', prompt: 'Help me with a math problem' },
  ]

  const sendSuggestion = useCallback(
    (prompt: string) => {
      void handleSubmit({
        constructedMessage: constructUserMessage(prompt),
        needGenerating: true,
      })
    },
    [handleSubmit]
  )

  return (
    <Page title="">
      <div className="p-0 flex flex-col h-full">
        {messageLayout || welcomeCardMode !== 'none' ? (
          <Stack align="center" justify="center" flex={1} px="md" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* ambient glow */}
            <div style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 500,
              height: 500,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(56, 189, 248, 0.07) 0%, transparent 65%)',
              pointerEvents: 'none',
            }} />

            <Stack align="center" gap={6} mb="lg">
              <div style={{ fontSize: '2.2rem', lineHeight: 1, marginBottom: 4 }}>✦</div>
              <Text
                ta="center"
                style={{
                  fontSize: isSmallScreen ? '1.45rem' : '1.85rem',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  background: 'linear-gradient(135deg, #f8fafc 20%, #38bdf8 80%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {timeGreeting}{tutorUser?.name ? `, ${tutorUser.name.split(' ')[0]}` : ''}!
              </Text>
              <Text size="sm" ta="center" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 360, lineHeight: 1.5 }}>
                Your AI learning companion — ask anything, or jump in with a suggestion below.
              </Text>
            </Stack>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isSmallScreen ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: 10,
              width: '100%',
              maxWidth: 540,
            }}>
              {suggestions.map(({ emoji, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => sendSuggestion(prompt)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '14px 16px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    color: 'white',
                    textAlign: 'left',
                    transition: 'background 0.16s, border-color 0.16s, transform 0.16s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(56,189,248,0.1)'
                    e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span style={{ fontSize: '1.35rem', lineHeight: 1 }}>{emoji}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.35, opacity: 0.85 }}>{label}</span>
                </button>
              ))}
            </div>
          </Stack>
        ) : (
          <Stack align="center" justify="center" gap="sm" flex={1} p="sm">
            <Stack
              align="center"
              justify="center"
              gap="lg"
              w={isSmallScreen ? '100%' : '80%'}
              maw={386}
              p="xl"
              className="border border-solid border-chatbox-border-primary rounded-lg relative"
            >
              <div className="absolute top-0 right-0">
                <ActionIcon
                  variant="transparent"
                  color="chatbox-tertiary"
                  m={10}
                  onClick={() => setSettings({ messageLayout: 'left' })}
                >
                  <ScalableIcon icon={IconX} size={20} className="text-chatbox-tint-tertiary" />
                </ActionIcon>
              </div>
              <Text size="md" fw="600">
                {t('Message Layout')}
              </Text>
              <Stack gap="sm">
                <MessageLayoutSelector
                  w="100%"
                  size="sm"
                  value={tempMessageLayout || 'left'}
                  onValueChange={(val) => setTempMessageLayout(val)}
                />

                <Text size="xs" c="chatbox-secondary">
                  {t('You can change this setting later in Settings → ')}
                  <a className="cursor-pointer !text-chatbox-tint-brand" onClick={() => navigateToSettings('chat')}>
                    {t('Conversation Settings')}
                  </a>
                </Text>
              </Stack>

              <Button
                variant="filled"
                size="md"
                className="w-full"
                onClick={() => setSettings({ messageLayout: tempMessageLayout || 'left' })}
              >
                {t('Save')}
              </Button>
            </Stack>
          </Stack>
        )}


        <Stack gap="sm">
          {session.copilotId ? (
            <Box px="md">
              <Stack gap="sm" className={widthFull ? 'w-full' : 'w-full max-w-4xl mx-auto'}>
                <Flex align="center" gap="sm">
                  <CopilotItem
                    name={session.name}
                    avatar={
                      session.assistantAvatarKey
                        ? { type: 'storage-key', storageKey: session.assistantAvatarKey }
                        : undefined
                    }
                    picUrl={session.picUrl}
                    selected
                    onClick={() => onClickSessionSettings?.()}
                  />
                  <ActionIcon
                    size={32}
                    radius={16}
                    c="chatbox-tertiary"
                    bg="#F1F3F5"
                    onClick={() => setSession((old) => ({ ...old, copilotId: undefined }))}
                  >
                    <ScalableIcon icon={IconX} size={24} />
                  </ActionIcon>
                </Flex>

                <Text c="chatbox-secondary" className="line-clamp-5">
                  {session.messages[0]?.contentParts?.map((part) => (part.type === 'text' ? part.text : '')).join('') ||
                    ''}
                </Text>
              </Stack>
            </Box>
          ) : (
            showCopilotsInNewSession && (
              <CopilotPicker onSelect={(copilot) => setSession((old) => ({ ...old, copilotId: copilot?.id }))} />
            )
          )}

          <InputBox
            sessionType="chat"
            sessionId="new"
            model={selectedModel}
            // fullWidth
            onSelectModel={onSelectModel}
            onClickSessionSettings={onClickSessionSettings}
            onSubmit={handleSubmit}
          />
        </Stack>
      </div>
    </Page>
  )
}

const MAX_COPILOTS_TO_SHOW = 10

const CopilotPicker = ({ selectedId, onSelect }: { selectedId?: string; onSelect?(copilot?: CopilotDetail): void }) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const widthFull = useUIStore((s) => s.widthFull)
  const { copilots: myCopilots } = useMyCopilots()
  const { copilots: remoteCopilots } = useRemoteCopilotsByCursor()

  const copilots = useMemo(
    () =>
      myCopilots.length >= MAX_COPILOTS_TO_SHOW
        ? myCopilots
        : [
            ...myCopilots,
            ...(myCopilots.length && remoteCopilots.length ? [undefined] : []),
            ...remoteCopilots
              .filter((c) => !myCopilots.map((mc) => mc.id).includes(c.id))
              .slice(0, MAX_COPILOTS_TO_SHOW - myCopilots.length - 1),
          ],
    [myCopilots, remoteCopilots]
  )

  const showMoreButton = useMemo(
    () => copilots.length < myCopilots.length + remoteCopilots.length,
    [copilots.length, myCopilots.length, remoteCopilots.length]
  )

  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollPosition, onScrollPositionChange] = useState({ x: 0, y: 0 })

  if (!copilots.length) {
    return null
  }

  return (
    <Box px="md">
      <Stack gap="xs" className={widthFull ? 'w-full' : 'w-full max-w-4xl mx-auto'}>
        <Flex align="center" justify="space-between">
          <Text size="xxs" c="chatbox-tertiary">
            {t('My Copilots').toUpperCase()}
          </Text>

          {!isSmallScreen && (
            <Flex align="center" gap="sm">
              <ActionIcon
                variant="transparent"
                color="chatbox-tertiary"
                // onClick={() => setPage((p) => Math.max(p - 1, 0))}
                onClick={() => {
                  if (viewportRef.current) {
                    // const scrollWidth = viewportRef.current.scrollWidth
                    const clientWidth = viewportRef.current.clientWidth
                    const newScrollPosition = Math.max(scrollPosition.x - clientWidth, 0)
                    viewportRef.current.scrollTo({ left: newScrollPosition, behavior: 'smooth' })
                    onScrollPositionChange({ x: newScrollPosition, y: 0 })
                  }
                }}
              >
                <ScalableIcon icon={IconChevronLeft} />
              </ActionIcon>
              <ActionIcon
                variant="transparent"
                color="chatbox-tertiary"
                // onClick={() => setPage((p) => p + 1)}
                onClick={() => {
                  if (viewportRef.current) {
                    const scrollWidth = viewportRef.current.scrollWidth
                    const clientWidth = viewportRef.current.clientWidth
                    const newScrollPosition = Math.min(scrollPosition.x + clientWidth, scrollWidth - clientWidth)
                    viewportRef.current.scrollTo({ left: newScrollPosition, behavior: 'smooth' })
                    onScrollPositionChange({ x: newScrollPosition, y: 0 })
                  }
                }}
              >
                <ScalableIcon icon={IconChevronRight} />
              </ActionIcon>
            </Flex>
          )}
        </Flex>

        <ScrollArea
          type={isSmallScreen ? 'never' : 'scroll'}
          mx="-md"
          scrollbars="x"
          offsetScrollbars="x"
          viewportRef={viewportRef}
          onScrollPositionChange={onScrollPositionChange}
          className="copilot-picker-scroll-area"
        >
          {scrollPosition.x > 8 && !isSmallScreen && (
            <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-chatbox-background-primary to-transparent"></div>
          )}
          {!isSmallScreen && (
            <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-chatbox-background-primary to-transparent"></div>
          )}
          <Flex wrap="nowrap" gap="xs">
            <Space w="xs" />
            {copilots.map((copilot) =>
              copilot ? (
                <CopilotItem
                  key={copilot.id}
                  name={copilot.name}
                  avatar={copilot.avatar}
                  picUrl={copilot.picUrl}
                  selected={selectedId === copilot.id}
                  onClick={() => {
                    onSelect?.(copilot)
                  }}
                />
              ) : (
                <Divider key="divider" orientation="vertical" my="xs" mx="xxs" />
              )
            )}
            {showMoreButton && (
              <CopilotItem
                name={t('View All Copilots')}
                noAvatar={true}
                selected={false}
                onClick={() =>
                  router.navigate({
                    to: '/copilots',
                  })
                }
              />
            )}
            <Space w="xs" />
          </Flex>
        </ScrollArea>
      </Stack>
    </Box>
  )
}

const CopilotItem = ({
  name,
  avatar,
  picUrl,
  selected,
  onClick,
  noAvatar = false,
}: {
  name: string
  avatar?: ImageSource
  picUrl?: string
  selected?: boolean
  onClick?(): void
  noAvatar?: boolean
}) => {
  const isSmallScreen = useIsSmallScreen()
  return (
    <Flex
      align="center"
      gap={isSmallScreen ? 'xxs' : 'xs'}
      py="xs"
      px={isSmallScreen ? 'xs' : 'md'}
      bd={selected ? 'none' : '1px solid var(--chatbox-border-primary)'}
      bg={selected ? 'var(--chatbox-background-brand-secondary)' : 'transparent'}
      className={clsx(
        'max-w-[75vw] sm:max-w-[50vw] cursor-pointer shrink-0 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.04)]',
        isSmallScreen ? 'rounded-full' : 'rounded-md'
      )}
      onClick={onClick}
    >
      {!noAvatar &&
        (avatar?.type === 'storage-key' || avatar?.type === 'url' || picUrl ? (
          <Avatar
            src={avatar?.type === 'storage-key' ? '' : avatar?.url || picUrl}
            alt={name}
            size={isSmallScreen ? 20 : 24}
            radius="xl"
            className="flex-shrink-0 border border-solid border-chatbox-border-primary"
          >
            {avatar?.type === 'storage-key' ? (
              <ImageInStorage storageKey={avatar.storageKey} className="object-cover object-center w-full h-full" />
            ) : (
              name?.charAt(0)?.toUpperCase()
            )}
          </Avatar>
        ) : (
          <Stack
            w={isSmallScreen ? 20 : 24}
            h={isSmallScreen ? 20 : 24}
            align="center"
            justify="center"
            className="flex-shrink-0 rounded-full bg-chatbox-background-brand-secondary"
          >
            <ScalableIcon icon={IconMessageCircle2Filled} size={24} className="text-chatbox-tint-brand" />
          </Stack>
        ))}
      <Text fw="600" c={selected ? 'chatbox-brand' : 'chatbox-primary'} lineClamp={1}>
        {name}
      </Text>
    </Flex>
  )
}
