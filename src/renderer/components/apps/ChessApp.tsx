/**
 * Chess inline component — no iframe, no postMessage.
 *
 * Differences from the standalone iframe version:
 *  - Listens for `app:toolInvoke` custom events (dispatched by abstract-ai-sdk)
 *    instead of `window.message` TOOL_INVOKE events
 *  - Calls `onStateUpdate(payload)` instead of `sendToParent(STATE_UPDATE)`
 *  - Calls `fetchChessOpponentMove(sessionId, fen, difficulty)` directly
 *    instead of the postMessage-based waitForOpponentUci round-trip
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { fetchChessOpponentMove } from '@/packages/chess-opponent-move'
import './chess.css'

// ── Wooden chessboard sounds (Web Audio API) ──────────────────────────────────

function makeCtx() { return new AudioContext() }

function woodThock(ctx: AudioContext, t: number, pitch: number, vol: number, decay: number) {
  const bufLen = Math.ceil(ctx.sampleRate * (decay + 0.05))
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

  const click = ctx.createBufferSource()
  click.buffer = buf
  const hpf = ctx.createBiquadFilter()
  hpf.type = 'highpass'
  hpf.frequency.setValueAtTime(4500, t)
  const clickEnv = ctx.createGain()
  clickEnv.gain.setValueAtTime(vol * 0.55, t)
  clickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.014)
  click.connect(hpf); hpf.connect(clickEnv); clickEnv.connect(ctx.destination)
  click.start(t); click.stop(t + 0.018)

  const body = ctx.createBufferSource()
  body.buffer = buf
  const bpf = ctx.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.setValueAtTime(pitch, t)
  bpf.Q.setValueAtTime(4.5, t)
  const bodyEnv = ctx.createGain()
  bodyEnv.gain.setValueAtTime(vol, t)
  bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + decay)
  body.connect(bpf); bpf.connect(bodyEnv); bodyEnv.connect(ctx.destination)
  body.start(t); body.stop(t + decay + 0.01)
}

function playPlayerMove(isCapture: boolean) {
  const ctx = makeCtx(); const t = ctx.currentTime
  isCapture ? woodThock(ctx, t, 520, 0.90, 0.18) : woodThock(ctx, t, 700, 0.65, 0.12)
}
function playOpponentMove(isCapture: boolean) {
  const ctx = makeCtx(); const t = ctx.currentTime
  isCapture ? woodThock(ctx, t, 480, 0.85, 0.18) : woodThock(ctx, t, 620, 0.55, 0.12)
}
function playCheckSound() {
  const ctx = makeCtx(); const t = ctx.currentTime
  woodThock(ctx, t, 720, 0.65, 0.11); woodThock(ctx, t + 0.08, 860, 0.50, 0.10)
}
function playVictory() {
  const ctx = makeCtx(); const t = ctx.currentTime
  woodThock(ctx, t, 680, 0.65, 0.12); woodThock(ctx, t + 0.16, 760, 0.65, 0.12)
  woodThock(ctx, t + 0.30, 880, 0.80, 0.20)
}
function playDefeat() {
  const ctx = makeCtx(); const t = ctx.currentTime
  woodThock(ctx, t, 490, 0.55, 0.22)
}
function playDrawSound() {
  const ctx = makeCtx(); const t = ctx.currentTime
  woodThock(ctx, t, 600, 0.50, 0.14); woodThock(ctx, t + 0.20, 600, 0.35, 0.14)
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Difficulty = 'super_dumb' | 'easy' | 'medium' | 'hard'
type GameStatus = 'waiting' | 'playing' | 'game_over'

const DIFFICULTY_INFO: Record<Difficulty, { label: string; desc: string }> = {
  super_dumb: { label: 'Super dumb',   desc: 'Random legal moves (no API)' },
  easy:       { label: 'Beginner',     desc: 'LLM plays weakly' },
  medium:     { label: 'Intermediate', desc: 'LLM club-level' },
  hard:       { label: 'Expert',       desc: 'LLM strong play' },
}

function randomLegalUci(g: Chess): string {
  const moves = g.moves({ verbose: true })
  if (!moves.length) return ''
  const m = moves[Math.floor(Math.random() * moves.length)]!
  let uci = m.from + m.to
  if (m.promotion) uci += m.promotion
  return uci
}

function tryApplyUci(g: Chess, uci: string, addMove: (san: string) => void): boolean {
  if (!uci || uci.length < 4) return false
  const from = uci.slice(0, 2) as Square
  const to = uci.slice(2, 4) as Square
  const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined
  try {
    const move = g.move({ from, to, promotion: promotion || undefined })
    if (move) { addMove(move.san); return true }
  } catch { /* invalid */ }
  return false
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChessAppProps {
  /** Full tool-call result from the manifest's execute() — not used by chess directly. */
  state?: Record<string, unknown>
  /** Passed through so the LLM opponent can be requested. */
  sessionId?: string
  onStateUpdate?: (state: Record<string, unknown>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ChessApp({ state: _state, sessionId, onStateUpdate }: ChessAppProps) {
  const [game, setGame] = useState(new Chess())
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting')
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalMoveSquares, setLegalMoveSquares] = useState<Square[]>([])
  const [showMoves, setShowMoves] = useState(true)
  const [boardSize, setBoardSize] = useState(400)
  const moveListRef = useRef<HTMLDivElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  const boardContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null }
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setBoardSize(Math.max(100, Math.min(width, height) - 12))
    })
    ro.observe(el)
    roRef.current = ro
  }, [])

  useEffect(() => {
    if (!moveHistory.length) return
    const lastSan = moveHistory[moveHistory.length - 1]
    if (!lastSan || lastSan.endsWith('#')) return
    const isOpponentMove = moveHistory.length % 2 === 0
    const isCapture = lastSan.includes('x')
    if (lastSan.endsWith('+')) playCheckSound()
    else if (isOpponentMove) playOpponentMove(isCapture)
    else playPlayerMove(isCapture)
  }, [moveHistory])

  useEffect(() => {
    if (!result) return
    if (result.includes('White wins')) playVictory()
    else if (result.includes('Black wins') || result === 'You resigned') playDefeat()
    else playDrawSound()
  }, [result])

  const getStatus = useCallback(
    (g: Chess): 'in_progress' | 'checkmate' | 'stalemate' | 'draw' => {
      if (g.isCheckmate()) return 'checkmate'
      if (g.isStalemate()) return 'stalemate'
      if (g.isDraw()) return 'draw'
      return 'in_progress'
    }, []
  )

  const notifyState = useCallback(
    (g: Chess, lastMove?: string) => {
      onStateUpdate?.({
        fen: g.fen(),
        turn: g.turn() === 'w' ? 'white' : 'black',
        status: getStatus(g),
        lastMove,
      })
    },
    [onStateUpdate, getStatus]
  )

  const checkGameEnd = useCallback(
    (g: Chess) => {
      if (!g.isGameOver()) return
      setGameStatus('game_over')
      let resultText = 'Draw'
      let winner: string | undefined
      if (g.isCheckmate()) {
        winner = g.turn() === 'w' ? 'black' : 'white'
        resultText = winner === 'white' ? 'White wins by checkmate' : 'Black wins by checkmate'
      } else if (g.isStalemate()) {
        resultText = 'Stalemate'
      }
      setResult(resultText)
      onStateUpdate?.({ action: 'game_over', result: getStatus(g), winner, resultText })
    },
    [getStatus, onStateUpdate]
  )

  const addMove = useCallback((san: string) => {
    setMoveHistory((prev) => [...prev, san])
    setTimeout(() => moveListRef.current?.scrollTo(0, moveListRef.current.scrollHeight), 50)
  }, [])

  const makeOpponentMove = useCallback(
    async (g: Chess) => {
      if (g.isGameOver()) return
      setThinking(true)
      try {
        let uci: string
        if (difficulty === 'super_dumb') {
          uci = randomLegalUci(g)
        } else {
          // Direct call — no postMessage round-trip needed when inline
          if (!sessionId) {
            uci = randomLegalUci(g)
          } else {
            const moveResult = await fetchChessOpponentMove(sessionId, g.fen(), difficulty)
            uci = 'uci' in moveResult ? moveResult.uci : randomLegalUci(g)
          }
        }
        if (!uci) return
        let appliedUci = uci
        if (!tryApplyUci(g, uci, addMove)) {
          const fb = randomLegalUci(g)
          if (!fb || !tryApplyUci(g, fb, addMove)) return
          appliedUci = fb
        }
        setGame(new Chess(g.fen()))
        notifyState(g, appliedUci)
        checkGameEnd(g)
      } finally {
        setThinking(false)
      }
    },
    [difficulty, sessionId, notifyState, checkGameEnd, addMove]
  )

  const startGame = useCallback(() => {
    const newGame = new Chess()
    setGame(newGame)
    setGameStatus('playing')
    setResult(null)
    setMoveHistory([])
    setSelectedSquare(null)
    setLegalMoveSquares([])
    notifyState(newGame)
  }, [notifyState])

  const makeMove = useCallback(
    async (move: string) => {
      if (gameStatus !== 'playing') return
      const g = new Chess(game.fen())
      try {
        const r = g.move(move)
        if (r) addMove(r.san)
      } catch {
        onStateUpdate?.({ action: 'error', code: 'INVALID_MOVE', message: `Invalid move: ${move}` })
        return
      }
      setGame(new Chess(g.fen()))
      notifyState(g, move)
      if (!g.isGameOver()) {
        await makeOpponentMove(g)
      } else {
        checkGameEnd(g)
      }
    },
    [game, gameStatus, notifyState, makeOpponentMove, checkGameEnd, addMove, onStateUpdate]
  )

  const clearSelection = useCallback(() => { setSelectedSquare(null); setLegalMoveSquares([]) }, [])

  const selectSquare = useCallback(
    (square: Square) => {
      const moves = game.moves({ verbose: true, square })
      if (!moves.length) { clearSelection(); return }
      setSelectedSquare(square)
      setLegalMoveSquares(moves.map((m) => m.to as Square))
    },
    [game, clearSelection]
  )

  const onSquareClick = useCallback(
    (square: Square) => {
      if (gameStatus !== 'playing' || thinking || game.turn() !== 'w') return
      if (selectedSquare && legalMoveSquares.includes(square)) {
        const g = new Chess(game.fen())
        let moveResult
        try { moveResult = g.move({ from: selectedSquare, to: square, promotion: 'q' }) } catch { clearSelection(); return }
        clearSelection()
        if (!moveResult) return
        addMove(moveResult.san)
        setGame(new Chess(g.fen()))
        notifyState(g, `${selectedSquare}${square}`)
        if (!g.isGameOver()) void makeOpponentMove(g); else checkGameEnd(g)
        return
      }
      const piece = game.get(square)
      if (piece && piece.color === 'w') {
        selectedSquare === square ? clearSelection() : selectSquare(square)
      } else {
        clearSelection()
      }
    },
    [game, gameStatus, thinking, selectedSquare, legalMoveSquares, clearSelection, selectSquare, addMove, notifyState, makeOpponentMove, checkGameEnd]
  )

  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      if (gameStatus !== 'playing' || thinking || game.turn() !== 'w') return false
      clearSelection()
      const g = new Chess(game.fen())
      let moveResult
      try { moveResult = g.move({ from: sourceSquare, to: targetSquare, promotion: 'q' }) } catch { return false }
      if (!moveResult) return false
      addMove(moveResult.san)
      setGame(new Chess(g.fen()))
      notifyState(g, `${sourceSquare}${targetSquare}`)
      if (!g.isGameOver()) void makeOpponentMove(g); else checkGameEnd(g)
      return true
    },
    [game, gameStatus, thinking, clearSelection, notifyState, makeOpponentMove, checkGameEnd, addMove]
  )

  // Listen for tool invocations dispatched by the platform (app:toolInvoke custom event)
  useEffect(() => {
    const handler = (event: Event) => {
      const { appId, tool, params } = (event as CustomEvent<{ appId: string; tool: string; params: Record<string, unknown> }>).detail
      if (appId !== 'chess') return
      switch (tool) {
        case 'start_game':
          startGame()
          break
        case 'make_move':
          void makeMove(params['move'] as string)
          break
        case 'get_board_state':
          notifyState(game)
          break
        case 'resign':
          setGameStatus('game_over')
          setResult('You resigned')
          onStateUpdate?.({ action: 'game_over', result: 'resigned', winner: 'black' })
          break
      }
    }
    window.addEventListener('app:toolInvoke', handler)
    return () => window.removeEventListener('app:toolInvoke', handler)
  }, [game, gameStatus, startGame, makeMove, notifyState, onStateUpdate])

  if (gameStatus === 'waiting') {
    const difficulties: Difficulty[] = ['super_dumb', 'easy', 'medium', 'hard']
    return (
      <div className="picker">
        <p className="picker-eyebrow">ChatBridge</p>
        <h2>Play Chess</h2>
        <p className="subtitle">Choose your difficulty</p>
        <div className="difficulty-cards">
          {difficulties.map((d) => (
            <button
              key={d}
              className={`difficulty-card ${difficulty === d ? 'selected' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              <div className="label">{DIFFICULTY_INFO[d].label}</div>
              <div className="desc">{DIFFICULTY_INFO[d].desc}</div>
            </button>
          ))}
        </div>
        <button className="start-btn" onClick={startGame}>Start Game</button>
      </div>
    )
  }

  const movePairs: { num: number; white: string; black?: string }[] = []
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({ num: Math.floor(i / 2) + 1, white: moveHistory[i]!, black: moveHistory[i + 1] })
  }

  const customSquareStyles: Record<string, React.CSSProperties> = {}
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(255, 215, 0, 0.55)' }
    for (const sq of legalMoveSquares) {
      const isCapture = !!game.get(sq)
      customSquareStyles[sq] = isCapture
        ? { boxShadow: 'inset 0 0 0 4px rgba(0,0,0,0.25)', borderRadius: '2px' }
        : { background: 'radial-gradient(circle, rgba(0,0,0,0.18) 30%, transparent 32%)', borderRadius: '50%' }
    }
  }

  return (
    <div className="chess-app">
      <div className="status-bar">
        <span className="turn-indicator">
          <span className={`turn-dot ${game.turn() === 'w' ? 'white' : 'black'} ${thinking ? 'thinking' : ''}`} />
          {thinking ? 'Thinking...' : game.turn() === 'w' ? 'Your turn' : "Opponent's turn"}
        </span>
        <div className="status-right">
          <button className="moves-toggle" onClick={() => setShowMoves((v) => !v)}>
            Moves {showMoves ? '▲' : '▼'}
          </button>
          <span className="difficulty-badge">{DIFFICULTY_INFO[difficulty].label}</span>
        </div>
      </div>

      <div className="game-area">
        <div className="board-wrap" ref={boardContainerRef}>
          <Chessboard
            position={game.fen()}
            onPieceDrop={onPieceDrop}
            onSquareClick={onSquareClick}
            boardWidth={boardSize}
            arePiecesDraggable={gameStatus === 'playing' && !thinking && game.turn() === 'w'}
            customDarkSquareStyle={{ backgroundColor: '#b58863' }}
            customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            customSquareStyles={customSquareStyles}
          />
          {game.inCheck() && !game.isGameOver() && <div className="check-banner">Check!</div>}
          {gameStatus === 'game_over' && result && (
            <div className="game-over-panel">
              <p className="result-text">{result}</p>
              <div className="game-over-actions">
                <button className="btn-primary" onClick={startGame}>New Game</button>
                <button className="btn-secondary" onClick={() => setGameStatus('waiting')}>Close</button>
              </div>
            </div>
          )}
        </div>

        {showMoves && (
          <div className="moves-panel">
            <div className="moves-panel-header">
              <span className="moves-col-num" />
              <span className="moves-col-label">White</span>
              <span className="moves-col-label">Black</span>
            </div>
            <div className="moves-panel-list" ref={moveListRef}>
              <div className="move-list">
                {!movePairs.length && <span className="no-moves">No moves yet</span>}
                {movePairs.map((pair, i) => {
                  const isLastPair = i === movePairs.length - 1
                  const whiteActive = isLastPair && moveHistory.length % 2 === 1
                  const blackActive = isLastPair && moveHistory.length % 2 === 0
                  return (
                    <div className="move-row" key={pair.num}>
                      <span className="move-num">{pair.num}.</span>
                      <span className={`move-cell${whiteActive ? ' move-cell--active' : ''}`}>{pair.white}</span>
                      <span className={`move-cell${blackActive ? ' move-cell--active' : ''}`}>{pair.black ?? ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
