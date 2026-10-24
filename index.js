/**
 * Host half of dsh-plugin-always-on-top.
 *
 * The browser half renders one pin button in the composer. This half answers a
 * single loopback route and toggles the Electron main window's always-on-top
 * state.
 *
 * The Desktop Host runs in a Node-mode child of Electron and has no
 * BrowserWindow access. There is also no shipped IPC channel for window levels.
 * Instead of rewriting app.asar, this plugin briefly asks the Electron main
 * process for its Node inspector (SIGUSR1), evaluates one tiny, fixed
 * expression against the live BrowserWindow, and closes the inspector again.
 * Nothing on disk is modified.
 *
 * The inspector is only opened for the few hundred milliseconds a toggle takes.
 * It listens on 127.0.0.1 and is closed in a `finally` block. If an inspector
 * was already open before the toggle, it is left alone.
 */

import { open } from 'node:fs/promises';
import path from 'node:path';

const ROUTE = '/__dsh/always-on-top';
const MAX_BODY_BYTES = 4 * 1024;
const INSPECTOR_PORTS = Object.freeze(Array.from({ length: 12 }, (_, index) => 9229 + index));
const INSPECTOR_WAIT_MS = 2_500;
const INSPECTOR_POLL_MS = 80;
const PORT_TIMEOUT_MS = 160;
const PID_TIMEOUT_MS = 600;
const EVAL_TIMEOUT_MS = 2_500;
const CLOSE_TIMEOUT_MS = 400;
const DESKTOP_ENTRY_PATTERN = /(?:^|[\\/])dsh-desktop-host[\\/]lib[\\/]index\.js$/;
const FUSE_SENTINEL = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
const FUSE_SCAN_CHUNK = 4 * 1024 * 1024;
const NODE_CLI_INSPECT_FUSE_INDEX = 3;

export const inject = ['webServer'];

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

class BridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}

/**
 * Whether the process entry point is the Desktop Host. Pure string check, so
 * tests can exercise it without pretending to be Electron.
 *
 * @param argv - Process arguments; defaults to the live process.
 * @returns true for `.../dsh-desktop-host/lib/index.js`.
 */
export function isDesktopEntry(argv = process.argv) {
  const entry = Array.isArray(argv) && typeof argv[1] === 'string' ? argv[1] : '';
  return DESKTOP_ENTRY_PATTERN.test(entry);
}

/**
 * Whether this Host process is the Desktop app's child, rather than `dsh web`
 * running in a terminal. Only the Desktop app has an Electron main parent with
 * a BrowserWindow.
 *
 * @returns true when running under the Desktop Host entry point.
 */
export function isDesktopHost() {
  if (!process.versions || typeof process.versions.electron !== 'string') return false;
  // The Desktop shell spawns this Host with an IPC channel; a `dsh web` process
  // started from a terminal does not have one. Requiring it avoids ever
  // signalling a shell that happened to launch the entry point by hand.
  if (process.connected !== true || typeof process.send !== 'function') return false;
  return isDesktopEntry(process.argv);
}

/**
 * Locate the binary that carries the Electron fuse wire.
 *
 * macOS keeps it in the framework; Windows and Linux keep it in the app
 * executable.
 *
 * @param execPath - Electron executable path.
 * @param platform - Target platform.
 * @returns Absolute path to the fuse-bearing file.
 */
export function fuseFilePath(execPath = process.execPath, platform = process.platform) {
  if (platform === 'darwin') {
    return path.join(
      path.dirname(path.dirname(execPath)),
      'Frameworks',
      'Electron Framework.framework',
      'Electron Framework',
    );
  }
  return execPath;
}

/**
 * Read the `EnableNodeCliInspectArguments` fuse without spawning a tool.
 *
 * This guard matters: when that fuse is disabled, Electron does not install
 * Node's SIGUSR1 handler, and sending SIGUSR1 would terminate the main
 * process. Never signal a build we cannot prove is inspectable.
 *
 * @param filePath - Fuse-bearing binary.
 * @returns true when the fuse is enabled, false when disabled, null when the
 *   wire cannot be read.
 */
