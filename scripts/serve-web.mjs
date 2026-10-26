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
    const proxyHeaders = {
      ...req.headers,
      host: `${API_HOST}:${API_PORT}`,
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'https',
      'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    };
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
          '  <script src="https://telegram.org/js/telegram-web-app.js"></script>\n  <script>try{if(window.Telegram&&window.Telegram.WebApp){window.Telegram.WebApp.ready();window.Telegram.WebApp.expand();window.Telegram.WebApp.setHeaderColor("#0b0716");window.Telegram.WebApp.setBackgroundColor("#0b0716");}}catch(e){console.error(e);}</script>\n</head>'
        );
      }
      if (!html.includes('theme-color')) {
        html = html.replace('<head>', '<head>\n  <meta name="theme-color" content="#0b0716">\n  <meta name="color-scheme" content="dark">');
      }
      if (!html.includes('arena-preloader-style')) {
        html = html.replace(
          '</head>',
          `  <style id="arena-preloader-style">
          html, body, #root {
            height: 100%;
            background-color: #0b0716 !important;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          .arena-loader-wrap {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #0b0716;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
          }
          .arena-loader-halo {
            position: absolute;
            width: 260px;
            height: 260px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(139, 92, 246, 0.14) 45%, transparent 70%);
            animation: arenaHaloPulse 2s ease-in-out infinite;
          }
          .arena-bottle-box {
            position: relative;
            width: 140px;
            height: 140px;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: arenaBottleSpin 1.8s linear infinite;
            transform-origin: center center;
          }
          .arena-bottle {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .arena-pointer-tip {
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 9px solid #F59E0B;
            margin-bottom: 2px;
          }
          .arena-foil-cap {
            width: 14px;
            height: 16px;
            background-color: #D97706;
            border-top-left-radius: 4px;
            border-top-right-radius: 4px;
            border: 1px solid #F59E0B;
            position: relative;
            box-sizing: border-box;
          }
          .arena-foil-ring {
            position: absolute;
            top: 4px;
            left: 0;
            right: 0;
            height: 3px;
            background-color: #FEF08A;
          }
          .arena-neck {
            width: 13px;
            height: 18px;
            background-color: #064e3b;
            border: 0.8px solid rgba(16, 185, 129, 0.45);
            box-sizing: border-box;
          }
          .arena-shoulders {
            width: 36px;
            height: 12px;
            border-top-left-radius: 12px;
            border-top-right-radius: 12px;
            background-color: #04382a;
            border: 0.8px solid rgba(16, 185, 129, 0.35);
            box-sizing: border-box;
          }
          .arena-body {
            width: 42px;
            height: 56px;
            background-color: #022c22;
            border-bottom-left-radius: 10px;
            border-bottom-right-radius: 10px;
            border: 1.2px solid rgba(16, 185, 129, 0.4);
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
            box-sizing: border-box;
          }
          .arena-glass-sheen {
            position: absolute;
            left: 4px;
            top: 0;
            bottom: 0;
            width: 3.5px;
            background: rgba(255, 255, 255, 0.4);
            border-radius: 2px;
          }
          .arena-glass-secondary {
            position: absolute;
            right: 4px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: rgba(255, 255, 255, 0.18);
            border-radius: 1px;
          }
          .arena-label {
            width: 28px;
            height: 16px;
            background-color: #18181b;
            border-radius: 3px;
            border: 1px solid #D97706;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
          }
          .arena-label-badge {
            width: 14px;
            height: 2px;
            background-color: #F59E0B;
            border-radius: 1px;
            box-shadow: 0 0 4px rgba(245, 158, 11, 0.6);
          }
          .arena-loader-text {
            margin-top: 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .arena-status-text {
            font-size: 15px;
            font-weight: 600;
            color: #E0E7FF;
            letter-spacing: 1px;
            animation: arenaTextPulse 1.6s ease-in-out infinite;
          }
          @keyframes arenaBottleSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes arenaHaloPulse {
            0%, 100% { transform: scale(0.92); opacity: 0.45; }
            50% { transform: scale(1.1); opacity: 0.95; }
          }
          @keyframes arenaTextPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          </style>\n</head>`
        );
      }
      if (!html.includes('arena-initial-loader') && html.includes('<div id="root">')) {
        html = html.replace(
          '<div id="root">',
          '<div id="root"><div id="arena-initial-loader" class="arena-loader-wrap"><div class="arena-loader-halo"></div><div class="arena-bottle-box"><div class="arena-bottle"><div class="arena-pointer-tip"></div><div class="arena-foil-cap"><div class="arena-foil-ring"></div></div><div class="arena-neck"></div><div class="arena-shoulders"></div><div class="arena-body"><div class="arena-glass-sheen"></div><div class="arena-glass-secondary"></div><div class="arena-label"><div class="arena-label-badge"></div></div></div></div></div><div class="arena-loader-text"><div class="arena-status-text">ჩატვირთვა...</div></div></div>'
        );
      }
      payload = Buffer.from(html, 'utf-8');
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
