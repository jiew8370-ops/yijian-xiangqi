const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { analyze } = require('./pikafish.cjs');
const port = Number(process.env.PORT || 8765), host = process.env.XIANGQI_HOST || '127.0.0.1';
const origin = `http://127.0.0.1:${port}`;
const files = { '/': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/xiangqi.js': ['xiangqi.js', 'text/javascript'], '/app.js': ['app.js', 'text/javascript'], '/engine/Copying.txt': ['engine/Copying.txt', 'text/plain'], '/engine/NNUE-License.md': ['engine/NNUE-License.md', 'text/plain'], '/engine/SOURCE.md': ['engine/SOURCE.md', 'text/plain'] };
let activeAnalyses = 0;
const server = http.createServer(async (req, res) => {
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) { res.writeHead(403).end(); return; } }
    catch { res.writeHead(403).end(); return; }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  const pathname = req.url.split('?')[0];
  if (req.method === 'GET' && files[pathname]) {
    const [file, mime] = files[pathname]; res.setHeader('Content-Type', mime + '; charset=utf-8');
    const stream = fs.createReadStream(path.join(__dirname, file));
    stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
    stream.pipe(res); return;
  }
  if (req.method === 'GET' && req.url === '/api/health') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ engine: 'Pikafish 2026-09-06' })); return;
  }
  if (req.method !== 'POST' || req.url !== '/api/analyze') { res.writeHead(404).end(); return; }
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { res.writeHead(415).end(); return; }
  if (activeAnalyses >= 2) { res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '5' }).end(JSON.stringify({ message: '当前已有两局在计算，请稍后再试。' })); return; }
  const controller = new AbortController(); res.on('close', () => controller.abort());
  activeAnalyses++;
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 65536) { res.writeHead(413).end(); return; } chunks.push(chunk); }
    if (controller.signal.aborted) return;
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('X-Accel-Buffering', 'no');
    await analyze(input, data => { if (!res.destroyed) res.write(JSON.stringify(data) + '\n'); }, controller.signal);
    res.end();
  } catch (error) {
    if (!res.destroyed) { if (!res.headersSent) res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8'); res.end(JSON.stringify({ type: 'error', message: error.message }) + '\n'); }
  } finally { activeAnalyses--; }
});
server.requestTimeout = 15000;
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用。如果弈见已经启动，直接打开 ${origin}；否则请关闭占用该端口的程序。` : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => {
  console.log(`弈见 · 皮卡鱼增强版已启动\n请在浏览器打开 ${origin}`);
});
