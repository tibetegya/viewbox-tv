// Profiles ("Who's watching?"): each is tied to one of the site's sync codes, which carries that person's favourites
// (bm:*) and watch history (pos:*). Switching uses the site's own sync (main.min.js, PRD Appendix A):
// hqsSyncJoin(code) pushes pending changes to the old code, wipes local bm:/pos:, activates the new code and pulls it.
/* global $ */

const KEY = 'fc-tv-profiles';
export const MAX_PROFILES = 6;
export const PALETTE = ['#1E88E5', '#E53935', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1', '#F4511E', '#6D4C41'];
export const CHOSEN_KEY = 'fc-tv-profile-chosen'; // sessionStorage: a profile was picked since the app opened

// ---- pure helpers (unit-tested) ---------------------------------------------------------------------------------

export const formatCode = (raw) => {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
  return c.length > 8 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}` : c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};
export const validCode = (code) => /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]$/.test(code);
export const sameCode = (a, b) => !!a && !!b && formatCode(a) === formatCode(b);
export const initialOf = (name) => (String(name || '').trim()[0] || '?').toUpperCase();

export const activeProfile = (list, hqsCode) => list.find((p) => sameCode(p.code, hqsCode)) || null;

export function addProfile(list, { name, color, code, pinHash }, id = String(Date.now())) {
  if (list.length >= MAX_PROFILES) throw new Error(`Up to ${MAX_PROFILES} profiles.`);
  if (list.some((p) => sameCode(p.code, code))) throw new Error('Another profile already uses that sync code.');
  return [...list, { id, name: String(name).trim().slice(0, 20), color: color || PALETTE[list.length % PALETTE.length], code: formatCode(code), ...(pinHash ? { pinHash } : {}) }];
}
export function updateProfile(list, id, changes) {
  if (changes.code && list.some((p) => p.id !== id && sameCode(p.code, changes.code))) throw new Error('Another profile already uses that sync code.');
  return list.map((p) => {
    if (p.id !== id) return p;
    const next = { ...p, ...changes };
    if (changes.code) next.code = formatCode(changes.code);
    if (changes.name != null) next.name = String(changes.name).trim().slice(0, 20);
    if (!next.pinHash) delete next.pinHash;
    return next;
  });
}
export const removeProfile = (list, id) => list.filter((p) => p.id !== id);

// Existing users: the sync code already active on this TV becomes "Profile 1", so its history stays put.
export function migrate(list, hqsCode) {
  if (list.length || !hqsCode) return list;
  return addProfile(list, { name: 'Profile 1', color: PALETTE[0], code: hqsCode }, '1');
}

export async function hashPin(id, pin) {
  const bytes = new TextEncoder().encode(`viewbox:${id}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const checkPin = async (profile, pin) => !profile.pinHash || (await hashPin(profile.id, pin)) === profile.pinHash;

// ---- storage ----------------------------------------------------------------------------------------------------

const currentCode = () => { try { return localStorage.getItem('hqs.code') || ''; } catch { return ''; } };
export function loadProfiles() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
  const migrated = migrate(list, currentCode());
  if (migrated !== list) {
    saveProfiles(migrated);
    // New-episode badges were kept for this TV as a whole; they now belong to Profile 1 (episodes.js keys by code).
    try { const old = localStorage.getItem('fc-tv-shows'); if (old) { localStorage.setItem(`fc-tv-shows:${currentCode()}`, old); localStorage.removeItem('fc-tv-shows'); } } catch {}
  }
  return migrated;
}
export const saveProfiles = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };
export const currentProfile = () => activeProfile(loadProfiles(), currentCode());
export const markChosen = () => { try { sessionStorage.setItem(CHOSEN_KEY, '1'); } catch {} };
export const wasChosen = () => { try { return sessionStorage.getItem(CHOSEN_KEY) === '1'; } catch { return false; } };

// ---- the site's sync server (same calls as the site's own code) --------------------------------------------------

const api = () => (window.hqsSync && window.hqsSync.api) || '';
const rawCode = (code) => formatCode(code).replace(/-/g, '');

// Does this sync code exist? (An unknown code handed to the site's switch makes it silently create a random new one.)
export function codeExists(code) {
  return new Promise((resolve, reject) => {
    if (!api() || typeof $ === 'undefined') return reject(new Error('Sync isn\'t available on this page.'));
    $.ajax({
      url: `${api()}/api/code/exists/${rawCode(code)}`, type: 'GET', dataType: 'json', timeout: 10000,
      beforeSend: (x) => x.setRequestHeader('X-Sync-Code', currentCode()),
      success: () => resolve(true),
      // 404: no such code; 400 "invalid code": fails the server's check (the last character is a check character)
      error: (x) => (x.status === 404 || x.status === 400 ? resolve(false) : reject(new Error('Couldn\'t reach the sync server.'))),
    });
  });
}

// A brand-new, empty sync code. Doesn't touch the code active on this TV (unlike the site's "Generate" button, which
// carries the current lists over into the new code).
export function createCode() {
  return new Promise((resolve, reject) => {
    if (!api() || typeof $ === 'undefined') return reject(new Error('Sync isn\'t available on this page.'));
    $.ajax({
      url: `${api()}/api/code/create`, type: 'POST', data: '{}', contentType: 'application/json', dataType: 'json', timeout: 10000,
      success: (r) => (r && r.code && validCode(formatCode(r.code)) ? resolve(formatCode(r.code)) : reject(new Error('The sync server didn\'t return a code.'))),
      error: () => reject(new Error('Couldn\'t reach the sync server.')),
    });
  });
}

const waitFor = (test, ms) => new Promise((resolve) => {
  const t0 = Date.now();
  const tick = () => (test() ? resolve(true) : Date.now() - t0 > ms ? resolve(false) : setTimeout(tick, 250));
  tick();
});

// Switch this TV to a profile's sync code, then pull its full history (positions too: the site's normal pull only
// fetches favourites outside watch pages). Rejects without changing anything if the sync server can't be reached.
export async function switchTo(profile) {
  if (sameCode(currentCode(), profile.code)) return;
  if (typeof window.hqsSyncJoin !== 'function') throw new Error('Sync isn\'t available on this page.');
  const before = currentCode();
  window.hqsSyncJoin(formatCode(profile.code));
  const switched = await waitFor(() => sameCode(currentCode(), profile.code), 15000);
  if (!switched) {
    const cur = activeProfile(loadProfiles(), before);
    throw new Error(`Couldn't reach the sync server — still on ${cur ? cur.name : 'the current profile'}.`);
  }
  await new Promise((resolve) => {
    const done = setTimeout(resolve, 15000);
    try { window.hqsSyncNow(() => { clearTimeout(done); resolve(); }, true); } catch { clearTimeout(done); resolve(); }
  });
}
