import { Redis } from '@upstash/redis/cloudflare';

export const config = { runtime: 'edge' };

const UPSTREAM_POPUP = 'https://fantasy.formula1.com/feeds/popup';
const F1_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://fantasy.formula1.com/en/statistics',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

const TTL_SECONDS = 90000; // 25h

export default async function handler(request) {
  const url = new URL(request.url);
  const parts = url.pathname.replace('/api/f1-popup/', '').replace('/api/f1-popup', '');
  const today = new Date().toISOString().split('T')[0];

  // Popup data is per-player and can't be pre-ingested without knowing all player IDs,
  // so we cache lazily on first request. Date in the key acts as a natural daily expiry.
  const redis = Redis.fromEnv();
  const kvKey = `f1:popup:${parts}:${today}`;

  const cached = await redis.get(kvKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT',
      },
    });
  }

  const upstream = new URL(`${UPSTREAM_POPUP}/${parts}`);
  upstream.search = url.search;
  const res = await fetch(upstream.toString(), { headers: F1_HEADERS });
  const data = await res.json();

  if (res.ok) {
    await redis.set(kvKey, data, { ex: TTL_SECONDS });
  }

  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS',
    },
  });
}
