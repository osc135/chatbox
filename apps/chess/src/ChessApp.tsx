import { useState, useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { Chess, Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { sendToParent, IncomingMessage, waitForOpponentUci } from './postMessage'

// --- Wooden chessboard sounds (Web Audio API) ---
function makeCtx() {
  return new AudioContext()
}

// Synthesizes a wooden "thock" from two noise layers: a bright click transient + a resonant body
function woodThock(ctx: AudioContext, t: number, pitch: number, vol: number, decay: number) {
  const bufLen = Math.ceil(ctx.sampleRate * (decay + 0.05))
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

  // Bright click transient (very short burst of high-frequency noise)
  const click = ctx.createBufferSource()
  click.buffer = buf
  const hpf = ctx.createBiquadFilter()
  hpf.type = 'highpass'
  hpf.frequency.setValueAtTime(4500, t)
  const clickEnv = ctx.createGain()
  clickEnv.gain.setValueAtTime(vol * 0.55, t)
  clickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.014)
  click.connect(hpf)
  hpf.connect(clickEnv)
  clickEnv.connect(ctx.destination)
  click.start(t)
  click.stop(t + 0.018)

  // Resonant body (the warm "thock" of wood)
  const body = ctx.createBufferSource()
  body.buffer = buf
  const bpf = ctx.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.setValueAtTime(pitch, t)
  bpf.Q.setValueAtTime(4.5, t)
  const bodyEnv = ctx.createGain()
  bodyEnv.gain.setValueAtTime(vol, t)
  bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + decay)
  body.connect(bpf)
  bpf.connect(bodyEnv)
  bodyEnv.connect(ctx.destination)
  body.start(t)
  body.stop(t + decay + 0.01)
}

function playPlayerMove(isCapture: boolean) {
  const ctx = makeCtx()
  const t = ctx.currentTime
  if (isCapture) {
    woodThock(ctx, t, 520, 0.90, 0.18) // heavier, lower — piece taken off board
  } else {
    woodThock(ctx, t, 700, 0.65, 0.12)
  }
}

function playOpponentMove(isCapture: boolean) {
  const ctx = makeCtx()
  const t = ctx.currentTime
  if (isCapture) {
    woodThock(ctx, t, 480, 0.85, 0.18)
  } else {
    woodThock(ctx, t, 620, 0.55, 0.12) // slightly softer/lower than player
  }
}

function playCheckSound() {
  const ctx = makeCtx()
  const t = ctx.currentTime
  woodThock(ctx, t, 720, 0.65, 0.11)
  woodThock(ctx, t + 0.08, 860, 0.50, 0.10) // double-thock for urgency
}

function playVictory() {
  const ctx = makeCtx()
  const t = ctx.currentTime
  woodThock(ctx, t, 680, 0.65, 0.12)
  woodThock(ctx, t + 0.16, 760, 0.65, 0.12)
  woodThock(ctx, t + 0.30, 880, 0.80, 0.20) // confident final thock
}

function playDefeat() {
  const ctx = makeCtx()
  const t = ctx.currentTime
  woodThock(ctx, t, 490, 0.55, 0.22) // single quiet heavy thock
}

function playDrawSound() {
  const ctx = makeCtx()
  const t = ctx.currentTime
  woodThock(ctx, t, 600, 0.50, 0.14)
  woodThock(ctx, t + 0.20, 600, 0.35, 0.14)
}
// --- End wooden chessboard sounds ---

type Difficulty = 'super_dumb' | 'easy' | 'medium' | 'hard'
type GameStatus = 'waiting' | 'playing' | 'game_over'

const DIFFICULTY_INFO: Record<Difficulty, { label: string; desc: string }> = {
  super_dumb: { label: 'Super dumb', desc: 'Random legal moves (no API)' },
  easy: { label: 'Beginner', desc: 'LLM plays weakly' },
  medium: { label: 'Intermediate', desc: 'LLM club-level' },
  hard: { label: 'Expert', desc: 'LLM strong play' },
}

function randomLegalUci(g: Chess): string {
  const moves = g.moves({ verbose: true })
  if (moves.length === 0) return ''
  const m = moves[Math.floor(Math.random() * moves.length)]!
  let uci = m.from + m.to
  if (m.promotion) uci += m.promotion
  return uci
}

/** Mutates g on success. */
function tryApplyUci(g: Chess, uci: string, addMove: (san: string) => void): boolean {
  if (!uci || uci.length < 4) return false
  const from = uci.slice(0, 2) as Square
  const to = uci.slice(2, 4) as Square
  const promotion = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined
  try {
    const move = g.move({ from, to, promotion: promotion || undefined })
    if (move) {
      addMove(move.san)
      return true
    }
  } catch {
    return false
  }
  return false
}

