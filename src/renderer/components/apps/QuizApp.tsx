import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  q: string
  options: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  explanation?: string
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuizAppProps {
  questions: QuizQuestion[]
  topic?: string
  onStateUpdate?: (state: Record<string, unknown>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuizApp({ questions, topic, onStateUpdate }: QuizAppProps) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<Array<{ question: string; correctAnswer: string; explanation?: string }>>([])
  const [done, setDone] = useState(false)

  const q = questions[current]

  if (!questions.length) {
    return (
      <div style={{ padding: 20, color: '#8892a4', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        No questions loaded.
      </div>
    )
  }

  if (!q && !done) return null

  // ── Palette ───────────────────────────────────────────────────────────────
  const accent = '#6c8fff'
  const correctColor = '#2ecc71'
  const wrongColor = '#e74c3c'
  const border = '#2a2d3d'
  const muted = '#8892a4'
  const textMain = '#e8eaf0'

  function handleSelect(idx: number) {
    if (selected !== null || !q) return
    setSelected(idx)
    const correct = idx === q.answer
    const newScore = correct ? score + 1 : score
    if (correct) {
      setScore(newScore)
    } else {
      setMissed(prev => [...prev, {
        question: q.q,
        correctAnswer: q.options[q.answer],
        explanation: q.explanation,
      }])
    }
    onStateUpdate?.({
      questionIndex: current + 1,
      total: questions.length,
      score: newScore,
      topic,
      correct,
      correctAnswer: q.options[q.answer],
    })
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      const finalScore = score
      const passed = finalScore / questions.length >= 0.7
      onStateUpdate?.({
        score: finalScore,
        total: questions.length,
        topic,
        passed,
        done: true,
        missed,
      })
      setDone(true)
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
    }
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    const pct = Math.round((score / questions.length) * 100)
    const passed = score / questions.length >= 0.7
    return (
      <div style={{ padding: '20px 16px', color: textMain, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700,
            border: `3px solid ${passed ? correctColor : wrongColor}`,
            color: passed ? correctColor : wrongColor,
          }}>
            {pct}%
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            {passed ? 'Great job!' : 'Keep practicing!'}
          </div>
          <div style={{ fontSize: 13, color: muted }}>
            {score} / {questions.length} correct{topic ? ` on ${topic}` : ''}
          </div>
        </div>

        {missed.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Review
            </div>
            {missed.map((m, i) => (
              <div key={i} style={{
                padding: '10px 12px', marginBottom: 8, borderRadius: 8,
                background: wrongColor + '10', border: `1px solid ${wrongColor}30`,
                fontSize: 13, lineHeight: 1.5,
              }}>
                <div style={{ color: muted, marginBottom: 4 }}>{m.question}</div>
                <div style={{ color: correctColor, fontWeight: 600 }}>✓ {m.correctAnswer}</div>
                {m.explanation && (
                  <div style={{ color: muted, fontSize: 12, marginTop: 4 }}>{m.explanation}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const progress = current / questions.length

  // ── Question screen ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px', color: textMain, fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        {topic && (
          <div style={{
            display: 'inline-block', background: accent + '22', color: accent,
            borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600, marginBottom: 8,
          }}>
            {topic}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 3, background: border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: accent, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 12, color: muted }}>{current + 1} / {questions.length}</span>
        </div>
      </div>

      {/* Question */}
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5, marginBottom: 14 }}>{q.q}</div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, i) => {
          let bg = 'transparent'
          let borderColor = border
          let letterBg = border
          let letterColor = muted

          if (selected !== null) {
            if (i === q.answer) {
              bg = correctColor + '18'; borderColor = correctColor; letterBg = correctColor; letterColor = '#fff'
            } else if (i === selected) {
              bg = wrongColor + '18'; borderColor = wrongColor; letterBg = wrongColor; letterColor = '#fff'
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: bg,
                border: `1px solid ${borderColor}`, borderRadius: 8,
                color: textMain, fontSize: 14, textAlign: 'left',
                cursor: selected !== null ? 'default' : 'pointer',
                width: '100%', transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, background: letterBg, color: letterColor,
              }}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          )
        })}
      </div>

      {/* Feedback */}
      {selected !== null && (
        <>
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 7, fontSize: 13, fontWeight: 500,
            background: selected === q.answer ? correctColor + '18' : wrongColor + '18',
            color: selected === q.answer ? correctColor : wrongColor,
          }}>
            {selected === q.answer
              ? 'Correct!'
              : `Incorrect — the answer is: ${q.options[q.answer]}`}
            {selected !== q.answer && q.explanation && (
              <div style={{ marginTop: 4, fontWeight: 400, opacity: 0.85 }}>{q.explanation}</div>
            )}
          </div>
          <button
            onClick={handleNext}
            style={{
              marginTop: 12, width: '100%', padding: '11px 0',
              background: accent, color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {current + 1 >= questions.length ? 'See Results' : 'Next Question'}
          </button>
        </>
      )}
    </div>
  )
}
