import { Redis } from '@upstash/redis';

export const config = { runtime: 'edge' };

// Verify the correct sport key for your Odds API subscription:
//   GET https://api.the-odds-api.com/v4/sports?apiKey={key}
// Common F1 key: 'motorsport_formula_one' — adjust if needed.
const SPORT_KEY = 'motorsport_formula_one';
const CACHE_KEY = 'f1:odds:upcoming';
const TTL_SECONDS = 60 * 60 * 4; // 4 hours

// American odds → implied win probability (0–1), ignoring vig
function impliedProb(price) {
  return price > 0
    ? 100 / (price + 100)
    : Math.abs(price) / (Math.abs(price) + 100);
}

function formatPrice(price) {
  return price > 0 ? `+${price}` : `${price}`;
}

// Attempt to extract a clean race name from whatever the Odds API returns.
// The event name varies by subscription; adjust this if needed after inspecting live data.
function extractRaceName(event) {
  const raw = event.home_team ?? event.description ?? event.sport_title ?? '';
  // Strip leading "Formula 1 " / "Formula One " and trailing year
  return raw
    .replace(/^formula\s+1\s+/i, '')
    .replace(/^formula\s+one\s+/i, '')
    .replace(/\s+\d{4}$/, '')
    .trim() || 'Next Race';
}

export default async function handler(request) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ODDS_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const redis = Redis.fromEnv();

  // Serve cached data if available
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  // Fetch upcoming races from The Odds API
  const oddsRes = await fetch(
    `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds` +
    `?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american`,
  );
  if (!oddsRes.ok) {
    const text = await oddsRes.text();
    return new Response(JSON.stringify({ error: `Odds API ${oddsRes.status}`, detail: text }), {
      status: oddsRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const events = await oddsRes.json();
  if (!Array.isArray(events) || events.length === 0) {
    return new Response(JSON.stringify({ error: 'No events returned' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Next upcoming race = earliest commence_time in the future
  const now = Date.now();
  const upcoming = events
    .filter(e => new Date(e.commence_time).getTime() > now)
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());

  if (!upcoming.length) {
    return new Response(JSON.stringify({ error: 'No upcoming races found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = upcoming[0];

  // Prefer DraftKings; fall back to first available bookmaker
  const bm = event.bookmakers?.find(b => b.key === 'draftkings') ?? event.bookmakers?.[0];
  const market = bm?.markets?.find(m => m.key === 'h2h');

  const drivers = (market?.outcomes ?? [])
    .map(o => ({
      name: o.name,
      price: o.price,
      formattedPrice: formatPrice(o.price),
      impliedProbability: impliedProb(o.price),
    }))
    .sort((a, b) => b.impliedProbability - a.impliedProbability); // favorite first

  const result = {
    raceName: extractRaceName(event),
    commenceTime: event.commence_time,
    bookmaker: bm?.title ?? '',
    drivers,
  };

  await redis.set(CACHE_KEY, result, { ex: TTL_SECONDS });

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}
