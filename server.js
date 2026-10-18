const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];

  // Routing aliases for clear separation of web and admin
  if (reqUrl === '/' || reqUrl === '/index.html' || reqUrl === '/web' || reqUrl === '/web/') {
    reqUrl = '/web/index.html';
  } else if (reqUrl === '/admin' || reqUrl === '/admin/' || reqUrl === '/admin.html') {
    reqUrl = '/admin/index.html';
  }

  const filePath = path.join(__dirname, reqUrl);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${reqUrl}`);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`500 Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🌻 Intensive Writer đang chạy tại: http://localhost:${PORT}`);
  console.log(`   - Giao diện học viên (Web): http://localhost:${PORT}/web/`);
  console.log(`   - Giao diện quản trị (Admin): http://localhost:${PORT}/admin/`);
});
