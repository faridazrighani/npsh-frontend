#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const frontendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendRoot, '..');
const apiRoot = path.join(workspaceRoot, 'npsh-api');
const outputName = 'LOCAL_LIVE_SYNC_MANIFEST.json';
const liveOrigin = process.env.NPSH_LIVE_ORIGIN || 'https://npsh.virsim.id';
const args = new Set(process.argv.slice(2));
const verifyAssets = args.has('--verify-assets');
const quiet = args.has('--quiet');
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.md',
  '.svg',
  '.txt',
  '.xml'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isTextAsset(relativePath) {
  return TEXT_EXTENSIONS.has(path.extname(String(relativePath || '').split('?')[0]).toLowerCase());
}

function canonicalizeText(text, relativePath) {
  let normalized = text.replace(/\r\n/g, '\n');
  if (/\.html?$/i.test(String(relativePath || '').split('?')[0])) {
    normalized = normalized.replace(/\n?<script\b[^>]*static\.cloudflareinsights\.com\/beacon[^>]*><\/script>/gi, '');
  }
  return normalized;
}

function canonicalTextBuffer(buffer, relativePath) {
  return Buffer.from(canonicalizeText(buffer.toString('utf8'), relativePath), 'utf8');
}

function contentInfo(buffer, relativePath) {
  const text = isTextAsset(relativePath);
  const canonical = text ? canonicalTextBuffer(buffer, relativePath) : buffer;
  return {
    sizeBytes: buffer.length,
    sha256: sha256(buffer),
    canonicalSizeBytes: canonical.length,
    canonicalSha256: sha256(canonical),
    canonicalizedLineEndings: text
  };
}

function fileInfo(root, relativePath) {
  const safeRelative = String(relativePath || '').replace(/^\/+/, '').split('?')[0];
  const filePath = path.resolve(root, safeRelative);
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (filePath !== root && !filePath.startsWith(normalizedRoot)) return { path: safeRelative, exists: false };
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return { path: safeRelative, exists: false };
  const data = fs.readFileSync(filePath);
  return {
    path: safeRelative,
    exists: true,
    ...contentInfo(data, safeRelative)
  };
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function gitValue(cwd, commandArgs) {
  try {
    return execFileSync('git', commandArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function requestBuffer(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'npsh-local-live-sync-manifest/1.0'
      },
      timeout: timeoutMs
    }, res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        url,
        statusCode: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks)
      }));
    });
    req.on('timeout', () => req.destroy(new Error(`Timeout fetching ${url}`)));
    req.on('error', reject);
  });
}

