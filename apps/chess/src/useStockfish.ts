import { useEffect, useRef, useCallback } from 'react'

type Difficulty = 'easy' | 'medium' | 'hard'

const SKILL_LEVELS: Record<Difficulty, number> = {
  easy: 3,
  medium: 10,
  hard: 20,
}

const DEPTH: Record<Difficulty, number> = {
  easy: 5,
  medium: 12,
  hard: 20,
}

export function useStockfish(difficulty: Difficulty) {
  const workerRef = useRef<Worker | null>(null)
  const resolveRef = useRef<((move: string) => void) | null>(null)

  useEffect(() => {
    const worker = new Worker('/stockfish.js')
    workerRef.current = worker

    worker.postMessage('uci')
    worker.postMessage(`setoption name Skill Level value ${SKILL_LEVELS[difficulty]}`)

    worker.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : ''
      if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1]
        if (resolveRef.current) {
          resolveRef.current(move)
          resolveRef.current = null
        }
      }
    }

    return () => {
      worker.terminate()
    }
  }, [difficulty])

  const getBestMove = useCallback(
    (fen: string): Promise<string> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve('')
          return
        }
        resolveRef.current = resolve
        workerRef.current.postMessage(`position fen ${fen}`)
        workerRef.current.postMessage(`go depth ${DEPTH[difficulty]}`)
      })
    },
    [difficulty],
  )

  return { getBestMove }
}
