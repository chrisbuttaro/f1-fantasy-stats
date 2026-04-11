import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

const UPSTREAM_STATS = 'https://fantasy.formula1.com/feeds/v2/statistics';
const F1_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://fantasy.formula1.com/en/statistics',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const parts = url.pathname.replace('/api/f1/', '').replace('/api/f1', '');
  const redis = Redis.fromEnv();

  // First-user-of-day: if ingest hasn't run today, kick it off now and await it
  // so this user (and all others today) get KV-backed responses
  const today = new Date().toISOString().split('T')[0];
  const lastIngest = await redis.get('f1:ingest_date');
  if (lastIngest !== today) {
    await fetch(`${url.origin}/api/ingest`);
  }

  // Serve from KV (populated by ingest or the await above)
  const cached = await redis.get(`f1:stats:${parts}`);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT',
      },
    });
  }

  // Fallback: endpoint not in the ingest list yet (e.g. brand-new metric mid-day).
  // Fetches directly without caching — add it to ingest.js to fix permanently.
  const upstream = new URL(`${UPSTREAM_STATS}/${parts}`);
  upstream.search = url.search;
  const res = await fetch(upstream.toString(), { headers: F1_HEADERS });
  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS',
    },
  });
}
