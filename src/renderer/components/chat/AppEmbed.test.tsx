// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import AppEmbed from './AppEmbed'
import type { MessageAppPart } from '@shared/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSetChessState = vi.fn()
const mockFetchChessOpponentMove = vi.fn()

vi.mock('@/packages/chess-state-store', () => ({
  setChessState: (...args: unknown[]) => mockSetChessState(...args),
  getChessState: vi.fn(),
}))

vi.mock('@/packages/chess-opponent-move', () => ({
  fetchChessOpponentMove: (...args: unknown[]) => mockFetchChessOpponentMove(...args),
}))

vi.mock('@/components/apps/CountingApp', () => ({
  default: ({ initialLevel }: { initialLevel: number }) => (
    <div data-testid="counting-app">counting-level-{initialLevel}</div>
  ),
}))

vi.mock('@/components/apps/VocabApp', () => ({
  default: ({ topic }: { topic?: string }) => (
    <div data-testid="vocab-app">vocab-{topic ?? 'no-topic'}</div>
  ),
}))

vi.mock('@/components/apps/CalendarApp', () => ({
  default: () => <div data-testid="calendar-app">calendar</div>,
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePart(appId: string, appUrl = `http://localhost/${appId}`, state?: Record<string, unknown>): MessageAppPart {
  return { type: 'app', appId, appUrl, state }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSetChessState.mockReset()
  mockFetchChessOpponentMove.mockReset()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('inline app routing', () => {
  test('renders CountingApp for appId="counting" with level from URL', () => {
    render(<AppEmbed part={makePart('counting', 'http://localhost/counting?level=2')} />)
    expect(screen.getByTestId('counting-app')).toBeTruthy()
    expect(screen.getByText('counting-level-2')).toBeTruthy()
  })

  test('defaults counting level to 1 when URL has no level param', () => {
    render(<AppEmbed part={makePart('counting', 'http://localhost/counting')} />)
    expect(screen.getByText('counting-level-1')).toBeTruthy()
  })

  test('renders VocabApp for appId="vocab"', () => {
    render(<AppEmbed part={makePart('vocab', 'http://localhost/vocab', { topic: 'science' })} />)
    expect(screen.getByTestId('vocab-app')).toBeTruthy()
    expect(screen.getByText('vocab-science')).toBeTruthy()
  })

  test('renders CalendarApp for appId="calendar"', () => {
    render(<AppEmbed part={makePart('calendar')} />)
    expect(screen.getByTestId('calendar-app')).toBeTruthy()
  })
})

describe('iframe rendering (chess / weather)', () => {
  test('renders an iframe with the correct src for appId="chess"', () => {
    render(<AppEmbed part={makePart('chess', 'http://localhost/chess')} sessionId="sess-1" />)
    const iframe = document.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe!.src).toContain('/chess')
  })

  test('shows loading spinner before iframe fires onLoad', () => {
    render(<AppEmbed part={makePart('chess')} />)
    expect(screen.getByText(/loading chess/i)).toBeTruthy()
  })

  test('hides loading text and displays iframe after onLoad fires', () => {
    render(<AppEmbed part={makePart('chess')} />)
    const iframe = document.querySelector('iframe')!
    fireEvent.load(iframe)
    expect(screen.queryByText(/loading chess/i)).toBeNull()
    expect(iframe.style.display).toBe('block')
  })

  test('shows error UI after 10 s load timeout', async () => {
    vi.useFakeTimers()
    render(<AppEmbed part={makePart('chess')} />)
    await act(async () => { vi.advanceTimersByTime(10_001) })
    expect(screen.getByText(/chess failed to load/i)).toBeTruthy()
  })

  test('"Try again" button resets error state and shows loading again', async () => {
    vi.useFakeTimers()
    render(<AppEmbed part={makePart('chess')} />)
    await act(async () => { vi.advanceTimersByTime(10_001) })

    const btn = screen.getByRole('button', { name: /try again/i })
    await act(async () => { fireEvent.click(btn) })

    expect(screen.queryByText(/chess failed to load/i)).toBeNull()
    expect(screen.getByText(/loading chess/i)).toBeTruthy()
  })
})

describe('postMessage — STATE_UPDATE', () => {
  test('calls onStateUpdate and setChessState when STATE_UPDATE is received', async () => {
    const onStateUpdate = vi.fn()
    render(
      <AppEmbed
        part={makePart('chess', 'http://localhost/chess')}
        sessionId="sess-1"
        onStateUpdate={onStateUpdate}
      />
    )

    const iframe = document.querySelector('iframe') as HTMLIFrameElement

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'STATE_UPDATE',
            pluginId: 'chess',
            invocationId: 'inv-1',
            payload: { fen: 'startpos', turn: 'b', status: 'in_progress' },
          },
          // Use the iframe's own contentWindow as source so the source-check passes
          source: iframe.contentWindow,
        })
      )
    })

    expect(mockSetChessState).toHaveBeenCalledWith({ fen: 'startpos', turn: 'b', status: 'in_progress' })
    expect(onStateUpdate).toHaveBeenCalledWith({ fen: 'startpos', turn: 'b', status: 'in_progress' })
  })

  test('ignores STATE_UPDATE whose pluginId does not match appId', async () => {
    const onStateUpdate = vi.fn()
    render(<AppEmbed part={makePart('chess')} onStateUpdate={onStateUpdate} />)
    const iframe = document.querySelector('iframe') as HTMLIFrameElement

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'STATE_UPDATE', pluginId: 'weather', payload: { city: 'NYC' } },
          source: iframe.contentWindow,
        })
      )
    })

    expect(onStateUpdate).not.toHaveBeenCalled()
  })
})

