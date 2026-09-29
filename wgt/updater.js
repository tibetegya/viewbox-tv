// SPDX-License-Identifier: GPL-3.0-only
// In-app updates for the .wgt: the interface (dist/main.js) is what changes between releases, so the service can fetch
// a newer one from the latest GitHub release, keep it on the TV and inject it instead of the copy built into the app.
// Releases that also need a newer service/config (package.json "viewboxService") still need a reinstall.
/* global MODULE_SRC, BUNDLE_VERSION, SERVICE_VERSION */
import { semverGt, updateStatus } from '../src/shell/version.js';

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = 'tibetegya/viewbox-tv';
const DIR = process.env.VIEWBOX_DATA || '/home/owner/share/viewbox-tv';
const file = (n) => path.join(DIR, n);

function get(url, asJson) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ViewboxTV', Accept: asJson ? 'application/json' : '*/*' }, timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(get(res.headers.location, asJson)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => { try { resolve(asJson ? JSON.parse(body) : body); } catch (e) { reject(e); } });
    }).on('error', reject).on('timeout', function onTimeout() { this.destroy(new Error('timeout')); });
  });
}

const readJson = (n) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch (e) { return null; } };
const writeJson = (n, v) => fs.writeFileSync(file(n), JSON.stringify(v));

// The interface to inject: a downloaded one if it's newer than the built-in copy.
export function loadBundle() {
  const meta = readJson('bundle.json');
  if (meta && semverGt(meta.version, BUNDLE_VERSION)) {
    try { return { code: fs.readFileSync(file('main.js'), 'utf8'), version: meta.version, downloaded: true, verified: !!meta.verified }; } catch (e) {}
  }
  return { code: MODULE_SRC, version: BUNDLE_VERSION, downloaded: false, verified: true };
}

let lastCheck = null;
export async function check(current) {
  const rel = await get(`https://api.github.com/repos/${REPO}/releases/latest`, true);
  const tag = rel.tag_name;
  const pkg = await get(`https://raw.githubusercontent.com/${REPO}/${tag}/package.json`, true);
  lastCheck = { tag, version: pkg.version, viewboxService: pkg.viewboxService || 1, url: rel.html_url };
  const st = updateStatus(current, lastCheck, SERVICE_VERSION);
  // A version that already failed to start on this TV isn't offered again (until a newer one is released).
  const failed = (readJson('failed.json') || []).indexOf(pkg.version) >= 0;
  return { current, latest: pkg.version, releaseUrl: rel.html_url, ...st, available: st.available && !failed, failed };
}

// Download the latest release's interface and store it (the previous one is kept for rollback).
export async function download(current) {
  const latest = lastCheck || (await check(current), lastCheck);
  const st = updateStatus(current, latest, SERVICE_VERSION);
  if (!st.available) throw new Error('Already up to date.');
  if (st.needsReinstall) throw new Error(`v${latest.version} needs a reinstall of the app.`);
  const code = await get(`https://raw.githubusercontent.com/${REPO}/${latest.tag}/dist/main.js`);
  if (code.length < 100000 || code.indexOf('__fcTv') < 0 || code.indexOf(`"${latest.version}"`) < 0) throw new Error('The download looks incomplete — try again.');
  fs.mkdirSync(DIR, { recursive: true });
  try { fs.copyFileSync(file('main.js'), file('main.js.prev')); fs.copyFileSync(file('bundle.json'), file('bundle.json.prev')); } catch (e) {}
  fs.writeFileSync(file('main.js.tmp'), code);
  fs.renameSync(file('main.js.tmp'), file('main.js'));
  writeJson('bundle.json', { version: latest.version, tag: latest.tag, verified: false });
  return { code, version: latest.version };
}

// The page came up on the downloaded interface: keep it.
export function markVerified(version) {
  const meta = readJson('bundle.json');
  if (meta && meta.version === version && !meta.verified) writeJson('bundle.json', { ...meta, verified: true });
}

// The downloaded interface didn't come up: go back to the previous download, or to the built-in copy.
export function rollback() {
  const meta = readJson('bundle.json');
  if (meta && meta.version) { try { writeJson('failed.json', [...(readJson('failed.json') || []), meta.version].slice(-10)); } catch (e) {} }
  try {
    if (fs.existsSync(file('main.js.prev')) && fs.existsSync(file('bundle.json.prev'))) {
      fs.renameSync(file('main.js.prev'), file('main.js'));
      fs.renameSync(file('bundle.json.prev'), file('bundle.json'));
    } else {
      fs.unlinkSync(file('bundle.json'));
    }
  } catch (e) {}
  return loadBundle();
}
