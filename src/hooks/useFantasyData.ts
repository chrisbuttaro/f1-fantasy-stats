import { useState, useEffect, useCallback } from 'react'
import type { Participant } from '../types'

interface FantasyData {
  drivers: Participant[]
  constructors: Participant[]
  season: string
  loading: boolean
  error: string | null
  fetchData: () => void
}

// Fetches drivers and constructors from the F1 Fantasy endpoint.
// Caching is handled at Vercel's CDN layer (24h s-maxage) — no localStorage used.
export function useFantasyData(): FantasyData {
  const [drivers, setDrivers] = useState<Participant[]>([])
  const [constructors, setConstructors] = useState<Participant[]>([])
  const [season, setSeason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/f1/driverconstructors_4.json', {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { drivers, constructors, season, loading, error, fetchData }
}
