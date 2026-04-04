import { useState, useEffect, useRef } from 'react'
import './counting.css'

// ─── Types ────────────────────────────────────────────────────────────────────
type Level = 1 | 2 | 3
type Phase = 'playing' | 'answering' | 'celebrating'

interface CountProblem {
  type: 'count'
  count: number
  emoji: string
  name: string
}
interface HopProblem {
  type: 'add' | 'subtract'
  start: number
  operand: number
  answer: number
}
type Problem = CountProblem | HopProblem

interface GameState {
  level: Level
  problem: Problem
  phase: Phase
  score: { correct: number; total: number }
  celebMsg: string
  attempts: number
  // Level 1
  choices: number[]
  wrongAnswer: number | null
  // Level 2/3
  frogPos: number
  hopsLeft: number
  isHopping: boolean
  passed: number[]
  answerChoices: number[]
  hopWrongAnswer: number | null
}

// ─── Content ──────────────────────────────────────────────────────────────────
const EMOJIS = [
  { emoji: '🍎', name: 'apples' },
  { emoji: '⭐', name: 'stars' },
  { emoji: '🐝', name: 'bees' },
  { emoji: '🦋', name: 'butterflies' },
  { emoji: '🌸', name: 'flowers' },
  { emoji: '🐟', name: 'fish' },
  { emoji: '🍪', name: 'cookies' },
  { emoji: '🎈', name: 'balloons' },
  { emoji: '🌻', name: 'sunflowers' },
  { emoji: '🍓', name: 'strawberries' },
] as const

const CHEERS = [
  'Amazing! 🌟', 'You did it! 🎉', 'Super work! ⭐',
  'Wonderful! 💫', 'Brilliant! 🏆', 'Perfect! 🎊', 'Way to go! 🌈',
]
const CONFETTI_SHAPES = ['⭐', '🌟', '✨', '💫', '🎊', '🎉', '🌈', '🍬', '🎈']

// ─── Audio ────────────────────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  if (_audioCtx.state === 'suspended') void _audioCtx.resume()
  return _audioCtx
}

function playCorrect() {
  const ctx = getAudioCtx()
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'triangle'
    osc.frequency.value = freq
    const t = ctx.currentTime + i * 0.11
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.28, t + 0.04)
    gain.gain.linearRampToValueAtTime(0, t + 0.22)
    osc.start(t)
    osc.stop(t + 0.25)
  })
}

function playWrong() {
  const ctx = getAudioCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(340, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(210, ctx.currentTime + 0.28)
  gain.gain.setValueAtTime(0.22, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.32)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.35)
}

function playRibbit() {
  const ctx = getAudioCtx()
  // "rib-bit" — two sawtooth pulses shaped like a frog's call
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sawtooth'
  // First pulse: "rib"
  osc.frequency.setValueAtTime(480, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(640, ctx.currentTime + 0.07)
  // Second pulse: "bit"
  osc.frequency.setValueAtTime(440, ctx.currentTime + 0.13)
  osc.frequency.linearRampToValueAtTime(580, ctx.currentTime + 0.2)
  // Amplitude envelope: silence gap between the two pulses
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01)
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.07)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)
  gain.gain.setValueAtTime(0, ctx.currentTime + 0.13)
  gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.14)
  gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.2)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.23)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.26)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ri(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i]!, a[j]!] = [a[j]!, a[i]!]
  }
  return a
}

function makeChoices(answer: number): number[] {
  const set = new Set<number>([answer])
  for (const delta of [-1, 1, -2, 2, 3, -3, 4, -4]) {
    const c = answer + delta
    if (c >= 1 && c <= 12) set.add(c)
    if (set.size === 4) break
  }
  for (let i = 1; set.size < 4; i++) set.add(i)
  return shuffle([...set].slice(0, 4))
}

// For hop answers: range 0–10 (subtraction can land on 0)
function makeHopChoices(answer: number): number[] {
  const set = new Set<number>([answer])
  for (const delta of [-1, 1, -2, 2, 3, -3]) {
    const c = answer + delta
    if (c >= 0 && c <= 10) set.add(c)
    if (set.size === 4) break
  }
  for (let i = 0; set.size < 4; i++) set.add(i)
  return shuffle([...set].slice(0, 4))
}

