import { h, card, cardTitle, btn, chip, toggle, ring, icon, iconBtn, durationDialog, confirmDialog, modal } from '../ui.js';
import { prefs, setPref, data, DEFAULT_MODELS } from '../store.js';
import { run, live, startPause, startAuto, nextStep, stopRest, dismissAlarm } from '../engine.js';
import { fmtDur, fmtClock, fmtHour, startOfDay, addDays } from '../util.js';

let oneOffSec = null; // durée ponctuelle (non enregistrée)

const effectiveSec = () => (oneOffSec != null ? oneOffSec : prefs.selectedSec);

const SUBTITLE = {
  IDLE: 'Prêt pour la pause',
  PAUSE: 'Repos en cours',
  WORK: 'Travail en cours',
  WAIT_PAUSE: 'Il est temps de faire une pause',
  WAIT_WORK: 'Reprenez le travail'
};

async function askSave(sec) {
  const r = await modal({
    title: 'Ajouter aux modèles ?',
    body: h('p', null, 'Voulez-vous enregistrer ' + fmtDur(sec) + ' dans vos durées habituelles ?'),
    actions: [
      { label: 'Non, une seule fois', kind: 'ghost', value: 'once' },
      { label: 'Oui, enregistrer', kind: 'primary', value: 'save' }
    ]
  });
  return r;
}

