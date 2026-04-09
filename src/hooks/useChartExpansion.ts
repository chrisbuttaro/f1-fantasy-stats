import { useState, useCallback } from 'react'
import type { RaceStat } from '../types'

interface ChartExpansion {
  expandedId: string | null
  statsCache: Record<string, RaceStat[]>
  statsLoading: boolean
  statsError: string | null
  toggleExpand: (playerId: string) => void
  collapseAll: () => void
}

// Manages which row has its chart open and caches per-race stats.
// Works for both drivers and constructors — their IDs don't collide.
export function useChartExpansion(): ChartExpansion {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statsCache, setStatsCache] = useState<Record<string, RaceStat[]>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

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
          races.push({ gamedayId: fx.GamedayId, meetingName: rd.MeetingName, location: rd.CountryName, points: totals[fx.GamedayId] })
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

  const collapseAll = useCallback(() => setExpandedId(null), [])

  return { expandedId, statsCache, statsLoading, statsError, toggleExpand, collapseAll }
}
