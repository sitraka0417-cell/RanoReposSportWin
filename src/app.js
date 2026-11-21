// Point d'entrée : coque de l'application, navigation, verrouillage, boucle d'horloge
import { h, icon, toastMsg } from './ui.js';
import * as Store from './store.js';
import { prefs, subscribe } from './store.js';
import * as Engine from './engine.js';
import { sync, initSync, signInWithTokens, signOutUser } from './sync.js';
import { sha256, fmtDay } from './util.js';
import { reposScreen } from './screens/repos.js';
import { waterScreen } from './screens/water.js';
import { sportScreen } from './screens/sport.js';
import { settingsScreen } from './screens/settings.js';
import { historyScreen } from './screens/history.js';

const VIEWS = [
  { id: 'repos', label: 'Repos', icon: 'timer', title: 'Repos', sub: 'Pauses et cycles de travail' },
  { id: 'water', label: 'Eau', icon: 'drop', title: 'Eau', sub: 'Hydratation du jour' },
  { id: 'sport', label: 'Sport', icon: 'fitness', title: 'Sport', sub: 'Séances et objectif de la semaine' },
  { id: 'settings', label: 'Réglages', icon: 'settings', title: 'Réglages', sub: 'Compte, apparence, sécurité' }
];

const state = { view: 'repos', history: null, locked: false };
const ctx = {
  live: [],
  config: null,
  sys: null,
  signing: false,
  render: () => schedule(),
  openHistory: (kind) => {
    state.history = kind;
    schedule();
  },
  closeHistory: () => {
    state.history = null;
    schedule();
  },
  signIn: () => signIn(),
  signOut: () => signOutUser().then(() => schedule())
};

let els = {};
let pending = false;
let lastActivity = Date.now();
let lastTray = '';

function schedule() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    render();
  }, 0);
}

function applyTheme() {
  document.documentElement.dataset.theme = prefs.theme;
}

function go(view) {
  if (!VIEWS.some((v) => v.id === view)) return;
  state.view = view;
  state.history = null;
  schedule();
}

// ----- Connexion Google -----
async function signIn() {
  if (!window.api || ctx.signing) return;
  ctx.signing = true;
  schedule();
  try {
    const r = await window.api.signInGoogle();
    if (r.error) {
      toastMsg(r.error);
    } else {
      await signInWithTokens(r.idToken, r.accessToken);
      toastMsg('Connexion réussie');
    }
  } catch (e) {
    toastMsg('Connexion refusée : ' + ((e && e.message) || 'erreur inconnue'));
  }
  ctx.signing = false;
  schedule();
}

// ----- Verrouillage par code PIN -----
function lock() {
  if (!prefs.pinHash) return false;
  state.locked = true;
  els.pin.value = '';
  els.pinErr.textContent = '';
  schedule();
  return true;
}

async function tryUnlock() {
  const pin = els.pin.value;
  if (!/^\d{4,6}$/.test(pin)) {
    els.pinErr.textContent = 'Entrez votre code (4 à 6 chiffres).';
    return;
  }
  if ((await sha256(prefs.pinSalt + pin)) === prefs.pinHash) {
    state.locked = false;
    lastActivity = Date.now();
    els.pin.value = '';
    els.pinErr.textContent = '';
    schedule();
  } else {
    els.pinErr.textContent = 'Code incorrect.';
    els.pin.value = '';
    els.lockBox.classList.remove('shake');
    void els.lockBox.offsetWidth;
    els.lockBox.classList.add('shake');
  }
}

// ----- Construction de la coque -----
function buildShell() {
  const root = document.getElementById('root');
  const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' }, VIEWS.map((v, i) => h('button', {
    type: 'button', class: 'nav-item', 'data-view': v.id, title: v.label + '  (Ctrl+' + (i + 1) + ')', onClick: () => go(v.id)
  }, icon(v.icon, 22), h('span', { class: 'nav-label' }, v.label))));
  els.nav = nav;
  els.hint = h('div', { class: 'side-hint' });
  els.title = h('h1', { class: 'view-title' });
  els.sub = h('p', { class: 'view-sub' });
  els.pill = h('button', { type: 'button', class: 'pill', onClick: () => go('settings') });
  els.content = h('main', { class: 'content', id: 'content', tabindex: '-1' });
  els.pin = h('input', {
    type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'off', placeholder: 'Code PIN', 'aria-label': 'Code PIN',
    onKeydown: (e) => { if (e.key === 'Enter') tryUnlock(); }
  });
  els.pinErr = h('p', { class: 'error', role: 'alert' });
  els.lockBox = h('div', { class: 'lock-box' },
    h('div', { class: 'lock-ico' }, icon('lock', 34)),
    h('h2', null, 'Application verrouillée'),
    h('p', { class: 'muted' }, 'Entrez votre code PIN pour continuer.'),
    els.pin, els.pinErr,
    h('button', { type: 'button', class: 'btn primary block', onClick: tryUnlock }, 'Déverrouiller'));
  els.lock = h('div', { class: 'lock', hidden: true }, els.lockBox);

  els.shell = h('div', { class: 'shell' },
    h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, h('img', { src: '../assets/icon.png', alt: '', width: 38, height: 38 }),
        h('div', { class: 'brand-text' }, h('b', null, 'Rano & Repos'), h('span', null, '& Sport'))),
      nav, h('div', { class: 'grow' }), els.hint),
    h('div', { class: 'main' },
      h('header', { class: 'topbar' }, h('div', { class: 'topbar-titles' }, els.title, els.sub), els.pill),
      els.content));
  root.append(els.shell, els.lock);
}

