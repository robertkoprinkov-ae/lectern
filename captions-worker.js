// Lectern captions helper: a Cloudflare Worker (free plan is plenty).
// Cassyni keeps caption files in an S3 bucket that only cassyni.com may read from a browser,
// so Lectern asks this Worker instead: GET /captions/{captions_file_token} returns the WebVTT text.
// It only passes on Cassyni caption files (text/vtt), so it cannot be used as a general proxy.

const ALLOWED_ORIGINS = [
  'https://robertkoprinkov-ae.github.io',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = ALLOWED_ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
    const reply = (body, status, extra) => new Response(body, { status, headers: { ...cors, ...extra } });

    if (request.method === 'OPTIONS') return reply(null, 204, { 'Access-Control-Allow-Methods': 'GET' });
    const m = new URL(request.url).pathname.match(/^\/captions\/([A-Za-z0-9]{16,32})$/);
    if (request.method !== 'GET' || !m) return reply('Not found', 404);

    const meta = await fetch(`https://api.cassyni.com/api/files/get-url/${m[1]}`);
    if (!meta.ok) return reply(`Cassyni answered ${meta.status}`, meta.status === 404 ? 404 : 502);
    const file = await meta.json();
    if (file.mime_type !== 'text/vtt' || !file.download_url) return reply('Not a caption file', 404);

    const vtt = await fetch(file.download_url);
    if (!vtt.ok) return reply(`Storage answered ${vtt.status}`, 502);
    return reply(vtt.body, 200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
  },
};
