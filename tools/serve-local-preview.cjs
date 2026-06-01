#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function readFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const host = readFlag('--host', process.env.HOST || '127.0.0.1');
const port = Number.parseInt(readFlag('--port', process.env.PORT || '4173'), 10);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8'
};

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(rootDir, relative);
  if (!target.startsWith(rootDir + path.sep) && target !== rootDir) return null;
  return target;
}

function send(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (!req.url || !['GET', 'HEAD'].includes(req.method || '')) {
    send(res, 405, 'Method Not Allowed');
    return;
  }

  const filePath = resolveRequestPath(req.url);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      send(res, 404, 'Not Found');
      return;
    }

    const type = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': stat.size,
      'Content-Type': type
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, host, () => {
  console.log(`NPSH frontend preview: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
  console.log(`Serving: ${rootDir}`);
});

server.on('error', error => {
  console.error(`Unable to start local preview on ${host}:${port}: ${error.message}`);
  process.exitCode = 1;
});
