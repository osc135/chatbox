import { useState, useEffect, useRef } from 'react'
import './weather.css'

// ── WMO weather code → description + emoji ───────────────────────────────────
const WMO: Record<number, { label: string; emoji: string }> = {
  0:  { label: 'Clear sky',           emoji: '☀️' },
  1:  { label: 'Mainly clear',        emoji: '🌤️' },
  2:  { label: 'Partly cloudy',       emoji: '⛅' },
  3:  { label: 'Overcast',            emoji: '☁️' },
  45: { label: 'Foggy',               emoji: '🌫️' },
  48: { label: 'Icy fog',             emoji: '🌫️' },
  51: { label: 'Light drizzle',       emoji: '🌦️' },
  53: { label: 'Drizzle',             emoji: '🌦️' },
  55: { label: 'Heavy drizzle',       emoji: '🌧️' },
  61: { label: 'Light rain',          emoji: '🌧️' },
  63: { label: 'Rain',                emoji: '🌧️' },
  65: { label: 'Heavy rain',          emoji: '🌧️' },
  71: { label: 'Light snow',          emoji: '🌨️' },
  73: { label: 'Snow',                emoji: '❄️' },
  75: { label: 'Heavy snow',          emoji: '❄️' },
  77: { label: 'Snow grains',         emoji: '🌨️' },
  80: { label: 'Light showers',       emoji: '🌦️' },
  81: { label: 'Showers',             emoji: '🌧️' },
  82: { label: 'Heavy showers',       emoji: '⛈️' },
  85: { label: 'Snow showers',        emoji: '🌨️' },
  86: { label: 'Heavy snow showers',  emoji: '❄️' },
  95: { label: 'Thunderstorm',        emoji: '⛈️' },
  96: { label: 'Thunderstorm + hail', emoji: '⛈️' },
  99: { label: 'Thunderstorm + hail', emoji: '⛈️' },
}

function wmo(code: number) {
  return WMO[code] ?? { label: 'Unknown', emoji: '🌡️' }
}

function getWeatherGradient(code: number): string {
  if (code <= 1)  return 'linear-gradient(160deg, #1565C0 0%, #0d3d7a 100%)'
  if (code === 2) return 'linear-gradient(160deg, #2d6a9f 0%, #1a3f63 100%)'
  if (code === 3) return 'linear-gradient(160deg, #3a3f52 0%, #1e2130 100%)'
  if (code <= 48) return 'linear-gradient(160deg, #3a3a3a 0%, #1a1a1a 100%)'
  if (code <= 67) return 'linear-gradient(160deg, #1a3a5c 0%, #0a1828 100%)'
  if (code <= 77) return 'linear-gradient(160deg, #2a4570 0%, #141e35 100%)'
  if (code <= 82) return 'linear-gradient(160deg, #1a3050 0%, #08111e 100%)'
  if (code <= 86) return 'linear-gradient(160deg, #2a4570 0%, #141e35 100%)'
  return 'linear-gradient(160deg, #1a1040 0%, #08060e 100%)'
}

function shortDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface GeoResult {
  name: string
  country: string
  latitude: number
  longitude: number
  timezone: string
}

interface WeatherData {
  location: GeoResult
  current: {
    temperature: number
    feelsLike: number
    humidity: number
    windspeed: number
    code: number
    uvIndex: number
  }
  today: {
    precipProb: number
    sunrise: string
    sunset: string
  }
  daily: {
    date: string
    codeDay: number
    high: number
    low: number
  }[]
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function geocode(query: string): Promise<GeoResult> {
  const normalizedQuery = query.replace(/,\s*/g, ' ').trim()
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedQuery)}&count=1&language=en&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Geocoding request failed')
  const data = await res.json() as { results?: { name: string; country: string; latitude: number; longitude: number; timezone: string }[] }
  if (!data.results?.length) throw new Error(`Location not found: ${query}`)
  return data.results[0]!
}

