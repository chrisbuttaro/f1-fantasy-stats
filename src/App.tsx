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

export default function App() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [season, setSeason] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

            {drivers.map((driver) => {
              const color = teamColor(driver.teamname)
              const rankClass =
                driver.rnk === 1 ? 'rank-1'
                : driver.rnk === 2 ? 'rank-2'
                : driver.rnk === 3 ? 'rank-3'
                : ''
              return (
                <div
                  key={driver.playerid}
                  className="driver-row"
                  style={{ '--team-color': color } as React.CSSProperties}
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
