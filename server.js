const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function handleAiProxy(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const { targetUrl, headers = {}, method = 'POST', data = {} } = payload;
      if (!targetUrl) {
        return sendJson(res, 400, { error: 'Missing targetUrl' });
      }

      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const proxyReq = client.request(parsedUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }, (proxyRes) => {
        let respData = '';
        proxyRes.on('data', c => { respData += c; });
        proxyRes.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(respData); } catch (_) { parsed = { raw: respData }; }
          sendJson(res, proxyRes.statusCode, parsed);
        });
      });

      proxyReq.on('error', err => {
        sendJson(res, 502, { error: 'AI Gateway Error: ' + err.message });
      });

      if (data) {
        proxyReq.write(typeof data === 'string' ? data : JSON.stringify(data));
      }
      proxyReq.end();
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid JSON body: ' + err.message });
    }
  });
}

const server = http.createServer((req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // API Routes
  if (pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'OK',
      server: 'VS Mobile Node Core',
      version: '2.0.0',
      time: new Date().toISOString()
    });
  }

  if (pathname === '/api/ai/proxy' && req.method === 'POST') {
    return handleAiProxy(req, res);
  }

  // Static File Serving
  if (pathname === '/' || pathname === '/index.php') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT, pathname));
  if (!safePath.startsWith(ROOT)) {
    return sendJson(res, 403, { error: 'Access denied' });
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for single page or not found
      if (pathname.startsWith('/assets/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Asset Not Found');
      }
      // Serve index.html for SPA routes
      const indexPath = path.join(ROOT, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Index Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(safePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 VS Mobile IDE server running at http://localhost:${PORT}`);
});
