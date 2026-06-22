#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const frontendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendRoot, '..');
const apiRoot = path.join(workspaceRoot, 'npsh-api');
const apiServer = path.join(apiRoot, 'server.mjs');
const localLiveManifestGenerator = path.join(frontendRoot, 'tools', 'generate-local-live-sync-manifest.cjs');
const args = process.argv.slice(2);

function readFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const host = readFlag('--host', process.env.HOST || '127.0.0.1');
const port = Number.parseInt(readFlag('--port', process.env.PORT || '4173'), 10);
const healthHost = host === '0.0.0.0' ? '127.0.0.1' : host;
const lockRoot = path.join(os.tmpdir(), 'npsh-local-api-preview-locks');
const lockFile = path.join(lockRoot, `${healthHost.replace(/[^a-z0-9.-]/gi, '_')}-${port}.lock`);

if (!Number.isFinite(port) || port <= 0) {
  console.error(`Invalid preview API port: ${readFlag('--port', process.env.PORT || '4173')}`);
  process.exit(1);
}

if (!fs.existsSync(apiServer)) {
  console.error(`NPSH API server was not found at ${apiServer}`);
  process.exit(1);
}

function processIsRunning(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function healthCheck() {
  return new Promise(resolve => {
    const req = http.request({
      host: healthHost,
      port,
      path: '/api/health',
      method: 'GET',
      timeout: 1000
    }, res => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function waitForHealth(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await healthCheck()) return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

function readLockOwner() {
  try {
    return JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  } catch {
    return null;
  }
}

function acquireStartLock() {
  fs.mkdirSync(lockRoot, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, port, createdAt: new Date().toISOString() }));
      fs.closeSync(fd);
      return true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = readLockOwner();
      if (!owner || !processIsRunning(Number(owner.pid))) {
        try {
          fs.unlinkSync(lockFile);
          continue;
        } catch {
          return false;
        }
      }
      return false;
    }
  }
  return false;
}

function releaseStartLock() {
  try {
    const owner = readLockOwner();
    if (Number(owner?.pid) === process.pid) fs.unlinkSync(lockFile);
  } catch {
    // Best-effort cleanup; stale locks are reaped by the next preview process.
  }
}

function keepReusableWebServerProcessAlive() {
  const timer = setInterval(() => {}, 2147483647);
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      clearInterval(timer);
      process.exit(0);
    });
  });
}

function refreshLocalLiveSyncManifest() {
  if (!fs.existsSync(localLiveManifestGenerator)) return;
  const child = spawn(process.execPath, [localLiveManifestGenerator, '--quiet'], {
    cwd: frontendRoot,
    env: process.env,
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true
  });
  child.stderr.on('data', chunk => {
    const text = String(chunk || '').trim();
    if (text) console.warn(`[local-live-sync] ${text}`);
  });
}

async function reuseExistingPreviewServer() {
  if (!(await waitForHealth())) {
    console.error(`Timed out waiting for reusable NPSH preview server at http://${healthHost}:${port}/api/health`);
    process.exit(1);
  }
  console.log(`Reusing existing NPSH preview server at http://${healthHost}:${port}/`);
  keepReusableWebServerProcessAlive();
}

async function main() {
  refreshLocalLiveSyncManifest();

  if (await healthCheck()) {
    await reuseExistingPreviewServer();
    return;
  }

  if (!acquireStartLock()) {
    await reuseExistingPreviewServer();
    return;
  }
  process.once('exit', releaseStartLock);

  const child = spawn(process.execPath, [apiServer, String(port)], {
    cwd: apiRoot,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      NPSH_STATIC_ROOT: frontendRoot
    },
    stdio: 'inherit',
    windowsHide: true
  });

  child.on('exit', (code, signal) => {
    releaseStartLock();
    if (signal) {
      process.exit(0);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on('error', error => {
    releaseStartLock();
    console.error(`Unable to start local API preview: ${error.message}`);
    process.exit(1);
  });

  waitForHealth().then(releaseStartLock, releaseStartLock);

  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      releaseStartLock();
      if (!child.killed) child.kill(signal);
    });
  });
}

main().catch(error => {
  releaseStartLock();
  console.error(`Unable to start local API preview: ${error.message}`);
  process.exit(1);
});
