import type { Participant, RaceStat, DriverOdds, OddsData } from '../types'
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
  statMode: 'fantasy' | 'vegas'
  oddsData: OddsData | null
  oddsLoading: boolean
  oddsError: string | null
}

// Build a name → DriverOdds lookup; tries full name then last name as fallback.
function buildOddsLookup(drivers: DriverOdds[]): Map<string, DriverOdds> {
  const map = new Map<string, DriverOdds>()
  for (const d of drivers) {
    // Last name first so full-name entries overwrite on collision
    const lastName = d.name.split(' ').pop()?.toLowerCase()
    if (lastName) map.set(lastName, d)
  }
  for (const d of drivers) {
    map.set(d.name.toLowerCase(), d)
  }
  return map
}

function getDriverOdds(lookup: Map<string, DriverOdds>, displayName: string): DriverOdds | undefined {
  return lookup.get(displayName.toLowerCase())
    ?? lookup.get(displayName.split(' ').pop()?.toLowerCase() ?? '')
}

// Shared table for both drivers and constructors.
// Constructors have playername === null, so teamname is used as the display name.
export default function RankingTable({
  items, isConstructor, expandedId, onExpand,
  pickedIds, onPick, maxPicks, remainingBudget, statsCache, statsLoading, statsError,
  statMode, oddsData, oddsLoading, oddsError,
}: RankingTableProps) {
  const isVegas = statMode === 'vegas'

  // Build odds lookup and sort items when in Vegas mode
  const oddsLookup = oddsData ? buildOddsLookup(oddsData.drivers) : new Map<string, DriverOdds>()

  const displayItems = isVegas && !isConstructor && oddsData
    ? [...items].sort((a, b) => {
        const oA = getDriverOdds(oddsLookup, a.playername ?? a.teamname)
        const oB = getDriverOdds(oddsLookup, b.playername ?? b.teamname)
        if (!oA && !oB) return 0
        if (!oA) return 1  // no-odds drivers sink to the bottom
        if (!oB) return -1
        return oB.impliedProbability - oA.impliedProbability
      })
    : items

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

  // Constructors tab in Vegas mode — no data yet
  if (isVegas && isConstructor) {
    return (
      <div className="table-card">
        <div className="table-header">
          <span className="col-label">Rank</span>
          <span className="col-label">Constructor</span>
          <span className="col-label team-col">Team</span>
          <span className="col-label right pick-col">Select<br/>Your<br/>Constructors</span>
          <span className="col-label right">Win<br/>Odds</span>
        </div>
        <div className="vegas-no-data">No Vegas odds available for constructors</div>
      </div>
    )
  }

  // Vegas mode with odds still loading or errored
  if (isVegas && !isConstructor) {
    if (oddsLoading) {
      return (
        <div className="table-card">
          <div className="state-container"><div className="loading-spinner" /></div>
        </div>
      )
    }
    if (oddsError) {
      return (
        <div className="table-card">
          <div className="vegas-no-data">Failed to load odds: {oddsError}</div>
        </div>
      )
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
        <span className="col-label right">{isVegas ? 'Win\nOdds' : 'Season\nPoints'}</span>
      </div>

      {displayItems.map((item, idx) => {
        const color = teamColor(item.teamname)
        const displayName = item.playername ?? item.teamname
        const itemOdds = isVegas ? getDriverOdds(oddsLookup, displayName) : undefined

        // In Vegas mode rank follows odds order; in Fantasy mode use the API rank
        const rank = isVegas ? idx + 1 : item.rnk
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''

        const isExpanded = expandedId === item.playerid
        const isPicked = pickedIds.includes(item.playerid)
        const pickDisabled = !isPicked && (
          pickedIds.length >= maxPicks ||
          (remainingBudget !== null && item.curvalue > remainingBudget)
        )
        const isLast = idx === displayItems.length - 1
        const stats = statsCache[item.playerid]

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
                <span className={`rank-number ${rankClass}`}>{rank}</span>
              </div>

              <div className="driver-info">
                <span className="driver-name">{displayName}</span>
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

              {isVegas ? (
                <div className="points">
                  <span className={`points-value${itemOdds && itemOdds.price < 0 ? ' odds-fav' : ''}`}>
                    {itemOdds ? itemOdds.formattedPrice : '—'}
                  </span>
                  <span className="points-unit">odds</span>
                </div>
              ) : (
                <div className="points">
                  <span className={`points-value ${item.statvalue < 0 ? 'negative' : ''}`}>
                    {item.statvalue > 0 ? '+' : ''}{item.statvalue}
                  </span>
                  <span className="points-unit">pts</span>
                </div>
              )}

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