export async function readNodeCliInspectFuse(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    const overlap = FUSE_SENTINEL.length - 1;
    for (let position = 0; position < size; position += FUSE_SCAN_CHUNK) {
      const length = Math.min(FUSE_SCAN_CHUNK + overlap, size - position);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, position);
      const index = buffer.subarray(0, bytesRead).indexOf(FUSE_SENTINEL);
      if (index === -1) continue;

      const wireAt = position + index + FUSE_SENTINEL.length;
      const header = Buffer.alloc(2);
      const headerRead = await handle.read(header, 0, 2, wireAt);
      if (headerRead.bytesRead < 2 || header[0] !== 1) return null;
      if (header[1] <= NODE_CLI_INSPECT_FUSE_INDEX) return null;

      const state = Buffer.alloc(1);
      const stateRead = await handle.read(state, 0, 1, wireAt + 2 + NODE_CLI_INSPECT_FUSE_INDEX);
      if (stateRead.bytesRead < 1) return null;
      // '1' = enabled, '0' = disabled, 'r' = removed.
      return state[0] === 0x31;
    }
    return null;
  } finally {
    await handle.close();
  }
}

let fuseState;

/**
 * Cached fuse check for this Host lifetime.
 *
 * @returns true/false from the wire, or null when unreadable.
 */
async function inspectFuseEnabled() {
  if (fuseState !== undefined) return fuseState;
  try {
    fuseState = await readNodeCliInspectFuse(fuseFilePath());
  } catch (error) {
    console.warn(
      '[always-on-top] could not read the Electron fuse wire',
      error instanceof Error ? error.message : error,
    );
    fuseState = null;
  }
  return fuseState;
}

/**
 * Explain why the bridge cannot run, or return an empty string when it can.
 *
 * @returns Support reason code, or ''.
 */
function unsupportedReason() {
  if (!isDesktopHost()) return 'desktop-only';
  if (typeof process.ppid !== 'number' || process.ppid <= 1) return 'desktop-only';
  if (typeof globalThis.fetch !== 'function' || typeof globalThis.WebSocket !== 'function') {
    return 'runtime-too-old';
  }
  if (process.platform === 'win32' && typeof process._debugProcess !== 'function') {
    return 'unsupported-platform';
  }
  return '';
}

/**
 * Async support check that also proves the inspector fuse is enabled.
 *
 * @returns Support reason code, or ''.
 */
async function bridgeUnsupportedReason() {
  const reason = unsupportedReason();
  if (reason !== '') return reason;
  const fuse = await inspectFuseEnabled();
  if (fuse === false) return 'inspect-disabled';
  if (fuse !== true) return 'inspect-unknown';
  return '';
}

/**
 * Ask the target process to open its Node inspector. On POSIX this is the
 * documented SIGUSR1 behavior; Windows uses Node's debug-attach helper.
 *
 * @param pid - Electron main process id.
 */
function requestInspector(pid) {
  if (process.platform === 'win32') {
    process._debugProcess(pid);
    return;
  }
  process.kill(pid, 'SIGUSR1');
}

/**
 * Build the fixed expression evaluated in the Electron main process.
 *
 * @param value - Desired always-on-top state; ignored for reads.
 * @param readOnly - When true, do not touch the window.
 * @returns A self-contained expression returning a JSON string.
 */
export function windowExpression(value, readOnly = false) {
  const apply = readOnly ? '' : `win.setAlwaysOnTop(${value === true ? 'true' : 'false'}, 'floating');`;
  return [
    '(() => {',
    '  try {',
    "    if (typeof process.getBuiltinModule !== 'function') return JSON.stringify({ ok: false, error: 'runtime' });",
    "    const moduleApi = process.getBuiltinModule('module');",
    "    if (!moduleApi || typeof moduleApi.createRequire !== 'function') return JSON.stringify({ ok: false, error: 'runtime' });",
    "    const electron = moduleApi.createRequire(process.execPath)('electron');",
    '    if (!electron || !electron.BrowserWindow) return JSON.stringify({ ok: false, error: \'no-electron\' });',
    '    const wins = electron.BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());',
    '    const win = wins.find((candidate) => {',
    '      try { return candidate.webContents.getURL().startsWith(\'dsh-app://app\'); } catch { return false; }',
    '    }) || wins.find((candidate) => {',
    '      try { return candidate.isVisible(); } catch { return false; }',
    '    }) || wins[0];',
    "    if (!win) return JSON.stringify({ ok: false, error: 'no-window' });",
    `    ${apply}`,
    '    return JSON.stringify({ ok: true, alwaysOnTop: win.isAlwaysOnTop(), windowId: win.id });',
    '  } catch (error) {',
    "    return JSON.stringify({ ok: false, error: error && error.message ? String(error.message) : 'evaluation' });",
    '  }',
    '})()',
  ].join('\n');
}

