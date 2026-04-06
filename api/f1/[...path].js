export const config = { runtime: 'edge' };

export default async function handler(request) {
  const url = new URL(request.url);
  const parts = url.pathname.replace('/api/f1/', '').replace('/api/f1', '');

  const upstream = new URL(`https://fantasy.formula1.com/feeds/v2/statistics/${parts}`);
  upstream.search = url.search;

  const response = await fetch(upstream.toString(), {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://fantasy.formula1.com/en/statistics',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
