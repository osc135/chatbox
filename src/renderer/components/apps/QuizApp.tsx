import { useState } from 'react'

// ── Question bank ─────────────────────────────────────────────────────────────

interface Question {
  q: string
  options: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  topic: string
}

const QUESTIONS: Question[] = [
  // Math
  { topic: 'math', q: 'What is 7 × 8?', options: ['54', '56', '48', '63'], answer: 1 },
  { topic: 'math', q: 'What is π (pi) to two decimal places?', options: ['3.12', '3.16', '3.14', '3.41'], answer: 2 },
  { topic: 'math', q: 'What is the square root of 144?', options: ['10', '11', '13', '12'], answer: 3 },
  { topic: 'math', q: 'What is 15% of 200?', options: ['25', '30', '35', '20'], answer: 1 },
  { topic: 'math', q: 'Which of these is a prime number?', options: ['21', '27', '29', '33'], answer: 2 },
  { topic: 'math', q: 'What is 2³?', options: ['6', '9', '8', '16'], answer: 2 },
  { topic: 'math', q: 'A rectangle is 9 cm wide and 4 cm tall. What is its area?', options: ['26 cm²', '36 cm²', '13 cm²', '32 cm²'], answer: 1 },
  { topic: 'math', q: 'What is 3/4 as a decimal?', options: ['0.34', '0.43', '0.70', '0.75'], answer: 3 },
  // Science
  { topic: 'science', q: 'What is the chemical symbol for water?', options: ['WA', 'H₂O', 'O₂H', 'HO'], answer: 1 },
  { topic: 'science', q: 'What force keeps planets in orbit around the Sun?', options: ['Magnetism', 'Friction', 'Gravity', 'Electricity'], answer: 2 },
  { topic: 'science', q: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Vacuole', 'Mitochondria'], answer: 3 },
  { topic: 'science', q: 'Which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], answer: 2 },
  { topic: 'science', q: 'What type of animal is a dolphin?', options: ['Fish', 'Reptile', 'Amphibian', 'Mammal'], answer: 3 },
  { topic: 'science', q: 'What gas do plants absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], answer: 2 },
  { topic: 'science', q: 'How many bones are in the adult human body?', options: ['186', '206', '216', '196'], answer: 1 },
  { topic: 'science', q: 'What is the approximate speed of light?', options: ['300,000 km/s', '150,000 km/s', '30,000 km/s', '3,000,000 km/s'], answer: 0 },
  // History
  { topic: 'history', q: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], answer: 2 },
  { topic: 'history', q: 'Who was the first President of the United States?', options: ['John Adams', 'Benjamin Franklin', 'Thomas Jefferson', 'George Washington'], answer: 3 },
  { topic: 'history', q: 'Which ancient wonder was located in Alexandria, Egypt?', options: ['Colossus of Rhodes', 'Hanging Gardens', 'The Lighthouse', 'Statue of Zeus'], answer: 2 },
  { topic: 'history', q: 'The Civil Rights Act was signed in which year?', options: ['1960', '1962', '1964', '1968'], answer: 2 },
  { topic: 'history', q: 'Which empire built the Colosseum?', options: ['Greek', 'Ottoman', 'Roman', 'Byzantine'], answer: 2 },
  { topic: 'history', q: 'Who wrote the Declaration of Independence?', options: ['James Madison', 'John Hancock', 'Benjamin Franklin', 'Thomas Jefferson'], answer: 3 },
  { topic: 'history', q: 'The Berlin Wall fell in which year?', options: ['1987', '1989', '1991', '1993'], answer: 1 },
  { topic: 'history', q: 'Which country was first to give women the right to vote?', options: ['United States', 'United Kingdom', 'New Zealand', 'Australia'], answer: 2 },
  // Geography
  { topic: 'geography', q: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Brisbane', 'Canberra'], answer: 3 },
  { topic: 'geography', q: 'Which is the longest river in the world?', options: ['Amazon', 'Mississippi', 'Nile', 'Yangtze'], answer: 2 },
  { topic: 'geography', q: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], answer: 2 },
  { topic: 'geography', q: 'Which country has the largest population?', options: ['United States', 'India', 'Russia', 'China'], answer: 1 },
  { topic: 'geography', q: 'What is the smallest country in the world?', options: ['Monaco', 'San Marino', 'Vatican City', 'Liechtenstein'], answer: 2 },
  { topic: 'geography', q: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  { topic: 'geography', q: 'Mount Everest is in which mountain range?', options: ['Andes', 'Alps', 'Himalayas', 'Rockies'], answer: 2 },
  { topic: 'geography', q: 'What is the capital of Canada?', options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], answer: 2 },
  // ELA
  { topic: 'ela', q: 'What is a synonym for "happy"?', options: ['Sad', 'Joyful', 'Angry', 'Tired'], answer: 1 },
  { topic: 'ela', q: 'Which of the following is a noun?', options: ['Run', 'Quickly', 'Beautiful', 'Friendship'], answer: 3 },
  { topic: 'ela', q: '"The wind whispered through the trees" is an example of:', options: ['Simile', 'Metaphor', 'Alliteration', 'Personification'], answer: 3 },
  { topic: 'ela', q: 'Who wrote "Romeo and Juliet"?', options: ['Charles Dickens', 'Mark Twain', 'William Shakespeare', 'Jane Austen'], answer: 2 },
  { topic: 'ela', q: 'What is the antonym of "ancient"?', options: ['Old', 'Historic', 'Modern', 'Classic'], answer: 2 },
  { topic: 'ela', q: 'Which sentence uses correct punctuation?', options: ["Its raining today.", "It's raining today.", "Its' raining today.", "Its raining, today."], answer: 1 },
  { topic: 'ela', q: 'The main idea of a text is also called its:', options: ['Theme', 'Plot', 'Setting', 'Character'], answer: 0 },
  { topic: 'ela', q: 'In "She ran quickly", what part of speech is "quickly"?', options: ['Adjective', 'Noun', 'Verb', 'Adverb'], answer: 3 },
]

const TOPIC_LABELS: Record<string, string> = {
  math: 'Math', science: 'Science', history: 'History',
  geography: 'Geography', ela: 'English Language Arts', all: 'Mixed Topics',
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickQuestions(topic: string, count: number): Question[] {
  const pool = topic === 'all' ? QUESTIONS : QUESTIONS.filter(q => q.topic === topic)
  return shuffle(pool).slice(0, Math.min(count, pool.length))
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuizAppProps {
  topic?: string
  count?: number
  onStateUpdate?: (state: Record<string, unknown>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuizApp({ topic = 'all', count = 5, onStateUpdate }: QuizAppProps) {
  const [questions] = useState<Question[]>(() => pickQuestions(topic, count))
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const q = questions[current]
  const topicLabel = TOPIC_LABELS[topic] ?? topic

  if (!q && !done) return null

  function handleSelect(idx: number) {
    if (selected !== null || !q) return
    setSelected(idx)
    const correct = idx === q.answer
    const newScore = correct ? score + 1 : score
    if (correct) setScore(newScore)
    onStateUpdate?.({
      question: current + 1,
      total: questions.length,
      score: newScore,
      topic,
      correct,
      answer: q.options[q.answer],
    })
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      const passed = score / questions.length >= 0.7
      onStateUpdate?.({ score, total: questions.length, topic, passed, done: true })
      setDone(true)
    } else {
      setCurrent(c => c + 1)
      setSelected(null)
    }
  }

  // ── Shared token palette ──────────────────────────────────────────────────
  const accent = '#6c8fff'
  const correct = '#2ecc71'
  const wrong = '#e74c3c'
  const border = '#2a2d3d'
  const muted = '#8892a4'
  const textMain = '#e8eaf0'

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    const pct = Math.round((score / questions.length) * 100)
    const passed = score / questions.length >= 0.7
    return (
      <div style={{ padding: '20px 16px', textAlign: 'center', color: textMain, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 700,
          border: `3px solid ${passed ? correct : wrong}`,
          color: passed ? correct : wrong,
        }}>
          {pct}%
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          {passed ? 'Great job!' : 'Keep practicing!'}
        </div>
        <div style={{ fontSize: 13, color: muted }}>
          {score} / {questions.length} correct on {topicLabel}
        </div>
      </div>
    )
  }

  const progress = current / questions.length

  // ── Question screen ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px', color: textMain, fontFamily: 'system-ui, sans-serif' }}>
      {/* Topic + progress */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          display: 'inline-block', background: accent + '22', color: accent,
          borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600, marginBottom: 8,
        }}>
          {topicLabel}
        </div>
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
              bg = correct + '18'; borderColor = correct; letterBg = correct; letterColor = '#fff'
            } else if (i === selected) {
              bg = wrong + '18'; borderColor = wrong; letterBg = wrong; letterColor = '#fff'
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
                color: textMain, fontSize: 14, textAlign: 'left', cursor: selected !== null ? 'default' : 'pointer',
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

      {/* Feedback + next */}
      {selected !== null && (
        <>
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 7, fontSize: 13, fontWeight: 500,
            background: selected === q.answer ? correct + '18' : wrong + '18',
            color: selected === q.answer ? correct : wrong,
          }}>
            {selected === q.answer ? 'Correct!' : `Incorrect — the answer is: ${q.options[q.answer]}`}
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
