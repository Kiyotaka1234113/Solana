const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const RPC_ENDPOINT = 'https://api.devnet.solana.com';

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/rpc')) {
    // Proxy RPC POST requests
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };
      const proxy = https.request(RPC_ENDPOINT, options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          res.end(data);
        });
      });
      proxy.on('error', err => {
        res.writeHead(502);
        res.end(JSON.stringify({ error: err.message }));
      });
      proxy.write(body);
      proxy.end();
    });
  } else {
    // Serve static files (index.html)
    let filePath = path.join(__dirname, 'index.html');
    if (req.url !== '/' && req.url !== '/index.html') {
      // fallback to index for any other path
      filePath = path.join(__dirname, 'index.html');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }
});

server.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
});
