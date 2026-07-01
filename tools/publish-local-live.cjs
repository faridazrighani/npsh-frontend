#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const frontendRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const argSet = new Set(args);

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const exactIndex = args.indexOf(name);
  if (exactIndex >= 0 && exactIndex + 1 < args.length) return args[exactIndex + 1];
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : fallback;
}

const projectName = argValue('--project-name', 'npsh-frontend');
const branch = argValue('--branch', '');
const commitMessage = argValue('--message', 'Refresh frontend local-to-live package');
const skipChecks = argSet.has('--skip-checks');
const skipDeploy = argSet.has('--skip-deploy');
const skipWaitLive = argSet.has('--skip-wait-live');
const maxWaitSeconds = Number.parseInt(argValue('--wait-seconds', '240'), 10);

function run(command, commandArgs = [], options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || frontendRoot,
    env: options.env || process.env,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const rendered = [command, ...commandArgs].join(' ');
    const detail = options.capture ? `${result.stdout || ''}${result.stderr || ''}`.trim() : '';
    throw new Error(`${rendered} failed with exit code ${result.status}${detail ? `\n${detail}` : ''}`);
  }
  return result;
}

function capture(command, commandArgs = [], options = {}) {
  return run(command, commandArgs, { ...options, capture: true }).stdout.trim();
}

function git(commandArgs, options = {}) {
  return run('git', commandArgs, options);
}

function gitCapture(commandArgs) {
  return capture('git', commandArgs);
}

function npmCommand() {
  return process.platform === 'win32' ? 'cmd.exe' : 'npm';
}

function npmArgs(commandArgs) {
  return process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd', ...commandArgs] : commandArgs;
}

function npxCommand() {
  return process.platform === 'win32' ? 'cmd.exe' : 'npx';
}

function npxArgs(commandArgs) {
  return process.platform === 'win32' ? ['/c', 'npx', ...commandArgs] : commandArgs;
}

function nodeCommand() {
  return process.execPath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusPorcelain() {
  return gitCapture(['status', '--porcelain']);
}

function currentBranch() {
  return branch || gitCapture(['branch', '--show-current']) || 'main';
}

function refreshManifest({ verifyAssets = false } = {}) {
  const manifestArgs = ['tools/generate-local-live-sync-manifest.cjs'];
  if (verifyAssets) manifestArgs.push('--verify-assets');
  run(nodeCommand(), manifestArgs);
}

function runChecks() {
  if (skipChecks) return;
  [
    ['run', 'validate:pipe-properties-cleanup-runtime'],
    ['run', 'validate:pipe-segments-file-runtime'],
    ['run', 'validate:pipe-source-confidence-map'],
    ['run', 'validate:realtime-defense']
  ].forEach((commandArgs) => run(npmCommand(), npmArgs(commandArgs)));
}

function commitIfDirty(message) {
  if (!statusPorcelain()) return null;
  git(['add', '-A']);
  const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: frontendRoot, shell: false });
  if (staged.status === 0) return null;
  git(['commit', '-m', message]);
  return gitCapture(['rev-parse', 'HEAD']);
}

function copyTrackedFilesToStaging(stagingRoot) {
  fs.mkdirSync(stagingRoot, { recursive: true });
  const files = gitCapture(['ls-files']).split(/\r?\n/).filter(Boolean);
  files.forEach((file) => {
    const source = path.join(frontendRoot, ...file.split('/'));
    const destination = path.join(stagingRoot, ...file.split('/'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  });
  if (!fs.existsSync(path.join(stagingRoot, 'index.html'))) {
    throw new Error('Deployment staging is missing index.html.');
  }
  return files.length;
}

function removeStaging(stagingRoot) {
  const resolvedRoot = fs.realpathSync(frontendRoot);
  const resolvedStaging = fs.existsSync(stagingRoot) ? fs.realpathSync(stagingRoot) : '';
  if (!resolvedStaging || !resolvedStaging.startsWith(`${resolvedRoot}${path.sep}`)) return;
  fs.rmSync(resolvedStaging, { recursive: true, force: true });
}

function deployWithWrangler(commitSha, activeBranch) {
  if (skipDeploy) return false;

  const stagingRoot = path.join(frontendRoot, `.deploy-staging-${Date.now()}`);
  const deployEnv = { ...process.env };
  if (process.env.CLOUDFLARE_API_TOKEN) {
    const xdgConfigHome = path.join(frontendRoot, '.wrangler-config');
    const wranglerLogPath = path.join(xdgConfigHome, 'logs');
    fs.mkdirSync(wranglerLogPath, { recursive: true });
    deployEnv.XDG_CONFIG_HOME = xdgConfigHome;
    deployEnv.WRANGLER_LOG_PATH = wranglerLogPath;
  } else {
    console.log('CLOUDFLARE_API_TOKEN is not set; Wrangler will use the stored OAuth login if available.');
  }

  try {
    const fileCount = copyTrackedFilesToStaging(stagingRoot);
    console.log(`Deploy staging: ${stagingRoot} (${fileCount} tracked files)`);
    const wranglerArgs = [
      'wrangler',
      'pages',
      'deploy',
      stagingRoot,
      '--project-name', projectName,
      '--branch', activeBranch,
      '--commit-hash', commitSha,
      '--commit-message', commitMessage,
      '--commit-dirty=false'
    ];
    run(npxCommand(), npxArgs(wranglerArgs), { env: deployEnv });
    return true;
  } finally {
    removeStaging(stagingRoot);
  }
}

function manifestStatus() {
  const manifestPath = path.join(frontendRoot, 'LOCAL_LIVE_SYNC_MANIFEST.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

async function waitForLiveSync() {
  if (skipWaitLive) return manifestStatus();
  const deadline = Date.now() + Math.max(30, maxWaitSeconds) * 1000;
  let latest = null;
  do {
    refreshManifest({ verifyAssets: true });
    latest = manifestStatus();
    console.log(`Live sync status: ${latest.status}`);
    if (latest.status === 'synced') return latest;
    await sleep(15000);
  } while (Date.now() < deadline);
  return latest;
}

async function main() {
  console.log('Checking GitHub auth...');
  run('gh', ['auth', 'status']);

  runChecks();

  console.log('Refreshing pre-deploy manifest...');
  refreshManifest({ verifyAssets: false });
  const preCommit = commitIfDirty(commitMessage);
  const activeBranch = currentBranch();
  const commitSha = gitCapture(['rev-parse', 'HEAD']);
  if (preCommit) console.log(`Created commit: ${preCommit}`);
  console.log(`Pushing ${activeBranch} to origin...`);
  git(['push', 'origin', activeBranch]);

  const directDeploy = deployWithWrangler(commitSha, activeBranch);
  if (!directDeploy) console.log('Direct Wrangler deploy was skipped.');

  console.log('Waiting for live/cache verification...');
  const latest = await waitForLiveSync();
  if (!latest || latest.status !== 'synced') {
    throw new Error(`Live verification did not reach synced status. Last status: ${latest?.status || 'unknown'}`);
  }

  const manifestCommit = commitIfDirty('Refresh frontend live sync manifest');
  if (manifestCommit) {
    console.log(`Created final manifest commit: ${manifestCommit}`);
    git(['push', 'origin', activeBranch]);
    const finalSha = gitCapture(['rev-parse', 'HEAD']);
    deployWithWrangler(finalSha, activeBranch);
  }

  console.log('Publish complete.');
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
