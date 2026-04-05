import { useState } from 'react'

// ── postMessage helpers ──────────────────────────────────────────────────────

function sendToParent(type: string, payload: unknown) {
  window.parent.postMessage({ type, pluginId: 'quiz', payload }, '*')
}

// ── Question bank ────────────────────────────────────────────────────────────

interface Question {
  q: string
  options: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  topic: string
}

const QUESTIONS: Question[] = [
  // Math
  { topic: 'math', q: 'What is 7 × 8?', options: ['54', '56', '48', '63'], answer: 1 },
  { topic: 'math', q: 'What is the value of π (pi) to two decimal places?', options: ['3.12', '3.16', '3.14', '3.41'], answer: 2 },
  { topic: 'math', q: 'What is the square root of 144?', options: ['10', '11', '13', '12'], answer: 3 },
  { topic: 'math', q: 'What is 15% of 200?', options: ['25', '30', '35', '20'], answer: 1 },
  { topic: 'math', q: 'Which of these is a prime number?', options: ['21', '27', '29', '33'], answer: 2 },
  { topic: 'math', q: 'What is 2³ (2 to the power of 3)?', options: ['6', '9', '8', '16'], answer: 2 },
  { topic: 'math', q: 'If a rectangle is 9 cm wide and 4 cm tall, what is its area?', options: ['26 cm²', '36 cm²', '13 cm²', '32 cm²'], answer: 1 },
  { topic: 'math', q: 'What is 3/4 expressed as a decimal?', options: ['0.34', '0.43', '0.70', '0.75'], answer: 3 },

  // Science
  { topic: 'science', q: 'What is the chemical symbol for water?', options: ['WA', 'H₂O', 'O₂H', 'HO'], answer: 1 },
  { topic: 'science', q: 'What force keeps planets in orbit around the Sun?', options: ['Magnetism', 'Friction', 'Gravity', 'Electricity'], answer: 2 },
  { topic: 'science', q: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Vacuole', 'Mitochondria'], answer: 3 },
  { topic: 'science', q: 'Which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], answer: 2 },
  { topic: 'science', q: 'What type of animal is a dolphin?', options: ['Fish', 'Reptile', 'Amphibian', 'Mammal'], answer: 3 },
  { topic: 'science', q: 'What gas do plants absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], answer: 2 },
  { topic: 'science', q: 'How many bones are in the adult human body?', options: ['186', '206', '216', '196'], answer: 1 },
  { topic: 'science', q: 'What is the speed of light (approximately)?', options: ['300,000 km/s', '150,000 km/s', '30,000 km/s', '3,000,000 km/s'], answer: 0 },

  // History
  { topic: 'history', q: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], answer: 2 },
  { topic: 'history', q: 'Who was the first President of the United States?', options: ['John Adams', 'Benjamin Franklin', 'Thomas Jefferson', 'George Washington'], answer: 3 },
  { topic: 'history', q: 'Which ancient wonder was located in Alexandria, Egypt?', options: ['Colossus of Rhodes', 'Hanging Gardens', 'The Lighthouse', 'Statue of Zeus'], answer: 2 },
  { topic: 'history', q: 'The Civil Rights Act was signed in which year?', options: ['1960', '1962', '1964', '1968'], answer: 2 },
  { topic: 'history', q: 'Which empire built the Colosseum?', options: ['Greek', 'Ottoman', 'Roman', 'Byzantine'], answer: 2 },
  { topic: 'history', q: 'Who wrote the Declaration of Independence?', options: ['James Madison', 'John Hancock', 'Benjamin Franklin', 'Thomas Jefferson'], answer: 3 },
  { topic: 'history', q: 'The Berlin Wall fell in which year?', options: ['1987', '1989', '1991', '1993'], answer: 1 },
  { topic: 'history', q: 'Which country was the first to give women the right to vote?', options: ['United States', 'United Kingdom', 'New Zealand', 'Australia'], answer: 2 },

  // Geography
  { topic: 'geography', q: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Brisbane', 'Canberra'], answer: 3 },
  { topic: 'geography', q: 'Which is the longest river in the world?', options: ['Amazon', 'Mississippi', 'Nile', 'Yangtze'], answer: 2 },
  { topic: 'geography', q: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], answer: 2 },
  { topic: 'geography', q: 'Which country has the largest population?', options: ['United States', 'India', 'Russia', 'China'], answer: 1 },
  { topic: 'geography', q: 'What is the smallest country in the world?', options: ['Monaco', 'San Marino', 'Vatican City', 'Liechtenstein'], answer: 2 },
  { topic: 'geography', q: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  { topic: 'geography', q: 'Mount Everest is located in which mountain range?', options: ['Andes', 'Alps', 'Himalayas', 'Rockies'], answer: 2 },
  { topic: 'geography', q: 'What is the capital city of Canada?', options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], answer: 2 },

  // ELA (English Language Arts)
  { topic: 'ela', q: 'What is a synonym for "happy"?', options: ['Sad', 'Joyful', 'Angry', 'Tired'], answer: 1 },
  { topic: 'ela', q: 'Which of the following is a noun?', options: ['Run', 'Quickly', 'Beautiful', 'Friendship'], answer: 3 },
  { topic: 'ela', q: 'What literary device is used in "The wind whispered through the trees"?', options: ['Simile', 'Metaphor', 'Alliteration', 'Personification'], answer: 3 },
  { topic: 'ela', q: 'Who wrote "Romeo and Juliet"?', options: ['Charles Dickens', 'Mark Twain', 'William Shakespeare', 'Jane Austen'], answer: 2 },
  { topic: 'ela', q: 'What is the antonym of "ancient"?', options: ['Old', 'Historic', 'Modern', 'Classic'], answer: 2 },
  { topic: 'ela', q: 'Which sentence uses correct punctuation?', options: ["Its raining today.", "It's raining today.", "Its' raining today.", "It's raining, today."], answer: 1 },
  { topic: 'ela', q: 'What is the main idea of a text also called?', options: ['Theme', 'Plot', 'Setting', 'Character'], answer: 0 },
  { topic: 'ela', q: 'In the sentence "She ran quickly", what part of speech is "quickly"?', options: ['Adjective', 'Noun', 'Verb', 'Adverb'], answer: 3 },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getQuestions(topic: string, count: number): Question[] {
  const pool = topic === 'all'
    ? QUESTIONS
    : QUESTIONS.filter((q) => q.topic === topic)
  return shuffle(pool).slice(0, Math.min(count, pool.length))
}

const TOPIC_LABELS: Record<string, string> = {
  math: 'Math',
  science: 'Science',
  history: 'History',
  geography: 'Geography',
  ela: 'English Language Arts',
  all: 'Mixed Topics',
}

// ── Styles ───────────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0f1117',
  card: '#1a1d27',
  border: '#2a2d3d',
  accent: '#6c8fff',
  accentLight: '#8aa4ff',
  correct: '#2ecc71',
  wrong: '#e74c3c',
  text: '#e8eaf0',
  muted: '#8892a4',
  optionHover: '#222538',
  optionSelected: '#1e2540',
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 16px',
  },
  header: {
    width: '100%',
    maxWidth: 560,
    marginBottom: 24,
  },
  topicBadge: {
    display: 'inline-block',
    background: COLORS.accent + '22',
    color: COLORS.accentLight,
    borderRadius: 6,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    background: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: COLORS.accent,
    borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  progressText: {
    fontSize: 12,
    color: COLORS.muted,
    minWidth: 60,
    textAlign: 'right' as const,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '24px 24px',
  },
  question: {
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.5,
    marginBottom: 20,
  },
  options: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    background: 'transparent',
    color: COLORS.text,
    fontSize: 15,
    textAlign: 'left' as const,
    width: '100%',
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    background: COLORS.border,
    color: COLORS.muted,
  },
  nextBtn: {
    marginTop: 20,
    width: '100%',
    padding: '12px 0',
    background: COLORS.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  scoreCard: {
    textAlign: 'center' as const,
    padding: '32px 24px',
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: '50%',
    margin: '0 auto 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    fontWeight: 700,
    border: '4px solid',
  },
  scoreTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
  },
  scoreSub: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 24,
  },
  retryBtn: {
    padding: '12px 32px',
    background: COLORS.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  feedback: {
    marginTop: 12,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
  },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function QuizApp() {
  const params = new URLSearchParams(window.location.search)
  const topicParam = params.get('topic') ?? 'all'
  const countParam = parseInt(params.get('count') ?? '5', 10)

  const [questions, setQuestions] = useState<Question[]>(() => getQuestions(topicParam, countParam))
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)

  function initQuiz() {
    setQuestions(getQuestions(topicParam, countParam))
    setCurrent(0)
    setSelected(null)
    setScore(0)
    setDone(false)
  }

  const q = questions[current]
  const topicLabel = TOPIC_LABELS[topicParam] ?? topicParam

  function handleSelect(idx: number) {
    if (selected !== null) return
    setSelected(idx)
    const correct = idx === q.answer
    const newScore = correct ? score + 1 : score
    if (correct) setScore(newScore)

    sendToParent('STATE_UPDATE', {
      question: current + 1,
      total: questions.length,
      score: newScore,
      topic: topicParam,
      correct,
    })
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      const finalScore = score + (selected === q.answer ? 0 : 0) // already counted
      const passed = score / questions.length >= 0.7
      sendToParent('COMPLETION', {
        score,
        total: questions.length,
        topic: topicParam,
        passed,
      })
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
      setSelected(null)
    }
  }

  if (!q && !done) return null

  if (done) {
    const pct = Math.round((score / questions.length) * 100)
    const passed = score / questions.length >= 0.7
    return (
      <div style={styles.root}>
        <div style={{ ...styles.card, ...styles.scoreCard }}>
          <div style={{
            ...styles.scoreCircle,
            borderColor: passed ? COLORS.correct : COLORS.wrong,
            color: passed ? COLORS.correct : COLORS.wrong,
          }}>
            {pct}%
          </div>
          <div style={styles.scoreTitle}>{passed ? 'Nice work!' : 'Keep practicing!'}</div>
          <div style={styles.scoreSub}>
            You scored {score} out of {questions.length} on {topicLabel}
          </div>
          <button style={styles.retryBtn} onClick={initQuiz}>Try Again</button>
        </div>
      </div>
    )
  }

  const progress = current / questions.length

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={styles.topicBadge}>{topicLabel}</div>
        <div style={styles.progress}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress * 100}%` }} />
          </div>
          <div style={styles.progressText}>
            {current + 1} / {questions.length}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.question}>{q.q}</div>
        <div style={styles.options}>
          {q.options.map((opt, i) => {
            let bg = 'transparent'
            let borderColor = COLORS.border
            let letterBg = COLORS.border
            let letterColor = COLORS.muted

            if (selected !== null) {
              if (i === q.answer) {
                bg = COLORS.correct + '18'
                borderColor = COLORS.correct
                letterBg = COLORS.correct
                letterColor = '#fff'
              } else if (i === selected) {
                bg = COLORS.wrong + '18'
                borderColor = COLORS.wrong
                letterBg = COLORS.wrong
                letterColor = '#fff'
              }
            } else if (hovered === i) {
              bg = COLORS.optionHover
              borderColor = COLORS.accent + '66'
            }

            return (
              <button
                key={i}
                style={{ ...styles.option, background: bg, borderColor }}
                onClick={() => handleSelect(i)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <span style={{ ...styles.optionLetter, background: letterBg, color: letterColor }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            )
          })}
        </div>

        {selected !== null && (
          <div style={{
            ...styles.feedback,
            background: selected === q.answer ? COLORS.correct + '18' : COLORS.wrong + '18',
            color: selected === q.answer ? COLORS.correct : COLORS.wrong,
          }}>
            {selected === q.answer ? 'Correct!' : `Incorrect. The answer is: ${q.options[q.answer]}`}
          </div>
        )}

        {selected !== null && (
          <button style={styles.nextBtn} onClick={handleNext}>
            {current + 1 >= questions.length ? 'See Results' : 'Next Question'}
          </button>
        )}
      </div>
    </div>
  )
}
