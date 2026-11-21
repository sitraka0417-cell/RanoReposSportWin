import { h, card, cardTitle, btn, chip, toggle, icon, modal, confirmDialog, toastMsg } from '../ui.js';
import { prefs, setPref, data, exportJson } from '../store.js';
import { sync } from '../sync.js';
import { chime } from '../notify.js';
import { sha256, uuid } from '../util.js';

const THEMES = [
  { id: 'dark', label: 'Sombre', c: ['#0A1020', '#111A2E', '#4DB6FF'] },
  { id: 'light', label: 'Clair', c: ['#F3F6FC', '#FFFFFF', '#0A74D9'] },
  { id: 'special', label: 'Spécial', c: ['#150B2E', '#241349', '#FF7AC6'] }
];

const LOCK_CHOICES = [{ v: 0, l: 'Jamais' }, { v: 1, l: '1 min' }, { v: 5, l: '5 min' }, { v: 10, l: '10 min' }, { v: 30, l: '30 min' }];

const pinOk = (v) => /^\d{4,6}$/.test(v);

// Saisie d'un code (retourne la chaîne ou null)
function pinPrompt(title, text) {
  const input = h('input', { type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'off', 'aria-label': 'Code PIN' });
  const err = h('p', { class: 'error', role: 'alert' });
  return modal({
    title,
    body: h('div', null, text ? h('p', { class: 'muted' }, text) : null, h('label', { class: 'field' }, input), err),
    actions: [
      { label: 'Annuler', kind: 'ghost', value: null },
      {
        label: 'Valider', kind: 'primary',
        run: () => {
          if (!pinOk(input.value)) {
            err.textContent = 'Le code doit contenir 4 à 6 chiffres.';
            return undefined;
          }
          return input.value;
        }
      }
    ]
  });
}

async function verifyCurrent() {
  const pin = await pinPrompt('Code actuel', 'Entrez votre code PIN actuel.');
  if (pin == null) return false;
  if ((await sha256(prefs.pinSalt + pin)) !== prefs.pinHash) {
    toastMsg('Code incorrect');
    return false;
  }
  return true;
}

async function setNewPin() {
  const a = await pinPrompt('Nouveau code PIN', 'Choisissez un code de 4 à 6 chiffres.');
  if (a == null) return;
  const b = await pinPrompt('Confirmer le code', 'Entrez-le une seconde fois.');
  if (b == null) return;
  if (a !== b) {
    toastMsg('Les deux codes sont différents');
    return;
  }
  const salt = uuid();
  setPref({ pinSalt: salt, pinHash: await sha256(salt + a) });
  toastMsg('Code PIN enregistré');
}

function themeTile(t) {
  return h('button', {
    type: 'button', class: 'theme-tile' + (prefs.theme === t.id ? ' on' : ''), 'aria-pressed': prefs.theme === t.id ? 'true' : 'false',
    onClick: () => setPref({ theme: t.id })
  }, h('span', { class: 'swatch' }, t.c.map((c) => h('i', { style: { background: c } }))), h('span', null, t.label));
}

