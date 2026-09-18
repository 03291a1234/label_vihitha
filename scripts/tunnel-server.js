// Zero-dependency static file server + /api reverse proxy for the shareable tunnel.
// Serves the built Angular app and forwards /api and /uploads to the .NET API on :5080.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'web', 'dist', 'labelvihitha-web', 'browser');
const API = { host: '127.0.0.1', port: 5080 };
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.ico':'image/x-icon','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff' };
http.createServer((req, res) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
    const p = http.request({ host: API.host, port: API.port, path: req.url, method: req.method, headers: req.headers },
      pr => { res.writeHead(pr.statusCode, pr.headers); pr.pipe(res); });
    p.on('error', e => { res.writeHead(502); res.end('proxy error: ' + e.message); });
    req.pipe(p); return;
  }
  let rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
  let file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) return fs.readFile(path.join(ROOT, 'index.html'), (e2, idx) => { res.writeHead(e2?404:200, {'Content-Type':'text/html'}); res.end(e2?'Not found':idx); });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
}).listen(4300, '127.0.0.1', () => console.log('static+proxy on http://localhost:4300'));
