import { useState, useEffect, useCallback } from 'react'
import './App.css'

// ── Types ────────────────────────────────────────────────────────────────────

// A single driver entry from the F1 Fantasy statistics feed
interface Driver {
  playerid: string    // unique player ID — used as key and in popup API URLs
  playername: string
  curvalue: number    // current price in $m (e.g. 23.2 = $23.2M)
  teamid: string
  teamname: string
  statvalue: number   // total fantasy points for the season
  rnk: number         // current fantasy ranking
}

// Per-race points for a driver, built by combining GamedayWiseStats + FixtureWiseStats
interface RaceStat {
  gamedayId: number   // F1 Fantasy internal game-day ID (1 = first race of season)
  meetingName: string // e.g. "Australian Grand Prix"
  location: string    // e.g. "Melbourne" — used as the x-axis label in the chart
  points: number      // total fantasy points scored at this race
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Official team hex colours used for the left-border accent and chart lines.
// Falls back to neutral grey for any team name not listed here.
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

// ── RaceChart ─────────────────────────────────────────────────────────────────

// Pure SVG line chart — no third-party charting library.
// Renders fantasy points per race for a single driver.
function RaceChart({ stats, color }: { stats: RaceStat[], color: string }) {
  // SVG canvas dimensions and inner plot padding
  const W = 560, H = 160
  const pad = { top: 28, right: 20, bottom: 50, left: 44 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom
  const n = stats.length

  const values = stats.map(s => s.points)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  // When all values are equal, keep the line centred rather than at the bottom
  const allSame = minV === maxV

  // Map a data-point index to its SVG x coordinate
  const xOf = (i: number) => pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  // Map a points value to its SVG y coordinate (higher points = higher on canvas)
  const yOf = (v: number) => allSame
    ? pad.top + plotH / 2
    : pad.top + plotH - ((v - minV) / (maxV - minV)) * plotH

  // Space-separated "x,y x,y …" string for the <polyline>
  const polylinePoints = stats.map((s, i) => `${xOf(i)},${yOf(s.points)}`).join(' ')

  // Horizontal guide lines: show min / midpoint / max (or just the one value if flat)
  const guides = allSame
    ? [{ v: minV, y: yOf(minV) }]
    : [
        { v: minV, y: yOf(minV) },
        { v: Math.round((minV + maxV) / 2), y: yOf((minV + maxV) / 2) },
        { v: maxV, y: yOf(maxV) },
      ]

  // Closed SVG path that fills the area beneath the line with a gradient
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
        {/* Team-coloured gradient fades to transparent at the bottom of the area fill */}
        <linearGradient id={`area-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal guide lines with y-axis value labels */}
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

      {/* Gradient area fill beneath the line */}
      {areaPath && (
        <path
          d={areaPath}
          fill={`url(#area-grad-${color.replace('#', '')})`}
        />
      )}

      {/* The line itself — only drawn when there are at least 2 data points */}
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

      {/* Per-race: dot, halo, points label above, location label below */}
      {stats.map((s, i) => (
        <g key={s.gamedayId}>
          {/* Solid dot */}
          <circle cx={xOf(i)} cy={yOf(s.points)} r="4" fill={color} />
          {/* Transparent halo for visual weight */}
          <circle cx={xOf(i)} cy={yOf(s.points)} r="7" fill={color} fillOpacity="0.15" />
          {/* Points value above the dot */}
          <text
            x={xOf(i)} y={yOf(s.points) - 12}
            textAnchor="middle" fontSize="10" fill="#e0e0e0" fontWeight="700"
          >
            {s.points > 0 ? '+' : ''}{s.points}
          </text>
          {/* Race location label on the x-axis */}
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

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // Driver list and initial load state
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [season, setSeason] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Which driver row has its race-points chart expanded (null = none)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Cache of fetched per-race stats keyed by playerid — avoids re-fetching
  const [statsCache, setStatsCache] = useState<Record<string, RaceStat[]>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // playerids of drivers the user has added to their fantasy team (max 5)
  const [pickedIds, setPickedIds] = useState<string[]>([])

  // ── Data fetching ──────────────────────────────────────────────────────────

  // Loads the full driver list from the F1 Fantasy statistics feed.
  // The ?buster= timestamp param bypasses CDN caching to get fresh data.
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
      // driver[0] is the "fantasy points" category; sort descending by total points
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

  // Toggles the per-race chart for a driver row.
  // On first expand, fetches from the popup stats endpoint and caches the result.
  const toggleDriver = useCallback(async (playerId: string) => {
    // Clicking the same row again collapses it
    if (selectedId === playerId) {
      setSelectedId(null)
      return
    }
    setSelectedId(playerId)

    // Skip fetch if we already have this driver's stats cached
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

      // Build a map of { gamedayId → total points } from GamedayWiseStats.
      // Each game-day has a StatsWise array; the entry with Event === "Total"
      // is the sum of all scoring events for that race weekend.
      const totals: Record<number, number> = {}
      for (const gd of val.GamedayWiseStats) {
        const total = gd.StatsWise.find((s: { Event: string }) => s.Event === 'Total')
        if (total) totals[gd.GamedayId] = total.Value
      }

      // FixtureWiseStats provides the human-readable race name and location
      // for each game-day. Cross-reference with totals to build RaceStat[].
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

  // Toggles a driver in/out of the user's picked team.
  // stopPropagation prevents the click from also triggering toggleDriver on the row.
  // Maximum of 5 drivers can be picked at once.
  const togglePick = useCallback((e: React.MouseEvent, playerId: string) => {
    e.stopPropagation()
    setPickedIds(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId)
      if (prev.length >= 5) return prev
      return [...prev, playerId]
    })
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {/* Sticky top bar with F1 Fantasy branding */}
      <header className="header">
        <span className="header-logo-f1">F1</span>
        <span className="header-logo-fantasy">Fantasy</span>
        <div className="header-divider" />
        <span className="header-title">Driver Statistics</span>
      </header>

      {/* Full-page loading spinner while the initial driver list is fetching */}
      {loading ? (
        <div className="state-container">
          <div className="loading-spinner" />
        </div>
      ) : error ? (
        /* Error state with retry button */
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

          {/* ── Driver table ── */}
          <div className="table-card">
            {/* Column headers — grid must match .driver-row exactly (6 columns) */}
            <div className="table-header">
              <span className="col-label">Rank</span>
              <span className="col-label">Driver</span>
              <span className="col-label team-col">Team</span>
              <span className="col-label right pick-col">Select<br/>Your<br/>Drivers</span>
              <span className="col-label right">Season<br/>Points</span>
            </div>

            {drivers.map((driver, idx) => {
              const color = teamColor(driver.teamname)
              // Gold / silver / bronze classes for top-3 rank numbers
              const rankClass =
                driver.rnk === 1 ? 'rank-1'
                : driver.rnk === 2 ? 'rank-2'
                : driver.rnk === 3 ? 'rank-3'
                : ''
              const isExpanded = selectedId === driver.playerid
              const isPicked = pickedIds.includes(driver.playerid)
              // Grey out the checkbox once 5 drivers are already picked
              const pickDisabled = !isPicked && pickedIds.length >= 5
              // The last block has no bottom border (unless its chart is open)
              const isLast = idx === drivers.length - 1
              const stats = statsCache[driver.playerid]

              return (
                // driver-block wraps the clickable row + the collapsible chart panel
                <div
                  key={driver.playerid}
                  className={`driver-block${isLast && !isExpanded ? ' last' : ''}`}
                >
                  {/* Clicking anywhere on the row (except the checkbox) expands the chart */}
                  <div
                    className={`driver-row${isExpanded ? ' expanded' : ''}`}
                    style={{ '--team-color': color } as React.CSSProperties}
                    onClick={() => toggleDriver(driver.playerid)}
                  >
                    {/* Rank — gold/silver/bronze colouring for top 3 */}
                    <div className="rank">
                      <span className={`rank-number ${rankClass}`}>
                        {driver.rnk}
                      </span>
                    </div>

                    {/* Driver name + team name (small, team-coloured) */}
                    <div className="driver-info">
                      <span className="driver-name">{driver.playername}</span>
                      <span className="driver-team-label">{driver.teamname}</span>
                    </div>

                    {/* Team dot + name (hidden on mobile) */}
                    <div className="team-cell">
                      <span className="team-dot" />
                      <span className="team-name-text">{driver.teamname}</span>
                    </div>

                    {/* Pick checkbox with current price label.
                        Click is handled on the label to allow stopPropagation. */}
                    <div className="driver-pick pick-col">
                      <label
                        className={`pick-label${isPicked ? ' picked' : ''}${pickDisabled ? ' disabled' : ''}`}
                        onClick={(e) => togglePick(e, driver.playerid)}
                      >
                        <span className={`pick-box${isPicked ? ' checked' : ''}`} />
                        <span className="pick-price">${driver.curvalue.toFixed(1)}M</span>
                      </label>
                    </div>

                    {/* Season fantasy points total */}
                    <div className="points">
                      <span className={`points-value ${driver.statvalue < 0 ? 'negative' : ''}`}>
                        {driver.statvalue > 0 ? '+' : ''}{driver.statvalue}
                      </span>
                      <span className="points-unit">pts</span>
                    </div>

                    {/* Expand/collapse chevron — rotates when the chart is open */}
                    <div className={`row-chevron${isExpanded ? ' open' : ''}`} />
                  </div>

                  {/* Collapsible chart panel — only rendered when this row is expanded */}
                  {isExpanded && (
                    <div className="chart-panel" style={{ '--team-color': color } as React.CSSProperties}>
                      {statsLoading && !stats ? (
                        // Spinner shown on first load of this driver's stats
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

          {/* ── My Team panel ──
              Appears below the table as soon as at least one driver is picked.
              Uses an IIFE to keep the derived `picked` / `total` variables scoped. */}
          {pickedIds.length > 0 && (() => {
            const picked = pickedIds.map(id => drivers.find(d => d.playerid === id)).filter(Boolean) as Driver[]
            const total = picked.reduce((sum, d) => sum + d.curvalue, 0)
            return (
              <div className="team-panel">
                <div className="team-panel-header">
                  <span className="team-panel-title">My Team</span>
                  <span className="team-panel-count">{pickedIds.length}/5 drivers</span>
                </div>
                <div className="team-panel-drivers">
                  {picked.map(d => (
                    <div
                      key={d.playerid}
                      className="team-panel-driver"
                      style={{ '--team-color': teamColor(d.teamname) } as React.CSSProperties}
                    >
                      <span className="team-dot" />
                      <span className="tp-name">{d.playername}</span>
                      <span className="tp-team">{d.teamname}</span>
                      <span className="tp-price">${d.curvalue.toFixed(1)}M</span>
                    </div>
                  ))}
                </div>
                {/* Sum of curvalue across all picked drivers */}
                <div className="team-panel-total">
                  <span>Total cost</span>
                  <span className="tp-total-value">${total.toFixed(1)}M</span>
                </div>
              </div>
            )
          })()}
        </main>
      )}

      <footer className="footer">
        Data sourced from F1 Fantasy · {season} Season
      </footer>
    </div>
  )
}
