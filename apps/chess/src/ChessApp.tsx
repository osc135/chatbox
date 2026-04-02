import { useState, useCallback, useEffect } from 'react'
import { Chess, Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { useStockfish } from './useStockfish'
import { sendToParent, IncomingMessage } from './postMessage'

type Difficulty = 'easy' | 'medium' | 'hard'
type GameStatus = 'waiting' | 'playing' | 'game_over'

export default function ChessApp() {
  const [game, setGame] = useState(new Chess())
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting')
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const { getBestMove } = useStockfish(difficulty)

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
          resultText = `Checkmate! ${winner === 'white' ? 'White' : 'Black'} wins!`
        } else if (g.isStalemate()) {
          resultText = 'Stalemate - Draw!'
        } else if (g.isDraw()) {
          resultText = 'Draw!'
        }

        setResult(resultText)
        sendToParent({
          type: 'COMPLETION',
          pluginId: 'chess',
          payload: {
            result: getStatus(g),
            winner,
            reason: 'game_over',
          },
        })
      }
    },
    [getStatus],
  )

  const makeStockfishMove = useCallback(
    async (g: Chess, invocationId: string) => {
      setThinking(true)
      const bestMove = await getBestMove(g.fen())
      if (bestMove && !g.isGameOver()) {
        const from = bestMove.slice(0, 2) as Square
        const to = bestMove.slice(2, 4) as Square
        const promotion = bestMove[4] as 'q' | 'r' | 'b' | 'n' | undefined
        g.move({ from, to, promotion: promotion || 'q' })
        setGame(new Chess(g.fen()))
        sendStateUpdate(g, invocationId, bestMove)
        checkGameEnd(g)
      }
      setThinking(false)
    },
    [getBestMove, sendStateUpdate, checkGameEnd],
  )

  const startGame = useCallback(
    (invocationId: string) => {
      const newGame = new Chess()
      setGame(newGame)
      setGameStatus('playing')
      setResult(null)
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
        g.move(move)
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
        await makeStockfishMove(g, invocationId)
      } else {
        checkGameEnd(g)
      }
    },
    [game, gameStatus, sendStateUpdate, makeStockfishMove, checkGameEnd],
  )

  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square): boolean => {
      if (gameStatus !== 'playing' || thinking || game.turn() !== 'w') return false

      const g = new Chess(game.fen())
      try {
        g.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
      } catch {
        return false
      }

      const moveStr = `${sourceSquare}${targetSquare}`
      setGame(new Chess(g.fen()))
      sendStateUpdate(g, 'ui-move', moveStr)

      if (!g.isGameOver()) {
        makeStockfishMove(g, 'ui-move')
      } else {
        checkGameEnd(g)
      }

      return true
    },
    [game, gameStatus, thinking, sendStateUpdate, makeStockfishMove, checkGameEnd],
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
          setResult('You resigned.')
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

  // Difficulty selector before game starts
  if (gameStatus === 'waiting') {
    return (
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ marginBottom: 24, fontSize: 28 }}>Chess</h1>
        <p style={{ marginBottom: 24, color: '#aaa' }}>Select difficulty to start</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: difficulty === d ? '2px solid #7c5cbf' : '2px solid #333',
                background: difficulty === d ? '#7c5cbf' : '#2a2a3e',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                textTransform: 'capitalize',
              }}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          onClick={() => startGame('ui-start')}
          style={{
            padding: '12px 48px',
            borderRadius: 8,
            border: 'none',
            background: '#7c5cbf',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          Start Game
        </button>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: '#aaa' }}>
          {thinking ? '🤔 Thinking...' : game.turn() === 'w' ? 'Your turn (White)' : "Black's turn"}
        </span>
        <span
          style={{
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 4,
            background: '#2a2a3e',
            textTransform: 'capitalize',
          }}
        >
          {difficulty}
        </span>
      </div>

      <Chessboard
        position={game.fen()}
        onPieceDrop={onPieceDrop}
        boardWidth={Math.min(window.innerWidth - 48, 560)}
        arePiecesDraggable={gameStatus === 'playing' && !thinking && game.turn() === 'w'}
        customDarkSquareStyle={{ backgroundColor: '#7c5cbf' }}
        customLightSquareStyle={{ backgroundColor: '#e8dff5' }}
      />

      {game.inCheck() && !game.isGameOver() && (
        <p style={{ marginTop: 8, color: '#ff6b6b', fontWeight: 600 }}>Check!</p>
      )}

      {/* Game over modal overlay */}
      {gameStatus === 'game_over' && result && (
        <div
          style={{
            marginTop: 16,
            padding: 20,
            borderRadius: 12,
            background: '#2a2a3e',
            border: '1px solid #444',
          }}
        >
          <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{result}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => startGame('ui-start')}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: '#7c5cbf',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              New Game
            </button>
            <button
              onClick={() => {
                sendToParent({
                  type: 'COMPLETION',
                  pluginId: 'chess',
                  payload: { result: 'closed', reason: 'game_over' },
                })
                setGameStatus('waiting')
              }}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: '1px solid #555',
                background: 'transparent',
                color: '#ccc',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
