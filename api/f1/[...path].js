export default async function handler(req, res) {
  try {
    const segments = req.query.path ?? [];
    const path = Array.isArray(segments) ? segments.join('/') : segments;

    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'path') qs.set(key, String(value));
    }

    const qsStr = qs.toString();
    const url = `https://fantasy.formula1.com/feeds/v2/statistics/${path}${qsStr ? '?' + qsStr : ''}`;

    const upstream = await fetch(url);
    const body = await upstream.text();

    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(body);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
