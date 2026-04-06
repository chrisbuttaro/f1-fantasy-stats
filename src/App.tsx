import { useState, useEffect, useCallback } from 'react'
import './App.css'

// ── Types ─────────────────────────────────────────────────────────────────────

// Shared shape for both driver and constructor participants.
// For constructors, playername is null — use teamname as the display name.
interface Participant {
  playerid: string
  playername: string | null  // null for constructors
  curvalue: number           // price in $m
  teamid: string
  teamname: string
  statvalue: number          // total fantasy points
  rnk: number
}

// Per-race points built from GamedayWiseStats + FixtureWiseStats
interface RaceStat {
  gamedayId: number
  meetingName: string
  location: string   // short name used as x-axis label
  points: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

// Pure SVG line chart showing fantasy points per race for one participant.
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

  // Closed path that fills the area beneath the line
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

      {/* Horizontal guide lines with y-axis value labels */}
      {guides.map((g, i) => (
        <g key={i}>
          <line x1={pad.left} y1={g.y} x2={W - pad.right} y2={g.y} stroke="#2a2a3a" strokeWidth="1" />
          <text x={pad.left - 6} y={g.y} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="#71717a">
            {g.v}
          </text>
        </g>
      ))}

      {/* Gradient area fill */}
      {areaPath && <path d={areaPath} fill={`url(#area-grad-${color.replace('#', '')})`} />}