async function fetchWeather(geo: GeoResult, fahrenheit: boolean): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(geo.latitude),
    longitude: String(geo.longitude),
    timezone: geo.timezone,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,windspeed_10m,weathercode,uv_index',
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    forecast_days: '7',
    ...(fahrenheit ? { temperature_unit: 'fahrenheit', windspeed_unit: 'mph' } : {}),
  })
  const url = `https://api.open-meteo.com/v1/forecast?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather request failed')
  const d = await res.json() as {
    current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; windspeed_10m: number; weathercode: number; uv_index: number }
    daily: { time: string[]; weathercode: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; sunrise: string[]; sunset: string[] }
  }
  return {
    location: geo,
    current: {
      temperature: Math.round(d.current.temperature_2m),
      feelsLike: Math.round(d.current.apparent_temperature),
      humidity: d.current.relative_humidity_2m,
      windspeed: Math.round(d.current.windspeed_10m),
      code: d.current.weathercode,
      uvIndex: Math.round(d.current.uv_index),
    },
    today: {
      precipProb: d.daily.precipitation_probability_max[0] ?? 0,
      sunrise: d.daily.sunrise[0] ?? '',
      sunset: d.daily.sunset[0] ?? '',
    },
    daily: d.daily.time.map((date, i) => ({
      date,
      codeDay: d.daily.weathercode[i]!,
      high: Math.round(d.daily.temperature_2m_max[i]!),
      low: Math.round(d.daily.temperature_2m_min[i]!),
    })),
  }
}

function buildSummary(data: WeatherData, fahrenheit: boolean): string {
  const cur = data.current
  const today = data.daily[0]
  const unit = fahrenheit ? '°F' : '°C'
  const speedUnit = fahrenheit ? 'mph' : 'km/h'
  const conditions = (WMO[cur.code] ?? { label: 'Unknown' }).label.toLowerCase()
  let s = `Currently ${cur.temperature}${unit} and ${conditions} in ${data.location.name}, ${data.location.country}.`
  if (today) s += ` High of ${today.high}°, low of ${today.low}°.`
  s += ` Humidity ${cur.humidity}%, wind ${cur.windspeed} ${speedUnit}.`
  return s
}

// ── Weather category ──────────────────────────────────────────────────────────
function getWeatherCategory(code: number): 'clear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' {
  if (code <= 1) return 'clear'
  if (code === 2) return 'partlyCloudy'
  if (code === 3) return 'cloudy'
  if (code <= 48) return 'fog'
  if (code <= 67) return 'rain'
  if (code <= 86) return 'snow'
  return 'storm'
}

// ── Animated SVG Weather Icons ────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg viewBox="0 0 100 100" className="weather-icon" aria-hidden="true">
      <defs>
        <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="30" fill="rgba(251,191,36,0.07)" className="sun-halo" />
      <circle cx="50" cy="50" r="22" fill="rgba(251,191,36,0.12)" className="sun-halo" style={{ animationDelay: '0.5s' }} />
      <g className="sun-rays-group">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="48.5" y="5" width="3" height="10" rx="1.5"
            fill="#fbbf24" opacity="0.75"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="15" fill="url(#sunGrad)" />
    </svg>
  )
}

function PartlyCloudyIcon() {
  return (
    <svg viewBox="0 0 100 100" className="weather-icon" aria-hidden="true">
      <defs>
        <radialGradient id="sunGrad2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <g className="sun-rays-group" style={{ ['--ox' as string]: '30px', ['--oy' as string]: '36px' }}>
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <rect
            key={angle}
            x="28.5" y="14" width="3" height="8" rx="1.5"
            fill="#fbbf24" opacity="0.7"
            transform={`rotate(${angle} 30 36)`}
          />
        ))}
      </g>
      <circle cx="30" cy="36" r="11" fill="url(#sunGrad2)" />
      <g className="cloud-float-group">
        <ellipse cx="60" cy="66" rx="30" ry="14" fill="rgba(255,255,255,0.22)" />
        <circle cx="44" cy="62" r="14" fill="rgba(255,255,255,0.22)" />
        <circle cx="60" cy="55" r="18" fill="rgba(255,255,255,0.22)" />
        <circle cx="76" cy="60" r="13" fill="rgba(255,255,255,0.22)" />
      </g>
    </svg>
  )
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 100 100" className="weather-icon" aria-hidden="true">
      <g className="cloud-float-group">
        <ellipse cx="50" cy="64" rx="34" ry="16" fill="rgba(255,255,255,0.18)" />
        <circle cx="33" cy="59" r="15" fill="rgba(255,255,255,0.18)" />
        <circle cx="52" cy="51" r="20" fill="rgba(255,255,255,0.18)" />
        <circle cx="69" cy="57" r="14" fill="rgba(255,255,255,0.18)" />
      </g>
    </svg>
  )
}

function RainIcon() {
  const drops = [
    { x1: 35, y1: 64, x2: 29, y2: 80, delay: '0s' },
    { x1: 47, y1: 61, x2: 41, y2: 77, delay: '0.22s' },
    { x1: 59, y1: 65, x2: 53, y2: 81, delay: '0.09s' },
    { x1: 41, y1: 73, x2: 35, y2: 89, delay: '0.38s' },
    { x1: 53, y1: 69, x2: 47, y2: 85, delay: '0.16s' },
    { x1: 65, y1: 71, x2: 59, y2: 87, delay: '0.04s' },
  ]
  return (
    <svg viewBox="0 0 100 100" className="weather-icon" aria-hidden="true">
      <g className="cloud-float-group">
        <ellipse cx="50" cy="44" rx="30" ry="13" fill="rgba(255,255,255,0.22)" />
        <circle cx="35" cy="40" r="13" fill="rgba(255,255,255,0.22)" />
        <circle cx="52" cy="33" r="17" fill="rgba(255,255,255,0.22)" />
        <circle cx="67" cy="39" r="12" fill="rgba(255,255,255,0.22)" />
      </g>
      {drops.map((d, i) => (
        <line
          key={i}
          x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
          stroke="rgba(147,197,253,0.85)" strokeWidth="2.5" strokeLinecap="round"
          className="rain-drop-anim"
          style={{ animationDelay: d.delay }}
        />
      ))}
    </svg>
  )
}

function SnowIcon() {
  const flakes = [
    { cx: 35, cy: 70, delay: '0s' },
    { cx: 50, cy: 65, delay: '0.28s' },
    { cx: 65, cy: 72, delay: '0.11s' },
    { cx: 42, cy: 80, delay: '0.42s' },
    { cx: 57, cy: 77, delay: '0.19s' },
  ]
  return (
    <svg viewBox="0 0 100 100" className="weather-icon" aria-hidden="true">
      <g className="cloud-float-group">
        <ellipse cx="50" cy="42" rx="30" ry="13" fill="rgba(255,255,255,0.24)" />
        <circle cx="35" cy="38" r="13" fill="rgba(255,255,255,0.24)" />
        <circle cx="52" cy="31" r="17" fill="rgba(255,255,255,0.24)" />
        <circle cx="67" cy="37" r="12" fill="rgba(255,255,255,0.24)" />
      </g>
      {flakes.map((f, i) => (
        <circle
          key={i}
          cx={f.cx} cy={f.cy} r="3.5"
          fill="rgba(219,234,254,0.88)"
          className="snow-flake-anim"
          style={{ animationDelay: f.delay }}
        />
      ))}
    </svg>
  )
}

function StormIcon() {
  return (
    <svg viewBox="0 0 100 100" className="weather-icon" aria-hidden="true">
      <g className="cloud-float-group">
        <ellipse cx="50" cy="38" rx="32" ry="14" fill="rgba(100,116,139,0.4)" />
        <circle cx="33" cy="34" r="14" fill="rgba(100,116,139,0.4)" />
        <circle cx="52" cy="26" r="19" fill="rgba(100,116,139,0.4)" />
        <circle cx="69" cy="33" r="14" fill="rgba(100,116,139,0.4)" />
      </g>
      <polyline
        points="58,54 48,69 56,69 46,86"
        fill="none" stroke="#fbbf24" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round"
        className="lightning-anim"
      />
    </svg>
  )
}

function FogIcon() {
  const lines = [
    { y: 30, x1: 14, x2: 86, delay: '0s',    op: 0.6 },
    { y: 43, x1: 22, x2: 78, delay: '0.35s',  op: 0.5 },
    { y: 56, x1: 10, x2: 90, delay: '0.12s',  op: 0.4 },
    { y: 69, x1: 26, x2: 74, delay: '0.55s',  op: 0.32 },
    { y: 82, x1: 18, x2: 82, delay: '0.22s',  op: 0.26 },
  ]
  return (
    <svg viewBox="0 0 100 100" className="weather-icon" aria-hidden="true">
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1} y1={l.y} x2={l.x2} y2={l.y}
          stroke={`rgba(209,213,219,${l.op})`}
          strokeWidth="5.5" strokeLinecap="round"
          className="fog-line-anim"
          style={{ animationDelay: l.delay }}
        />
      ))}
    </svg>
  )
}

function WeatherIcon({ code }: { code: number }) {
  const cat = getWeatherCategory(code)
  if (cat === 'clear') return <SunIcon />
  if (cat === 'partlyCloudy') return <PartlyCloudyIcon />
  if (cat === 'cloudy') return <CloudIcon />
  if (cat === 'fog') return <FogIcon />
  if (cat === 'rain') return <RainIcon />
  if (cat === 'snow') return <SnowIcon />
  return <StormIcon />
}

// ── Sunrise / Sunset Arc ──────────────────────────────────────────────────────
function SunriseSunsetArc({ sunrise, sunset }: { sunrise: string; sunset: string }) {
  const now = Date.now()
  const riseMs = new Date(sunrise).getTime()
  const setMs  = new Date(sunset).getTime()
  const daySpan = setMs - riseMs
  const progress = daySpan > 0
    ? Math.max(0, Math.min(1, (now - riseMs) / daySpan))
    : 0.5
  const daytime = now >= riseMs && now <= setMs

  const R = 42, cx = 50, cy = 46
  const sx = cx - R * Math.cos(progress * Math.PI)
  const sy = cy - R * Math.sin(progress * Math.PI)

  return (
    <div className="detail-card detail-card--wide arc-card">
      <span className="detail-card-label">Sunrise &amp; Sunset</span>
      <svg viewBox="0 0 100 50" className="sun-arc-svg" aria-hidden="true">
        <line x1={cx - R - 4} y1={cy} x2={cx + R + 4} y2={cy}
          stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2"
        />
        {daytime && progress > 0.01 && (
          <path
            d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${sx} ${sy}`}
            fill="none" stroke="rgba(251,191,36,0.6)" strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        {daytime && (
          <>
            <circle cx={sx} cy={sy} r="8" fill="rgba(251,191,36,0.15)" />
            <circle cx={sx} cy={sy} r="5" fill="rgba(251,191,36,0.3)" />
            <circle cx={sx} cy={sy} r="3" fill="#fbbf24" />
          </>
        )}
        <circle cx={cx - R} cy={cy} r="3" fill="rgba(255,180,80,0.5)" />
        <circle cx={cx + R} cy={cy} r="3" fill="rgba(255,110,50,0.5)" />
      </svg>
      <div className="arc-times">
        <div className="arc-time">
          <span className="arc-time-icon">🌅</span>
          <span className="arc-time-label">Sunrise</span>
          <span className="arc-time-val">{sunrise ? formatTime(sunrise) : '—'}</span>
        </div>
        <div className="arc-time arc-time--right">
          <span className="arc-time-icon">🌇</span>
          <span className="arc-time-label">Sunset</span>
          <span className="arc-time-val">{sunset ? formatTime(sunset) : '—'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Temperature Range Bar ─────────────────────────────────────────────────────
function TempBar({ low, high, globalMin, globalMax }: {
  low: number; high: number; globalMin: number; globalMax: number
}) {
  const range = globalMax - globalMin || 1
  const leftPct  = ((low  - globalMin) / range) * 100
  const widthPct = Math.max(((high - low) / range) * 100, 8)
  return (
    <div className="temp-bar-track">
      <div
        className="temp-bar-fill"
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      />
    </div>
  )
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="skeleton-wrap">
      <div className="sk sk-icon" />
      <div className="sk sk-temp" />
      <div className="sk sk-desc" />
      <div className="sk-cards-row">
        {[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-card" />)}
      </div>
      <div className="sk sk-arc" />
      <div className="sk-forecast-row">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="sk sk-day" />)}
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface WeatherAppProps {
  state: Record<string, unknown>
  onStateUpdate?: (state: Record<string, unknown>) => void
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function WeatherApp({ state, onStateUpdate }: WeatherAppProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [inputValue, setInputValue] = useState('')
  const invocationIdRef = useRef('weather-load')
  const [fahrenheit, setFahrenheit] = useState<boolean>(() => {
    try { return localStorage.getItem('weather_unit') !== 'c' } catch { return true }
  })

  const tempUnit = fahrenheit ? '°F' : '°C'
  const speedUnit = fahrenheit ? 'mph' : 'km/h'

  // Load initial location from plugin state prop
  useEffect(() => {
    const loc = typeof state.location === 'string' ? state.location : null
    if (loc) {
      setQuery(loc)
      setInputValue(loc)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for tool invocations from abstract-ai-sdk
  useEffect(() => {
    const handler = (event: Event) => {
      const { tool, params, invocationId } = (event as CustomEvent<{
        tool: string
        params: Record<string, unknown>
        invocationId?: string
      }>).detail
      if (
        (tool === 'show_weather' || tool === 'update_location') &&
        typeof params?.location === 'string'
      ) {
        invocationIdRef.current = invocationId ?? 'weather-load'
        setQuery(params.location)
        setInputValue(params.location)
      }
    }
    window.addEventListener('app:toolInvoke', handler)
    return () => window.removeEventListener('app:toolInvoke', handler)
  }, [])

  // Fetch whenever query or unit preference changes
  useEffect(() => {
    if (!query.trim()) return
    let cancelled = false
    setLoading(true)
    setError(null)
    geocode(query)
      .then((geo) => fetchWeather(geo, fahrenheit))
      .then((data) => {
        if (cancelled) return
        setWeather(data)
        setLoading(false)

        onStateUpdate?.({
          location: `${data.location.name}, ${data.location.country}`,
          temperature: data.current.temperature,
          unit: fahrenheit ? '°F' : '°C',
          conditions: (WMO[data.current.code] ?? { label: 'Unknown' }).label,
          humidity: data.current.humidity,
          wind: data.current.windspeed,
          summary: buildSummary(data, fahrenheit),
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [query, fahrenheit]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleUnit = () => {
    setFahrenheit((f) => {
      const next = !f
      try { localStorage.setItem('weather_unit', next ? 'f' : 'c') } catch { /* ignore */ }
      return next
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) setQuery(inputValue.trim())
  }

  const cur    = weather?.current
  const curWmo = cur ? wmo(cur.code) : null
  const gradient = cur
    ? getWeatherGradient(cur.code)
    : 'linear-gradient(160deg, #1e2030 0%, #0d0f1a 100%)'

  const globalMin = weather ? Math.min(...weather.daily.map((d) => d.low))  : 0
  const globalMax = weather ? Math.max(...weather.daily.map((d) => d.high)) : 1

  return (
    <div className="app" style={{ background: gradient }}>
      <div className="noise-overlay" aria-hidden="true" />

      {/* ── Top Bar ── */}
      <div className="top-row">
        <form className="search-bar" onSubmit={handleSearch}>
          <div className="search-pill">
            <svg className="search-icon-svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" />
              <line x1="12.5" y1="12.5" x2="16.5" y2="16.5"
                stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              className="search-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="City or place…"
            />
          </div>
        </form>
        <div className="unit-pill">
          <button
            className={`unit-opt${fahrenheit ? ' unit-opt--active' : ''}`}
            type="button"
            onClick={() => { if (!fahrenheit) toggleUnit() }}
          >°F</button>
          <button
            className={`unit-opt${!fahrenheit ? ' unit-opt--active' : ''}`}
            type="button"
            onClick={() => { if (fahrenheit) toggleUnit() }}
          >°C</button>
        </div>
      </div>

      {/* ── Loading skeleton ── */}
      {loading && <LoadingSkeleton />}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="state-msg state-msg--error">
          <svg viewBox="0 0 24 24" fill="none" className="state-icon" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="#fca5a5" strokeWidth="1.5" />
            <line x1="12" y1="7" x2="12" y2="13" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1" fill="#fca5a5" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Weather content ── */}
      {!loading && !error && weather && cur && curWmo && (
        <div className="weather-content">

          {/* Hero */}
          <div className="hero">
            <div className="location-name">{weather.location.name}</div>
            <div className="location-country">{weather.location.country}</div>
            <div className="hero-main">
              <div className="icon-wrap">
                <WeatherIcon code={cur.code} />
              </div>
              <div className="temp-col">
                <div className="current-temp">
                  <span className="temp-num">{cur.temperature}</span>
                  <span className="temp-sup">{tempUnit}</span>
                </div>
              </div>
            </div>
            <div className="current-desc">{curWmo.label}</div>
            <div className="feels-like">Feels like {cur.feelsLike}{tempUnit}</div>
          </div>

          {/* Detail cards */}
          <div className="detail-grid">
            <div className="detail-card">
              <span className="detail-card-icon">💧</span>
              <span className="detail-card-label">Humidity</span>
              <span className="detail-card-val">
                {cur.humidity}<span className="detail-card-unit">%</span>
              </span>
            </div>
            <div className="detail-card">
              <span className="detail-card-icon">💨</span>
              <span className="detail-card-label">Wind</span>
              <span className="detail-card-val">
                {cur.windspeed}<span className="detail-card-unit"> {speedUnit}</span>
              </span>
            </div>
            <div className="detail-card">
              <span className="detail-card-icon">🌧️</span>
              <span className="detail-card-label">Rain chance</span>
              <span className="detail-card-val">
                {weather.today.precipProb}<span className="detail-card-unit">%</span>
              </span>
            </div>
            <div className="detail-card">
              <span className="detail-card-icon">🔆</span>
              <span className="detail-card-label">UV Index</span>
              <span className="detail-card-val">{cur.uvIndex}</span>
            </div>
            {weather.today.sunrise && weather.today.sunset && (
              <SunriseSunsetArc sunrise={weather.today.sunrise} sunset={weather.today.sunset} />
            )}
          </div>

          {/* 7-Day Forecast */}
          <div className="forecast-section">
            <div className="forecast-label">7-Day Forecast</div>
            <div className="forecast">
              {weather.daily.map((day, i) => {
                const w = wmo(day.codeDay)
                return (
                  <div key={day.date} className={`forecast-day${i === 0 ? ' today' : ''}`}>
                    <div className="forecast-day-name">{i === 0 ? 'Today' : shortDay(day.date)}</div>
                    <div className="forecast-emoji">{w.emoji}</div>
                    <TempBar low={day.low} high={day.high} globalMin={globalMin} globalMax={globalMax} />
                    <div className="forecast-temps">
                      <span className="forecast-high">{day.high}°</span>
                      <span className="forecast-low">{day.low}°</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && !weather && (
        <div className="state-msg">
          <svg viewBox="0 0 40 40" fill="none" className="state-icon state-icon--lg" aria-hidden="true">
            <circle cx="20" cy="20" r="13" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="5.5" fill="rgba(255,255,255,0.1)" />
            {[0, 90, 180, 270].map((a) => (
              <line key={a}
                x1="20" y1="5" x2="20" y2="9"
                stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round"
                transform={`rotate(${a} 20 20)`}
              />
            ))}
          </svg>
          Search a city to see the forecast
        </div>
      )}
    </div>
  )
}
