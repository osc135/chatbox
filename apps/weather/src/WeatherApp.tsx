import { useState, useEffect, useRef } from 'react'

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

function shortDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' })
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
  // Normalize "City, State" → "City State" — the API doesn't handle commas well
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
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,windspeed_10m,weathercode',
    daily: 'weathercode,temperature_2m_max,temperature_2m_min',
    forecast_days: '7',
    ...(fahrenheit ? { temperature_unit: 'fahrenheit', windspeed_unit: 'mph' } : {}),
  })
  const url = `https://api.open-meteo.com/v1/forecast?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather request failed')
  const d = await res.json() as {
    current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; windspeed_10m: number; weathercode: number }
    daily: { time: string[]; weathercode: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] }
  }
  return {
    location: geo,
    current: {
      temperature: Math.round(d.current.temperature_2m),
      feelsLike: Math.round(d.current.apparent_temperature),
      humidity: d.current.relative_humidity_2m,
      windspeed: Math.round(d.current.windspeed_10m),
      code: d.current.weathercode,
    },
    daily: d.daily.time.map((date, i) => ({
      date,
      codeDay: d.daily.weathercode[i]!,
      high: Math.round(d.daily.temperature_2m_max[i]!),
      low: Math.round(d.daily.temperature_2m_min[i]!),
    })),
  }
}

// ── postMessage helpers ───────────────────────────────────────────────────────
function sendToParent(message: Record<string, unknown>) {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*')
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function WeatherApp() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [inputValue, setInputValue] = useState('')
  const invocationIdRef = useRef('weather-load')
  const hasCompletedRef = useRef(false)
  const [fahrenheit, setFahrenheit] = useState<boolean>(() => {
    try { return localStorage.getItem('weather_unit') !== 'c' } catch { return true }
  })

  const tempUnit = fahrenheit ? '°F' : '°C'
  const speedUnit = fahrenheit ? 'mph' : 'km/h'

  // Load location from URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const loc = params.get('location')
    if (loc) {
      setQuery(loc)
      setInputValue(loc)
    }
  }, [])

  // Listen for TOOL_INVOKE show_weather / update_location from parent
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; tool?: string; invocationId?: string; params?: { location?: string } } | undefined
      if (
        data?.type === 'TOOL_INVOKE' &&
        (data.tool === 'show_weather' || data.tool === 'update_location') &&
        data.params?.location
      ) {
        invocationIdRef.current = data.invocationId ?? 'weather-load'
        setQuery(data.params.location)
        setInputValue(data.params.location)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
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

        sendToParent({
          type: 'STATE_UPDATE',
          pluginId: 'weather',
          invocationId: invocationIdRef.current,
          payload: {
            location: `${data.location.name}, ${data.location.country}`,
            temperature: data.current.temperature,
            unit: fahrenheit ? '°F' : '°C',
            conditions: (WMO[data.current.code] ?? { label: 'Unknown' }).label,
            humidity: data.current.humidity,
            wind: data.current.windspeed,
            summary: buildSummary(data, fahrenheit),
          },
        })

        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true
          sendToParent({
            type: 'COMPLETION',
            pluginId: 'weather',
            payload: { reason: 'data_loaded' },
          })
        }
      })
      .catch((err: unknown) => { if (!cancelled) { setError(err instanceof Error ? err.message : String(err)); setLoading(false) } })
    return () => { cancelled = true }
  }, [query, fahrenheit])

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

  const cur = weather?.current
  const curWmo = cur ? wmo(cur.code) : null

  return (
    <div className="app">
      <div className="top-row">
        <form className="search-bar" onSubmit={handleSearch}>
          <input
            className="search-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search location…"
          />
          <button className="search-btn" type="submit">→</button>
        </form>
        <button className="unit-toggle" type="button" onClick={toggleUnit}>
          {fahrenheit ? '°F' : '°C'}
        </button>
      </div>

      {loading && <div className="state-msg">Loading weather…</div>}
      {error && !loading && <div className="state-msg error">{error}</div>}

      {!loading && !error && weather && cur && curWmo && (
        <>
          <div className="location-name">
            {weather.location.name}, {weather.location.country}
          </div>

          <div className="current-card">
            <div className="current-left">
              <div className="current-emoji">{curWmo.emoji}</div>
              <div className="current-temp">{cur.temperature}{tempUnit}</div>
              <div className="current-desc">{curWmo.label}</div>
            </div>
            <div className="current-right">
              <div className="detail-row">
                <span className="detail-label">Feels like</span>
                <span className="detail-val">{cur.feelsLike}{tempUnit}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Humidity</span>
                <span className="detail-val">{cur.humidity}%</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Wind</span>
                <span className="detail-val">{cur.windspeed} {speedUnit}</span>
              </div>
            </div>
          </div>

          <div className="forecast">
            {weather.daily.map((day) => {
              const w = wmo(day.codeDay)
              return (
                <div key={day.date} className="forecast-day">
                  <div className="forecast-day-name">{shortDay(day.date)}</div>
                  <div className="forecast-emoji">{w.emoji}</div>
                  <div className="forecast-temps">
                    <span className="forecast-high">{day.high}°</span>
                    <span className="forecast-low">{day.low}°</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {!loading && !error && !weather && (
        <div className="state-msg">Enter a location to see the weather.</div>
      )}
    </div>
  )
}
