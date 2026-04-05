// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { sendToParent, waitForOpponentUci } from '../../../apps/chess/src/postMessage'
import type { OutgoingStateUpdate } from '../../../apps/chess/src/postMessage'

describe('sendToParent', () => {
  test('posts message to window.parent when inside an iframe', () => {
    const postMessage = vi.fn()
    const fakeParent = { postMessage } as unknown as Window
    // Simulate iframe context: parent !== self
    Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true })

    const msg: OutgoingStateUpdate = {
      type: 'STATE_UPDATE',
      pluginId: 'chess',
      invocationId: 'inv-1',
      payload: { fen: 'startpos', turn: 'w', status: 'in_progress' },
    }
    sendToParent(msg)

    expect(postMessage).toHaveBeenCalledWith(msg, '*')
  })

  test('does nothing when window.parent === window (top-level context)', () => {
    // Reset parent to equal window
    Object.defineProperty(window, 'parent', { value: window, configurable: true })

    const msg: OutgoingStateUpdate = {
      type: 'STATE_UPDATE',
      pluginId: 'chess',
      invocationId: 'inv-2',
      payload: { fen: 'startpos', turn: 'w', status: 'in_progress' },
    }
    // Should not throw and window.postMessage should not be called on parent
    expect(() => sendToParent(msg)).not.toThrow()
  })
})

describe('waitForOpponentUci', () => {
  beforeEach(() => {
    // Simulate iframe context for all these tests
    const parentPostMessage = vi.fn((message: unknown) => {
      // Simulate the host immediately replying with a UCI move
      const req = message as { type: string; requestId: string }
      if (req.type === 'REQUEST_OPPONENT_MOVE') {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'OPPONENT_MOVE_RESULT', pluginId: 'chess', requestId: req.requestId, uci: 'e2e4' },
          })
        )
      }
    })
    Object.defineProperty(window, 'parent', {
      value: { postMessage: parentPostMessage },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
    vi.useRealTimers()
  })

  test('resolves with the UCI move from OPPONENT_MOVE_RESULT', async () => {
    const uci = await waitForOpponentUci('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'easy')
    expect(uci).toBe('e2e4')
  })

  test('resolves with empty string when OPPONENT_MOVE_RESULT carries an error', async () => {
    const errorParent = {
      postMessage: vi.fn((message: unknown) => {
        const req = message as { requestId: string }
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'OPPONENT_MOVE_RESULT', pluginId: 'chess', requestId: req.requestId, error: 'no_session' },
          })
        )
      }),
    }
    Object.defineProperty(window, 'parent', { value: errorParent, configurable: true })

    const uci = await waitForOpponentUci('startpos', 'medium')
    expect(uci).toBe('')
  })

  test('resolves with empty string on timeout', async () => {
    vi.useFakeTimers()
    // Parent never replies
    Object.defineProperty(window, 'parent', {
      value: { postMessage: vi.fn() },
      configurable: true,
    })

    const promise = waitForOpponentUci('startpos', 'hard', { timeoutMs: 500 })
    await vi.advanceTimersByTimeAsync(600)
    expect(await promise).toBe('')
  })

  test('ignores OPPONENT_MOVE_RESULT with a different requestId', async () => {
    const replyParent = {
      postMessage: vi.fn((message: unknown) => {
        // Reply with a different requestId (should be ignored)
        void message
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'OPPONENT_MOVE_RESULT', pluginId: 'chess', requestId: 'wrong-id', uci: 'd7d5' },
          })
        )
      }),
    }
    Object.defineProperty(window, 'parent', { value: replyParent, configurable: true })

    vi.useFakeTimers()
    const promise = waitForOpponentUci('startpos', 'easy', { timeoutMs: 200 })
    await vi.advanceTimersByTimeAsync(300)
    expect(await promise).toBe('')
  })

  test('resolves with empty string when there is no parent (top-level context)', async () => {
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
    const uci = await waitForOpponentUci('startpos', 'easy')
    expect(uci).toBe('')
  })
})
