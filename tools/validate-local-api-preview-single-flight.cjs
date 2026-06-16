const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const PREVIEW_SCRIPT = path.join(FRONTEND_ROOT, "tools", "serve-local-api-preview.cjs");
const HOST = "127.0.0.1";
const LOCK_ROOT = path.join(os.tmpdir(), "npsh-local-api-preview-locks");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function healthCheck(port) {
  return new Promise(resolve => {
    const req = http.request({
      host: HOST,
      port,
      path: "/api/health",
      method: "GET",
      timeout: 1000
    }, res => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function waitFor(predicate, timeoutMs, message) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(typeof message === "function" ? message() : message);
}

function spawnPreview(name, port) {
  const child = spawn(process.execPath, [
    PREVIEW_SCRIPT,
    "--host",
    HOST,
    "--port",
    String(port)
  ], {
    cwd: FRONTEND_ROOT,
    env: {
      ...process.env,
      NO_COLOR: "1"
    },
    windowsHide: true
  });

  const state = {
    name,
    child,
    output: "",
    stderr: "",
    exitCode: null,
    signal: null
  };

  child.stdout.on("data", chunk => {
    state.output += chunk.toString();
  });
  child.stderr.on("data", chunk => {
    state.stderr += chunk.toString();
  });
  child.on("exit", (code, signal) => {
    state.exitCode = code;
    state.signal = signal;
  });

  return state;
}

function terminate(state) {
  return new Promise(resolve => {
    if (state.exitCode !== null || state.signal) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      if (state.exitCode === null && !state.signal) state.child.kill("SIGKILL");
      resolve();
    }, 5000);

    state.child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    state.child.kill("SIGTERM");
  });
}

function cleanupTestLock(port) {
  const lockFile = path.join(LOCK_ROOT, `${HOST}-${port}.lock`);
  try {
    fs.unlinkSync(lockFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function main() {
  const port = Number.parseInt(process.env.NPSH_SINGLE_FLIGHT_PORT || "", 10) || await getFreePort();
  const first = spawnPreview("first", port);
  const second = spawnPreview("second", port);
  const states = [first, second];

  try {
    await waitFor(() => healthCheck(port), 30000, `Preview server did not become healthy on ${HOST}:${port}.`);

    await waitFor(() => {
      const combined = states.map(state => `${state.output}\n${state.stderr}`).join("\n");
      return /Preview server running at http:\/\/127\.0\.0\.1:\d+\//.test(combined)
        && /Reusing existing NPSH preview server at http:\/\/127\.0\.0\.1:\d+\//.test(combined);
    }, 30000, () => {
      const combined = states.map(state => [
        `--- ${state.name} stdout ---`,
        state.output,
        `--- ${state.name} stderr ---`,
        state.stderr
      ].join("\n")).join("\n");
      return `Concurrent preview start did not show one starter and one reusable server.\n${combined}`;
    });

    const combined = states.map(state => `${state.output}\n${state.stderr}`).join("\n");
    assert(!/EADDRINUSE/i.test(combined), `Concurrent preview start must not emit EADDRINUSE.\n${combined}`);
    assert(
      states.some(state => state.output.includes(`Preview server running at http://${HOST}:${port}/`)),
      "One preview process must start the local API preview server."
    );
    assert(
      states.some(state => state.output.includes(`Reusing existing NPSH preview server at http://${HOST}:${port}/`)),
      "One preview process must reuse the already-starting local API preview server."
    );

    console.log(JSON.stringify({
      passed: true,
      localApiPreviewSingleFlight: true,
      port,
      starters: states.filter(state => state.output.includes("Preview server running at")).map(state => state.name),
      reusers: states.filter(state => state.output.includes("Reusing existing NPSH preview server")).map(state => state.name)
    }, null, 2));
  } finally {
    await Promise.all(states.map(terminate));
    await waitFor(async () => !(await healthCheck(port)), 10000, `Preview server still responds on ${HOST}:${port} after cleanup.`);
    cleanupTestLock(port);
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