/**
 * Parse the JSON string returned by {@link windowExpression}.
 *
 * @param value - Raw inspector value.
 * @returns Normalized state.
 */
export function parseWindowResult(value) {
  if (typeof value !== 'string') throw new BridgeError('unreadable', 'The window channel returned no value.');
  let data;
  try {
    data = JSON.parse(value);
  } catch {
    throw new BridgeError('unreadable', 'The window channel returned unreadable JSON.');
  }
  if (data === null || typeof data !== 'object' || data.ok !== true) {
    const code = data && data.error === 'no-window' ? 'no-window' : 'window-unavailable';
    throw new BridgeError(code, 'The Harness window is unavailable.');
  }
  return {
    alwaysOnTop: data.alwaysOnTop === true,
    windowId: Number.isSafeInteger(data.windowId) ? data.windowId : null,
  };
}

/**
 * Fetch the inspector target list for one loopback port.
 *
 * @param port - Inspector port.
 * @returns Target objects, or an empty array when the port is not an inspector.
 */
async function fetchTargets(port) {
  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(PORT_TIMEOUT_MS)
      : undefined;
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/json/list`, { signal });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.filter(
      (target) => target !== null && typeof target === 'object' && typeof target.webSocketDebuggerUrl === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Send one Runtime.evaluate and resolve its return value.
 *
 * @param wsUrl - Inspector websocket URL.
 * @param expression - Expression to evaluate.
 * @param timeoutMs - Overall timeout.
 * @returns The evaluated value.
 */
function evaluate(wsUrl, expression, timeoutMs = EVAL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const WebSocketImpl = globalThis.WebSocket;
    if (typeof WebSocketImpl !== 'function') {
      reject(new BridgeError('runtime-too-old', 'This runtime has no WebSocket client.'));
      return;
    }
    const ws = new WebSocketImpl(wsUrl);
    let settled = false;
    let timer;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // Already closed.
      }
      if (error) reject(error);
      else resolve(value);
    };

    timer = setTimeout(() => finish(new BridgeError('inspector-timeout', 'The window channel timed out.')), timeoutMs);

    ws.addEventListener('open', () => {
      try {
        ws.send(
          JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true, awaitPromise: true },
          }),
        );
      } catch (error) {
        finish(new BridgeError('inspector-unavailable', String(error)));
      }
    });

    ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message === null || typeof message !== 'object' || message.id !== 1) return;
      if (message.error) {
        finish(new BridgeError('inspector-unavailable', message.error.message || 'Inspector error.'));
        return;
      }
      const result = message.result;
      if (result && result.exceptionDetails) {
        finish(new BridgeError('window-unavailable', result.exceptionDetails.text || 'Evaluation failed.'));
        return;
      }
      finish(null, result && result.result ? result.result.value : undefined);
    });

    ws.addEventListener('error', () => {
      finish(new BridgeError('inspector-unavailable', 'Could not connect to the window channel.'));
    });

    ws.addEventListener('close', () => {
      finish(new BridgeError('inspector-unavailable', 'The window channel closed early.'));
    });
  });
}

/**
 * Verify that an inspector target belongs to the expected process.
 *
 * @param wsUrl - Inspector websocket URL.
 * @param pid - Expected process id.
 * @returns true when the target answered with `pid`.
 */
async function isTargetForPid(wsUrl, pid) {
  try {
    const value = await evaluate(wsUrl, 'process.pid', PID_TIMEOUT_MS);
    return value === pid;
  } catch {
    return false;
  }
}

/**
 * Scan inspector ports for the main process's target.
 *
 * @param pid - Electron main process id.
 * @returns Matching target, or null.
 */
async function findInspector(pid) {
  for (const port of INSPECTOR_PORTS) {
    const targets = await fetchTargets(port);
    for (const target of targets) {
      if (await isTargetForPid(target.webSocketDebuggerUrl, pid)) return { port, target };
    }
  }
  return null;
}

/**
 * Wait for the inspector to appear after SIGUSR1.
 *
 * @param pid - Electron main process id.
 * @param timeoutMs - Maximum wait.
 * @returns Matching target, or null.
 */
async function waitForInspector(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await findInspector(pid);
    if (found) return found;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, INSPECTOR_POLL_MS));
  }
}

/**
 * Run one task against the main process inspector, opening and closing it when
 * this plugin is the one that opened it.
 *
 * @param task - Receives the inspector target.
 * @returns Task result.
 */
async function withMainInspector(task, pid = process.ppid) {
  // Never signal a build whose inspect fuse is off: SIGUSR1 would terminate it.
  if (isDesktopHost()) {
    const fuse = await inspectFuseEnabled();
    if (fuse !== true) {
      throw new BridgeError(
        fuse === false ? 'inspect-disabled' : 'inspect-unknown',
        'The Electron inspector fuse is not enabled in this build.',
      );
    }
  }
  let opened = false;
  let found = await findInspector(pid);
  if (!found) {
    requestInspector(pid);
    opened = true;
    found = await waitForInspector(pid, INSPECTOR_WAIT_MS);
  }
  if (!found) {
    throw new BridgeError(
      'inspector-unavailable',
      'The Electron inspector did not open. Another debugger may be using the default port.',
    );
  }
  try {
    return await task(found);
  } finally {
    if (opened) {
      try {
        await evaluate(found.target.webSocketDebuggerUrl, 'process.getBuiltinModule("inspector").close(); true', CLOSE_TIMEOUT_MS);
      } catch {
        // The evaluate response never arrives when inspector.close() succeeds.
      }
    }
  }
}

/**
 * Read the live window state.
 *
 * @returns Normalized state.
 */
export async function readWindowState(pid = process.ppid) {
  return withMainInspector(async ({ target }) => {
    const value = await evaluate(target.webSocketDebuggerUrl, windowExpression(false, true));
    return parseWindowResult(value);
  }, pid);
}

/**
 * Set the live window state.
 *
 * @param value - Desired always-on-top state.
 * @returns Normalized state after the change.
 */
export async function writeWindowState(value, pid = process.ppid) {
  return withMainInspector(async ({ target }) => {
    const evaluated = await evaluate(target.webSocketDebuggerUrl, windowExpression(value, false));
    return parseWindowResult(evaluated);
  }, pid);
}

export function apply(ctx) {
  let queue = Promise.resolve();

  const serialized = (task) => {
    const next = queue.then(task, task);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: ROUTE,
        handler: (req, res) => handleRequest(ctx, req, res, serialized),
      }),
    'always-on-top: route',
  );
}

async function handleRequest(ctx, req, res, serialized) {
  try {
    assertSameOrigin(ctx, req);
    const reason = await bridgeUnsupportedReason();

    if (req.method === 'GET') {
      if (reason !== '') {
        send(res, 200, { ok: true, supported: false, reason, alwaysOnTop: false });
        return;
      }
      const state = await serialized(() => readWindowState());
      send(res, 200, { ok: true, supported: true, alwaysOnTop: state.alwaysOnTop });
      return;
    }

    if (req.method === 'POST') {
      if (reason !== '') {
        send(res, 409, { ok: false, supported: false, reason });
        return;
      }
      const body = await readJson(req);
      if (body === null || typeof body !== 'object' || Array.isArray(body) || typeof body.alwaysOnTop !== 'boolean') {
        throw new RequestError(400, 'Expected {"alwaysOnTop": true|false}.');
      }
      const state = await serialized(() => writeWindowState(body.alwaysOnTop));
      send(res, 200, { ok: true, supported: true, alwaysOnTop: state.alwaysOnTop });
      return;
    }

    throw new RequestError(405, 'Only GET and POST are supported.');
  } catch (error) {
    if (res.writableEnded) return;
    if (error instanceof RequestError) {
      send(res, error.status, { ok: false, error: error.message });
      return;
    }
    if (error instanceof BridgeError) {
      send(res, 503, { ok: false, supported: true, error: error.code });
      return;
    }
    console.error('[always-on-top] could not change the window', error);
    send(res, 503, { ok: false, supported: true, error: 'window-unavailable' });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail(new RequestError(413, 'The request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (size === 0) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new RequestError(400, 'The request body is not valid JSON.'));
      }
    });
    req.on('error', (error) => fail(new RequestError(400, error.message)));
  });
}

function assertSameOrigin(ctx, req) {
  const address = req.socket && req.socket.remoteAddress;
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') {
    throw new RequestError(403, 'This action is only available over the local loopback connection.');
  }
  let expected;
  try {
    expected = ctx.webServer.getOrigin();
  } catch {
    throw new RequestError(503, 'The web server is not ready yet.');
  }
  const origin = req.headers.origin;
  if (origin && origin !== expected) {
    throw new RequestError(403, 'This request came from a different origin.');
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new RequestError(403, 'Cross-site requests are not allowed.');
  }
}

function send(res, status, payload) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}