      {/* Line — only when 2+ data points */}
      {n > 1 && (
        <polyline points={polylinePoints} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}

      {/* Dot, halo, point value, and location label per race */}
      {stats.map((s, i) => (
        <g key={s.gamedayId}>
          <circle cx={xOf(i)} cy={yOf(s.points)} r="4" fill={color} />
          <circle cx={xOf(i)} cy={yOf(s.points)} r="7" fill={color} fillOpacity="0.15" />
          <text x={xOf(i)} y={yOf(s.points) - 12} textAnchor="middle" fontSize="10" fill="#e0e0e0" fontWeight="700">
            {s.points > 0 ? '+' : ''}{s.points}
          </text>
          <text x={xOf(i)} y={H - pad.bottom + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">
            {s.location}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── RankingTable ──────────────────────────────────────────────────────────────

interface RankingTableProps {
  items: Participant[]
  isConstructor: boolean
  expandedId: string | null
  onExpand: (playerId: string) => void
  pickedIds: string[]
  onPick: (e: React.MouseEvent, playerId: string) => void
  maxPicks: number
  statsCache: Record<string, RaceStat[]>
  statsLoading: boolean
  statsError: string | null
}

// Shared table for both drivers and constructors.
// Constructors have playername === null, so teamname is used as the display name.
function RankingTable({
  items, isConstructor, expandedId, onExpand,
  pickedIds, onPick, maxPicks, statsCache, statsLoading, statsError,
}: RankingTableProps) {
  return (
    <div className="table-card">
      {/* Header — 6 columns must match .driver-row grid exactly */}
      <div className="table-header">
        <span className="col-label">Rank</span>
        <span className="col-label">{isConstructor ? 'Constructor' : 'Driver'}</span>
        <span className="col-label team-col">Team</span>
        <span className="col-label right pick-col">Select<br/>Your<br/>{isConstructor ? 'Constructors' : 'Drivers'}</span>
        <span className="col-label right">Season<br/>Points</span>
      </div>

      {items.map((item, idx) => {
        const color = teamColor(item.teamname)
        const rankClass = item.rnk === 1 ? 'rank-1' : item.rnk === 2 ? 'rank-2' : item.rnk === 3 ? 'rank-3' : ''
        const isExpanded = expandedId === item.playerid
        const isPicked = pickedIds.includes(item.playerid)
        const pickDisabled = !isPicked && pickedIds.length >= maxPicks
        const isLast = idx === items.length - 1
        const stats = statsCache[item.playerid]
        // Constructors use teamname as their display name
        const displayName = item.playername ?? item.teamname

        return (
          <div
            key={item.playerid}
            className={`driver-block${isLast && !isExpanded ? ' last' : ''}`}
          >
            {/* Row — clicking expands/collapses the chart */}
            <div
              className={`driver-row${isExpanded ? ' expanded' : ''}`}
              style={{ '--team-color': color } as React.CSSProperties}
              onClick={() => onExpand(item.playerid)}
            >
              <div className="rank">
                <span className={`rank-number ${rankClass}`}>{item.rnk}</span>
              </div>

              <div className="driver-info">
                <span className="driver-name">{displayName}</span>
                {/* Sub-label only for drivers — constructors' name already is the team */}
                {!isConstructor && (
                  <span className="driver-team-label">{item.teamname}</span>
                )}
              </div>

              <div className="team-cell">
                <span className="team-dot" />
                <span className="team-name-text">{item.teamname}</span>
              </div>

              {/* Custom checkbox with price — stopPropagation keeps row click separate */}
              <div className="driver-pick pick-col">
                <label
                  className={`pick-label${isPicked ? ' picked' : ''}${pickDisabled ? ' disabled' : ''}`}
                  onClick={(e) => onPick(e, item.playerid)}
                >
                  <span className={`pick-box${isPicked ? ' checked' : ''}`} />
                  <span className="pick-price">${item.curvalue.toFixed(1)}M</span>
                </label>
              </div>

              <div className="points">
                <span className={`points-value ${item.statvalue < 0 ? 'negative' : ''}`}>
                  {item.statvalue > 0 ? '+' : ''}{item.statvalue}
                </span>
                <span className="points-unit">pts</span>
              </div>

              <div className={`row-chevron${isExpanded ? ' open' : ''}`} />
            </div>

            {/* Collapsible chart — only rendered when this row is expanded */}
            {isExpanded && (
              <div className="chart-panel" style={{ '--team-color': color } as React.CSSProperties}>
                {statsLoading && !stats ? (
                  <div className="chart-loading"><div className="loading-spinner small" /></div>
                ) : statsError && !stats ? (
                  <div className="chart-error">{statsError}</div>
                ) : stats && stats.length > 0 ? (
                  <>
                    <div className="chart-title">{displayName} — Points per Race</div>
                    <RaceChart stats={stats} color={color} />
                  </>
                ) : null}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors'>('drivers')

  const [drivers, setDrivers] = useState<Participant[]>([])
  const [constructors, setConstructors] = useState<Participant[]>([])
  const [season, setSeason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Which row has its chart expanded — shared across tabs
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Shared cache: driver ids (large numbers) and constructor ids (small team ids) don't collide
  const [statsCache, setStatsCache] = useState<Record<string, RaceStat[]>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Team selection — max 5 drivers, max 2 constructors
  const [pickedDriverIds, setPickedDriverIds] = useState<string[]>([])
  const [pickedConstructorIds, setPickedConstructorIds] = useState<string[]>([])

  // ── Data fetching ──────────────────────────────────────────────────────────

  // Fetches drivers and constructors from the same endpoint in one request.
  // driver[0] = fantasy points category; constructor[0] = fantasy points category.
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const buster = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const res = await fetch(`/api/f1/driverconstructors_4.json?buster=${buster}`, {
        headers: { Accept: 'application/json, text/plain, */*', Referer: 'https://fantasy.formula1.com/en/statistics' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const data = json.Data
      setSeason(data.season ?? '')
      setDrivers([...data.driver[0].participants].sort((a: Participant, b: Participant) => b.statvalue - a.statvalue))
      setConstructors([...data.constructor[0].participants].sort((a: Participant, b: Participant) => b.statvalue - a.statvalue))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Toggles the race-points chart for a row. Fetches and caches on first expand.
  const toggleExpand = useCallback(async (playerId: string) => {
    if (expandedId === playerId) { setExpandedId(null); return }
    setExpandedId(playerId)
    if (statsCache[playerId]) return

    setStatsLoading(true)
    setStatsError(null)
    try {
      const buster = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const res = await fetch(`/api/f1-popup/playerstats_${playerId}.json?buster=${buster}`, {
        headers: { Accept: 'application/json, text/plain, */*', Referer: 'https://fantasy.formula1.com/en/statistics' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const val = json.Value

      // Build totals map: { gamedayId → total points }
      const totals: Record<number, number> = {}
      for (const gd of val.GamedayWiseStats) {
        const total = gd.StatsWise.find((s: { Event: string }) => s.Event === 'Total')
        if (total) totals[gd.GamedayId] = total.Value
      }

      // Cross-reference with FixtureWiseStats to get race names
      const races: RaceStat[] = []
      for (const fx of val.FixtureWiseStats) {
        if (fx.RaceDayWise.length > 0 && totals[fx.GamedayId] !== undefined) {
          const rd = fx.RaceDayWise[0]
          races.push({ gamedayId: fx.GamedayId, meetingName: rd.MeetingName, location: rd.MeetingLocation, points: totals[fx.GamedayId] })
        }
      }
      races.sort((a, b) => a.gamedayId - b.gamedayId)
      setStatsCache(prev => ({ ...prev, [playerId]: races }))
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setStatsLoading(false)
    }
  }, [expandedId, statsCache])

  // Collapse expanded chart when switching tabs
  const handleTabChange = (tab: 'drivers' | 'constructors') => {
    setActiveTab(tab)
    setExpandedId(null)
  }

  const toggleDriverPick = useCallback((e: React.MouseEvent, playerId: string) => {
    e.stopPropagation()
    setPickedDriverIds(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId)
      : prev.length >= 5 ? prev
      : [...prev, playerId]
    )
  }, [])

  const toggleConstructorPick = useCallback((e: React.MouseEvent, playerId: string) => {
    e.stopPropagation()
    setPickedConstructorIds(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId)
      : prev.length >= 2 ? prev
      : [...prev, playerId]
    )
  }, [])

  // ── Team bar data ──────────────────────────────────────────────────────────

  const pickedDrivers = pickedDriverIds.map(id => drivers.find(d => d.playerid === id)).filter(Boolean) as Participant[]
  const pickedConstructors = pickedConstructorIds.map(id => constructors.find(c => c.playerid === id)).filter(Boolean) as Participant[]
  const totalCost = [...pickedDrivers, ...pickedConstructors].reduce((sum, p) => sum + p.curvalue, 0)
  const hasTeam = pickedDriverIds.length > 0 || pickedConstructorIds.length > 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`app${hasTeam ? ' has-team-bar' : ''}`}>
      <header className="header">
        <span className="header-logo-f1">F1</span>
        <span className="header-logo-fantasy">Fantasy</span>
        <div className="header-divider" />
        <span className="header-title">Driver Statistics</span>
      </header>

      {loading ? (
        <div className="state-container"><div className="loading-spinner" /></div>
      ) : error ? (
        <div className="state-container">
          <div className="error-box">
            <p>Failed to load data: {error}</p>
            <button className="retry-btn" onClick={fetchData}>Retry</button>
          </div>
        </div>
      ) : (
        <main className="page">
          <div className="page-heading">
            <h1>Fantasy <span>Rankings</span></h1>
            {season && <span className="season-badge">{season} Season</span>}
          </div>

          {/* Tab switcher */}
          <div className="tabs">
            <button
              className={`tab${activeTab === 'drivers' ? ' active' : ''}`}
              onClick={() => handleTabChange('drivers')}
            >
              Drivers
            </button>
            <button
              className={`tab${activeTab === 'constructors' ? ' active' : ''}`}
              onClick={() => handleTabChange('constructors')}
            >
              Constructors
            </button>
          </div>

          {activeTab === 'drivers' ? (
            <RankingTable
              items={drivers}
              isConstructor={false}
              expandedId={expandedId}
              onExpand={toggleExpand}
              pickedIds={pickedDriverIds}
              onPick={toggleDriverPick}
              maxPicks={5}
              statsCache={statsCache}
              statsLoading={statsLoading}
              statsError={statsError}
            />
          ) : (
            <RankingTable
              items={constructors}
              isConstructor={true}
              expandedId={expandedId}
              onExpand={toggleExpand}
              pickedIds={pickedConstructorIds}
              onPick={toggleConstructorPick}
              maxPicks={2}
              statsCache={statsCache}
              statsLoading={statsLoading}
              statsError={statsError}
            />
          )}
        </main>
      )}

      {/* Fixed bottom bar — visible whenever any driver or constructor is picked */}
      {hasTeam && (
        <div className="team-bar">
          <div className="team-bar-chips">
            {/* Driver chips */}
            {pickedDrivers.map(d => (
              <div key={d.playerid} className="team-chip" style={{ '--team-color': teamColor(d.teamname) } as React.CSSProperties}>
                <span className="team-dot" />
                <span className="chip-name">{d.playername ?? d.teamname}</span>
                <span className="chip-price">${d.curvalue.toFixed(1)}M</span>
              </div>
            ))}
            {/* Separator between drivers and constructors when both are present */}
            {pickedDrivers.length > 0 && pickedConstructors.length > 0 && (
              <div className="team-bar-divider" />
            )}
            {/* Constructor chips */}
            {pickedConstructors.map(c => (
              <div key={c.playerid} className="team-chip" style={{ '--team-color': teamColor(c.teamname) } as React.CSSProperties}>
                <span className="team-dot" />
                <span className="chip-name">{c.teamname}</span>
                <span className="chip-price">${c.curvalue.toFixed(1)}M</span>
              </div>
            ))}
          </div>
          <div className="team-bar-total">
            <span className="team-bar-label">Total</span>
            <span className="team-bar-value">${totalCost.toFixed(1)}M</span>
          </div>
        </div>
      )}

      <footer className="footer">
        Data sourced from F1 Fantasy · {season} Season
      </footer>
    </div>
  )
}