function makeProblem(level: Level): Problem {
  if (level === 1) {
    const e = pick(EMOJIS)
    return { type: 'count', count: ri(1, 10), emoji: e.emoji, name: e.name }
  }
  if (level === 2) {
    const start = ri(0, 5)
    const operand = ri(1, 10 - start)
    return { type: 'add', start, operand, answer: start + operand }
  }
  const operand = ri(1, 5)
  const start = ri(operand, Math.min(operand + 5, 10))
  return { type: 'subtract', start, operand, answer: start - operand }
}

function getProblemText(p: Problem): string {
  if (p.type === 'count') return `Count ${p.count} ${p.name}`
  return p.type === 'add' ? `${p.start} + ${p.operand} = ?` : `${p.start} - ${p.operand} = ?`
}

function buildState(level: Level): GameState {
  const p = makeProblem(level)
  return {
    level,
    problem: p,
    phase: 'playing',
    score: { correct: 0, total: 0 },
    celebMsg: '',
    attempts: 0,
    choices: p.type === 'count' ? makeChoices(p.count) : [],
    wrongAnswer: null,
    frogPos: p.type !== 'count' ? p.start : 0,
    hopsLeft: p.type !== 'count' ? p.operand : 0,
    isHopping: false,
    passed: p.type !== 'count' ? [p.start] : [],
    answerChoices: [],
    hopWrongAnswer: null,
  }
}

