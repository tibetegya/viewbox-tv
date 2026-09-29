// "Who's watching?" — profile picker / manager in the style of Nuvio TV (NuvioMedia/NuvioTVSmart; design reference
// only). Shown at launch when there are 2+ profiles (shell.js), from the header avatar (/home#profiles) and from
// Settings (/home#profiles-manage). OK picks a profile; holding OK (or manage mode) opens the editor.
import { h, icon, isSignedIn, keyHook } from './ui.js';
import {
  loadProfiles, saveProfiles, currentProfile, addProfile, updateProfile, removeProfile, switchTo, markChosen,
  createCode, codeExists, formatCode, validCode, hashPin, checkPin, initialOf, PALETTE, MAX_PROFILES,
} from './profiles.js';

const BACK = [10009, 27, 8];
const HOLD_MS = 600;
const digitOf = (code) => (code >= 48 && code <= 57 ? code - 48 : code >= 96 && code <= 105 ? code - 96 : -1);

export function profilesView(app, { manage = false, onDone } = {}) {
  let list = loadProfiles();
  let overlay = null; // { el, back() , key?(e) }
  const status = h('p', { class: 'nv-profiles__status', role: 'status' });
  const root = h('div', { class: 'nv-profiles' });
  app.replaceChildren(root);

  const avatar = (p, cls = 'nv-avatar') => h('div', { class: cls, style: { background: p.color } }, initialOf(p.name));
  const setStatus = (text, busy) => { status.replaceChildren(busy ? h('span', { class: 'jf-spinner nv-spinner' }) : '', text || ''); };

  function render(focusId) {
    list = loadProfiles();
    const active = currentProfile();
    const cards = list.map((p) => h('button', { class: 'nv-profile', 'data-id': p.id, 'aria-label': p.name },
      h('div', { class: 'nv-profile__ring' }, avatar(p)),
      h('div', { class: 'nv-profile__name' }, p.name),
      h('div', { class: 'nv-profile__badge' }, p.pinHash ? icon('lock', 'nv-lock') : '', active && active.id === p.id ? 'CURRENT' : '')));
    if (list.length < MAX_PROFILES) {
      cards.push(h('button', { class: 'nv-profile nv-profile--add', 'data-id': 'add', 'aria-label': 'Add Profile' },
        h('div', { class: 'nv-profile__ring' }, h('div', { class: 'nv-avatar nv-avatar--add' })),
        h('div', { class: 'nv-profile__name' }, 'Add Profile'),
        h('div', { class: 'nv-profile__badge' })));
    }
    root.className = `nv-profiles${cards.length >= 5 ? ' nv-profiles--compact' : ''}`;
    root.replaceChildren(
      h('div', { class: 'nv-profiles__brand' }, 'Viewbox'),
      h('h1', { class: 'nv-profiles__title' }, manage ? 'Manage Profiles' : 'Who\'s watching?'),
      h('p', { class: 'nv-profiles__subtitle' }, manage ? 'Select a profile to edit, or add a new one' : 'Select a profile to continue'),
      h('div', { class: 'nv-profiles__grid' }, cards),
      status,
      h('p', { class: 'nv-profiles__hint' }, manage ? 'Press Back when you\'re done' : 'Hold OK to edit a profile'));
    const target = root.querySelector(`.nv-profile[data-id="${focusId || (active && active.id) || (list[0] && list[0].id) || 'add'}"]`) || root.querySelector('.nv-profile');
    setTimeout(() => target && target.focus({ preventScroll: true }), 0);
  }

  // ---- choosing a profile ----
  async function choose(p) {
    if (p.pinHash && !(await askPin(`Enter PIN for ${p.name}`, (pin) => checkPin(p, pin)))) return;
    const active = currentProfile();
    markChosen();
    if (active && active.id === p.id) return finish();
    setStatus(`Switching to ${p.name}…`, true);
    try {
      await switchTo(p);
      location.assign('/home'); // reload everything with the new profile's lists and history
    } catch (e) {
      setStatus(e.message);
    }
  }
  const finish = () => (onDone ? onDone() : (location.hash = ''));

  function activate(id, held) {
    if (id === 'add') return openEditor(null);
    const p = list.find((x) => x.id === id);
    if (!p) return;
    if (manage || held) openEditor(p); else choose(p);
  }

  // ---- overlays ----
  function openOverlay(panel, onBack) {
    const el = h('div', { class: 'nv-overlay' }, panel);
    root.append(el);
    overlay = { el, back: onBack };
    return el;
  }
  function closeOverlay(focusId) {
    if (!overlay) return;
    overlay.el.remove();
    overlay = null;
    render(focusId);
  }

  // PIN pad: resolves with the PIN (or with verify()'s answer), or false on Back.
  function askPin(title, verify) {
    return new Promise((resolve) => {
      const prev = overlay;
      let pin = '';
      const dots = h('div', { class: 'nv-pin__dots' }, [0, 1, 2, 3].map(() => h('span', { class: 'nv-pin__dot' })));
      const msg = h('p', { class: 'nv-pin__msg', role: 'status' });
      const show = () => [...dots.children].forEach((d, i) => d.classList.toggle('nv-pin__dot--on', i < pin.length));
      const done = (v) => { el.remove(); overlay = prev; resolve(v); };
      async function press(d) {
        if (d === 'del') { pin = pin.slice(0, -1); show(); return; }
        if (pin.length >= 4) return;
        pin += d;
        show();
        if (pin.length < 4) return;
        const ok = verify ? await verify(pin) : true;
        if (ok) return done(verify ? true : pin);
        msg.textContent = 'Wrong PIN';
        dots.classList.add('nv-pin__dots--shake');
        setTimeout(() => { dots.classList.remove('nv-pin__dots--shake'); pin = ''; show(); }, 450);
      }
      const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'del', 0].map((d) => h('button', { class: 'nv-key', 'aria-label': d === 'del' ? 'Delete' : String(d), onclick: () => press(d === 'del' ? 'del' : String(d)) }, d === 'del' ? icon('backspace') : String(d)));
      const panel = h('div', { class: 'nv-panel nv-pin' }, h('h2', { class: 'nv-panel__title' }, title), dots, msg, h('div', { class: 'nv-pin__pad' }, keys));
      const el = h('div', { class: 'nv-overlay' }, panel);
      root.append(el);
      overlay = { el, back: () => done(false), key: (e) => { const d = digitOf(e.keyCode); if (d < 0) return false; press(String(d)); return true; } };
      setTimeout(() => keys[4].focus({ preventScroll: true }), 0);
    });
  }

  // Editor: new profile (p = null) or an existing one.
  function openEditor(p) {
    const isNew = !p;
    const id = p ? p.id : String(Date.now()); // known up front: a PIN is hashed with the profile id
    const active = currentProfile();
    const isActive = !!(p && active && active.id === p.id);
    let color = p ? p.color : PALETTE[list.length % PALETTE.length];
    let pinHash = p ? p.pinHash || null : null;
    let codeMode = isNew ? 'fresh' : 'keep'; // fresh | existing | keep
    let deleteArmed = false;
    const name = h('input', { class: 'jf-input nv-input', type: 'text', maxlength: '20', placeholder: 'Profile name', value: p ? p.name : '', autocomplete: 'off', spellcheck: 'false' });
    const preview = h('div', { class: 'nv-avatar nv-avatar--preview', style: { background: color } }, initialOf(name.value || '?'));
    name.addEventListener('input', () => { preview.textContent = initialOf(name.value || '?'); });
    const swatches = h('div', { class: 'nv-swatches' }, PALETTE.map((c) => h('button', {
      class: `nv-swatch${c === color ? ' nv-swatch--on' : ''}`, style: { background: c }, 'aria-label': `Colour ${c}`,
      onclick: (ev) => { color = c; preview.style.background = c; swatches.querySelectorAll('.nv-swatch').forEach((s) => s.classList.toggle('nv-swatch--on', s === ev.currentTarget)); },
    })));
    const code = h('input', { class: 'jf-input jf-input--code nv-input', type: 'text', maxlength: '11', placeholder: 'XXXX-XXXX-X', autocomplete: 'off', spellcheck: 'false' });
    code.addEventListener('input', () => { const v = formatCode(code.value); if (v !== code.value) code.value = v; });
    const codeBox = h('div', { class: 'nv-editor__code' });
    const msg = h('p', { class: 'nv-editor__msg', role: 'status' });
    const pinBtn = h('button', { class: 'jf-button nv-btn', onclick: async () => {
      if (pinHash) { pinHash = null; drawPin(); return; }
      const first = await askPin('Choose a 4-digit PIN');
      if (!first) return;
      const again = await askPin('Enter the PIN again', async (x) => x === first);
      if (again) { pinHash = await hashPin(id, first); drawPin(); }
    } });
    const drawPin = () => { pinBtn.textContent = pinHash ? 'Remove PIN' : 'Set a PIN'; };
    drawPin();
    function drawCode() {
      const choice = (mode, label) => h('button', { class: `jf-button nv-btn${codeMode === mode ? ' nv-btn--on' : ''}`, onclick: () => { codeMode = mode; drawCode(); if (mode === 'existing') code.focus(); } }, label);
      if (isNew) {
        codeBox.replaceChildren(h('div', { class: 'nv-editor__label' }, 'Watch history'),
          h('div', { class: 'nv-row' }, choice('fresh', 'Start fresh'), choice('existing', 'Use existing sync code')),
          codeMode === 'existing' ? code : '');
      } else {
        codeBox.replaceChildren(h('div', { class: 'nv-editor__label' }, `Sync code ••••-••••-${formatCode(p.code).slice(-1)}`),
          isActive ? h('p', { class: 'nv-editor__note' }, 'This profile is in use. Switch to another profile to change its sync code.')
            : h('div', { class: 'nv-row' }, choice('keep', 'Keep'), choice('existing', 'Change sync code')),
          codeMode === 'existing' ? code : '');
      }
    }
    drawCode();
    const del = !isNew && !isActive && h('button', { class: 'jf-button nv-btn nv-btn--danger', onclick: () => {
      if (!deleteArmed) { deleteArmed = true; del.textContent = 'Press again to delete'; return; }
      saveProfiles(removeProfile(loadProfiles(), p.id));
      closeOverlay();
    } }, 'Delete profile');
    const save = h('button', { class: 'jf-button nv-btn nv-btn--primary', onclick: async () => {
      const nm = name.value.trim();
      if (!nm) { msg.textContent = 'Give the profile a name.'; return name.focus(); }
      try {
        let newCode = null;
        if (codeMode === 'fresh' || codeMode === 'existing') {
          if (!isSignedIn()) throw new Error('Sign in to your VIP account first (Settings) — lists only sync for a signed-in account.');
          if (codeMode === 'fresh') {
            msg.textContent = 'Creating a new sync code…';
            newCode = await createCode();
          } else {
            newCode = formatCode(code.value);
            if (!validCode(newCode)) throw new Error('A sync code looks like ABCD-1234-X (9 letters/digits).');
            msg.textContent = 'Checking the sync code…';
            if (!(await codeExists(newCode))) throw new Error('No sync code found with that code — check it and try again.');
          }
        }
        let all = loadProfiles();
        if (isNew) all = updateProfile(addProfile(all, { name: nm, color, code: newCode }, id), id, { pinHash });
        else all = updateProfile(all, id, { name: nm, color, pinHash, ...(newCode ? { code: newCode } : {}) });
        saveProfiles(all);
        closeOverlay(id);
      } catch (e) {
        msg.textContent = e.message;
      }
    } }, isNew ? 'Create profile' : 'Save');
    const panel = h('div', { class: 'nv-panel nv-editor' },
      h('div', { class: 'nv-editor__head' }, h('h2', { class: 'nv-panel__title' }, isNew ? 'Add Profile' : 'Edit Profile')),
      h('div', { class: 'nv-editor__body' },
        h('div', { class: 'nv-editor__preview' }, preview),
        h('div', { class: 'nv-editor__fields' },
          h('label', { class: 'nv-editor__label' }, 'Name'), name,
          h('div', { class: 'nv-editor__label' }, 'Colour'), swatches,
          codeBox,
          h('div', { class: 'nv-editor__label' }, 'PIN'), h('div', { class: 'nv-row' }, pinBtn),
          msg,
          h('div', { class: 'nv-row nv-editor__actions' }, save, del || ''))));
    openOverlay(panel, () => closeOverlay(p && p.id));

    setTimeout(() => name.focus({ preventScroll: true }), 0);
  }

  // ---- keys: hold OK to edit, Back closes overlays / leaves, digits on the PIN pad ----
  let holdTimer = null;
  let held = false;
  keyHook.fn = (e) => {
    if (!root.isConnected) { keyHook.fn = null; return false; }
    const k = e.keyCode;
    if (overlay) {
      if (BACK.includes(k) && !(k === 8 && e.target.matches && e.target.matches('input'))) { overlay.back(); return true; }
      return overlay.key ? overlay.key(e) : false;
    }
    if (BACK.includes(k)) { if (!onDone) history.back(); return true; } // at launch there's nowhere to go back to
    const card = document.activeElement && document.activeElement.closest && document.activeElement.closest('.nv-profile');
    if (k === 13 && card) {
      if (!e.repeat && !holdTimer) { held = false; holdTimer = setTimeout(() => { held = true; holdTimer = null; activate(card.dataset.id, true); }, HOLD_MS); }
      return true; // acted on at key release (tap) or after HOLD_MS (hold)
    }
    return false;
  };
  const onUp = (e) => {
    if (!root.isConnected) return window.removeEventListener('keyup', onUp, true);
    if (e.keyCode !== 13 || overlay) return;
    const card = document.activeElement && document.activeElement.closest && document.activeElement.closest('.nv-profile');
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; if (card && !held) activate(card.dataset.id, false); }
  };
  window.addEventListener('keyup', onUp, true);
  root.addEventListener('click', (e) => { // mouse / pointer (desktop testing)
    const card = e.target.closest('.nv-profile');
    if (card && e.detail > 0 && !overlay) activate(card.dataset.id, false);
  });

  render();
}
