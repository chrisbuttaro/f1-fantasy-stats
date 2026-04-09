import { useState, useEffect } from 'react'
import './App.css'
import { teamColor } from './constants'
import { useFantasyData } from './hooks/useFantasyData'
import { useChartExpansion } from './hooks/useChartExpansion'
import { useTeamPicker } from './hooks/useTeamPicker'
import RankingTable from './components/RankingTable'

export default function App() {
  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors'>('drivers')

  const { drivers, constructors, season, loading, error, fetchData } = useFantasyData()
  const { expandedId, statsCache, statsLoading, statsError, toggleExpand, collapseAll, prefetchAll } = useChartExpansion()
  const {
    pickedDriverIds, pickedConstructorIds,
    pickedDrivers, pickedConstructors,
    budgetInput, setBudgetInput,
    budget, totalCost, remainingBudget,
    toggleDriverPick, toggleConstructorPick,
  } = useTeamPicker(drivers, constructors)

  // Once main data is loaded, kick off background prefetch for all player charts
  useEffect(() => {
    if (!loading && drivers.length > 0) {
      prefetchAll([...drivers, ...constructors].map(p => p.playerid))
    }
  }, [loading, drivers, constructors, prefetchAll])

  const handleTabChange = (tab: 'drivers' | 'constructors') => {
    setActiveTab(tab)
    collapseAll()
  }

  return (
    <div className="app has-team-bar">
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

          <div className="tabs">
            <button className={`tab${activeTab === 'drivers' ? ' active' : ''}`} onClick={() => handleTabChange('drivers')}>
              Drivers
            </button>
            <button className={`tab${activeTab === 'constructors' ? ' active' : ''}`} onClick={() => handleTabChange('constructors')}>
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
              remainingBudget={remainingBudget}
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
              remainingBudget={remainingBudget}
              statsCache={statsCache}
              statsLoading={statsLoading}
              statsError={statsError}
            />
          )}
        </main>
      )}

      {/* Fixed bottom bar — always visible so budget can be entered at any time */}
      <div className="team-bar">
        <div className="team-bar-chips">
          {/* Drivers: first 2 on top row, remaining 3 on bottom row */}
          {pickedDrivers.length > 0 && (
            <div className="team-picks-drivers">
              <div className="team-picks-row">
                {pickedDrivers.slice(0, 2).map(d => (
                  <div key={d.playerid} className="team-chip" style={{ '--team-color': teamColor(d.teamname) } as React.CSSProperties}>
                    <span className="team-dot" />
                    <span className="chip-name">{d.playername ?? d.teamname}</span>
                    <span className="chip-price">${d.curvalue.toFixed(1)}M</span>
                  </div>
                ))}
              </div>
              {pickedDrivers.length > 2 && (
                <div className="team-picks-row">
                  {pickedDrivers.slice(2).map(d => (
                    <div key={d.playerid} className="team-chip" style={{ '--team-color': teamColor(d.teamname) } as React.CSSProperties}>
                      <span className="team-dot" />
                      <span className="chip-name">{d.playername ?? d.teamname}</span>
                      <span className="chip-price">${d.curvalue.toFixed(1)}M</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Constructors: stacked vertically beside drivers */}
          {pickedConstructors.length > 0 && (
            <div className="team-picks-constructors">
              {pickedConstructors.map(c => (
                <div key={c.playerid} className="team-chip" style={{ '--team-color': teamColor(c.teamname) } as React.CSSProperties}>
                  <span className="team-dot" />
                  <span className="chip-name">{c.teamname}</span>
                  <span className="chip-price">${c.curvalue.toFixed(1)}M</span>
                </div>
              ))}
            </div>
          )}

          {pickedDrivers.length === 0 && pickedConstructors.length === 0 && (
            <span className="team-bar-empty">Select drivers &amp; constructors to build your team</span>
          )}
        </div>

        <div className="team-bar-budget">
          <div className="budget-row">
            <span className="budget-label">Budget</span>
            <div className="budget-input-wrap">
              <span className="budget-currency">$</span>
              <input
                type="number"
                className="budget-input"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.1"
              />
              <span className="budget-currency">M</span>
            </div>
          </div>
          {budget > 0 && (
            <div className="budget-row">
              <span className="budget-label">Left</span>
              <span className={`budget-remaining${remainingBudget !== null && remainingBudget < 0 ? ' over' : ''}`}>
                ${(remainingBudget ?? 0).toFixed(1)}M
              </span>
            </div>
          )}
          {totalCost > 0 && (
            <div className="budget-row">
              <span className="budget-label">Spent</span>
              <span className="budget-spent">${totalCost.toFixed(1)}M</span>
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        Data sourced from F1 Fantasy · {season} Season
      </footer>
    </div>
  )
}