export function reposScreen(ctx) {
  const r = run.rest;
  const phase = r.phase;
  const idle = phase === 'IDLE';
  const colors = phase === 'PAUSE' ? ['#2EE6B6', '#4DB6FF'] : phase === 'WORK' ? ['#FFB74D', '#FF7A59'] : ['#4DB6FF', '#2EE6B6'];

  // ----- Chronomètre -----
  const clock = h('div', { class: 'ring-time' });
  const sub = h('div', { class: 'ring-sub' }, SUBTITLE[phase] + (r.auto && phase !== 'IDLE' ? ' · cycle automatique' : ''));
  const rg = ring({ size: 260, stroke: 16, progress: 1, colors }, clock, sub);
  const paint = (now = Date.now()) => {
    if (phase === 'PAUSE' || phase === 'WORK') {
      const left = Math.max(0, r.endAt - now);
      clock.textContent = fmtClock(left);
      rg.setProgress(r.totalMs > 0 ? left / r.totalMs : 0);
    } else if (phase === 'IDLE') {
      clock.textContent = fmtClock(effectiveSec() * 1000);
      rg.setProgress(1);
    } else {
      clock.textContent = '00:00';
      rg.setProgress(0);
    }
  };
  ctx.live.push(paint);
  paint();

  const chrono = card({ class: 'center' }, h('div', { class: 'ring-wrap' }, rg));

  // ----- Alarme -----
  const alarm = live.ringing
    ? card({ class: 'alert-card' },
      h('div', { class: 'alert-row' }, icon('bell', 28), h('div', null, h('h3', null, live.title), h('p', { class: 'muted' }, live.text))),
      btn({ kind: 'primary', block: true, onClick: dismissAlarm }, 'Arrêter l\'alarme'))
    : null;

  // ----- Durée et boutons -----
  const models = prefs.models;
  const isCustom = oneOffSec == null && !DEFAULT_MODELS.includes(prefs.selectedSec);
  const chips = models.map((s) => chip(fmtDur(s), oneOffSec == null && prefs.selectedSec === s, () => {
    oneOffSec = null;
    setPref({ selectedSec: s });
  }, { disabled: !idle }));
  chips.push(chip('Autre', oneOffSec != null, async () => {
    const sec = await durationDialog('Durée du repos', effectiveSec());
    if (sec == null) return;
    if (models.includes(sec)) {
      oneOffSec = null;
      setPref({ selectedSec: sec });
      return;
    }
    const a = await askSave(sec);
    if (a === 'save') {
      oneOffSec = null;
      setPref({ models: models.concat(sec), selectedSec: sec });
    } else if (a === 'once') {
      oneOffSec = sec;
      ctx.render();
    }
  }, { disabled: !idle }));

  let mainBtn;
  if (phase === 'IDLE') mainBtn = btn({ kind: 'primary', icon: 'play', block: true, onClick: () => startPause(effectiveSec()) }, 'Début du repos');
  else if (phase === 'WAIT_PAUSE') mainBtn = btn({ kind: 'primary', icon: 'play', block: true, onClick: nextStep }, 'Je commence la pause');
  else if (phase === 'WAIT_WORK') mainBtn = btn({ kind: 'primary', icon: 'play', block: true, onClick: nextStep }, 'Je reprends le travail');
  else mainBtn = btn({ kind: 'danger', icon: 'stop', block: true, onClick: stopRest }, r.auto ? 'Arrêter le cycle' : 'Arrêter le repos');
  const stopExtra = (phase === 'WAIT_PAUSE' || phase === 'WAIT_WORK')
    ? btn({ kind: 'ghost', block: true, onClick: stopRest }, 'Arrêter le cycle') : null;

  const controls = card(null,
    cardTitle('timer', 'Durée du repos', oneOffSec != null ? 'Durée ponctuelle : ' + fmtDur(oneOffSec) + ' (non enregistrée)' : 'Choisissez une durée'),
    h('div', { class: 'chips' }, chips),
    isCustom ? h('div', { class: 'row-actions' },
      btn({ kind: 'ghost', small: true, icon: 'edit', onClick: async () => {
        const sec = await durationDialog('Modifier la durée', prefs.selectedSec);
        if (sec == null || sec === prefs.selectedSec) return;
        const l = models.filter((m) => m !== sec).map((m) => (m === prefs.selectedSec ? sec : m));
        setPref({ models: l.includes(sec) ? l : l.concat(sec), selectedSec: sec });
      } }, 'Modifier'),
      btn({ kind: 'ghost', small: true, icon: 'trash', onClick: async () => {
        if (!(await confirmDialog('Supprimer cette durée ?', fmtDur(prefs.selectedSec) + ' sera retirée de vos modèles.', 'Supprimer'))) return;
        const l = models.filter((m) => m !== prefs.selectedSec);
        setPref({ models: l, selectedSec: (l.length ? l : DEFAULT_MODELS)[0] });
      } }, 'Supprimer')) : null,
    h('div', { class: 'spacer-sm' }),
    mainBtn, stopExtra);

  // ----- Cycle automatique -----
  const auto = card(null,
    cardTitle('calendar', 'Cycle automatique', 'Alterne travail et repos sans y penser',
      toggle(prefs.autoEnabled, (v) => setPref({ autoEnabled: v }), 'Cycle automatique')),
    prefs.autoEnabled ? h('div', { class: 'stack' },
      h('div', { class: 'kv' },
        h('div', null, h('div', { class: 'k' }, 'Temps de travail'), h('div', { class: 'v' }, fmtDur(prefs.workSec))),
        btn({ kind: 'ghost', small: true, icon: 'edit', onClick: async () => {
          const s = await durationDialog('Temps de travail', prefs.workSec);
          if (s != null) setPref({ workSec: s });
        } }, 'Modifier')),
      h('div', { class: 'kv' },
        h('div', null, h('div', { class: 'k' }, 'Temps de pause'), h('div', { class: 'v' }, fmtDur(prefs.autoPauseSec))),
        btn({ kind: 'ghost', small: true, icon: 'edit', onClick: async () => {
          const s = await durationDialog('Temps de pause', prefs.autoPauseSec);
          if (s != null) setPref({ autoPauseSec: s });
        } }, 'Modifier')),
      h('div', { class: 'kv' },
        h('div', null, h('div', { class: 'k' }, 'Confirmer chaque changement'),
          h('div', { class: 'muted small' }, prefs.autoConfirm ? 'L\'alarme sonne jusqu\'à votre confirmation.' : 'Désactivé : tout s\'enchaîne automatiquement.')),
        toggle(prefs.autoConfirm, (v) => setPref({ autoConfirm: v }), 'Confirmer chaque changement')),
      idle ? btn({ kind: 'primary', icon: 'play', block: true, onClick: startAuto }, 'Démarrer le cycle') : null)
      : h('p', { class: 'muted' }, 'Activez-le pour enchaîner automatiquement les périodes de travail et de repos.'));

  // ----- Aujourd'hui -----
  const from = startOfDay(Date.now());
  const today = data.repos.filter((x) => x.ts >= from && x.ts < addDays(from, 1)).sort((a, b) => b.ts - a.ts);
  const totalSec = today.reduce((s, x) => s + x.sec, 0);
  const todayCard = card(null,
    h('p', { class: 'muted' }, 'Repos d\'aujourd\'hui'),
    h('div', { class: 'big accent2' }, fmtDur(totalSec)),
    h('p', { class: 'muted' }, today.length === 0 ? 'Aucun repos pour l\'instant' : today.length === 1 ? '1 repos effectué' : today.length + ' repos effectués'),
    today.length ? h('ul', { class: 'mini-list' }, today.slice(0, 4).map((x) => h('li', null, h('span', null, fmtHour(x.ts)), h('b', null, fmtDur(x.sec))))) : null,
    btn({ kind: 'tonal', icon: 'history', block: true, onClick: () => ctx.openHistory('repo') }, 'Historique'));

  return h('div', { class: 'grid' }, h('div', { class: 'col' }, alarm, chrono), h('div', { class: 'col' }, controls, auto, todayCard));
}
