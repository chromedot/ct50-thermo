const http = require('http');
const fs = require('fs');
const path = require('path');

const TSTAT_HOST = '192.168.6.174';
const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

const server = http.createServer((req, res) => {
  // Serve static files
  if (['/', '/index.html', '/style.css', '/app.js'].includes(req.url)) {
    const file = req.url === '/' ? '/index.html' : req.url;
    const ext = path.extname(file);
    fs.readFile(path.join(__dirname, file), (err, data) => {
      if (err) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
      res.end(data);
    });
    return;
  }

  // Proxy /api/* to thermostat
  if (req.url.startsWith('/api/')) {
    const tstatPath = req.url.replace('/api', '');
    let reqBody = '';
    req.on('data', c => reqBody += c);
    req.on('end', () => {
      const opts = {
        hostname: TSTAT_HOST, port: 80, path: tstatPath,
        method: req.method, timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      };
      if (reqBody) opts.headers['Content-Length'] = Buffer.byteLength(reqBody);
      const p = http.request(opts, pr => {
        let body = '';
        pr.on('data', c => body += c);
        pr.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(body);
        });
      });
      p.on('error', e => { res.writeHead(502); res.end(JSON.stringify({error:e.message})); });
      p.on('timeout', () => { p.destroy(); res.writeHead(504); res.end('{}'); });
      if (reqBody) p.write(reqBody);
      p.end();
    });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`Thermostat dashboard: http://localhost:${PORT}`));
