import { Redis } from '@upstash/redis/cloudflare';

export const config = { runtime: 'edge' };

// All known F1 stats endpoints. Add new ones here as metrics grow — they'll be
// pre-fetched on every daily ingest automatically.
const STATS_ENDPOINTS = [
  'driverconstructors_4.json',
];

const UPSTREAM_STATS = 'https://fantasy.formula1.com/feeds/v2/statistics';
const F1_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://fantasy.formula1.com/en/statistics',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// 25h TTL — outlasts a full day so stale data is never served on a partial failure
const TTL_SECONDS = 90000;

export default async function handler(request) {
  const redis = Redis.fromEnv();
  const today = new Date().toISOString().split('T')[0]; // UTC date: "YYYY-MM-DD"

  // Idempotent guard — cron may fire, then first user arrives and hits this too
  const lastIngest = await redis.get('f1:ingest_date');
  if (lastIngest === today) {
    return new Response(JSON.stringify({ status: 'skipped', date: today }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch all registered endpoints in parallel
  const results = await Promise.allSettled(
    STATS_ENDPOINTS.map(async (endpoint) => {
      const res = await fetch(`${UPSTREAM_STATS}/${endpoint}`, { headers: F1_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await redis.set(`f1:stats:${endpoint}`, data, { ex: TTL_SECONDS });
    })
  );

  // Mark today as ingested even on partial failure — prevents a broken upstream
  // from hammering F1's servers on every request
  await redis.set('f1:ingest_date', today, { ex: TTL_SECONDS });

  const summary = results.map((r, i) => ({
    endpoint: STATS_ENDPOINTS[i],
    status: r.status,
    ...(r.status === 'rejected' ? { error: String(r.reason) } : {}),
  }));

  return new Response(JSON.stringify({ status: 'ok', date: today, results: summary }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
