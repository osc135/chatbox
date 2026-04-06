import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question {
  q: string
  options: [string, string, string, string]
  answer: 0 | 1 | 2 | 3
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
}

// ── Question bank ─────────────────────────────────────────────────────────────
// easy   = grades 3–5
// medium = grades 6–8
// hard   = grades 9–12

const QUESTIONS: Question[] = [
  // ── Math · easy ─────────────────────────────────────────────────────────────
  { difficulty: 'easy', topic: 'math', q: 'What is 4 × 5?', options: ['16', '25', '20', '15'], answer: 2 },
  { difficulty: 'easy', topic: 'math', q: 'What is 15 ÷ 3?', options: ['3', '4', '5', '6'], answer: 2 },
  { difficulty: 'easy', topic: 'math', q: 'What is half of 18?', options: ['8', '9', '10', '11'], answer: 1 },
  { difficulty: 'easy', topic: 'math', q: 'Which of these is an even number?', options: ['7', '11', '14', '19'], answer: 2 },
  { difficulty: 'easy', topic: 'math', q: 'What is the perimeter of a square with sides of 4 cm?', options: ['8 cm', '12 cm', '16 cm', '20 cm'], answer: 2 },
  { difficulty: 'easy', topic: 'math', q: 'What is 3/10 written as a decimal?', options: ['3.10', '0.30', '0.03', '3.0'], answer: 1 },
  { difficulty: 'easy', topic: 'math', q: 'What is 6 × 7?', options: ['36', '42', '48', '35'], answer: 1 },
  { difficulty: 'easy', topic: 'math', q: 'What is 100 − 64?', options: ['44', '46', '36', '34'], answer: 2 },
  // ── Math · medium ───────────────────────────────────────────────────────────
  { difficulty: 'medium', topic: 'math', q: 'What is 7 × 8?', options: ['54', '56', '48', '63'], answer: 1 },
  { difficulty: 'medium', topic: 'math', q: 'What is 2³?', options: ['6', '9', '8', '16'], answer: 2 },
  { difficulty: 'medium', topic: 'math', q: 'What is 15% of 200?', options: ['25', '30', '35', '20'], answer: 1 },
  { difficulty: 'medium', topic: 'math', q: 'A rectangle is 9 cm wide and 4 cm tall. What is its area?', options: ['26 cm²', '36 cm²', '13 cm²', '32 cm²'], answer: 1 },
  { difficulty: 'medium', topic: 'math', q: 'What is 3/4 as a decimal?', options: ['0.34', '0.43', '0.70', '0.75'], answer: 3 },
  { difficulty: 'medium', topic: 'math', q: 'Which of these is a prime number?', options: ['21', '27', '29', '33'], answer: 2 },
  { difficulty: 'medium', topic: 'math', q: 'What is the value of x if 3x + 5 = 20?', options: ['3', '4', '5', '6'], answer: 2 },
  { difficulty: 'medium', topic: 'math', q: 'What is the area of a triangle with base 8 and height 5?', options: ['40', '20', '13', '80'], answer: 1 },
  // ── Math · hard ─────────────────────────────────────────────────────────────
  { difficulty: 'hard', topic: 'math', q: 'What is π (pi) to two decimal places?', options: ['3.12', '3.16', '3.14', '3.41'], answer: 2 },
  { difficulty: 'hard', topic: 'math', q: 'What is the square root of 144?', options: ['10', '11', '13', '12'], answer: 3 },
  { difficulty: 'hard', topic: 'math', q: 'Simplify: (x² − 9) ÷ (x − 3)', options: ['x − 3', 'x + 3', 'x² + 3', 'x − 9'], answer: 1 },
  { difficulty: 'hard', topic: 'math', q: 'What is the slope of the line y = 3x − 7?', options: ['-7', '3', '-3', '7'], answer: 1 },
  { difficulty: 'hard', topic: 'math', q: 'If sin(θ) = 0.5, what is θ in degrees (0°–90°)?', options: ['30°', '45°', '60°', '90°'], answer: 0 },

  // ── Science · easy ──────────────────────────────────────────────────────────
  { difficulty: 'easy', topic: 'science', q: 'What do plants need to make food?', options: ['Water only', 'Sunlight and CO₂', 'Soil and rain', 'Oxygen only'], answer: 1 },
  { difficulty: 'easy', topic: 'science', q: 'What is the largest planet in our solar system?', options: ['Earth', 'Saturn', 'Jupiter', 'Neptune'], answer: 2 },
  { difficulty: 'easy', topic: 'science', q: 'What state of matter is ice?', options: ['Gas', 'Liquid', 'Solid', 'Plasma'], answer: 2 },
  { difficulty: 'easy', topic: 'science', q: 'Which animal is a mammal?', options: ['Salmon', 'Eagle', 'Frog', 'Bat'], answer: 3 },
  { difficulty: 'easy', topic: 'science', q: 'What gas do humans breathe in?', options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], answer: 2 },
  { difficulty: 'easy', topic: 'science', q: 'Which planet is called the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], answer: 1 },
  { difficulty: 'easy', topic: 'science', q: 'What covers most of Earth\'s surface?', options: ['Land', 'Ice', 'Water', 'Forests'], answer: 2 },
  { difficulty: 'easy', topic: 'science', q: 'How many legs does an insect have?', options: ['4', '6', '8', '10'], answer: 1 },
  // ── Science · medium ────────────────────────────────────────────────────────
  { difficulty: 'medium', topic: 'science', q: 'What is the chemical symbol for water?', options: ['WA', 'H₂O', 'O₂H', 'HO'], answer: 1 },
  { difficulty: 'medium', topic: 'science', q: 'What force keeps planets in orbit around the Sun?', options: ['Magnetism', 'Friction', 'Gravity', 'Electricity'], answer: 2 },
  { difficulty: 'medium', topic: 'science', q: 'Which planet is closest to the Sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], answer: 2 },
  { difficulty: 'medium', topic: 'science', q: 'What type of animal is a dolphin?', options: ['Fish', 'Reptile', 'Amphibian', 'Mammal'], answer: 3 },
  { difficulty: 'medium', topic: 'science', q: 'What gas do plants absorb during photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], answer: 2 },
  { difficulty: 'medium', topic: 'science', q: 'How many bones are in the adult human body?', options: ['186', '206', '216', '196'], answer: 1 },
  { difficulty: 'medium', topic: 'science', q: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Vacuole', 'Mitochondria'], answer: 3 },
  { difficulty: 'medium', topic: 'science', q: 'What layer of the atmosphere contains the ozone layer?', options: ['Troposphere', 'Mesosphere', 'Stratosphere', 'Thermosphere'], answer: 2 },
  // ── Science · hard ──────────────────────────────────────────────────────────
  { difficulty: 'hard', topic: 'science', q: 'What is the approximate speed of light?', options: ['300,000 km/s', '150,000 km/s', '30,000 km/s', '3,000,000 km/s'], answer: 0 },
  { difficulty: 'hard', topic: 'science', q: 'What is the atomic number of carbon?', options: ['4', '6', '8', '12'], answer: 1 },
  { difficulty: 'hard', topic: 'science', q: 'Which organelle is responsible for protein synthesis?', options: ['Mitochondria', 'Golgi body', 'Ribosome', 'Vacuole'], answer: 2 },
  { difficulty: 'hard', topic: 'science', q: 'What is Newton\'s Second Law of Motion?', options: ['F = mv', 'F = ma', 'F = m/a', 'F = v/t'], answer: 1 },
  { difficulty: 'hard', topic: 'science', q: 'DNA replication occurs during which phase of the cell cycle?', options: ['G1', 'S phase', 'G2', 'Mitosis'], answer: 1 },

  // ── History · easy ──────────────────────────────────────────────────────────
  { difficulty: 'easy', topic: 'history', q: 'How many stars are on the United States flag?', options: ['48', '50', '52', '45'], answer: 1 },
  { difficulty: 'easy', topic: 'history', q: 'Who wrote the Emancipation Proclamation?', options: ['George Washington', 'Abraham Lincoln', 'Thomas Jefferson', 'Benjamin Franklin'], answer: 1 },
  { difficulty: 'easy', topic: 'history', q: 'What document starts with "We the People"?', options: ['Bill of Rights', 'Declaration of Independence', 'The Constitution', 'Emancipation Proclamation'], answer: 2 },
  { difficulty: 'easy', topic: 'history', q: 'What country did the United States declare independence from?', options: ['France', 'Spain', 'England', 'Germany'], answer: 2 },
  { difficulty: 'easy', topic: 'history', q: 'In which city is the Statue of Liberty?', options: ['Washington D.C.', 'Boston', 'New York City', 'Philadelphia'], answer: 2 },
  { difficulty: 'easy', topic: 'history', q: 'Which ship did the Pilgrims sail to America on?', options: ['Titanic', 'Mayflower', 'Santa Maria', 'Endeavour'], answer: 1 },
  { difficulty: 'easy', topic: 'history', q: 'Who was the first President of the United States?', options: ['John Adams', 'Benjamin Franklin', 'Thomas Jefferson', 'George Washington'], answer: 3 },
  { difficulty: 'easy', topic: 'history', q: 'What do we celebrate on July 4th?', options: ['Memorial Day', 'Independence Day', 'Constitution Day', 'Thanksgiving'], answer: 1 },
  // ── History · medium ────────────────────────────────────────────────────────
  { difficulty: 'medium', topic: 'history', q: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], answer: 2 },
  { difficulty: 'medium', topic: 'history', q: 'Which empire built the Colosseum?', options: ['Greek', 'Ottoman', 'Roman', 'Byzantine'], answer: 2 },
  { difficulty: 'medium', topic: 'history', q: 'Who wrote the Declaration of Independence?', options: ['James Madison', 'John Hancock', 'Benjamin Franklin', 'Thomas Jefferson'], answer: 3 },
  { difficulty: 'medium', topic: 'history', q: 'Which ancient wonder was located in Alexandria, Egypt?', options: ['Colossus of Rhodes', 'Hanging Gardens', 'The Lighthouse', 'Statue of Zeus'], answer: 2 },
  { difficulty: 'medium', topic: 'history', q: 'The Civil Rights Act was signed in which year?', options: ['1960', '1962', '1964', '1968'], answer: 2 },
  { difficulty: 'medium', topic: 'history', q: 'Which country did Columbus sail for in 1492?', options: ['Portugal', 'England', 'Spain', 'France'], answer: 2 },
  // ── History · hard ──────────────────────────────────────────────────────────
  { difficulty: 'hard', topic: 'history', q: 'The Berlin Wall fell in which year?', options: ['1987', '1989', '1991', '1993'], answer: 1 },
  { difficulty: 'hard', topic: 'history', q: 'Which country was first to give women the right to vote?', options: ['United States', 'United Kingdom', 'New Zealand', 'Australia'], answer: 2 },
  { difficulty: 'hard', topic: 'history', q: 'The Treaty of Versailles was signed after which war?', options: ['WWI', 'WWII', 'Korean War', 'Vietnam War'], answer: 0 },
  { difficulty: 'hard', topic: 'history', q: 'Which US president issued the Monroe Doctrine?', options: ['John Adams', 'James Monroe', 'Andrew Jackson', 'James Madison'], answer: 1 },

  // ── Geography · easy ────────────────────────────────────────────────────────
  { difficulty: 'easy', topic: 'geography', q: 'What is the capital of the United States?', options: ['New York City', 'Los Angeles', 'Chicago', 'Washington D.C.'], answer: 3 },
  { difficulty: 'easy', topic: 'geography', q: 'What is the largest continent?', options: ['Africa', 'Asia', 'North America', 'Europe'], answer: 1 },
  { difficulty: 'easy', topic: 'geography', q: 'What river runs through Egypt?', options: ['Amazon', 'Congo', 'Nile', 'Niger'], answer: 2 },
  { difficulty: 'easy', topic: 'geography', q: 'Which US state is the largest?', options: ['Texas', 'Alaska', 'California', 'Montana'], answer: 1 },
  { difficulty: 'easy', topic: 'geography', q: 'Which country is directly north of the United States?', options: ['Mexico', 'Russia', 'Canada', 'Greenland'], answer: 2 },
  { difficulty: 'easy', topic: 'geography', q: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], answer: 2 },
  { difficulty: 'easy', topic: 'geography', q: 'What is the largest desert in the world?', options: ['Gobi', 'Sahara', 'Arabian', 'Antarctic'], answer: 3 },
  { difficulty: 'easy', topic: 'geography', q: 'Which ocean is on the East coast of the United States?', options: ['Pacific', 'Indian', 'Arctic', 'Atlantic'], answer: 3 },
  // ── Geography · medium ──────────────────────────────────────────────────────
  { difficulty: 'medium', topic: 'geography', q: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Brisbane', 'Canberra'], answer: 3 },
  { difficulty: 'medium', topic: 'geography', q: 'Which is the longest river in the world?', options: ['Amazon', 'Mississippi', 'Nile', 'Yangtze'], answer: 2 },
  { difficulty: 'medium', topic: 'geography', q: 'Which country has the largest population?', options: ['United States', 'India', 'Russia', 'China'], answer: 1 },
  { difficulty: 'medium', topic: 'geography', q: 'What is the smallest country in the world?', options: ['Monaco', 'San Marino', 'Vatican City', 'Liechtenstein'], answer: 2 },
  { difficulty: 'medium', topic: 'geography', q: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  { difficulty: 'medium', topic: 'geography', q: 'Mount Everest is in which mountain range?', options: ['Andes', 'Alps', 'Himalayas', 'Rockies'], answer: 2 },
  { difficulty: 'medium', topic: 'geography', q: 'What is the capital of Canada?', options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], answer: 2 },
  // ── Geography · hard ────────────────────────────────────────────────────────
  { difficulty: 'hard', topic: 'geography', q: 'What is the capital of Kazakhstan?', options: ['Almaty', 'Nur-Sultan', 'Bishkek', 'Tashkent'], answer: 1 },
  { difficulty: 'hard', topic: 'geography', q: 'Which country has the most time zones?', options: ['Russia', 'China', 'USA', 'France'], answer: 3 },
  { difficulty: 'hard', topic: 'geography', q: 'The Strait of Malacca separates which two land masses?', options: ['Africa and Asia', 'Malaysia and Sumatra', 'India and Sri Lanka', 'Java and Bali'], answer: 1 },

  // ── ELA · easy ──────────────────────────────────────────────────────────────
  { difficulty: 'easy', topic: 'ela', q: 'What is a synonym for "big"?', options: ['Tiny', 'Large', 'Flat', 'Cold'], answer: 1 },
  { difficulty: 'easy', topic: 'ela', q: 'Which of these is a question?', options: ['The dog barked.', 'Please sit down.', 'Where is my backpack?', 'I love pizza!'], answer: 2 },
  { difficulty: 'easy', topic: 'ela', q: 'What type of word describes a noun?', options: ['Verb', 'Adverb', 'Adjective', 'Preposition'], answer: 2 },
  { difficulty: 'easy', topic: 'ela', q: 'What punctuation ends an exclamatory sentence?', options: ['Period', 'Comma', 'Question mark', 'Exclamation point'], answer: 3 },
  { difficulty: 'easy', topic: 'ela', q: 'Which word is a verb?', options: ['Apple', 'Beautiful', 'Run', 'Quickly'], answer: 2 },
  { difficulty: 'easy', topic: 'ela', q: 'What is the plural of "child"?', options: ['Childs', 'Childes', 'Children', 'Childer'], answer: 2 },
  { difficulty: 'easy', topic: 'ela', q: 'What is the antonym of "hot"?', options: ['Warm', 'Cold', 'Bright', 'Dark'], answer: 1 },
  { difficulty: 'easy', topic: 'ela', q: 'Which sentence is correct?', options: ['Me and him went to the store.', 'Him and I went to the store.', 'He and I went to the store.', 'I and he went to the store.'], answer: 2 },
  // ── ELA · medium ────────────────────────────────────────────────────────────
  { difficulty: 'medium', topic: 'ela', q: 'What is a synonym for "happy"?', options: ['Sad', 'Joyful', 'Angry', 'Tired'], answer: 1 },
  { difficulty: 'medium', topic: 'ela', q: 'Which of the following is a noun?', options: ['Run', 'Quickly', 'Beautiful', 'Friendship'], answer: 3 },
  { difficulty: 'medium', topic: 'ela', q: '"The wind whispered through the trees" is an example of:', options: ['Simile', 'Metaphor', 'Alliteration', 'Personification'], answer: 3 },
  { difficulty: 'medium', topic: 'ela', q: 'What is the antonym of "ancient"?', options: ['Old', 'Historic', 'Modern', 'Classic'], answer: 2 },
  { difficulty: 'medium', topic: 'ela', q: 'Which sentence uses correct punctuation?', options: ["Its raining today.", "It's raining today.", "Its' raining today.", "Its raining, today."], answer: 1 },
  { difficulty: 'medium', topic: 'ela', q: 'The main idea of a text is also called its:', options: ['Theme', 'Plot', 'Setting', 'Character'], answer: 0 },
  { difficulty: 'medium', topic: 'ela', q: 'In "She ran quickly", what part of speech is "quickly"?', options: ['Adjective', 'Noun', 'Verb', 'Adverb'], answer: 3 },
  // ── ELA · hard ──────────────────────────────────────────────────────────────
  { difficulty: 'hard', topic: 'ela', q: 'Who wrote "Romeo and Juliet"?', options: ['Charles Dickens', 'Mark Twain', 'William Shakespeare', 'Jane Austen'], answer: 2 },
  { difficulty: 'hard', topic: 'ela', q: '"All the world\'s a stage" is an example of:', options: ['Simile', 'Irony', 'Extended metaphor', 'Allusion'], answer: 2 },
  { difficulty: 'hard', topic: 'ela', q: 'Which sentence contains a dangling modifier?', options: ['Running to the store, she grabbed her keys.', 'Running to the store, the keys were grabbed.', 'She ran to the store with her keys.', 'Her keys were in the store.'], answer: 1 },
  { difficulty: 'hard', topic: 'ela', q: 'What is the term for the resolution of a story\'s conflict?', options: ['Exposition', 'Rising action', 'Climax', 'Denouement'], answer: 3 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOPIC_LABELS: Record<string, string> = {
  math: 'Math', science: 'Science', history: 'History',
  geography: 'Geography', ela: 'English Language Arts', all: 'Mixed Topics',
}

function gradeToDifficulty(grade?: string | null): 'easy' | 'medium' | 'hard' {
  if (!grade) return 'medium'
  const g = grade.trim()
  if (['K', '1', '2', '3', '4', '5'].includes(g)) return 'easy'
  if (['6', '7', '8'].includes(g)) return 'medium'
  return 'hard'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickQuestions(topic: string, count: number, difficulty: 'easy' | 'medium' | 'hard'): Question[] {
  const pool = QUESTIONS
    .filter(q => topic === 'all' || q.topic === topic)
    .filter(q => q.difficulty === difficulty)
  return shuffle(pool).slice(0, Math.min(count, pool.length))
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuizAppProps {
  topic?: string
  count?: number
  grade?: string | null
  onStateUpdate?: (state: Record<string, unknown>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuizApp({ topic = 'all', count = 5, grade, onStateUpdate }: QuizAppProps) {
  const difficulty = gradeToDifficulty(grade)
  const [questions] = useState<Question[]>(() => pickQuestions(topic, count, difficulty))
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<Array<{ question: string; correctAnswer: string }>>([])
  const [done, setDone] = useState(false)

  const q = questions[current]
  const topicLabel = TOPIC_LABELS[topic] ?? topic

  if (!q && !done) return null

  function handleSelect(idx: number) {
    if (selected !== null || !q) return
    setSelected(idx)
    const correct = idx === q.answer
    const newScore = correct ? score + 1 : score
    if (correct) {
      setScore(newScore)
    } else {
      setMissed(prev => [...prev, { question: q.q, correctAnswer: q.options[q.answer] }])
    }
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
      onStateUpdate?.({
        score,
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
        {missed.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Missed
            </div>
            {missed.map((m, i) => (
              <div key={i} style={{
                padding: '8px 10px', marginBottom: 6, borderRadius: 7,
                background: wrong + '12', border: `1px solid ${wrong}33`,
                fontSize: 12, lineHeight: 1.5,
              }}>
                <span style={{ color: muted }}>{m.question}</span>
                <br />
                <span style={{ color: correct, fontWeight: 600 }}>✓ {m.correctAnswer}</span>
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
