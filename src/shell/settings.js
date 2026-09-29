// Settings (/home#settings): VIP sign-in, the list Sync Code, autoplay, and "About" details for troubleshooting.
// The site's own sign-in form and sync-code box live on pages the shell covers, so they're offered here instead.
/* global VERSION */
import { h, header, isSignedIn, toast } from './ui.js';

const SYNC_KEY = 'hqs.code'; // the site's active sync code for this browser (PRD Appendix A)
export const PENDING_SYNC = 'fc-pending-sync';
const SETTINGS_KEY = 'fc-tv-settings';

export const formatCode = (raw) => {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
  return c.length > 8 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}` : c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};
export const validCode = (code) => /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]$/.test(code);
const activeCode = () => { try { return localStorage.getItem(SYNC_KEY); } catch (e) { return null; } };

// Same request the site's own sign-in form sends, including the CSRF header its $.ajaxSetup adds to every POST.
async function signIn(email, password) {
  const r = await fetch('/ajax/viplogin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '',
    },
    body: JSON.stringify({ uname: email, passw: password }),
  });
  const body = await r.text();
  if (r.status === 401) throw new Error(body.slice(0, 120) || 'Wrong email or password.');
  if (!r.ok) throw new Error(`Sign-in failed (HTTP ${r.status}).`);
  if (/"status"\s*:\s*"expired"/.test(body)) throw new Error('Your VIP membership has expired.');
}

const field = (label, input) => h('label', { class: 'jf-field' }, h('span', { class: 'jf-field__label' }, label), input);

export function settingsView(app) {
  const main = h('main', { class: 'jf-main jf-settings' });
  app.append(header({ title: 'Settings' }), main);

  // ---- Account
  const signedIn = isSignedIn();
  const email = h('input', { class: 'jf-input', type: 'email', autocomplete: 'username', placeholder: 'VIP email' });
  const password = h('input', { class: 'jf-input', type: 'password', autocomplete: 'current-password', placeholder: 'Password' });
  const accountMsg = h('p', { class: 'jf-settings__msg', role: 'status' });
  const signInBtn = h('button', { class: 'jf-button', onclick: async () => {
    if (!email.value.trim() || !password.value) { accountMsg.textContent = 'Enter your VIP email and password.'; return; }
    accountMsg.textContent = 'Signing in…';
    try { await signIn(email.value.trim(), password.value); accountMsg.textContent = 'Signed in.'; setTimeout(() => location.reload(), 600); } catch (e) { accountMsg.textContent = e.message; }
  } }, 'Sign in');
  const account = h('section', { class: 'jf-settings__section' },
    h('h2', { class: 'jf-section__title' }, 'Account'),
    signedIn
      ? h('p', { class: 'jf-settings__status' }, '✓ Signed in to your VIP account.')
      : h('div', { class: 'jf-settings__form' }, h('p', { class: 'jf-settings__status' }, 'Not signed in. Your lists need a VIP sign-in.'), field('Email', email), field('Password', password), signInBtn, accountMsg));

  // ---- Sync Code (your lists)
  const current = activeCode();
  const codeInput = h('input', { class: 'jf-input jf-input--code', type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'XXXX-XXXX-X', maxlength: '11' });
  codeInput.addEventListener('input', () => { const v = formatCode(codeInput.value); if (v !== codeInput.value) codeInput.value = v; });
  const syncMsg = h('p', { class: 'jf-settings__msg', role: 'status' });
  const applyBtn = h('button', { class: 'jf-button', onclick: () => {
    const code = formatCode(codeInput.value);
    if (!validCode(code)) { syncMsg.textContent = 'A sync code looks like ABCD-1234-X (9 letters/digits).'; return; }
    if (!isSignedIn()) { syncMsg.textContent = 'Sign in first — the site only loads lists for a signed-in VIP account.'; return; }
    try { localStorage.setItem(PENDING_SYNC, code); } catch (e) {}
    syncMsg.textContent = 'Applying…';
    location.assign('/mylists/favorites'); // the site's sync box lives on that page; favouritesView enters the code there
  } }, 'Apply');
  const sync = h('section', { class: 'jf-settings__section' },
    h('h2', { class: 'jf-section__title' }, 'Your lists (Sync Code)'),
    h('p', { class: 'jf-settings__status' }, current ? `Active sync code: ${formatCode(current)}` : 'No sync code on this TV yet — your Favourites stay empty until you add one.'),
    h('div', { class: 'jf-settings__form' }, field(current ? 'Change sync code' : 'Sync code', codeInput), applyBtn, syncMsg));

  // ---- Playback
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })();
  const autoplayOn = prefs.autoplayEnabled !== false;
  const autoplayBtn = h('button', { class: `jf-toggle${autoplayOn ? ' jf-toggle--on' : ''}`, role: 'switch', 'aria-checked': String(autoplayOn), onclick: () => {
    const p = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })();
    p.autoplayEnabled = p.autoplayEnabled === false;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(p)); } catch (e) {}
    autoplayBtn.classList.toggle('jf-toggle--on', p.autoplayEnabled);
    autoplayBtn.setAttribute('aria-checked', String(p.autoplayEnabled));
    toast(`Autoplay ${p.autoplayEnabled ? 'on' : 'off'}`);
  } }, 'Play the next episode automatically');
  const playback = h('section', { class: 'jf-settings__section' }, h('h2', { class: 'jf-section__title' }, 'Playback'), autoplayBtn);

  // ---- About (for troubleshooting)
  const about = h('section', { class: 'jf-settings__section' },
    h('h2', { class: 'jf-section__title' }, 'About'),
    h('p', { class: 'jf-settings__about' }, `Viewbox TV ${typeof VERSION === 'string' ? VERSION : ''} · screen ${innerWidth}×${innerHeight} @${devicePixelRatio}x · ${location.host}`),
    h('p', { class: 'jf-settings__about' }, navigator.userAgent));

  main.append(account, sync, playback, about);
  setTimeout(() => (signedIn ? codeInput : email).focus({ preventScroll: true }), 0);
}

// On My Lists (the only page with the site's sync box): enter a code chosen in Settings. The site checks it and, if it
// exists, applies it and pulls the lists (its own 'input' handler, ~400 ms later). Resolves with whether it took.
export function applyPendingSync() {
  let code = null;
  try { code = localStorage.getItem(PENDING_SYNC); } catch (e) {}
  const input = document.querySelector('#syncCodeInput');
  if (!code || !input) return null;
  try { localStorage.removeItem(PENDING_SYNC); } catch (e) {}
  return new Promise((resolve) => {
    setTimeout(() => {
      input.value = code;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      let tries = 0;
      const t = setInterval(() => {
        const now = activeCode();
        const ok = now && formatCode(now) === code;
        if (ok || ++tries > 30) { clearInterval(t); resolve(!!ok); }
      }, 500);
    }, 500); // let the site bind its input handler first
  });
}
