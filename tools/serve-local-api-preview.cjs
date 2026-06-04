#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const frontendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendRoot, '..');
const apiRoot = path.join(workspaceRoot, 'npsh-api');
const apiServer = path.join(apiRoot, 'server.mjs');
const args = process.argv.slice(2);

function readFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const host = readFlag('--host', process.env.HOST || '127.0.0.1');
const port = Number.parseInt(readFlag('--port', process.env.PORT || '4173'), 10);

if (!Number.isFinite(port) || port <= 0) {
  console.error(`Invalid preview API port: ${readFlag('--port', process.env.PORT || '4173')}`);
  process.exit(1);
}

if (!fs.existsSync(apiServer)) {
  console.error(`NPSH API server was not found at ${apiServer}`);
  process.exit(1);
}

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
  if (signal) {
    process.exit(0);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', error => {
  console.error(`Unable to start local API preview: ${error.message}`);
  process.exit(1);
});

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
});
