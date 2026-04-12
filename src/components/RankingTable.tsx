import type { Participant, RaceStat } from '../types'
import { teamColor } from '../constants'
import RaceChart from './RaceChart'

export interface RankingTableProps {
  items: Participant[]
  isConstructor: boolean
  expandedId: string | null
  onExpand: (playerId: string) => void
  pickedIds: string[]
  onPick: (e: React.MouseEvent, playerId: string) => void
  maxPicks: number
  remainingBudget: number | null  // null = no budget set; otherwise blocks picks that exceed it
  statsCache: Record<string, RaceStat[]>
  statsLoading: boolean
  statsError: string | null
}

// Shared table for both drivers and constructors.
// Constructors have playername === null, so teamname is used as the display name.
export default function RankingTable({
  items, isConstructor, expandedId, onExpand,
  pickedIds, onPick, maxPicks, remainingBudget, statsCache, statsLoading, statsError,
}: RankingTableProps) {
  // Find the single-race high and low across all cached participants for shared chart scaling
  let globalMax: { points: number; name: string } | undefined
  let globalMin: { points: number; name: string } | undefined
  for (const item of items) {
    const stats = statsCache[item.playerid]
    if (!stats?.length) continue
    const name = item.playername ?? item.teamname
    for (const stat of stats) {
      if (!globalMax || stat.points > globalMax.points) globalMax = { points: stat.points, name }
      if (!globalMin || stat.points < globalMin.points) globalMin = { points: stat.points, name }
    }
  }

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
        // Disabled when: count limit reached, OR budget set and price exceeds what's left
        const pickDisabled = !isPicked && (
          pickedIds.length >= maxPicks ||
          (remainingBudget !== null && item.curvalue > remainingBudget)
        )
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
                    <RaceChart stats={stats} color={color} globalMax={globalMax} globalMin={globalMin} />
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
