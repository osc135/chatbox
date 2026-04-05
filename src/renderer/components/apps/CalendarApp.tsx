import { useState, useEffect, useCallback } from 'react'
import {
  getCalendarStatus,
  getCalendarAuthUrl,
  disconnectCalendar,
  getCalendarEvents,
  createCalendarEvent,
  type CalendarEvent,
} from '@/packages/tutorApi'
import './calendar.css'

// Google Calendar colorId → color
const EVENT_COLORS: Record<string, string> = {
  '1': '#D50000', // Tomato
  '2': '#E67C73', // Flamingo
  '3': '#F4511E', // Tangerine
  '4': '#E4C441', // Banana
  '5': '#51B749', // Sage
  '6': '#0B8043', // Basil
  '7': '#039BE5', // Peacock
  '8': '#3F51B5', // Blueberry
  '9': '#7986CB', // Lavender
  '10': '#8E24AA', // Grape
  '11': '#757575', // Graphite
}

// Fallback colors cycling for events without a meaningful colorId
const CYCLE_COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D00', '#9C27B0', '#00BCD4', '#E91E63']

// Day-of-week badge colors (0=Sun … 6=Sat)
const DAY_COLORS = ['#EF5350', '#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#26C6DA', '#EC407A']

function getEventColor(event: CalendarEvent, index: number): string {
  if (event.colorId && event.colorId !== '1' && EVENT_COLORS[event.colorId]) {
    return EVENT_COLORS[event.colorId]!
  }
  return CYCLE_COLORS[index % CYCLE_COLORS.length]!
}

interface PrefillData {
  title?: string
  date?: string
  startTime?: string
  endTime?: string
  description?: string
}

interface CalendarAppProps {
  prefill?: PrefillData
  onStateUpdate?: (state: Record<string, unknown>) => void
}

