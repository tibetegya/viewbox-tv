// In-app updates (standalone .wgt only): the app's service (wgt/service.js + updater.js) exposes window.__vbHost to the
// page; we ask it to check the latest GitHub release and, when the user agrees, to download the new interface and
// reload on it. With TizenBrew there's no service — updates come from the module version there.
/* global VERSION */
import { h, toast } from './ui.js';

const CHECK_KEY = 'fc-tv-update-check'; // sessionStorage: this launch's check result
const DISMISS_KEY = 'fc-tv-update-dismissed';
let seq = 0;

export const hostAvailable = () => typeof window.__vbHost === 'function';

export function request(cmd, timeout = 30000) {
  return new Promise((resolve, reject) => {
    if (!hostAvailable()) return reject(new Error('Updates come from TizenBrew for this install.'));
    const id = ++seq;
    const done = () => { window.removeEventListener('vb-host', on); clearTimeout(t); };
    const on = (e) => {
      const d = e.detail || {};
      if (d.id !== id) return;
      done();
      if (d.ok) resolve(d); else reject(new Error(d.error || 'Update failed.'));
    };
    const t = setTimeout(() => { done(); reject(new Error('The app didn\'t answer — try again.')); }, timeout);
    window.addEventListener('vb-host', on);
    window.__vbHost(JSON.stringify({ id, cmd, version: typeof VERSION === 'string' ? VERSION : '' }));
  });
}

const session = { get: (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// Once per launch: check for a newer release (cached for the session).
export async function checkOnce() {
  const cached = session.get(CHECK_KEY);
  if (cached) return cached;
  const r = await request('check');
  session.set(CHECK_KEY, r);
  return r;
}
export async function checkNow() {
  const r = await request('check');
  session.set(CHECK_KEY, r);
  return r;
}

// Download + reload on the new version (the page is reloaded by the service).
export async function updateNow(onStatus) {
  onStatus && onStatus('Downloading the update…');
  const r = await request('update', 90000);
  onStatus && onStatus(`Installing v${r.updating}…`);
  session.set(CHECK_KEY, null);
  return r;
}

// "Update available" bar at the top of Home: ask first (nothing downloads until Update is pressed).
function banner(r) {
  const msg = h('span', { class: 'vb-update__text' });
  const setText = (t) => { msg.textContent = t; };
  const reinstall = r.needsReinstall;
  setText(reinstall ? `Viewbox TV v${r.latest} is out — it needs a reinstall (download ViewboxTV.wgt from the GitHub release).` : `Update available: Viewbox TV v${r.latest} (you have v${r.current}).`);
  const bar = h('div', { class: 'vb-update', role: 'status' }, msg);
  const later = h('button', { class: 'jf-button vb-update__btn', onclick: () => { session.set(DISMISS_KEY, r.latest); bar.remove(); } }, reinstall ? 'OK' : 'Not now');
  if (!reinstall) {
    const go = h('button', { class: 'jf-button vb-update__btn vb-update__btn--primary', onclick: async () => {
      go.disabled = true; later.disabled = true;
      try { await updateNow(setText); } catch (e) { setText(e.message); go.disabled = false; later.disabled = false; }
    } }, 'Update');
    bar.append(go);
  }
  bar.append(later);
  return bar;
}

// After the shell is up: tell the service we booted (it keeps a downloaded update only once that happens), show its
// notice ("Updated to …"), then check once per launch and offer the update on Home.
export async function startUpdates() {
  if (!hostAvailable()) return;
  try { const b = await request('booted', 10000); if (b.notice) { toast(b.notice, 7000); session.set(CHECK_KEY, null); } } catch (e) { /* older service */ }
  let r;
  try { r = await checkOnce(); } catch (e) { return; }
  if (!r.available || session.get(DISMISS_KEY) === r.latest) return;
  const main = document.querySelector('#fc-app main.jf-main--rail');
  if (!main || !/^\/(home)?$/.test(location.pathname) || location.hash) return;
  main.prepend(banner(r));
}