function freshProblem(gs: GameState): GameState {
  const p = makeProblem(gs.level)
  return {
    ...gs,
    problem: p,
    phase: 'playing',
    celebMsg: '',
    attempts: 0,
    choices: p.type === 'count' ? makeChoices(p.count) : [],
    wrongAnswer: null,
    frogPos: p.type !== 'count' ? p.start : 0,
    hopsLeft: p.type !== 'count' ? p.operand : 0,
    isHopping: false,
    passed: p.type !== 'count' ? [p.start] : [],
    answerChoices: [],
    hopWrongAnswer: null,
  }
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    dx: ri(-200, 200),
    dy: ri(-240, -20),
    shape: pick(CONFETTI_SHAPES),
    delay: +(i * 0.05).toFixed(2),
    size: ri(16, 30),
  }))
  return (
    <div className="cnt-confetti" aria-hidden="true">
      {pieces.map(c => (
        <span
          key={c.id}
          className="cnt-confetti-piece"
          style={{
            '--cnt-dx': `${c.dx}px`,
            '--cnt-dy': `${c.dy}px`,
            animationDelay: `${c.delay}s`,
            fontSize: `${c.size}px`,
          } as React.CSSProperties}
        >
          {c.shape}
        </span>
      ))}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface CountingAppProps {
  initialLevel?: 1 | 2 | 3
  onStateUpdate?: (state: Record<string, unknown>) => void
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function CountingApp({ initialLevel = 1, onStateUpdate }: CountingAppProps) {
  const [gs, setGs] = useState<GameState>(() => buildState(initialLevel))
  const onStateUpdateRef = useRef(onStateUpdate)
  useEffect(() => { onStateUpdateRef.current = onStateUpdate }, [onStateUpdate])

  function notify(g: GameState, studentAnswer: number | null, correct: boolean | null) {
    if (!onStateUpdateRef.current) return
    const { problem, level, score, attempts } = g
    onStateUpdateRef.current({
      level,
      problemType: problem.type,
      problemText: getProblemText(problem),
      answer: problem.type === 'count' ? problem.count : problem.answer,
      studentAnswer,
      correct,
      attempts,
      score,
    })
  }

  useEffect(() => {
    notify(gs, null, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ appId: string; tool: string; params: Record<string, unknown> }>).detail
      if (detail.appId !== 'counting') return
      if (detail.tool === 'set_level') {
        const l = detail.params.level as number
        if (l === 1 || l === 2 || l === 3) {
          const newGs = buildState(l as Level)
          setGs(newGs)
          notify(newGs, null, null)
        }
      }
    }
    window.addEventListener('app:toolInvoke', handler)
    return () => window.removeEventListener('app:toolInvoke', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  function changeLevel(l: Level) {
    const newGs = buildState(l)
    setGs(newGs)
    notify(newGs, null, null)
  }

  function nextProblem() {
    setGs(prev => {
      const newGs = freshProblem(prev)
      notify(newGs, null, null)
      return newGs
    })
  }

  // Level 1: student picks one of 4 number choices
  function handleChoice(n: number) {
    if (gs.phase !== 'playing' || gs.problem.type !== 'count' || gs.wrongAnswer !== null) return
    const correct = gs.problem.count

    if (n === correct) {
      playCorrect()
      setTimeout(() => {
        setGs(prev => {
          const newScore = { correct: prev.score.correct + 1, total: prev.score.total + 1 }
          const newGs = { ...prev, phase: 'celebrating' as Phase, score: newScore, celebMsg: pick(CHEERS) }
          notify(newGs, n, true)
          return newGs
        })
      }, 120)
    } else {
      playWrong()
      const newAttempts = gs.attempts + 1
      setGs(prev => ({ ...prev, wrongAnswer: n, attempts: newAttempts }))
      notify({ ...gs, attempts: newAttempts }, n, false)
      setTimeout(() => {
        setGs(prev => ({ ...prev, wrongAnswer: null }))
      }, 800)
    }
  }

  // Level 2/3: hop the frog one step
  function handleHop() {
    if (gs.phase !== 'playing' || gs.problem.type === 'count' || gs.isHopping || gs.hopsLeft <= 0) return
    const dir = gs.problem.type === 'add' ? 1 : -1
    const newPos = gs.frogPos + dir
    const newHops = gs.hopsLeft - 1
    const willFinish = newHops === 0
    playRibbit()
    setGs(prev => ({ ...prev, isHopping: true }))
    setTimeout(() => {
      setGs(prev => ({
        ...prev,
        frogPos: newPos,
        hopsLeft: newHops,
        isHopping: false,
        passed: [...prev.passed, newPos],
      }))
      if (willFinish) {
        // Transition to answering phase — student must pick the landing number
        setTimeout(() => {
          setGs(prev => {
            const answer = prev.problem.type !== 'count' ? prev.problem.answer : 0
            return { ...prev, phase: 'answering', answerChoices: makeHopChoices(answer), hopWrongAnswer: null }
          })
        }, 300)
      }
    }, 400)
  }

  // Level 2/3: student picks the answer after all hops done
  function handleHopAnswer(n: number) {
    if (gs.phase !== 'answering' || gs.problem.type === 'count' || gs.hopWrongAnswer !== null) return
    const correct = gs.problem.answer

    if (n === correct) {
      playCorrect()
      setTimeout(() => {
        setGs(prev => {
          const newScore = { correct: prev.score.correct + 1, total: prev.score.total + 1 }
          const newGs = { ...prev, phase: 'celebrating' as Phase, score: newScore, celebMsg: pick(CHEERS), hopWrongAnswer: null }
          notify(newGs, n, true)
          return newGs
        })
      }, 120)
    } else {
      playWrong()
      const newAttempts = gs.attempts + 1
      setGs(prev => ({ ...prev, hopWrongAnswer: n, attempts: newAttempts }))
      notify({ ...gs, attempts: newAttempts }, n, false)
      setTimeout(() => {
        setGs(prev => ({ ...prev, hopWrongAnswer: null }))
      }, 800)
    }
  }

  const { problem, phase, score, celebMsg, choices, wrongAnswer, frogPos, hopsLeft, isHopping, passed, level, answerChoices, hopWrongAnswer } = gs
  const hopsDone = problem.type !== 'count' ? problem.operand - hopsLeft : 0

  return (
    <div className="cnt-app">
      <div className="cnt-sky-decor" aria-hidden="true">
        <div className="cnt-cloud cnt-c1" /><div className="cnt-cloud cnt-c2" /><div className="cnt-cloud cnt-c3" />
        <div className="cnt-sun" />
      </div>

      <div className="cnt-card">
        {/* Header */}
        <div className="cnt-header">
          <div className="cnt-tabs">
            {([1, 2, 3] as Level[]).map(l => (
              <button key={l} className={`cnt-tab ${level === l ? 'active' : ''}`} onClick={() => changeLevel(l)}>
                {l === 1 ? '🔢 Count' : l === 2 ? '➕ Add' : '➖ Take Away'}
              </button>
            ))}
          </div>
          <div className="cnt-score">⭐ {score.correct}/{score.total}</div>
        </div>

        {/* Question */}
        <p className="cnt-question">
          {problem.type === 'count' && <>How many <em>{problem.name}</em> do you see?</>}
          {problem.type === 'add' && (phase === 'answering'
            ? <>Where did <em>🐸</em> land?</>
            : <>🐸 is at <em>{problem.start}</em>. Hop <em>{problem.operand}</em>&nbsp;time{problem.operand !== 1 ? 's' : ''} forward!</>
          )}
          {problem.type === 'subtract' && (phase === 'answering'
            ? <>Where did <em>🐸</em> land?</>
            : <>🐸 is at <em>{problem.start}</em>. Hop back <em>{problem.operand}</em>&nbsp;time{problem.operand !== 1 ? 's' : ''}!</>
          )}
        </p>

        {/* ── Level 1: display objects + 4 answer choices ── */}
        {problem.type === 'count' && (
          <div className="cnt-objects-area">
            <div className="cnt-objects-grid">
              {Array.from({ length: problem.count }, (_, i) => (
                <div key={i} className="cnt-obj-display">
                  <span className="cnt-obj-emoji">{problem.emoji}</span>
                </div>
              ))}
            </div>

            <div className={`cnt-try-again ${wrongAnswer !== null ? 'visible' : ''}`}>
              Oops! Try again! 🤔
            </div>

            {phase === 'playing' && (
              <div className="cnt-choices">
                {choices.map(n => (
                  <button
                    key={n}
                    className={`cnt-choice-btn ${wrongAnswer === n ? 'wrong' : ''}`}
                    onClick={() => handleChoice(n)}
                    disabled={wrongAnswer !== null}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Level 2/3: number line ── */}
        {(problem.type === 'add' || problem.type === 'subtract') && (
          <div className="cnt-nl-area">
            <div className="cnt-nl-row">
              {Array.from({ length: 11 }, (_, i) => (
                <div key={i} className="cnt-nl-cell">
                  <div className="cnt-nl-frog-slot">
                    {i === frogPos && <span className={`cnt-frog ${isHopping ? 'hopping' : ''}`}>🐸</span>}
                  </div>
                  <div className={['cnt-nl-dot', passed.includes(i) ? 'passed' : '', i === frogPos ? 'current' : ''].filter(Boolean).join(' ')} />
                  <span className="cnt-nl-num">{i}</span>
                </div>
              ))}
            </div>

            <div className="cnt-hop-progress">
              {Array.from({ length: problem.operand }, (_, i) => (
                <div key={i} className={`cnt-hp-dot ${i < hopsDone ? 'done' : ''}`} />
              ))}
            </div>

            {/* Hopping phase: show hops remaining + HOP button */}
            {phase === 'playing' && (
              <>
                <p className="cnt-hops-msg">
                  {hopsLeft > 0
                    ? <>{hopsLeft} hop{hopsLeft !== 1 ? 's' : ''} to go!</>
                    : <>All done hopping! 🎯</>
                  }
                </p>
                {hopsLeft > 0 && (
                  <button className="cnt-hop-btn" onClick={handleHop} disabled={isHopping}>
                    {problem.type === 'add' ? 'HOP! →' : '← HOP!'}
                  </button>
                )}
              </>
            )}

            {/* Answering phase: student picks the landing number */}
            {phase === 'answering' && (
              <>
                <div className={`cnt-try-again ${hopWrongAnswer !== null ? 'visible' : ''}`}>
                  Oops! Try again! 🤔
                </div>
                <div className="cnt-choices">
                  {answerChoices.map(n => (
                    <button
                      key={n}
                      className={`cnt-choice-btn ${hopWrongAnswer === n ? 'wrong' : ''}`}
                      onClick={() => handleHopAnswer(n)}
                      disabled={hopWrongAnswer !== null}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Celebration overlay */}
        {phase === 'celebrating' && (
          <div className="cnt-celeb-overlay">
            <Confetti />
            <div className="cnt-celeb-box">
              <div className="cnt-celeb-msg">{celebMsg}</div>
              <div className="cnt-celeb-answer">
                {problem.type === 'count'
                  ? <>{problem.count} {problem.emoji}!</>
                  : <>{problem.type === 'add' ? `${problem.start} + ${problem.operand}` : `${problem.start} − ${problem.operand}`} = <strong>{problem.answer}</strong>!</>
                }
              </div>
              <button className="cnt-next-btn" onClick={nextProblem}>Next ➡️</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
