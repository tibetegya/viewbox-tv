// SPDX-License-Identifier: GPL-3.0-only
// Viewbox TV's background service, adapted from TizenBrew's (github.com/reisxd/TizenBrew, GPL-3.0).
// A Tizen web app can't inject script into a remote site, so, like TizenBrew, this service asks the TV's own sdbd
// (Developer Mode with Host PC IP 127.0.0.1) to relaunch the app with a DevTools port, then injects the bundled
// module (dist/main.js, embedded at build time as MODULE_SRC) into every page over the DevTools protocol.
/* global tizen, MODULE_SRC */
// No 'use strict' here: esbuild hoists it over the whole bundle, and adbhost assigns an undeclared global
// (`packet = …` in _onPacket), which throws in strict mode — the service then dies on sdbd's first reply.

import { loadBundle, check, download, markVerified, rollback } from './updater.js';

const http = require('http');
const adbhost = require('adbhost');
const CDP = require('chrome-remote-interface');

// The interface injected into pages: the built-in copy, or a newer one downloaded in-app (updater.js).
let bundle = loadBundle();
let scriptId = null; // our addScriptToEvaluateOnNewDocument registration
let bootTimer = null;
let lastNotice = null; // shown to the page once, e.g. "Updated to v0.7.1"
const BOOT_MS = 25000;

const APP = 'ViewboxTV';
let client = null; // DevTools connection to the app, while it's open
let connecting = false; // a debug relaunch is in progress

// Step log, so the start page can show where launching stopped.
const logs = [];
function log(msg) {
  logs.push(`${Math.round(process.uptime())}s ${msg}`);
  if (logs.length > 60) logs.shift();
  console.log(`[viewbox] ${msg}`);
}

// 127.0.0.1:8083 — `/` the step log; `/launch` the start page's handshake (see launch()).
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(req.url === '/launch' ? launch() : logs.join('\n'));
}).on('error', (e) => log(`log server: ${e.message}`)).listen(8083, '127.0.0.1');

// Inject at document start in every new page (no flash of the site's own UI), plus into contexts that already exist.
// main.js guards against running twice (window.__fcTv).
function attach(port, host, attempt) {
  CDP({ port, host, local: true }, (c) => {
    log(`DevTools attached on port ${port}`);
    client = c;
    connecting = false;
    c.on('disconnect', () => { log('DevTools disconnected'); client = null; });
    c.on('Runtime.executionContextCreated', (msg) => {
      c.Runtime.evaluate({ expression: bundle.code, contextId: msg.context.id })
        .then((r) => log(`injected into ${msg.context.origin || 'context'}${r.exceptionDetails ? ` (error: ${r.exceptionDetails.text})` : ''}`))
        .catch((e) => log(`inject failed: ${e.message}`));
    });
    c.on('Runtime.bindingCalled', (msg) => { if (msg.name === '__vbHost') onHost(c, msg); });
    c.Runtime.enable();
    // The binding must exist before the page reloads, or its first document can't reach us.
    c.Runtime.addBinding({ name: '__vbHost' }).catch((e) => log(`binding failed: ${e.message}`))
      .then(() => c.Page.enable())
      .then(() => c.Page.addScriptToEvaluateOnNewDocument({ source: bundle.code }))
      .then((r) => { scriptId = r && r.identifier; return c.Page.reload(); }) // the start page loaded before we attached
      .then(() => { log(`document-start script registered (v${bundle.version}${bundle.downloaded ? ', downloaded' : ''}), page reloaded`); if (!bundle.verified) guardBoot(c); })
      .catch((e) => log(`Page setup failed: ${e.message}`));
  }).on('error', (e) => {
    if (attempt >= 20) { connecting = false; log(`DevTools connect failed: ${e.message}`); return; }
    setTimeout(() => attach(port, host, attempt + 1), 750);
  });
}

