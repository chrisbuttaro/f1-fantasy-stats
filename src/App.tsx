import { useState, useEffect, useCallback } from 'react'
import './App.css'

interface Driver {
  playerid: string
  playername: string
  curvalue: number
  teamid: string
  teamname: string
  statvalue: number
  rnk: number
}

interface RaceStat {
  gamedayId: number
  meetingName: string
  location: string
  points: number
}

const TEAM_COLORS: Record<string, string> = {
  'Mercedes':         '#27F4D2',
  'Ferrari':          '#E8002D',
  'Red Bull Racing':  '#3671C6',
  'McLaren':          '#FF8000',
  'Alpine':           '#FF87BC',
  'Aston Martin':     '#229971',
  'Williams':         '#64C4FF',
  'Racing Bulls':     '#6692FF',
  'Haas F1 Team':     '#B6BABD',
  'Cadillac':         '#C8A84B',
  'Audi':             '#C0C0C0',
}

function teamColor(teamname: string): string {
  return TEAM_COLORS[teamname] ?? '#71717a'
}

function RaceChart({ stats, color }: { stats: RaceStat[], color: string }) {
  const W = 560, H = 160
  const pad = { top: 28, right: 20, bottom: 50, left: 44 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom
  const n = stats.length

  const values = stats.map(s => s.points)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const allSame = minV === maxV

  const xOf = (i: number) => pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yOf = (v: number) => allSame
    ? pad.top + plotH / 2
    : pad.top + plotH - ((v - minV) / (maxV - minV)) * plotH

  const polylinePoints = stats.map((s, i) => `${xOf(i)},${yOf(s.points)}`).join(' ')

  const guides = allSame
    ? [{ v: minV, y: yOf(minV) }]
    : [
        { v: minV, y: yOf(minV) },
        { v: Math.round((minV + maxV) / 2), y: yOf((minV + maxV) / 2) },
        { v: maxV, y: yOf(maxV) },
      ]

  // Area fill path: down from first point, along bottom, back up
  const areaPath = n > 1
    ? `M ${xOf(0)},${yOf(stats[0].points)} ` +
      stats.slice(1).map((s, i) => `L ${xOf(i + 1)},${yOf(s.points)}`).join(' ') +
      ` L ${xOf(n - 1)},${pad.top + plotH} L ${xOf(0)},${pad.top + plotH} Z`
    : ''

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-label="Race points chart"
    >
      <defs>
        <linearGradient id={`area-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Guide lines */}
      {guides.map((g, i) => (
        <g key={i}>
          <line
            x1={pad.left} y1={g.y}
            x2={W - pad.right} y2={g.y}
            stroke="#2a2a3a" strokeWidth="1"
          />
          <text
            x={pad.left - 6} y={g.y}
            textAnchor="end" dominantBaseline="middle"
            fontSize="9" fill="#71717a"
          >
            {g.v}
          </text>
        </g>
      ))}

      {/* Area fill */}
      {areaPath && (
        <path
          d={areaPath}
          fill={`url(#area-grad-${color.replace('#', '')})`}
        />
      )}

      {/* Line */}
      {n > 1 && (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Dots + value labels + x-axis labels */}
      {stats.map((s, i) => (
        <g key={s.gamedayId}>
          <circle cx={xOf(i)} cy={yOf(s.points)} r="4" fill={color} />
          <circle cx={xOf(i)} cy={yOf(s.points)} r="7" fill={color} fillOpacity="0.15" />
          <text
            x={xOf(i)} y={yOf(s.points) - 12}
            textAnchor="middle" fontSize="10" fill="#e0e0e0" fontWeight="700"
          >
            {s.points > 0 ? '+' : ''}{s.points}
          </text>
          <text
            x={xOf(i)} y={H - pad.bottom + 14}
            textAnchor="middle" fontSize="9" fill="#9ca3af"
          >
            {s.location}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function App() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [season, setSeason] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statsCache, setStatsCache] = useState<Record<string, RaceStat[]>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  const fetchDrivers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const buster = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const res = await fetch(
        `/api/f1/driverconstructors_4.json?buster=${buster}`,
        {
          headers: {
            Accept: 'application/json, text/plain, */*',
            Referer: 'https://fantasy.formula1.com/en/statistics',
          },
        }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const data = json.Data
      setSeason(data.season ?? '')
      const participants: Driver[] = data.driver[0].participants
      const sorted = [...participants].sort((a, b) => b.statvalue - a.statvalue)
      setDrivers(sorted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDrivers()
  }, [fetchDrivers])

  const toggleDriver = useCallback(async (playerId: string) => {
    if (selectedId === playerId) {
      setSelectedId(null)
      return
    }
    setSelectedId(playerId)
    if (statsCache[playerId]) return

    setStatsLoading(true)
    setStatsError(null)
    try {
      const buster = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const res = await fetch(
        `/api/f1-popup/playerstats_${playerId}.json?buster=${buster}`,
        {
          headers: {
            Accept: 'application/json, text/plain, */*',
            Referer: 'https://fantasy.formula1.com/en/statistics',
          },
        }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const val = json.Value

      // Total points per gameday
      const totals: Record<number, number> = {}
      for (const gd of val.GamedayWiseStats) {
        const total = gd.StatsWise.find((s: { Event: string }) => s.Event === 'Total')
        if (total) totals[gd.GamedayId] = total.Value
      }

      // Race names from FixtureWiseStats
      const races: RaceStat[] = []
      for (const fx of val.FixtureWiseStats) {
        if (fx.RaceDayWise.length > 0 && totals[fx.GamedayId] !== undefined) {
          const rd = fx.RaceDayWise[0]
          races.push({
            gamedayId: fx.GamedayId,
            meetingName: rd.MeetingName,
            location: rd.MeetingLocation,
            points: totals[fx.GamedayId],
          })
        }
      }
      races.sort((a, b) => a.gamedayId - b.gamedayId)

      setStatsCache(prev => ({ ...prev, [playerId]: races }))
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setStatsLoading(false)
    }
  }, [selectedId, statsCache])

  return (
    <div className="app">
      <header className="header">
        <span className="header-logo-f1">F1</span>
        <span className="header-logo-fantasy">Fantasy</span>
        <div className="header-divider" />
        <span className="header-title">Driver Statistics</span>
      </header>

      {loading ? (
        <div className="state-container">
          <div className="loading-spinner" />
        </div>
      ) : error ? (
        <div className="state-container">
          <div className="error-box">
            <p>Failed to load driver data: {error}</p>
            <button className="retry-btn" onClick={fetchDrivers}>Retry</button>
          </div>
        </div>
      ) : (
        <main className="page">
          <div className="page-heading">
            <h1>Driver <span>Rankings</span></h1>
            {season && <span className="season-badge">{season} Season</span>}
          </div>

          <div className="table-card">
            <div className="table-header">
              <span className="col-label">Rank</span>
              <span className="col-label">Driver</span>
              <span className="col-label team-col">Team</span>
              <span className="col-label right price-col">Price</span>
              <span className="col-label right">Points</span>
            </div>

            {drivers.map((driver, idx) => {
              const color = teamColor(driver.teamname)
              const rankClass =
                driver.rnk === 1 ? 'rank-1'
                : driver.rnk === 2 ? 'rank-2'
                : driver.rnk === 3 ? 'rank-3'
                : ''
              const isSelected = selectedId === driver.playerid
              const isLast = idx === drivers.length - 1
              const stats = statsCache[driver.playerid]

              return (
                <div
                  key={driver.playerid}
                  className={`driver-block${isLast && !isSelected ? ' last' : ''}`}
                >
                  <div
                    className={`driver-row${isSelected ? ' expanded' : ''}`}
                    style={{ '--team-color': color } as React.CSSProperties}
                    onClick={() => toggleDriver(driver.playerid)}
                  >
                    <div className="rank">
                      <span className={`rank-number ${rankClass}`}>
                        {driver.rnk}
                      </span>
                    </div>

                    <div className="driver-info">
                      <span className="driver-name">{driver.playername}</span>
                      <span className="driver-team-label">{driver.teamname}</span>
                    </div>

                    <div className="team-cell">
                      <span className="team-dot" />
                      <span className="team-name-text">{driver.teamname}</span>
                    </div>

                    <div className="price">
                      ${driver.curvalue.toFixed(1)}m
                    </div>

                    <div className="points">
                      <span className={`points-value ${driver.statvalue < 0 ? 'negative' : ''}`}>
                        {driver.statvalue > 0 ? '+' : ''}{driver.statvalue}
                      </span>
                      <span className="points-unit">pts</span>
                    </div>

                    <div className={`row-chevron${isSelected ? ' open' : ''}`} />
                  </div>

                  {isSelected && (
                    <div className="chart-panel" style={{ '--team-color': color } as React.CSSProperties}>
                      {statsLoading && !stats ? (
                        <div className="chart-loading">
                          <div className="loading-spinner small" />
                        </div>
                      ) : statsError && !stats ? (
                        <div className="chart-error">{statsError}</div>
                      ) : stats && stats.length > 0 ? (
                        <>
                          <div className="chart-title">{driver.playername} — Points per Race</div>
                          <RaceChart stats={stats} color={color} />
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </main>
      )}

      <footer className="footer">
        Data sourced from F1 Fantasy · {season} Season
      </footer>
    </div>
  )
}
