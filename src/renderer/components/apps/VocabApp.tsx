import { useState, useEffect, useRef } from 'react'
import './vocab.css'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VocabCard {
  word: string
  definition: string
  example: string
  hint?: string
}

interface QuizQuestion {
  word: string
  correctDef: string
  choices: string[]
  selected: string | null
  correct: boolean | null
}

type Phase = 'front' | 'flipped' | 'celebrating' | 'quiz' | 'quiz_result' | 'done'

interface AppState {
  deck: VocabCard[]
  mastered: VocabCard[]
  current: number
  phase: Phase
  celebMsg: string
  celebWord: string
  isLastCard: boolean
  quizQuestions: QuizQuestion[]
  quizIndex: number
  quizScore: { correct: number; total: number }
}

// ─── Content ──────────────────────────────────────────────────────────────────
const CHEERS = ['Nice!', 'Got it!', 'Yes!', 'Locked in.', 'Nailed it.', 'That\'s the one.', 'On fire.']
const CONFETTI = ['★', '✦', '◆', '▲', '●', '✸', '✺']

// ─── Audio ────────────────────────────────────────────────────────────────────
let _ctx: AudioContext | null = null
const audio = () => {
  if (!_ctx) _ctx = new AudioContext()
  if (_ctx.state === 'suspended') void _ctx.resume()
  return _ctx
}

function playCorrect() {
  const ctx = audio()
  ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'triangle'; o.frequency.value = freq
    const t = ctx.currentTime + i * 0.1
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.04)
    g.gain.linearRampToValueAtTime(0, t + 0.2)
    o.start(t); o.stop(t + 0.22)
  })
}

function playWrong() {
  const ctx = audio()
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'sine'
  o.frequency.setValueAtTime(320, ctx.currentTime)
  o.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.25)
  g.gain.setValueAtTime(0.15, ctx.currentTime)
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
  o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3)
}

function playFlip() {
  const ctx = audio()
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'sine'
  o.frequency.setValueAtTime(700, ctx.currentTime)
  o.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.08)
  g.gain.setValueAtTime(0.07, ctx.currentTime)
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)
  o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1)
}

function playStudyMore() {
  const ctx = audio()
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'sine'
  o.frequency.setValueAtTime(460, ctx.currentTime)
  o.frequency.linearRampToValueAtTime(340, ctx.currentTime + 0.2)
  g.gain.setValueAtTime(0.1, ctx.currentTime)
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.24)
  o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.24)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]!

function blankWord(text: string, word: string): React.ReactNode {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length === 1) return text // word not found in text
  return parts.map((part, i) =>
    part.toLowerCase() === word.toLowerCase()
      ? <span key={i} className="vcb-blank" aria-label="blank" />
      : part
  )
}
const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i]!, a[j]!] = [a[j]!, a[i]!]
  }
  return a
}

function makeQuiz(mastered: VocabCard[]): QuizQuestion[] {
  const allDefs = mastered.map(c => c.definition)
  return shuffle([...mastered]).map(card => ({
    word: card.word,
    correctDef: card.definition,
    choices: shuffle([card.definition, ...shuffle(allDefs.filter(d => d !== card.definition)).slice(0, 3)]),
    selected: null,
    correct: null,
  }))
}

