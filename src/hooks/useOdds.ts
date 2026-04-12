import { useState, useEffect } from 'react'
import type { OddsData } from '../types'

interface UseOdds {
  oddsData: OddsData | null
  oddsLoading: boolean
  oddsError: string | null
}

// Fetches upcoming race odds from /api/odds (Vercel edge function → The Odds API).
// Note: this endpoint is not available in Vite dev mode — use `vercel dev` to test locally.
export function useOdds(): UseOdds {
  const [oddsData, setOddsData] = useState<OddsData | null>(null)
  const [oddsLoading, setOddsLoading] = useState(true)
  const [oddsError, setOddsError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/odds')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setOddsData(data)
      } catch (err) {
        setOddsError(err instanceof Error ? err.message : 'Failed to load odds')
      } finally {
        setOddsLoading(false)
      }
    }
    load()
  }, [])

  return { oddsData, oddsLoading, oddsError }
}