export default function ChessApp() {
  const [game, setGame] = useState(new Chess())
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting')
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalMoveSquares, setLegalMoveSquares] = useState<Square[]>([])
  const moveListRef = useRef<HTMLDivElement>(null)

  const boardSize = Math.min(window.innerWidth - 200, 420)

  // Sound: play on each new move
  useEffect(() => {
    if (moveHistory.length === 0) return
    const lastSan = moveHistory[moveHistory.length - 1]
    if (!lastSan) return
    if (lastSan.endsWith('#')) return // game-over sound handles checkmate
    const isOpponentMove = moveHistory.length % 2 === 0
    const isCapture = lastSan.includes('x')
    if (lastSan.endsWith('+')) {
      playCheckSound()
    } else if (isOpponentMove) {
      playOpponentMove(isCapture)
    } else {
      playPlayerMove(isCapture)
    }
  }, [moveHistory])

  // Sound: play on game over
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
    },
    [],
  )

  const sendStateUpdate = useCallback(
    (g: Chess, invocationId: string, lastMove?: string) => {
      sendToParent({
        type: 'STATE_UPDATE',
        pluginId: 'chess',
        invocationId,
        payload: {
          fen: g.fen(),
          turn: g.turn() === 'w' ? 'white' : 'black',
          status: getStatus(g),
          lastMove,
        },
      })
    },
    [getStatus],
  )

  const checkGameEnd = useCallback(
    (g: Chess) => {
      if (g.isGameOver()) {
        setGameStatus('game_over')
        let resultText = 'Draw'
        let winner: string | undefined

        if (g.isCheckmate()) {
          winner = g.turn() === 'w' ? 'black' : 'white'
          resultText = winner === 'white' ? 'White wins by checkmate' : 'Black wins by checkmate'
        } else if (g.isStalemate()) {
          resultText = 'Stalemate'
        } else if (g.isDraw()) {
          resultText = 'Draw'
        }

        setResult(resultText)
        sendToParent({
          type: 'COMPLETION',
          pluginId: 'chess',
          payload: { result: getStatus(g), winner, reason: 'game_over' },
        })
      }
    },
    [getStatus],
  )

  const addMove = useCallback((san: string) => {
    setMoveHistory((prev) => [...prev, san])
    setTimeout(() => moveListRef.current?.scrollTo(0, moveListRef.current.scrollHeight), 50)
  }, [])

  const makeOpponentMove = useCallback(
    async (g: Chess, invocationId: string) => {
      if (g.isGameOver()) return

      setThinking(true)
      try {
        let uci: string
        if (difficulty === 'super_dumb') {
          uci = randomLegalUci(g)
        } else {
          uci = await waitForOpponentUci(g.fen(), difficulty)
          if (!uci) {
            uci = randomLegalUci(g)
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
        sendStateUpdate(g, invocationId, appliedUci)
        checkGameEnd(g)
      } finally {
        setThinking(false)
      }
    },
    [difficulty, sendStateUpdate, checkGameEnd, addMove],
  )

  const startGame = useCallback(
    (invocationId: string) => {
      const newGame = new Chess()
      setGame(newGame)
      setGameStatus('playing')
      setResult(null)
      setMoveHistory([])
      setSelectedSquare(null)
      setLegalMoveSquares([])
      sendStateUpdate(newGame, invocationId)
    },
    [sendStateUpdate],
  )

  const makeMove = useCallback(
    async (move: string, invocationId: string) => {
      if (gameStatus !== 'playing') {
        sendToParent({
          type: 'ERROR',
          pluginId: 'chess',
          invocationId,
          payload: { code: 'NO_GAME', message: 'No game in progress. Start a new game first.' },
        })
        return
      }

      const g = new Chess(game.fen())
      try {
        const result = g.move(move)
        if (result) addMove(result.san)
      } catch {
        sendToParent({
          type: 'ERROR',
          pluginId: 'chess',
          invocationId,
          payload: { code: 'INVALID_MOVE', message: `Invalid move: ${move}` },
        })
        return
      }

      setGame(new Chess(g.fen()))
      sendStateUpdate(g, invocationId, move)

      if (!g.isGameOver()) {
        await makeOpponentMove(g, invocationId)
      } else {
        checkGameEnd(g)
      }
    },
    [game, gameStatus, sendStateUpdate, makeOpponentMove, checkGameEnd, addMove],
  )

  const clearSelection = useCallback(() => {
    setSelectedSquare(null)
    setLegalMoveSquares([])
  }, [])

  const selectSquare = useCallback(
    (square: Square) => {
      const moves = game.moves({ verbose: true, square })
      if (moves.length === 0) {
        clearSelection()
        return
      }
      setSelectedSquare(square)
      setLegalMoveSquares(moves.map((m) => m.to as Square))
    },
    [game, clearSelection],
  )

  const onSquareClick = useCallback(
    (square: Square) => {
      if (gameStatus !== 'playing' || thinking || game.turn() !== 'w') return

      // If a piece is already selected and we clicked a legal destination, make the move
      if (selectedSquare && legalMoveSquares.includes(square)) {
        const g = new Chess(game.fen())
        let moveResult
        try {
          moveResult = g.move({ from: selectedSquare, to: square, promotion: 'q' })
        } catch {
          clearSelection()
          return
        }
        clearSelection()
        if (!moveResult) return
        addMove(moveResult.san)
        const moveStr = `${selectedSquare}${square}`
        setGame(new Chess(g.fen()))
        sendStateUpdate(g, 'ui-move', moveStr)
        if (!g.isGameOver()) {
          void makeOpponentMove(g, 'ui-move')
        } else {
          checkGameEnd(g)
        }
        return
      }

      // Select the clicked square if it has a white piece
      const piece = game.get(square)
      if (piece && piece.color === 'w') {
        if (selectedSquare === square) {
          clearSelection()
        } else {
          selectSquare(square)
        }
      } else {
        clearSelection()
      }
    },
    [
      game, gameStatus, thinking, selectedSquare, legalMoveSquares,
      clearSelection, selectSquare, addMove, sendStateUpdate, makeOpponentMove, checkGameEnd,
    ],
  )

  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      if (gameStatus !== 'playing' || thinking || game.turn() !== 'w') return false

      clearSelection()
      const g = new Chess(game.fen())
      let moveResult
      try {
        moveResult = g.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
      } catch {
        return false
      }

      if (moveResult) addMove(moveResult.san)
      const moveStr = `${sourceSquare}${targetSquare}`
      setGame(new Chess(g.fen()))
      sendStateUpdate(g, 'ui-move', moveStr)

      if (!g.isGameOver()) {
        void makeOpponentMove(g, 'ui-move')
      } else {
        checkGameEnd(g)
      }

      return true
    },
    [game, gameStatus, thinking, clearSelection, sendStateUpdate, makeOpponentMove, checkGameEnd, addMove],
  )

  // Listen for postMessage from platform
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as IncomingMessage
      if (data?.type !== 'TOOL_INVOKE') return

      switch (data.tool) {
        case 'start_game':
          startGame(data.invocationId)
          break
        case 'make_move':
          makeMove(data.params.move as string, data.invocationId)
          break
        case 'get_board_state':
          sendToParent({
            type: 'STATE_UPDATE',
            pluginId: 'chess',
            invocationId: data.invocationId,
            payload: {
              fen: game.fen(),
              turn: game.turn() === 'w' ? 'white' : 'black',
              status: getStatus(game),
            },
          })
          break
        case 'resign':
          setGameStatus('game_over')
          setResult('You resigned')
          sendToParent({
            type: 'COMPLETION',
            pluginId: 'chess',
            payload: { result: 'resigned', winner: 'black', reason: 'resigned' },
          })
          break
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [game, gameStatus, startGame, makeMove, getStatus])

  // Difficulty picker
  if (gameStatus === 'waiting') {
    const difficulties: Difficulty[] = ['super_dumb', 'easy', 'medium', 'hard']
    return (
      <div className="picker">
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
        <button className="start-btn" onClick={() => startGame('ui-start')}>
          Start Game
        </button>
      </div>
    )
  }

  // Move history grouped into pairs
  const movePairs: { num: number; white: string; black?: string }[] = []
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moveHistory[i],
      black: moveHistory[i + 1],
    })
  }

  // Square highlight styles for selected piece and its legal moves
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
    <div>
      <div className="status-bar">
        <span className="turn-indicator">
          <span className={`turn-dot ${game.turn() === 'w' ? 'white' : 'black'} ${thinking ? 'thinking' : ''}`} />
          {thinking ? 'Thinking...' : game.turn() === 'w' ? 'Your turn' : "Opponent's turn"}
        </span>
        <span className="difficulty-badge">{DIFFICULTY_INFO[difficulty].label}</span>
      </div>

      <div className="game-container">
        <div className="board-column">
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
        </div>

        <div className="sidebar">
          <div className="move-history" ref={moveListRef}>
            <h4>Moves</h4>
            <div className="move-list">
              {movePairs.length === 0 && (
                <span style={{ fontSize: 12, color: '#555' }}>No moves yet</span>
              )}
              {movePairs.map((pair) => (
                <div className="move-row" key={pair.num}>
                  <span className="move-num">{pair.num}.</span>
                  <span className="move-white">{pair.white}</span>
                  <span className="move-black">{pair.black || ''}</span>
                </div>
              ))}
            </div>
          </div>

          {gameStatus === 'game_over' && result && (
            <div className="game-over-panel">
              <p className="result-text">{result}</p>
              <div className="game-over-actions">
                <button className="btn-primary" onClick={() => startGame('ui-start')}>
                  New Game
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    sendToParent({
                      type: 'COMPLETION',
                      pluginId: 'chess',
                      payload: { result: 'closed', reason: 'game_over' },
                    })
                    setGameStatus('waiting')
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
