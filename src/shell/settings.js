// Settings (/home#settings): VIP sign-in, the list Sync Code, autoplay, and "About" details for troubleshooting.
// The site's own sign-in form and sync-code box live on pages the shell covers, so they're offered here instead.
/* global VERSION */
import { h, isSignedIn, toast } from './ui.js';
import { railLayout } from './sidebar.js';
import { hostAvailable, checkNow, updateNow } from './updates.js';
import { loadProfiles, currentProfile, initialOf } from './profiles.js';

const SETTINGS_KEY = 'fc-tv-settings';

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
  railLayout(app, 'settings', main, 'Settings');

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

  // ---- Profiles (each tied to a sync code: its favourites and watch history)
  const profiles = loadProfiles();
  const cur = currentProfile();
  const sync = h('section', { class: 'jf-settings__section' },
    h('h2', { class: 'jf-section__title' }, 'Profiles'),
    h('p', { class: 'jf-settings__status' }, profiles.length
      ? `${profiles.map((p) => p.name).join(', ')}${cur ? ` — watching as ${cur.name}` : ''}`
      : 'No profiles yet. Add one to keep your favourites and watch history (it\'s tied to a sync code).'),
    h('div', { class: 'jf-settings__form' },
      h('a', { class: 'jf-button', href: '/home#profiles-manage' }, profiles.length ? 'Manage profiles' : 'Add a profile'),
      cur && h('span', { class: 'jf-settings__avatar', style: { background: cur.color } }, initialOf(cur.name))));

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

  // ---- Updates (standalone app: download the latest release's interface; TizenBrew: its module version)
  const upMsg = h('p', { class: 'jf-settings__status', role: 'status' });
  const upBtn = h('button', { class: 'jf-button' }, 'Check for updates');
  let latest = null;
  upBtn.addEventListener('click', async () => {
    upBtn.disabled = true;
    try {
      if (latest && latest.available && !latest.needsReinstall) { await updateNow((t) => { upMsg.textContent = t; }); return; }
      upMsg.textContent = 'Checking…';
      latest = await checkNow();
      if (latest.failed) upMsg.textContent = `v${latest.latest} didn't start on this TV, so you're staying on v${latest.current}.`;
      else if (!latest.available) upMsg.textContent = `You're up to date (v${latest.current}).`;
      else if (latest.needsReinstall) upMsg.textContent = `v${latest.latest} is out, but it needs a reinstall — download ViewboxTV.wgt from the GitHub release.`;
      else { upMsg.textContent = `v${latest.latest} is available (you have v${latest.current}).`; upBtn.textContent = `Update to v${latest.latest}`; }
    } catch (e) { upMsg.textContent = e.message; }
    upBtn.disabled = false;
  });
  const updates = h('section', { class: 'jf-settings__section' },
    h('h2', { class: 'jf-section__title' }, 'Updates'),
    hostAvailable() ? h('div', { class: 'jf-settings__form' }, upBtn, upMsg)
      : h('p', { class: 'jf-settings__status' }, 'This install updates through TizenBrew (the module version you added there).'));

  main.append(account, sync, playback, updates, about);
  setTimeout(() => (signedIn ? sync.querySelector('.jf-button') : email).focus({ preventScroll: true }), 0);
}
