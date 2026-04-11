// Runs after `npm run build` to pre-warm Redis with fresh F1 data.
// Skipped silently when Redis env vars aren't present (local builds).
import { Redis } from '@upstash/redis';

const STATS_ENDPOINTS = [
  'driverconstructors_4.json',
];

const UPSTREAM_STATS = 'https://fantasy.formula1.com/feeds/v2/statistics';
const F1_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://fantasy.formula1.com/en/statistics',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
const TTL_SECONDS = 90000;

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.log('[ingest] No Redis env vars — skipping build-time sync.');
  process.exit(0);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const today = new Date().toISOString().split('T')[0];

const results = await Promise.allSettled(
  STATS_ENDPOINTS.map(async (endpoint) => {
    const res = await fetch(`${UPSTREAM_STATS}/${endpoint}`, { headers: F1_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    await redis.set(`f1:stats:${endpoint}`, data, { ex: TTL_SECONDS });
    console.log(`[ingest] Stored ${endpoint}`);
  })
);

await redis.set('f1:ingest_date', today, { ex: TTL_SECONDS });

const failures = results.filter(r => r.status === 'rejected');
if (failures.length) {
  failures.forEach((r, i) => console.error(`[ingest] Failed ${STATS_ENDPOINTS[i]}:`, r.reason));
  process.exit(1);
}

console.log(`[ingest] Build-time sync complete for ${today}`);