type View = 'events' | 'create'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarApp({ prefill, onStateUpdate }: CalendarAppProps) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>(() => (prefill?.title || prefill?.date ? 'create' : 'events'))
  const [connectError, setConnectError] = useState('')

  const [formTitle, setFormTitle] = useState(prefill?.title ?? '')
  const [formDate, setFormDate] = useState(prefill?.date ?? todayLocal())
  const [formStartTime, setFormStartTime] = useState(prefill?.startTime ?? '')
  const [formEndTime, setFormEndTime] = useState(prefill?.endTime ?? '')
  const [formDesc, setFormDesc] = useState(prefill?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedTitle, setSavedTitle] = useState('')

  const loadEvents = useCallback(async () => {
    try {
      const evts = await getCalendarEvents()
      setEvents(evts)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const { connected: c } = await getCalendarStatus()
        setConnected(c)
        if (c) await loadEvents()
      } catch {
        setConnected(false)
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [loadEvents])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; error?: string } | undefined
      if (data?.type === 'GOOGLE_CALENDAR_CONNECTED') {
        setConnected(true)
        void loadEvents()
      } else if (data?.type === 'GOOGLE_CALENDAR_ERROR') {
        setConnectError(data.error ?? 'Authorization failed')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [loadEvents])

  async function handleConnect() {
    setConnectError('')
    try {
      const url = await getCalendarAuthUrl()
      window.open(url, 'google-calendar-auth', 'width=500,height=650,noopener=no')
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Could not start authorization')
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectCalendar()
      setConnected(false)
      setEvents([])
    } catch { /* ignore */ }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaveError('')
    setSaving(true)
    try {
      const event = await createCalendarEvent({
        title: formTitle,
        date: formDate,
        startTime: formStartTime || undefined,
        endTime: formEndTime || undefined,
        description: formDesc || undefined,
      })
      setEvents((prev) => [...prev, event].sort((a, b) => a.start.localeCompare(b.start)))
      setSavedTitle(event.title)
      setView('events')
      setFormTitle('')
      setFormDate(todayLocal())
      setFormStartTime('')
      setFormEndTime('')
      setFormDesc('')
      onStateUpdate?.({ lastCreated: event })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="cal-loading">
        <div className="cal-loading-spinner" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="cal-root">
        <div className="cal-connect-screen">
          <div className="cal-connect-glogo">
            <span style={{ color: '#4285F4' }}>G</span>
            <span style={{ color: '#EA4335' }}>o</span>
            <span style={{ color: '#FBBC04' }}>o</span>
            <span style={{ color: '#4285F4' }}>g</span>
            <span style={{ color: '#34A853' }}>l</span>
            <span style={{ color: '#EA4335' }}>e</span>
          </div>
          <h2 className="cal-connect-title">Google Calendar</h2>
          <p className="cal-connect-desc">
            Connect your Google account to view and create events right here in the chat.
          </p>
          {connectError && <div className="cal-error">{connectError}</div>}
          <button className="cal-btn-connect" onClick={handleConnect}>
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Connect Google Calendar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cal-root">
      {/* Header */}
      <div className="cal-header">
        <div className="cal-header-left">
          <div className="cal-header-badge">
            <svg width="14" height="14" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          </div>
          <span className="cal-header-title">Google Calendar</span>
          <span className="cal-header-range">Next 14 days</span>
        </div>
        <div className="cal-header-right">
          {view === 'events' ? (
            <button className="cal-btn-new" onClick={() => { setSavedTitle(''); setView('create') }}>
              <span>+</span> New Event
            </button>
          ) : (
            <button className="cal-btn-back" onClick={() => setView('events')}>
              ← Back
            </button>
          )}
        </div>
      </div>

      {view === 'events' ? (
        <div className="cal-events-view">
          {savedTitle && (
            <div className="cal-success">
              <span className="cal-success-icon">✓</span>
              "{savedTitle}" added to your calendar
            </div>
          )}
          {events.length === 0 ? (
            <div className="cal-empty">
              <div className="cal-empty-icon">🗓️</div>
              <div>No upcoming events in the next 14 days</div>
            </div>
          ) : (
            <EventGroups events={events} />
          )}
          <button className="cal-disconnect-btn" onClick={handleDisconnect}>
            Disconnect calendar
          </button>
        </div>
      ) : (
        <form className="cal-form" onSubmit={handleCreate}>
          <div className="cal-form-header">
            <div className="cal-form-dot" />
            <div className="cal-form-title">New Event</div>
          </div>

          <div className="cal-field">
            <label className="cal-label">Title</label>
            <input
              className="cal-input"
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Parent-teacher conference"
              required
              autoFocus
            />
          </div>

          <div className="cal-field">
            <label className="cal-label">Date</label>
            <input
              className="cal-input"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
            />
          </div>

          <div className="cal-field-row">
            <div className="cal-field">
              <label className="cal-label">Start time <span className="cal-opt">(optional)</span></label>
              <input className="cal-input" type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
            </div>
            <div className="cal-field">
              <label className="cal-label">End time <span className="cal-opt">(optional)</span></label>
              <input className="cal-input" type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
            </div>
          </div>

          <div className="cal-field">
            <label className="cal-label">Description <span className="cal-opt">(optional)</span></label>
            <textarea
              className="cal-input cal-textarea"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Notes about this event…"
              rows={3}
            />
          </div>

          {saveError && <div className="cal-error">{saveError}</div>}

          <button className="cal-btn-primary" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create Event'}
          </button>
        </form>
      )}
    </div>
  )
}

// ── Event grouping helpers ────────────────────────────────────────────────────

function getDateKey(event: CalendarEvent): string {
  if (event.allDay) return event.start.slice(0, 10)
  return new Date(event.start).toLocaleDateString('en-CA')
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'All day'
  return new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function EventGroups({ events }: { events: CalendarEvent[] }) {
  const groups = new Map<string, CalendarEvent[]>()
  for (const evt of events) {
    const key = getDateKey(evt)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(evt)
  }

  const today = new Date()
  let colorIndex = 0

  return (
    <div className="cal-groups">
      {Array.from(groups.entries()).map(([key, dayEvents]) => {
        const dt = parseDateKey(key)
        const isToday =
          dt.getFullYear() === today.getFullYear() &&
          dt.getMonth() === today.getMonth() &&
          dt.getDate() === today.getDate()
        const dayOfWeek = dt.getDay()
        const dayColor = DAY_COLORS[dayOfWeek]!
        const weekday = isToday ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short' })
        const dayNum = dt.getDate()
        const month = dt.toLocaleDateString('en-US', { month: 'short' })

        return (
          <div key={key} className="cal-day-group">
            {/* Day badge */}
            <div className="cal-day-col">
              <div
                className={`cal-day-badge${isToday ? ' cal-day-badge-today' : ''}`}
                style={{ '--day-color': dayColor } as React.CSSProperties}
              >
                <span className="cal-day-badge-wd">{weekday}</span>
                <span className="cal-day-badge-num">{dayNum}</span>
              </div>
              <span className="cal-day-badge-month">{month}</span>
              {/* Connecting line to next group */}
              <div className="cal-day-line" />
            </div>

            {/* Events */}
            <div className="cal-day-events">
              {dayEvents.map((evt) => {
                const color = getEventColor(evt, colorIndex++)
                return (
                  <div
                    key={evt.id}
                    className="cal-event-card"
                    style={{ '--event-color': color } as React.CSSProperties}
                  >
                    <div className="cal-event-bar" />
                    <div className="cal-event-content">
                      <div className="cal-event-top">
                        <span className="cal-event-title">{evt.title}</span>
                        <span className="cal-event-time">{formatEventTime(evt)}</span>
                      </div>
                      {(evt.location || evt.description) && (
                        <div className="cal-event-bottom">
                          {evt.location && <span className="cal-event-loc">📍 {evt.location}</span>}
                          {evt.description && <span className="cal-event-desc">{evt.description}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