// ---- in-app updates: the page talks to us through the __vbHost binding (the site's CSP blocks fetching 127.0.0.1) ----
function reply(c, contextId, detail) {
  c.Runtime.evaluate({ expression: `window.dispatchEvent(new CustomEvent('vb-host', { detail: ${JSON.stringify(detail)} }))`, contextId }).catch(() => {});
}
async function swapTo(c, next) {
  bundle = next;
  if (scriptId) await c.Page.removeScriptToEvaluateOnNewDocument({ identifier: scriptId }).catch(() => {});
  const r = await c.Page.addScriptToEvaluateOnNewDocument({ source: bundle.code });
  scriptId = r && r.identifier;
  await c.Page.reload();
}
// A downloaded interface must report 'booted' soon after loading, or we go back to the previous one.
function guardBoot(c) {
  clearTimeout(bootTimer);
  const version = bundle.version;
  bootTimer = setTimeout(() => {
    const back = rollback();
    lastNotice = `The update to v${version} didn't start — back on v${back.version}.`;
    log(`v${version} didn't report booted: rolled back to v${back.version}`);
    swapTo(c, back).catch((e) => log(`rollback reload failed: ${e.message}`));
  }, BOOT_MS);
}
async function onHost(c, msg) {
  let req = {};
  try { req = JSON.parse(msg.payload); } catch (e) {}
  const answer = (detail) => reply(c, msg.executionContextId, { id: req.id, cmd: req.cmd, ...detail });
  try {
    if (req.cmd === 'booted') {
      if (req.version === bundle.version && bundle.downloaded && !bundle.verified) { clearTimeout(bootTimer); markVerified(bundle.version); bundle.verified = true; log(`v${bundle.version} booted`); }
      answer({ ok: true, version: bundle.version, notice: lastNotice });
      lastNotice = null;
    } else if (req.cmd === 'check') {
      answer({ ok: true, ...(await check(bundle.version)) });
    } else if (req.cmd === 'update') {
      log('update requested');
      const from = bundle.version;
      const next = await download(bundle.version);
      answer({ ok: true, updating: next.version });
      lastNotice = `Updated to v${next.version} (from v${from}).`;
      await swapTo(c, { ...next, downloaded: true, verified: false });
      guardBoot(c);
    } else {
      answer({ ok: false, error: 'unknown command' });
    }
  } catch (e) {
    log(`${req.cmd} failed: ${e.message}`);
    answer({ ok: false, error: e.message });
  }
}

// `0 debug <app id>` relaunches the app with a DevTools port and prints "... port: 12345". The TV only does this for an
// app that isn't running, so (like TizenBrew) the start page exits right after asking and we wait a second first.
function relaunchInDebug() {
  const pkg = tizen.application.getAppInfo().packageId;
  const tizen3 = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version').startsWith('3.0');
  const cmd = `0 debug ${pkg}.${APP}${tizen3 ? ' 0' : ''}`;
  log(`Node ${process.version}; sdb: ${cmd}`);
  const adb = adbhost.createConnection({ host: '127.0.0.1', port: 26101 });
  let answered = false;
  // Packet-level trace (adbhost ignores AUTH, so a stall after "socket open" shows up here).
  const trace = adb._onPacket;
  adb._onPacket = function () {
    const p = this._packet;
    if (p) log(`sdbd ← ${p.cmd || p.command} ${p.arg1}/${p.arg2}${p.data ? ` ${JSON.stringify(p.data.toString().slice(0, 80))}` : ''}`);
    return trace.apply(this, arguments);
  };
  adb._stream.on('connect', () => {
    log('sdbd socket open');
    const sh = adb.createStream(`shell:${cmd}`);
    sh.on('data', (data) => {
      const s = data.toString();
      answered = true;
      log(`sdb: ${s.trim()}`);
      if (!s.includes('debug')) return;
      const port = Number(s.substr(s.indexOf(':') + 1, 6).replace(' ', ''));
      attach(port, '127.0.0.1', 1);
      setTimeout(() => adb._stream.end(), 1000);
    });
  });
  adb._stream.on('end', () => log('sdbd closed the connection'));
  adb._stream.on('error', (e) => { answered = true; connecting = false; log(`sdbd connection failed (Developer mode on, Host PC IP 127.0.0.1?): ${e.message}`); });
  setTimeout(() => {
    if (answered) return;
    connecting = false;
    log('no answer from sdbd in 15 s');
    try { adb._stream.destroy(); } catch (e) {}
  }, 15000);
}

// Start page handshake. "attached": the module is injected (or arrives with the reload). "relaunch": the page must exit
// now; we relaunch it in debug mode in 1 s. "wait": a relaunch is in progress. "failed": relaunching keeps failing —
// stop, so the page doesn't exit/relaunch in a loop, and show the log.
let relaunches = [];
function launch() {
  const state = client ? 'attached' : connecting ? 'wait' : null;
  if (state) { log(`launch request: ${state}`); return state; }
  relaunches = relaunches.filter((t) => Date.now() - t < 120000);
  if (relaunches.length >= 2) { log('launch request: failed (2 relaunches in 2 min without DevTools)'); return 'failed'; }
  relaunches.push(Date.now());
  connecting = true;
  log('launch request: relaunch (the app exits, debug relaunch in 1 s)');
  setTimeout(() => {
    try { relaunchInDebug(); } catch (e) { connecting = false; log(`relaunch failed: ${e.message}`); }
  }, 1000);
  return 'relaunch';
}

module.exports.onStart = () => log('service started');
module.exports.onRequest = () => {};
module.exports.onExit = () => { if (client) client.close(); };
module.exports.attach = attach; // for desktop testing
module.exports.bundleVersion = () => bundle.version;
module.exports.launch = launch; // for desktop testing