function grade(correct: number, total: number) {
  const p = total > 0 ? correct / total : 0
  if (p === 1)  return { label: 'Perfect',   sub: 'Flawless run.',        stars: 3 }
  if (p >= 0.8) return { label: 'Strong',    sub: 'Nearly there.',        stars: 2 }
  if (p >= 0.6) return { label: 'Decent',    sub: 'Room to grow.',        stars: 1 }
  return              { label: 'Keep at it', sub: 'Review and retry.',    stars: 0 }
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Burst() {
  const pieces = Array.from({ length: 20 }, (_, i) => ({
    id: i, dx: ri(-180, 180), dy: ri(-200, -30),
    shape: pick(CONFETTI), delay: +(i * 0.05).toFixed(2), size: ri(12, 22),
    color: pick(['#c9963a','#e8b84b','#3ecf8e','#8b7cf8','#f87171','#60a5fa']),
  }))
  return (
    <div className="vcb-burst" aria-hidden>
      {pieces.map(p => (
        <span key={p.id} className="vcb-burst-piece"
          style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${p.delay}s`,
            fontSize: p.size, color: p.color } as React.CSSProperties}>{p.shape}</span>
      ))}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface VocabAppProps {
  initialCards?: VocabCard[]
  topic?: string
  onStateUpdate?: (state: Record<string, unknown>) => void
}

const QUIZ_LABELS = ['A', 'B', 'C', 'D']

// ─── App ──────────────────────────────────────────────────────────────────────
export default function VocabApp({ initialCards = [], topic, onStateUpdate }: VocabAppProps) {
  const [s, setS] = useState<AppState>(() => ({
    deck: shuffle([...initialCards]),
    mastered: [], current: 0,
    phase: initialCards.length > 0 ? 'front' : 'done',
    celebMsg: '', celebWord: '', isLastCard: false,
    quizQuestions: [], quizIndex: 0, quizScore: { correct: 0, total: 0 },
  }))

  const cbRef = useRef(onStateUpdate)
  useEffect(() => { cbRef.current = onStateUpdate }, [onStateUpdate])

  function emit(state: AppState, action: string, extra?: Record<string, unknown>) {
    cbRef.current?.({
      action, topic: topic ?? null,
      word: state.deck[state.current]?.word ?? null,
      mastered: state.mastered.map(c => c.word),
      remaining: Math.max(0, state.deck.length - state.current),
      total: state.mastered.length + state.deck.length,
      ...extra,
    })
  }

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ appId: string; tool: string; params: Record<string, unknown> }>).detail
      if (d.appId !== 'vocab' || d.tool !== 'add_words') return
      const cards = d.params.words as VocabCard[]
      if (!Array.isArray(cards) || !cards.length) return
      setS(p => ({ ...p, deck: [...p.deck, ...shuffle(cards)],
        phase: p.phase === 'done' || p.phase === 'quiz_result' ? 'front' : p.phase }))
    }
    window.addEventListener('app:toolInvoke', h)
    return () => window.removeEventListener('app:toolInvoke', h)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const card = s.deck[s.current]
  const total = s.mastered.length + s.deck.length
  const pct = total > 0 ? (s.mastered.length / total) * 100 : 0
  const q = s.quizQuestions[s.quizIndex]
  const inQuiz = s.phase === 'quiz' || s.phase === 'quiz_result'

  // ── Flashcard handlers ─────────────────────────────────────────────────────
  function flip() {
    if (s.phase !== 'front') return
    playFlip()
    const next = { ...s, phase: 'flipped' as Phase }
    setS(next); emit(next, 'flipped')
  }

  function gotIt() {
    if (s.phase !== 'flipped' || !card) return
    playCorrect()
    const mc = card
    const newDeck = s.deck.filter((_, i) => i !== s.current)
    const newMastered = [...s.mastered, mc]
    const isLast = newDeck.length === 0
    const msg = pick(CHEERS)
    setTimeout(() => {
      const next: AppState = { ...s, deck: newDeck, mastered: newMastered, current: 0,
        phase: 'celebrating', celebMsg: msg, celebWord: mc.word, isLastCard: isLast }
      setS(next); emit(next, 'got_it')
    }, 80)
  }

  function studyMore() {
    if (s.phase !== 'flipped' || !card) return
    playStudyMore()
    const rest = s.deck.filter((_, i) => i !== s.current)
    const newDeck = [...rest, card]
    const nextIdx = s.current < rest.length ? s.current : 0
    const next: AppState = { ...s, deck: newDeck, current: nextIdx,
      phase: 'front', celebMsg: '', celebWord: '', isLastCard: false }
    setS(next); emit(next, 'study_more')
  }

  function next() {
    if (s.isLastCard && s.mastered.length >= 2) {
      setS(p => ({ ...p, phase: 'quiz', quizQuestions: makeQuiz(p.mastered),
        quizIndex: 0, quizScore: { correct: 0, total: 0 },
        celebMsg: '', celebWord: '', isLastCard: false }))
    } else {
      setS(p => ({ ...p, phase: 'front', celebMsg: '', celebWord: '', isLastCard: false }))
    }
  }

  // ── Quiz handlers ──────────────────────────────────────────────────────────
  function answer(choice: string) {
    if (!q || q.selected !== null) return
    const ok = choice === q.correctDef
    if (ok) playCorrect(); else playWrong()
    const newQs = s.quizQuestions.map((x, i) =>
      i === s.quizIndex ? { ...x, selected: choice, correct: ok } : x)
    const newScore = { correct: s.quizScore.correct + (ok ? 1 : 0), total: s.quizScore.total + 1 }
    setS(p => ({ ...p, quizQuestions: newQs, quizScore: newScore }))
  }

  function nextQ() {
    const ni = s.quizIndex + 1
    if (ni >= s.quizQuestions.length) {
      const missed = s.quizQuestions.filter(x => !x.correct).map(x => x.word)
      const next: AppState = { ...s, phase: 'quiz_result' }
      setS(next)
      emit(next, 'quiz_complete', { score: s.quizScore, missedWords: missed })
    } else {
      setS(p => ({ ...p, quizIndex: ni }))
    }
  }

  function studyAgain() {
    setS(p => ({ ...p, deck: shuffle([...p.mastered]), mastered: [], current: 0,
      phase: 'front', celebMsg: '', celebWord: '', isLastCard: false,
      quizQuestions: [], quizIndex: 0, quizScore: { correct: 0, total: 0 } }))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const g = grade(s.quizScore.correct, s.quizScore.total)
  const missed = s.quizQuestions.filter(x => x.correct === false)

  return (
    <div className="vcb-app">
      {/* ── Header ── */}
      <header className="vcb-header">
        <span className="vcb-topic">{topic ?? 'Vocabulary'}</span>
        {!inQuiz ? (
          <div className="vcb-prog-wrap">
            <div className="vcb-prog-track"><div className="vcb-prog-fill" style={{ width: `${pct}%` }} /></div>
            <span className="vcb-prog-label">{s.mastered.length}<span className="vcb-prog-sep">/</span>{total}</span>
          </div>
        ) : s.phase === 'quiz' ? (
          <div className="vcb-prog-wrap">
            <span className="vcb-quiz-counter">{s.quizIndex + 1} of {s.quizQuestions.length}</span>
            <div className="vcb-prog-track">
              <div className="vcb-prog-fill vcb-prog-fill--amber"
                style={{ width: `${(s.quizIndex / s.quizQuestions.length) * 100}%` }} />
            </div>
          </div>
        ) : null}
      </header>

      {/* ── Flashcard ── */}
      {(s.phase === 'front' || s.phase === 'flipped' || s.phase === 'celebrating') && (
        <>
          <div className="vcb-stage">
            {card ? (
              <div
                className={`vcb-card${s.phase === 'flipped' ? ' is-flipped' : ''}`}
                onClick={s.phase === 'front' ? flip : undefined}
                role={s.phase === 'front' ? 'button' : undefined}
                tabIndex={s.phase === 'front' ? 0 : undefined}
                onKeyDown={s.phase === 'front' ? e => (e.key === 'Enter' || e.key === ' ') && flip() : undefined}
              >
                <div className="vcb-card-inner">
                  {/* Front — definition with word blanked */}
                  <div className="vcb-face vcb-face-front">
                    <span className="vcb-face-label">Definition</span>
                    <p className="vcb-def-text">{blankWord(card.definition, card.word)}</p>
                    <p className="vcb-ex-text">"{blankWord(card.example, card.word)}"</p>
                    <span className="vcb-cue">tap to reveal</span>
                  </div>
                  {/* Back — word */}
                  <div className="vcb-face vcb-face-back">
                    <span className="vcb-face-label">The word is</span>
                    <p className="vcb-answer-word">{card.word.toUpperCase()}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="vcb-empty-state">
                <span className="vcb-empty-icon">◈</span>
                <span className="vcb-empty-text">Waiting for cards…</span>
              </div>
            )}

            {/* Celebration overlay */}
            {s.phase === 'celebrating' && (
              <div className="vcb-celeb">
                <Burst />
                <div className="vcb-celeb-inner">
                  <span className="vcb-celeb-msg">{s.celebMsg}</span>
                  <span className="vcb-celeb-word">{s.celebWord.toUpperCase()}</span>
                  <button className="vcb-cta-btn" onClick={next}>
                    {s.isLastCard ? 'Start Quiz →' : 'Next →'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {s.phase === 'flipped' && (
            <div className="vcb-actions">
              <button className="vcb-act-btn vcb-act-study" onClick={studyMore}>↩ Study more</button>
              <button className="vcb-act-btn vcb-act-got" onClick={gotIt}>Got it ✓</button>
            </div>
          )}
        </>
      )}

      {/* ── Quiz ── */}
      {s.phase === 'quiz' && q && (
        <div className="vcb-quiz">
          <div className="vcb-quiz-word">{q.word.toUpperCase()}</div>
          <div className="vcb-quiz-prompt">Which definition is correct?</div>
          <div className="vcb-choices">
            {q.choices.map((choice, i) => {
              let mod = ''
              if (q.selected !== null) {
                if (choice === q.correctDef) mod = ' is-correct'
                else if (choice === q.selected) mod = ' is-wrong'
              }
              return (
                <button key={i} className={`vcb-choice${mod}`}
                  onClick={() => answer(choice)} disabled={q.selected !== null}>
                  <span className="vcb-choice-label">{QUIZ_LABELS[i]}</span>
                  <span className="vcb-choice-text">{choice}</span>
                </button>
              )
            })}
          </div>
          {q.selected !== null && (
            <button className="vcb-cta-btn vcb-cta-quiz" onClick={nextQ}>
              {s.quizIndex + 1 < s.quizQuestions.length ? 'Next →' : 'See results →'}
            </button>
          )}
        </div>
      )}

      {/* ── Result ── */}
      {s.phase === 'quiz_result' && (
        <div className="vcb-result">
          <div className="vcb-result-top">
            <span className="vcb-result-score">{s.quizScore.correct}<span className="vcb-result-denom">/{s.quizScore.total}</span></span>
            <span className="vcb-result-label">{g.label}</span>
            <span className="vcb-result-sub">{g.sub}</span>
          </div>
          {missed.length > 0 && (
            <div className="vcb-missed">
              <p className="vcb-missed-heading">Review</p>
              {missed.map((x, i) => (
                <div key={i} className="vcb-missed-row">
                  <span className="vcb-missed-word">{x.word}</span>
                  <span className="vcb-missed-def">{x.correctDef}</span>
                </div>
              ))}
            </div>
          )}
          <button className="vcb-retry-btn" onClick={studyAgain}>↺ Study again</button>
        </div>
      )}

      {/* ── Done (single card edge case) ── */}
      {s.phase === 'done' && (
        <div className="vcb-stage">
          <div className="vcb-empty-state">
            <span className="vcb-empty-icon">◈</span>
            <span className="vcb-empty-text">
              {total === 0 ? 'Waiting for cards…' : `All ${s.mastered.length} words mastered.`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
