import { useState, useCallback, useRef } from 'react'
import type { RaceStat } from '../types'

interface ChartExpansion {
  expandedId: string | null
  statsCache: Record<string, RaceStat[]>
  statsLoading: boolean
  statsError: string | null
  toggleExpand: (playerId: string) => void
  collapseAll: () => void
  prefetchAll: (playerIds: string[]) => void
}

// Fetches per-race stats for a player from the popup endpoint.
// Responses are cached in Upstash Redis per player per day; in-memory cache avoids re-fetching within a session.
async function fetchPlayerStats(playerId: string): Promise<RaceStat[]> {
  const res = await fetch(`/api/f1-popup/playerstats_${playerId}.json`, {
    headers: { Accept: 'application/json, text/plain, */*', Referer: 'https://fantasy.formula1.com/en/statistics' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const val = json.Value

  const totals: Record<number, number> = {}
  for (const gd of val.GamedayWiseStats) {
    const total = gd.StatsWise.find((s: { Event: string }) => s.Event === 'Total')
    if (total) totals[gd.GamedayId] = total.Value
  }

  const races: RaceStat[] = []
  for (const fx of val.FixtureWiseStats) {
    if (fx.RaceDayWise.length > 0 && totals[fx.GamedayId] !== undefined) {
      const rd = fx.RaceDayWise[0]
      races.push({ gamedayId: fx.GamedayId, meetingName: rd.MeetingName, location: rd.CountryName, points: totals[fx.GamedayId] })
    }
  }
  races.sort((a, b) => a.gamedayId - b.gamedayId)
  return races
}

// Manages which row has its chart open and keeps an in-memory stats cache for the session.
export function useChartExpansion(): ChartExpansion {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statsCache, setStatsCache] = useState<Record<string, RaceStat[]>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Ref keeps prefetchAll stable without stale closure on statsCache
  const statsCacheRef = useRef(statsCache)

  const updateCache = useCallback((playerId: string, races: RaceStat[]) => {
    setStatsCache(prev => {
      const next = { ...prev, [playerId]: races }
      statsCacheRef.current = next
      return next
    })
  }, [])

  const toggleExpand = useCallback(async (playerId: string) => {
    if (expandedId === playerId) { setExpandedId(null); return }
    setExpandedId(playerId)
    if (statsCacheRef.current[playerId]) return

    setStatsLoading(true)
    setStatsError(null)
    try {
      const races = await fetchPlayerStats(playerId)
      updateCache(playerId, races)
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setStatsLoading(false)
    }
  }, [expandedId, updateCache])

  // Fetches stats for all supplied IDs sequentially, skipping any already cached.
  // Runs silently in the background — no loading state shown to the user.
  const prefetchAll = useCallback(async (playerIds: string[]) => {
    for (const id of playerIds) {
      if (statsCacheRef.current[id]) continue
      try {
        const races = await fetchPlayerStats(id)
        updateCache(id, races)
      } catch {
        // Skip silently — user can still expand to retry individually
      }
    }
  }, [updateCache])

  const collapseAll = useCallback(() => setExpandedId(null), [])

  return { expandedId, statsCache, statsLoading, statsError, toggleExpand, collapseAll, prefetchAll }
}
