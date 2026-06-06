#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(rootDir, '..');
const literatureRoot = path.join(workspaceRoot, 'book_pdf');
const args = process.argv.slice(2);

function readFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const host = readFlag('--host', process.env.HOST || '127.0.0.1');
const port = Number.parseInt(readFlag('--port', process.env.PORT || '4173'), 10);

const literatureBooks = [
  {
    id: 'cengel-fluid-mechanics-3e',
    author: 'Cengel',
    shortTitle: 'Fluid Mechanics 3rd Ed',
    menuLabel: 'Cengel - Fluid Mechanics 3rd Ed',
    filename: 'Fluid_Cengel_FluidMechanics_3rdEd_2014.pdf',
    sizeBytes: 22923248
  },
  {
    id: 'fox-mcdonald-fluid-mechanics-10e',
    author: 'Fox & McDonald',
    shortTitle: 'Introduction to Fluid Mechanics 10th Ed',
    menuLabel: 'Fox & McDonald - Introduction to Fluid Mechanics 10th Ed',
    filename: 'Fluid_Fox_McDonald_IntroductionToFluidMechanics_10thEd.pdf',
    sizeBytes: 33991196
  },
  {
    id: 'grist-cavitation-centrifugal-pump-1998',
    author: 'Grist',
    shortTitle: 'Cavitation and the Centrifugal Pump',
    menuLabel: 'Grist - Cavitation and the Centrifugal Pump',
    filename: 'Fluid_Grist_CavitationAndTheCentrifugalPump_1998.pdf',
    sizeBytes: 108229393
  },
  {
    id: 'hydraulic-institute-npsh-margin-2024',
    author: 'Hydraulic Institute',
    shortTitle: 'NPSH Margin Guideline 2024',
    menuLabel: 'Hydraulic Institute - NPSH Margin Guideline 2024',
    filename: 'Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf',
    sizeBytes: 36443739
  }
];

const literatureBooksById = new Map(literatureBooks.map(book => [book.id, book]));

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

function sendJson(req, res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(req.method === 'HEAD' ? '' : body);
}

function parseByteRange(rangeHeader, size) {
  const value = String(rangeHeader || '').trim();
  if (!value) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return { invalid: true };

  let start;
  let end;
  if (match[1] === '') {
    const suffixLength = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { invalid: true };
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    end = match[2] === '' ? size - 1 : Number.parseInt(match[2], 10);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return { invalid: true };
  }

  return {
    start,
    end: Math.min(end, size - 1),
    partial: true
  };
}

function resolveLiteraturePdf(book) {
  const filePath = path.resolve(literatureRoot, book.filename);
  const rootWithSeparator = literatureRoot.endsWith(path.sep) ? literatureRoot : `${literatureRoot}${path.sep}`;
  if (filePath !== literatureRoot && !filePath.startsWith(rootWithSeparator)) return null;
  return filePath;
}

function sendLocalLiteratureList(req, res) {
  sendJson(req, res, 200, {
    ok: true,
    accessMode: 'local-preview',
    viewerMode: 'canvas-read-only',
    sourceLinksExposed: false,
    books: literatureBooks.map(book => ({
      id: book.id,
      author: book.author,
      shortTitle: book.shortTitle,
      menuLabel: book.menuLabel,
      sizeBytes: book.sizeBytes,
      viewerEndpoint: `/api/literature/${encodeURIComponent(book.id)}/pdf`
    }))
  });
}

async function sendLocalLiteraturePdf(req, res, book) {
  const filePath = resolveLiteraturePdf(book);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    sendJson(req, res, 404, {
      ok: false,
      error: 'local_literature_pdf_not_found',
      message: `Local literature PDF was not found in ${literatureRoot}.`
    });
    return;
  }

  const range = parseByteRange(req.headers.range, stat.size);
  if (range.invalid) {
    res.writeHead(416, {
      'Cache-Control': 'no-store',
      'Content-Range': `bytes */${stat.size}`,
      'Content-Type': 'application/pdf'
    });
    res.end();
    return;
  }

  const length = range.end - range.start + 1;
  const headers = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Length': length,
    'Content-Type': 'application/pdf',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
  if (range.partial) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stat.size}`;

  res.writeHead(range.partial ? 206 : 200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
}

async function handleLocalLiteratureRequest(req, res) {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
  const pathname = requestUrl.pathname.replace(/\/+$/, '');
  if (pathname !== '/api/literature' && !pathname.startsWith('/api/literature/')) return false;

  if (pathname === '/api/literature') {
    sendLocalLiteratureList(req, res);
    return true;
  }

  const match = /^\/api\/literature\/([^/]+)\/pdf$/.exec(pathname);
  const book = match ? literatureBooksById.get(decodeURIComponent(match[1])) : null;
  if (!book) {
    sendJson(req, res, 404, {
      ok: false,
      error: 'literature_book_not_found'
    });
    return true;
  }

  await sendLocalLiteraturePdf(req, res, book);
  return true;
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !['GET', 'HEAD'].includes(req.method || '')) {
    send(res, 405, 'Method Not Allowed');
    return;
  }

  if (await handleLocalLiteratureRequest(req, res)) {
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
