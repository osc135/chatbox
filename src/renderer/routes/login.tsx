import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { login, signup } from '@/packages/tutorApi'
import { tutorAuthStore } from '@/stores/tutorAuthStore'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const DEMO_USERS = [
  { label: 'Admin', role: 'Admin', email: 'admin@chatbridge.dev', password: 'admin123', color: '#9b59b6', initial: 'A' },
  { label: 'Ms. Rivera', role: 'Teacher', email: 'teacher@chatbridge.dev', password: 'teacher123', color: '#c97d2e', initial: 'R' },
  { label: 'Luna', role: 'Kindergarten', email: 'luna@chatbridge.dev', password: 'luna1234', color: '#4a90a4', initial: 'L' },
  { label: 'Eli', role: '1st Grade', email: 'eli@chatbridge.dev', password: 'eli12345', color: '#7b6fa0', initial: 'E' },
  { label: 'Maya', role: '2nd Grade', email: 'maya@chatbridge.dev', password: 'maya1234', color: '#5a9e6f', initial: 'M' },
]

function LoginPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupSchool, setSignupSchool] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await login(loginEmail, loginPassword)
      tutorAuthStore.getState().setAuth(token, {
        id: user.id, name: user.name, email: user.email,
        role: user.role,
        grade: user.grade, school: user.school,
      })
      if (user.role === 'admin') {
        navigate({ to: '/admin', replace: true })
      } else if (user.role === 'teacher') {
        navigate({ to: '/teacher', replace: true })
      } else {
        navigate({ to: '/', replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await signup(signupName, signupEmail, signupPassword, signupSchool || undefined)
      tutorAuthStore.getState().setAuth(token, {
        id: user.id, name: user.name, email: user.email,
        role: 'teacher', school: signupSchool || null,
      })
      navigate({ to: '/teacher', replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(u: typeof DEMO_USERS[number]) {
    setTab('login')
    setLoginEmail(u.email)
    setLoginPassword(u.password)
    setError('')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .lp-root {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d0f14;
          font-family: 'DM Sans', sans-serif;
          padding: 32px 20px;
          position: relative;
          overflow: hidden;
        }

        .lp-root::before {
          content: '';
          position: fixed;
          top: -300px; left: 50%;
          transform: translateX(-50%);
          width: 800px; height: 600px;
          background: radial-gradient(ellipse, rgba(201,125,46,0.07) 0%, transparent 65%);
          pointer-events: none;
        }

        .lp-card {
          width: 100%;
          max-width: 440px;
          animation: lpFadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both;
        }

        @keyframes lpFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Wordmark */
        .lp-wordmark {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 40px;
        }
        .lp-wordmark-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #c97d2e;
          flex-shrink: 0;
        }
        .lp-wordmark-text {
          font-family: 'Instrument Serif', serif;
          font-size: 20px;
          color: #f0ead6;
          letter-spacing: -0.01em;
        }

        /* Demo section */
        .lp-demo-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: rgba(240,234,214,0.28);
          margin-bottom: 10px;
        }
        .lp-demo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 32px;
        }
        .lp-demo-grid > :first-child {
          grid-column: 1 / -1;
        }
        .lp-demo-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.14s, border-color 0.14s, transform 0.12s;
          text-align: left;
          font-family: 'DM Sans', sans-serif;
        }
        .lp-demo-btn:hover {
          background: rgba(255,255,255,0.065);
          border-color: rgba(255,255,255,0.13);
          transform: translateY(-1px);
        }
        .lp-demo-btn.selected {
          border-color: rgba(201,125,46,0.45);
          background: rgba(201,125,46,0.06);
        }
        .lp-avatar {
          width: 30px; height: 30px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #0d0f14;
          flex-shrink: 0;
        }
        .lp-demo-name {
          font-size: 13px;
          font-weight: 500;
          color: #f0ead6;
          line-height: 1.25;
        }
        .lp-demo-role {
          font-size: 11px;
          color: rgba(240,234,214,0.35);
          line-height: 1.25;
        }

        /* Divider */
        .lp-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .lp-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }
        .lp-divider-text {
          font-size: 12px;
          color: rgba(240,234,214,0.25);
          white-space: nowrap;
        }

        /* Tabs */
        .lp-tabs {
          display: flex;
          gap: 0;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 9px;
          padding: 3px;
          margin-bottom: 22px;
        }
        .lp-tab {
          flex: 1;
          padding: 7px 10px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: rgba(240,234,214,0.4);
          cursor: pointer;
          transition: all 0.15s;
        }
        .lp-tab.active {
          background: rgba(201,125,46,0.16);
          color: #c97d2e;
        }

        /* Fields */
        .lp-fields {
          display: flex;
          flex-direction: column;
          gap: 13px;
          margin-bottom: 18px;
        }
        .lp-label {
          display: block;
          font-size: 11.5px;
          font-weight: 500;
          color: rgba(240,234,214,0.45);
          letter-spacing: 0.04em;
          margin-bottom: 5px;
          text-transform: uppercase;
        }
        .lp-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 8px;
          padding: 10px 13px;
          color: #f0ead6;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.14s, background 0.14s;
        }
        .lp-input:focus {
          border-color: rgba(201,125,46,0.4);
          background: rgba(201,125,46,0.03);
        }
        .lp-input::placeholder {
          color: rgba(240,234,214,0.18);
        }

        .lp-error {
          font-size: 13px;
          color: #e07878;
          padding: 9px 13px;
          background: rgba(224,120,120,0.08);
          border: 1px solid rgba(224,120,120,0.18);
          border-radius: 7px;
          margin-bottom: 12px;
        }

        .lp-submit {
          width: 100%;
          padding: 12px;
          background: #c97d2e;
          border: none;
          border-radius: 9px;
          color: #0d0f14;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: opacity 0.14s, transform 0.1s;
        }
        .lp-submit:hover:not(:disabled) {
          opacity: 0.87;
          transform: translateY(-1px);
        }
        .lp-submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .lp-footer {
          font-size: 12px;
          color: rgba(240,234,214,0.22);
          text-align: center;
          margin-top: 18px;
        }
      `}</style>

      <div className="lp-root">
        <div className="lp-card">

          {/* Wordmark */}
          <div className="lp-wordmark">
            <span className="lp-wordmark-dot" />
            <span className="lp-wordmark-text">TutorMeAI</span>
          </div>

          {/* Demo accounts */}
          <div className="lp-demo-label">Jump in as a demo user</div>
          <div className="lp-demo-grid">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                className={`lp-demo-btn${loginEmail === u.email ? ' selected' : ''}`}
                onClick={() => fillDemo(u)}
                type="button"
              >
                <div className="lp-avatar" style={{ background: u.color }}>{u.initial}</div>
                <div>
                  <div className="lp-demo-name">{u.label}</div>
                  <div className="lp-demo-role">{u.role}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="lp-divider">
            <div className="lp-divider-line" />
            <span className="lp-divider-text">or sign in manually</span>
            <div className="lp-divider-line" />
          </div>

          {/* Tabs */}
          <div className="lp-tabs">
            <button className={`lp-tab${tab === 'login' ? ' active' : ''}`} onClick={() => { setTab('login'); setError('') }} type="button">Sign In</button>
            <button className={`lp-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => { setTab('signup'); setError('') }} type="button">Teacher Sign Up</button>
          </div>

          {/* Forms */}
          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="lp-fields">
                <div>
                  <label className="lp-label">Email</label>
                  <input className="lp-input" type="email" placeholder="you@school.edu" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="lp-label">Password</label>
                  <input className="lp-input" type="password" placeholder="Your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                </div>
              </div>
              {error && <div className="lp-error">{error}</div>}
              <button className="lp-submit" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <div className="lp-fields">
                <div>
                  <label className="lp-label">Your Name</label>
                  <input className="lp-input" type="text" placeholder="Ms. Smith" value={signupName} onChange={e => setSignupName(e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="lp-label">Email</label>
                  <input className="lp-input" type="email" placeholder="teacher@school.edu" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="lp-label">Password</label>
                  <input className="lp-input" type="password" placeholder="At least 8 characters" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required />
                </div>
                <div>
                  <label className="lp-label">School <span style={{ opacity: 0.5 }}>(optional)</span></label>
                  <input className="lp-input" type="text" placeholder="Lincoln Elementary" value={signupSchool} onChange={e => setSignupSchool(e.target.value)} />
                </div>
              </div>
              {error && <div className="lp-error">{error}</div>}
              <button className="lp-submit" type="submit" disabled={loading}>
                {loading ? 'Creating account…' : 'Create Teacher Account'}
              </button>
            </form>
          )}

          <p className="lp-footer">Students — ask your teacher for your login details.</p>
        </div>
      </div>
    </>
  )
}
