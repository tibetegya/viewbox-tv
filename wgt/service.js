// SPDX-License-Identifier: GPL-3.0-only
// Viewbox TV's background service, adapted from TizenBrew's (github.com/reisxd/TizenBrew, GPL-3.0).
// A Tizen web app can't inject script into a remote site, so, like TizenBrew, this service asks the TV's own sdbd
// (Developer Mode with Host PC IP 127.0.0.1) to relaunch the app with a DevTools port, then injects the bundled
// module (dist/main.js, embedded at build time as MODULE_SRC) into every page over the DevTools protocol.
/* global tizen, MODULE_SRC */
// No 'use strict' here: esbuild hoists it over the whole bundle, and adbhost assigns an undeclared global
// (`packet = …` in _onPacket), which throws in strict mode — the service then dies on sdbd's first reply.

const http = require('http');
const adbhost = require('adbhost');
const CDP = require('chrome-remote-interface');

// Step log, served on 127.0.0.1:8083 so the start page can show where launching stopped.
const logs = [];
function log(msg) {
  logs.push(`${Math.round(process.uptime())}s ${msg}`);
  if (logs.length > 60) logs.shift();
  console.log(`[viewbox] ${msg}`);
}
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(logs.join('\n'));
}).on('error', (e) => log(`log server: ${e.message}`)).listen(8083, '127.0.0.1');

const APP = 'ViewboxTV';
let client = null; // DevTools connection to the app, while it's open
let connecting = false;

// Inject at document start in every new page (no flash of the site's own UI), plus into contexts that already exist.
// main.js guards against running twice (window.__fcTv).
function attach(port, host, attempt) {
  CDP({ port, host, local: true }, (c) => {
    log(`DevTools attached on port ${port}`);
    client = c;
    connecting = false;
    c.on('disconnect', () => { log('DevTools disconnected'); client = null; });
    c.on('Runtime.executionContextCreated', (msg) => {
      c.Runtime.evaluate({ expression: MODULE_SRC, contextId: msg.context.id })
        .then((r) => log(`injected into ${msg.context.origin || 'context'}${r.exceptionDetails ? ` (error: ${r.exceptionDetails.text})` : ''}`))
        .catch((e) => log(`inject failed: ${e.message}`));
    });
    c.Runtime.enable();
    c.Page.enable()
      .then(() => c.Page.addScriptToEvaluateOnNewDocument({ source: MODULE_SRC }))
      .then(() => c.Page.reload()) // the start page loaded before we attached: reload it with the module
      .then(() => log('document-start script registered, page reloaded'))
      .catch((e) => log(`Page setup failed: ${e.message}`));
  }).on('error', (e) => {
    if (attempt >= 20) { connecting = false; log(`DevTools connect failed: ${e.message}`); return; }
    setTimeout(() => attach(port, host, attempt + 1), 750);
  });
}

// `0 debug <app id>` relaunches the app with a DevTools port and prints "... port: 12345".
function relaunchInDebug() {
  const pkg = tizen.application.getAppInfo().packageId;
  const tizen3 = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version').startsWith('3.0');
  const cmd = `0 debug ${pkg}.${APP}${tizen3 ? ' 0' : ''}`;
  log(`Node ${process.version}; sdb: ${cmd}`);
  const adb = adbhost.createConnection({ host: '127.0.0.1', port: 26101 });
  adb._stream.on('connect', () => {
    log('sdbd connected');
    const sh = adb.createStream(`shell:${cmd}`);
    sh.on('data', (data) => {
      const s = data.toString();
      log(`sdb: ${s.trim()}`);
      if (!s.includes('debug')) return;
      const port = Number(s.substr(s.indexOf(':') + 1, 6).replace(' ', ''));
      attach(port, '127.0.0.1', 1);
      setTimeout(() => adb._stream.end(), 1000);
    });
  });
  adb._stream.on('error', (e) => { connecting = false; log(`sdbd connection failed (Developer mode on, Host PC IP 127.0.0.1?): ${e.message}`); });
}

// The start page asks for this on every launch; only act when the app isn't already attached.
function ensure() {
  log(`launch request (${client ? 'attached' : connecting ? 'connecting' : 'idle'})`);
  if (client || connecting) return;
  connecting = true;
  try { relaunchInDebug(); } catch (e) { connecting = false; log(`relaunch failed: ${e.message}`); }
}

module.exports.onStart = ensure;
module.exports.onRequest = ensure;
module.exports.onExit = () => { if (client) client.close(); };
module.exports.attach = attach; // for desktop testing