function extractCacheKeys(indexHtml) {
  const keys = new Set();
  const pattern = /["'`]([^"'`<>\s]+?\?v=[^"'`<>\s]+)["'`]/g;
  let match;
  while ((match = pattern.exec(indexHtml))) {
    const key = match[1].replace(/&amp;/g, '&');
    if (/^(?:https?:)?\/\//i.test(key)) continue;
    keys.add(key.replace(/^\.\//, ''));
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

function diffArrays(left, right) {
  const rightSet = new Set(right);
  return left.filter(item => !rightSet.has(item));
}

function assetPathFromKey(key) {
  return String(key || '').split('?')[0].replace(/^\/+/, '');
}

async function fetchLive() {
  const live = {
    origin: liveOrigin,
    indexUrl: `${liveOrigin}/`,
    apiVersionUrl: `${liveOrigin}/api/version`,
    reachable: false,
    error: null,
    index: null,
    apiVersion: null,
    verifiedAssets: []
  };

  try {
    const [indexResponse, versionResponse] = await Promise.all([
      requestBuffer(live.indexUrl),
      requestBuffer(live.apiVersionUrl)
    ]);
    const indexHtml = indexResponse.body.toString('utf8');
    live.reachable = true;
    live.index = {
      statusCode: indexResponse.statusCode,
      ...contentInfo(indexResponse.body, 'index.html'),
      cacheKeys: extractCacheKeys(indexHtml)
    };
    live.apiVersion = {
      statusCode: versionResponse.statusCode,
      sha256: sha256(versionResponse.body),
      payload: JSON.parse(versionResponse.body.toString('utf8'))
    };
  } catch (error) {
    live.error = error.message;
  }

  return live;
}

async function verifyLiveAssets(liveCacheKeys, localAssets) {
  const localByKey = new Map(localAssets.map(item => [item.cacheKey, item]));
  const verified = [];
  for (const cacheKey of liveCacheKeys) {
    const local = localByKey.get(cacheKey);
    const assetPath = assetPathFromKey(cacheKey);
    try {
      const response = await requestBuffer(`${liveOrigin}/${cacheKey}`);
      verified.push({
        cacheKey,
        path: assetPath,
        liveSizeBytes: response.body.length,
        liveSha256: sha256(response.body),
        liveCanonicalSha256: contentInfo(response.body, assetPath).canonicalSha256,
        localSha256: local?.sha256 || null,
        localCanonicalSha256: local?.canonicalSha256 || null,
        matched: !!local?.canonicalSha256 && local.canonicalSha256 === contentInfo(response.body, assetPath).canonicalSha256
      });
    } catch (error) {
      verified.push({
        cacheKey,
        path: assetPath,
        error: error.message,
        matched: false
      });
    }
  }
  return verified;
}

function buildLocalSnapshot(indexHtml) {
  const cacheKeys = extractCacheKeys(indexHtml);
  const criticalPaths = new Set([
    'index.html',
    'app.bundle.min.js',
    'style.min.css',
    'FILE_MANIFEST.md',
    ...cacheKeys.map(assetPathFromKey)
  ]);
  const assets = [...criticalPaths]
    .sort((a, b) => a.localeCompare(b))
    .map(relativePath => {
      const info = fileInfo(frontendRoot, relativePath);
      const cacheKey = cacheKeys.find(key => assetPathFromKey(key) === relativePath) || null;
      return { ...info, cacheKey };
    });

  const releaseManifestPath = path.join(apiRoot, 'docs', 'release-integrity-manifest.json');
  const releaseManifest = fs.existsSync(releaseManifestPath) ? readJson(releaseManifestPath) : null;

  return {
    frontendRoot,
    apiRoot,
    serverUrl: process.env.NPSH_LOCAL_URL || 'http://127.0.0.1:4174/',
    frontendCommit: gitValue(frontendRoot, ['rev-parse', 'HEAD']),
    frontendOriginMain: gitValue(frontendRoot, ['rev-parse', 'origin/main']),
    apiCommit: gitValue(apiRoot, ['rev-parse', 'HEAD']),
    apiOriginMain: gitValue(apiRoot, ['rev-parse', 'origin/main']),
    releaseIntegrity: releaseManifest ? {
      schemaVersion: releaseManifest.schemaVersion,
      rootFingerprint: releaseManifest.rootFingerprint,
      fileCount: releaseManifest.fileCount,
      generatedAt: releaseManifest.generatedAt
    } : null,
    index: {
      path: 'index.html',
      ...contentInfo(Buffer.from(indexHtml, 'utf8'), 'index.html'),
      cacheKeys
    },
    assets
  };
}

async function main() {
  const indexPath = path.join(frontendRoot, 'index.html');
  const local = buildLocalSnapshot(readText(indexPath));
  const live = await fetchLive();
  if (verifyAssets && live.index?.cacheKeys?.length) {
    live.verifiedAssets = await verifyLiveAssets(live.index.cacheKeys, local.assets);
  }

  const localKeys = local.index.cacheKeys;
  const liveKeys = live.index?.cacheKeys || [];
  const cacheKeysMissingOnLive = live.index ? diffArrays(localKeys, liveKeys) : [];
  const cacheKeysMissingLocally = live.index ? diffArrays(liveKeys, localKeys) : [];
  const localIndexMatchesLive = !!live.index && local.index.canonicalSha256 === live.index.canonicalSha256;
  const cacheKeysMatch = !!live.index && cacheKeysMissingOnLive.length === 0 && cacheKeysMissingLocally.length === 0;
  const assetVerificationFailures = live.verifiedAssets.filter(item => item.matched === false);
  const status = !live.reachable
    ? 'live-unavailable'
    : (localIndexMatchesLive && cacheKeysMatch && assetVerificationFailures.length === 0 ? 'synced' : 'review-required');

  const manifest = {
    schemaVersion: 'local-live-sync-manifest.v1',
    generatedAt: new Date().toISOString(),
    purpose: 'Keeps the local preview server auditable against the deployed npsh.virsim.id package.',
    status,
    syncChecks: {
      liveReachable: live.reachable,
      localIndexMatchesLive,
      cacheKeysMatch,
      verifiedLiveAssets: verifyAssets,
      assetVerificationFailures: assetVerificationFailures.length,
      apiCommitMatchesOriginMain: !!local.apiCommit && local.apiCommit === local.apiOriginMain,
      frontendCommitMatchesOriginMain: !!local.frontendCommit && local.frontendCommit === local.frontendOriginMain
    },
    local,
    live,
    differences: {
      cacheKeysMissingOnLive,
      cacheKeysMissingLocally,
      assetVerificationFailures
    },
    cachePolicy: {
      htmlAndManifest: 'no-cache/no-store validation path',
      cacheBustedAssets: 'public, max-age=31536000, immutable; cache key must change whenever bytes change'
    },
    manualRefreshCommands: [
      'cd npsh-frontend && npm run sync:local-live',
      'cd npsh-api && npm run build:same-origin',
      'cd npsh-api && npm run test:release-candidate'
    ]
  };

  const outputPath = path.join(frontendRoot, outputName);
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const publicRoot = path.join(apiRoot, 'public');
  if (fs.existsSync(path.join(publicRoot, 'index.html'))) {
    fs.writeFileSync(path.join(publicRoot, outputName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  if (!quiet) {
    console.log(JSON.stringify({
      ok: status !== 'live-unavailable',
      status,
      output: outputPath,
      localIndexMatchesLive,
      cacheKeysMatch,
      assetVerificationFailures: assetVerificationFailures.length,
      liveOrigin
    }, null, 2));
  }

  if (args.has('--strict') && status !== 'synced') process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