describe('postMessage — REQUEST_OPPONENT_MOVE', () => {
  test('calls fetchChessOpponentMove and posts OPPONENT_MOVE_RESULT back', async () => {
    mockFetchChessOpponentMove.mockResolvedValue({ uci: 'e7e5' })
    render(<AppEmbed part={makePart('chess')} sessionId="sess-42" />)
    const iframe = document.querySelector('iframe') as HTMLIFrameElement

    const posted: unknown[] = []
    // Capture postMessage calls to the iframe's contentWindow
    if (iframe.contentWindow) {
      vi.spyOn(iframe.contentWindow, 'postMessage').mockImplementation((...args) => {
        posted.push(args[0])
      })
    }

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'REQUEST_OPPONENT_MOVE',
            pluginId: 'chess',
            requestId: 'req-99',
            fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
            difficulty: 'easy',
          },
          source: iframe.contentWindow,
        })
      )
    })

    expect(mockFetchChessOpponentMove).toHaveBeenCalledWith(
      'sess-42',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      'easy'
    )
    // Allow the async move fetch to resolve
    await act(async () => {})
    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'OPPONENT_MOVE_RESULT', requestId: 'req-99', uci: 'e7e5' })
    )
  })

  test('sends error result when fetchChessOpponentMove returns an error', async () => {
    mockFetchChessOpponentMove.mockResolvedValue({ error: 'model_timeout' })
    render(<AppEmbed part={makePart('chess')} sessionId="sess-1" />)
    const iframe = document.querySelector('iframe') as HTMLIFrameElement

    const posted: unknown[] = []
    if (iframe.contentWindow) {
      vi.spyOn(iframe.contentWindow, 'postMessage').mockImplementation((...args) => {
        posted.push(args[0])
      })
    }

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'REQUEST_OPPONENT_MOVE', pluginId: 'chess', requestId: 'req-err', fen: 'startpos', difficulty: 'hard' },
          source: iframe.contentWindow,
        })
      )
    })
    await act(async () => {})

    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'OPPONENT_MOVE_RESULT', requestId: 'req-err', error: 'model_timeout' })
    )
  })

  test('sends no_session error when sessionId is not provided', async () => {
    render(<AppEmbed part={makePart('chess')} />) // no sessionId
    const iframe = document.querySelector('iframe') as HTMLIFrameElement

    const posted: unknown[] = []
    if (iframe.contentWindow) {
      vi.spyOn(iframe.contentWindow, 'postMessage').mockImplementation((...args) => {
        posted.push(args[0])
      })
    }

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'REQUEST_OPPONENT_MOVE', pluginId: 'chess', requestId: 'req-ns', fen: 'startpos', difficulty: 'medium' },
          source: iframe.contentWindow,
        })
      )
    })

    expect(mockFetchChessOpponentMove).not.toHaveBeenCalled()
    expect(posted).toContainEqual(
      expect.objectContaining({ type: 'OPPONENT_MOVE_RESULT', error: 'no_session' })
    )
  })
})