// ----- Affichage -----
function render() {
  const view = VIEWS.find((v) => v.id === state.view) || VIEWS[0];
  els.nav.querySelectorAll('.nav-item').forEach((b) => {
    const on = b.dataset.view === view.id;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  els.title.textContent = view.title;
  els.sub.textContent = state.history ? '' : view.id === 'repos' || view.id === 'water' || view.id === 'sport' ? fmtDay(Date.now()) + ' · ' + view.sub : view.sub;
  els.hint.textContent = prefs.pinHash ? 'Ctrl+L : verrouiller' : '';

  const st = sync.status;
  const pillMap = {
    off: ['Non connecté', 'pill off'],
    connecting: ['Synchronisation…', 'pill busy'],
    on: ['Synchronisé', 'pill ok'],
    error: ['Erreur de synchro', 'pill err'],
    unconfigured: ['', 'pill hidden']
  };
  const p = pillMap[st] || pillMap.off;
  els.pill.textContent = p[0];
  els.pill.className = p[1];
  els.pill.title = sync.error || '';

  els.lock.hidden = !state.locked;
  els.shell.inert = state.locked;
  if (state.locked) {
    setTimeout(() => els.pin.focus(), 30);
  }

  const scroll = els.content.scrollTop;
  ctx.live = [];
  let node;
  try {
    if (state.history) node = historyScreen(ctx, state.history);
    else if (view.id === 'repos') node = reposScreen(ctx);
    else if (view.id === 'water') node = waterScreen(ctx);
    else if (view.id === 'sport') node = sportScreen(ctx);
    else node = settingsScreen(ctx);
  } catch (e) {
    console.error(e);
    node = h('div', { class: 'card' }, h('h3', null, 'Une erreur est survenue'), h('p', { class: 'muted' }, String((e && e.message) || e)));
  }
  els.content.replaceChildren(node);
  els.content.scrollTop = scroll;
}

// ----- Boucle d'horloge -----
function loop() {
  const now = Date.now();
  Engine.tick(now);
  const fns = ctx.live.slice();
  fns.forEach((fn) => {
    try {
      fn(now);
    } catch (e) { /* ignoré */ }
  });
  if (window.api) {
    const t = Engine.trayText(now);
    if (t !== lastTray) {
      lastTray = t;
      window.api.setTray(t);
    }
  }
  if (prefs.pinHash && !state.locked && prefs.autoLockMin > 0 && now - lastActivity > prefs.autoLockMin * 60000) lock();
}

async function main() {
  Store.loadAll();
  Engine.restore();
  applyTheme();
  buildShell();
  try {
    ctx.config = window.api ? await window.api.config() : {};
    ctx.sys = window.api ? await window.api.getSystem() : {};
  } catch (e) {
    ctx.config = {};
    ctx.sys = {};
  }
  state.locked = !!prefs.pinHash;
  subscribe((kind) => {
    if (kind === 'prefs') applyTheme();
    schedule();
  });
  initSync(ctx.config && ctx.config.firebase);
  render();

  setInterval(loop, 250);
  setInterval(schedule, 60000);

  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => {
    window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true });
  });
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'l') {
      e.preventDefault();
      if (!lock() && !state.locked) toastMsg('Définissez d\'abord un code PIN (Réglages → Sécurité).');
    } else if (k >= '1' && k <= '4' && !state.locked) {
      e.preventDefault();
      go(VIEWS[Number(k) - 1].id);
    }
  });
  if (window.api) {
    window.api.onLock(() => lock());
    window.api.onResume(() => {
      loop();
      schedule();
    });
    window.api.onNavigate((v) => go(v));
  }
}

main();