export function settingsScreen(ctx) {
  const cfg = ctx.config || {};
  const sys = ctx.sys || {};

  // ----- Compte -----
  let account;
  if (sync.status === 'unconfigured') {
    account = h('p', { class: 'muted' }, 'La synchronisation n\'est pas configurée : renseignez la clé API Firebase dans config.json (voir le fichier README).');
  } else if (sync.user) {
    const u = sync.user;
    const statusText = sync.status === 'on' ? 'Synchronisé' : sync.status === 'connecting' ? 'Synchronisation en cours…' : sync.status === 'error' ? 'Erreur de synchronisation' : 'Connecté';
    account = h('div', { class: 'stack' },
      h('div', { class: 'user-row' },
        u.photo ? h('img', { class: 'avatar', src: u.photo, alt: '', referrerpolicy: 'no-referrer' }) : h('div', { class: 'avatar ph' }, (u.name || u.email || '?').charAt(0).toUpperCase()),
        h('div', null, h('div', { class: 'strong' }, u.name || 'Compte Google'), h('div', { class: 'muted small' }, u.email))),
      h('p', { class: sync.status === 'error' ? 'error' : 'ok-text small' }, statusText + (sync.error ? ' : ' + sync.error : '')),
      btn({ kind: 'ghost', icon: 'person', onClick: async () => {
        if (await confirmDialog('Se déconnecter ?', 'Les données restent sauvegardées dans votre compte et reviendront à la prochaine connexion.', 'Se déconnecter')) {
          await ctx.signOut();
        }
      } }, 'Se déconnecter'));
  } else {
    account = h('div', { class: 'stack' },
      h('p', { class: 'muted' }, 'Connectez-vous pour retrouver vos repos, votre eau et votre sport sur tous vos appareils (même compte que l\'application Android).'),
      btn({ kind: 'primary', icon: 'google', disabled: ctx.signing, onClick: ctx.signIn }, ctx.signing ? 'Connexion dans le navigateur…' : 'Se connecter avec Google'),
      ctx.signing ? h('p', { class: 'muted small' }, 'Terminez la connexion dans la page qui vient de s\'ouvrir, puis revenez ici.') : null);
  }

  // ----- Son -----
  const vol = h('input', {
    type: 'range', min: 0, max: 100, value: String(Math.round(prefs.volume * 100)), 'aria-label': 'Volume',
    onInput: (e) => { volLabel.textContent = e.target.value + ' %'; },
    onChange: (e) => setPref({ volume: Number(e.target.value) / 100 })
  });
  const volLabel = h('span', { class: 'muted small' }, Math.round(prefs.volume * 100) + ' %');

  // ----- Application -----
  const sysRows = h('div', { class: 'stack' },
    h('div', { class: 'kv' },
      h('div', null, h('div', { class: 'k' }, 'Réduire dans la zone de notification'),
        h('div', { class: 'muted small' }, 'La croix ferme la fenêtre mais les rappels restent actifs.')),
      toggle(sys.closeToTray !== false, async (v) => { ctx.sys = await window.api.setSystem({ closeToTray: v }); ctx.render(); }, 'Réduire dans la zone de notification')),
    h('div', { class: 'kv' },
      h('div', null, h('div', { class: 'k' }, 'Lancer avec Windows'),
        h('div', { class: 'muted small' }, sys.packaged === false ? 'Disponible dans la version installée.' : 'L\'application démarre en arrière-plan à l\'ouverture de session.')),
      toggle(!!sys.autoLaunch, async (v) => { ctx.sys = await window.api.setSystem({ autoLaunch: v }); ctx.render(); }, 'Lancer avec Windows')));

  // ----- Sécurité -----
  const hasPin = !!prefs.pinHash;
  const security = h('div', { class: 'stack' },
    hasPin
      ? h('div', null,
        h('p', { class: 'ok-text small' }, 'Code PIN actif · Ctrl+L pour verrouiller'),
        h('div', { class: 'btn-row' },
          btn({ kind: 'tonal', small: true, icon: 'lock', onClick: async () => { if (await verifyCurrent()) await setNewPin(); } }, 'Modifier le code'),
          btn({ kind: 'ghost', small: true, icon: 'trash', onClick: async () => {
            if (await verifyCurrent()) {
              setPref({ pinHash: '', pinSalt: '', autoLockMin: 0 });
              toastMsg('Code PIN supprimé');
            }
          } }, 'Supprimer le code')),
        h('p', { class: 'strong' }, 'Verrouillage automatique après inactivité'),
        h('div', { class: 'chips' }, LOCK_CHOICES.map((c) => chip(c.l, prefs.autoLockMin === c.v, () => setPref({ autoLockMin: c.v })))),
        h('p', { class: 'muted small' }, 'L\'application se verrouille aussi quand la session Windows est verrouillée.'))
      : h('div', null,
        h('p', { class: 'muted' }, 'Protégez l\'accès à vos données avec un code de 4 à 6 chiffres.'),
        btn({ kind: 'tonal', icon: 'lock', onClick: setNewPin }, 'Définir un code PIN')));

  // ----- Données -----
  const dataCard = h('div', { class: 'stack' },
    h('p', { class: 'muted' }, data.repos.length + ' repos · ' + data.waters.length + ' verres · ' + data.sports.length + ' séances de sport'),
    btn({ kind: 'tonal', icon: 'download', onClick: async () => {
      const r = await window.api.exportData('rano-repos-sport-' + new Date().toISOString().slice(0, 10) + '.json', exportJson());
      if (r && r.path) toastMsg('Données exportées');
    } }, 'Exporter mes données (JSON)'));

  // ----- À propos -----
  const updateBox = h('div', { class: 'stack' });
  const direct = 'https://github.com/' + (cfg.repo || '') + '/releases/latest/download/RanoReposSport-Setup.exe';
  const about = h('div', { class: 'stack' },
    h('p', null, h('b', null, 'Rano & Repos & Sport'), ' · version ' + (cfg.version || '')),
    h('p', { class: 'muted small' }, '© 2026 Sitraka Nambinintsoa'),
    h('div', { class: 'btn-row' },
      btn({ kind: 'tonal', small: true, icon: 'download', onClick: async () => {
        updateBox.replaceChildren(h('p', { class: 'muted small' }, 'Vérification en cours…'));
        const r = await window.api.checkUpdate();
        if (r.error) updateBox.replaceChildren(h('p', { class: 'error' }, r.error));
        else if (r.version && r.version !== cfg.version) {
          updateBox.replaceChildren(h('p', { class: 'ok-text' }, 'Une nouvelle version est disponible : ' + r.version),
            btn({ kind: 'primary', small: true, icon: 'download', onClick: () => window.api.openExternal(r.url) }, 'Télécharger'));
        } else updateBox.replaceChildren(h('p', { class: 'ok-text small' }, 'Vous avez la dernière version.'));
      } }, 'Vérifier les mises à jour'),
      cfg.downloadPage ? btn({ kind: 'ghost', small: true, onClick: () => window.api.openExternal(cfg.downloadPage) }, 'Page de téléchargement') : null,
      cfg.repo ? btn({ kind: 'ghost', small: true, onClick: async () => {
        try {
          await navigator.clipboard.writeText(direct);
          toastMsg('Lien de téléchargement copié');
        } catch (e) { toastMsg(direct); }
      } }, 'Copier le lien à partager') : null),
    updateBox);

  return h('div', { class: 'grid' },
    h('div', { class: 'col' },
      card(null, cardTitle('person', 'Compte et synchronisation'), account),
      card(null, cardTitle('settings', 'Apparence'), h('div', { class: 'themes' }, THEMES.map(themeTile))),
      card(null, cardTitle('volume', 'Sons et alarmes'),
        h('div', { class: 'stack' },
          h('div', { class: 'kv' }, h('div', { class: 'k' }, 'Son des alarmes'), toggle(prefs.sound, (v) => setPref({ sound: v }), 'Son des alarmes')),
          h('div', { class: 'kv' }, h('div', { class: 'k' }, 'Volume'), h('div', { class: 'inline grow' }, vol, volLabel)),
          h('div', { class: 'kv' },
            h('div', null, h('div', { class: 'k' }, 'Afficher la fenêtre à chaque alarme'), h('div', { class: 'muted small' }, 'Sinon, l\'icône clignote dans la barre des tâches.')),
            toggle(prefs.bringFront, (v) => setPref({ bringFront: v }), 'Afficher la fenêtre à chaque alarme')),
          btn({ kind: 'tonal', small: true, icon: 'play', onClick: () => chime() }, 'Tester le son')))),
    h('div', { class: 'col' },
      card(null, cardTitle('bell', 'Application'), sysRows),
      card(null, cardTitle('shield', 'Sécurité'), security),
      card(null, cardTitle('download', 'Mes données'), dataCard),
      card(null, cardTitle('info', 'À propos'), about)));
}
