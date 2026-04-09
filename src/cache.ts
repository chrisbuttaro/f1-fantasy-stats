const ONE_DAY = 24 * 60 * 60 * 1000

interface CacheEntry<T> {
  data: T
  cachedAt: number
  buildTime: number
}

// Returns cached data if it exists, is under 24 hours old, and is from the current build.
// Returns null if missing, stale, or from an older build (triggering a fresh fetch).
export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.cachedAt > ONE_DAY) return null
    if (entry.buildTime < __BUILD_TIME__) return null
    return entry.data
  } catch {
    return null
  }
}

// Persists data to localStorage with the current timestamp and build time.
// Silently swallows errors (e.g. private browsing mode or storage quota exceeded).
export function writeCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now(), buildTime: __BUILD_TIME__ }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {}
}
