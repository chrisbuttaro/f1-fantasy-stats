export default async function handler(req, res) {
  const segments = req.query.path ?? [];
  const path = Array.isArray(segments) ? segments.join('/') : segments;

  const qs = new URLSearchParams(req.query);
  qs.delete('path');

  const url = `https://fantasy.formula1.com/feeds/v2/statistics/${path}${qs.size ? '?' + qs.toString() : ''}`;

  const upstream = await fetch(url);
  const body = await upstream.text();

  res.status(upstream.status).setHeader('Content-Type', 'application/json').send(body);
}
