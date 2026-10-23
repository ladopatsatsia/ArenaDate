import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../mobile/dist/web');
const ADMIN_DIST_DIR = path.resolve(__dirname, '../admin/dist/admin/browser');
const PORT = process.env.PORT || 8081;

// Flexible API destination (supports API_URL=http://... or API_PORT=5180)
const rawApiUrl = process.env.API_URL;
const parsedApiUrl = rawApiUrl ? new URL(rawApiUrl) : null;
const API_HOST = parsedApiUrl ? parsedApiUrl.hostname : (process.env.API_HOST || '127.0.0.1');
const API_PORT = parsedApiUrl ? (parsedApiUrl.port || (parsedApiUrl.protocol === 'https:' ? 443 : 80)) : (process.env.API_PORT || 5180);
const API_IS_HTTPS = parsedApiUrl ? parsedApiUrl.protocol === 'https:' : false;
const httpModule = API_IS_HTTPS ? https : http;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Reverse proxy API, Hubs and OpenAPI requests directly to backend API
  if (pathname.startsWith('/api') || pathname.startsWith('/hubs') || pathname.startsWith('/openapi')) {
    const proxyHeaders = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
    const proxyReq = httpModule.request(
      {
        host: API_HOST,
        port: API_PORT,
        path: req.url,
        method: req.method,
        headers: proxyHeaders,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('[Proxy Error]:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad_gateway', message: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    let subPath = pathname === '/admin' ? '/' : pathname.slice('/admin'.length);
    let filePath = path.join(ADMIN_DIST_DIR, subPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ADMIN_DIST_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Admin Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(data);
    });
    return;
  }

  let filePath = path.join(DIST_DIR, pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const candidateIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(candidateIndex)) {
      filePath = candidateIndex;
    } else {
      filePath = path.join(DIST_DIR, 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }

    let payload = data;
    if (ext === '.html') {
      let html = data.toString('utf-8');
      if (!html.includes('telegram-web-app.js')) {
        html = html.replace(
          '</head>',
          '  <script src="https://telegram.org/js/telegram-web-app.js"></script>\n  <script>try{if(window.Telegram&&window.Telegram.WebApp){window.Telegram.WebApp.ready();window.Telegram.WebApp.expand();}}catch(e){console.error(e);}</script>\n</head>'
        );
        payload = Buffer.from(html, 'utf-8');
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(payload);
  });
});

server.on('upgrade', (req, clientSocket, head) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (parsedUrl.pathname.startsWith('/hubs') || parsedUrl.pathname.startsWith('/ws')) {
    const connectSocket = () => {
      if (API_IS_HTTPS) {
        return tls.connect(Number(API_PORT), API_HOST, { servername: API_HOST });
      }
      return net.connect(Number(API_PORT), API_HOST);
    };
    const serverSocket = connectSocket();
    serverSocket.on(API_IS_HTTPS ? 'secureConnect' : 'connect', () => {
      serverSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
      for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() === 'host') {
          serverSocket.write(`host: ${API_HOST}:${API_PORT}\r\n`);
          continue;
        }
        if (Array.isArray(value)) {
          for (const v of value) {
            serverSocket.write(`${key}: ${v}\r\n`);
          }
        } else {
          serverSocket.write(`${key}: ${value}\r\n`);
        }
      }
      serverSocket.write('\r\n');
      if (head && head.length > 0) serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
    serverSocket.on('error', (err) => {
      console.error('[WS Proxy Error]:', err.message);
      clientSocket.destroy();
    });
    clientSocket.on('error', () => serverSocket.destroy());
  } else {
    clientSocket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server listening on http://0.0.0.0:${PORT} serving ${DIST_DIR} (proxying /api and /hubs to :${API_PORT})`);
});
