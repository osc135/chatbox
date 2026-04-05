import { describe, test, expect } from 'vitest'
import { setChessState, getChessState } from './chess-state-store'

describe('chess-state-store', () => {
  test('starts as null in a fresh module context', () => {
    // Each test file runs in its own module context so lastState is null here.
    expect(getChessState()).toBeNull()
  })

  test('setChessState stores and getChessState returns the same object', () => {
    const state = { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', turn: 'b', status: 'in_progress' }
    setChessState(state)
    expect(getChessState()).toEqual(state)
  })

  test('overwrites previously stored state', () => {
    const first = { fen: 'start', turn: 'w', status: 'in_progress' }
    const second = { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', turn: 'b', status: 'checkmate' }
    setChessState(first)
    setChessState(second)
    expect(getChessState()).toEqual(second)
  })

  test('stores arbitrary extra fields in the state object', () => {
    const state = { fen: 'x', turn: 'w', status: 'in_progress', lastMove: 'e2e4', extra: 42 }
    setChessState(state)
    expect(getChessState()?.extra).toBe(42)
  })
})
