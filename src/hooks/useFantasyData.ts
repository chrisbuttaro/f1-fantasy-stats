import { useState, useEffect, useCallback } from 'react'
import type { Participant } from '../types'
import { readCache, writeCache } from '../cache'

const CACHE_KEY = 'f1_main'

interface CachedPayload {
  drivers: Participant[]
  constructors: Participant[]
  season: string
}

interface FantasyData {
  drivers: Participant[]
  constructors: Participant[]
  season: string
  loading: boolean
  error: string | null
  fetchData: () => void
}

// Fetches drivers and constructors from the same F1 Fantasy endpoint.
// Responses are cached in localStorage for 24 hours and invalidated on each new build.
export function useFantasyData(): FantasyData {
  const cached = readCache<CachedPayload>(CACHE_KEY)

  const [drivers, setDrivers] = useState<Participant[]>(cached?.drivers ?? [])
  const [constructors, setConstructors] = useState<Participant[]>(cached?.constructors ?? [])
  const [season, setSeason] = useState(cached?.season ?? '')
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

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
      const season = data.season ?? ''
      const drivers = [...data.driver[0].participants].sort((a: Participant, b: Participant) => b.statvalue - a.statvalue)
      const constructors = [...data.constructor[0].participants].sort((a: Participant, b: Participant) => b.statvalue - a.statvalue)

      setSeason(season)
      setDrivers(drivers)
      setConstructors(constructors)
      writeCache<CachedPayload>(CACHE_KEY, { drivers, constructors, season })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Only fetch on mount if there was no valid cache
  useEffect(() => {
    if (!cached) fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { drivers, constructors, season, loading, error, fetchData }
}
