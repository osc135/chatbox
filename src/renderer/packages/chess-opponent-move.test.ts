import { describe, test, expect, vi } from 'vitest'
import { extractUciFromModelText } from './chess-opponent-move'

// Mock all heavy imports — we only test the pure extractUciFromModelText function here
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))
vi.mock('@shared/models', () => ({ getModel: vi.fn() }))
vi.mock('@shared/models/errors', () => ({
  ApiError: class ApiError extends Error {},
  NetworkError: class NetworkError extends Error {},
}))
vi.mock('@/adapters', () => ({ createModelDependencies: vi.fn() }))
vi.mock('@/packages/model-calls', () => ({ generateText: vi.fn() }))
vi.mock('@/platform', () => ({ default: { type: 'web', getConfig: vi.fn().mockResolvedValue({}) } }))
vi.mock('@/stores/chatStore', () => ({ getSessionSettings: vi.fn().mockResolvedValue({}) }))
vi.mock('@/stores/settingActions', () => ({ getRemoteConfig: vi.fn().mockReturnValue({}) }))
vi.mock('@/stores/settingsStore', () => ({
  settingsStore: { getState: () => ({ getSettings: () => ({}) }) },
}))

describe('extractUciFromModelText', () => {
  test('returns a simple four-character UCI move', () => {
    expect(extractUciFromModelText('e2e4')).toBe('e2e4')
  })

  test('normalises a hyphenated move (e2-e4 → e2e4)', () => {
    expect(extractUciFromModelText('e2-e4')).toBe('e2e4')
  })

  test('returns a pawn promotion move (five characters)', () => {
    expect(extractUciFromModelText('e7e8q')).toBe('e7e8q')
  })

  test('extracts UCI from surrounding explanation text', () => {
    expect(extractUciFromModelText('I recommend d2d4 as a strong centre pawn.')).toBe('d2d4')
  })

  test('ignores moves buried inside code fences (fence content is stripped)', () => {
    // The implementation replaces the whole fence block with a space, so a UCI
    // move that only appears inside ``` ... ``` will not be found.
    expect(extractUciFromModelText('```\ne2e4\n```')).toBeNull()
  })

  test('finds a UCI move that appears outside a code fence', () => {
    expect(extractUciFromModelText('```some code```\nPlay e2e4 now.')).toBe('e2e4')
  })

  test('lowercases the result regardless of model output casing', () => {
    expect(extractUciFromModelText('E2E4')).toBe('e2e4')
  })

  test('handles leading and trailing whitespace', () => {
    expect(extractUciFromModelText('  g1f3  ')).toBe('g1f3')
  })

  test('returns null when the output contains no UCI move', () => {
    expect(extractUciFromModelText('I cannot determine a good move right now.')).toBeNull()
  })

  test('returns null for an empty string', () => {
    expect(extractUciFromModelText('')).toBeNull()
  })

  test('picks the first UCI move when multiple are present', () => {
    expect(extractUciFromModelText('Play e2e4 or d2d4')).toBe('e2e4')
  })
})
