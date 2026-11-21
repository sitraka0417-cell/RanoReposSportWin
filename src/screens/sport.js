import { h, card, cardTitle, btn, chip, toggle, ring, icon, iconBtn, progressBar, minutesDialog, nameDialog, confirmDialog, modal } from '../ui.js';
import { prefs, setPref, data, DEFAULT_SPORTS } from '../store.js';
import { run, live, startSport, completeSport, abandonSport, dismissSportEnded } from '../engine.js';
import { sportStats } from '../stats.js';
import { fmtDur, fmtMinutes, fmtClock, fmtElapsed, DAY_NAMES } from '../util.js';

const minCeil = (sec) => Math.ceil(sec / 60);

function planDialog() {
  const inputs = DAY_NAMES.map((d, i) => h('input', {
    type: 'number', min: 0, max: 600, value: String(prefs.sportDayMin[i] || 0), inputmode: 'numeric', 'aria-label': d + ' (minutes)'
  }));
  const rows = DAY_NAMES.map((d, i) => h('label', { class: 'plan-row' }, h('span', null, d), h('div', { class: 'num' }, inputs[i], h('span', null, 'min'))));
  return modal({
    title: 'Planning de la semaine',
    wide: true,
    body: h('div', null,
      h('p', { class: 'muted' }, 'Durée en minutes pour chaque jour. Laissez 0 pour un jour de repos.'),
      h('div', { class: 'plan' }, rows)),
    actions: [
      { label: 'Annuler', kind: 'ghost', value: null },
      { label: 'Valider', kind: 'primary', run: () => inputs.map((x) => Math.min(600, Math.max(0, Math.floor(Number(x.value) || 0)))) }
    ]
  });
}

export function sportScreen(ctx) {
  const st = sportStats(data.sports, prefs);
  const s = run.sport;
  const running = s.running;
  const est = s.estSec;

  // ----- Chronomètre -----
  const clock = h('div', { class: 'ring-time' });
  const sub = h('div', { class: 'ring-sub' }, !running ? 'Prêt pour le sport' : (est > 0 ? s.type + ' · temps restant' : s.type + ' · en cours'));
  const rg = ring({ size: 260, stroke: 16, progress: 1, colors: running ? ['#FFB74D', '#4DB6FF'] : ['#4DB6FF', '#2EE6B6'] }, clock, sub);
  const paint = (now = Date.now()) => {
    if (running && est > 0) {
      const remain = Math.max(0, s.startAt + est * 1000 - now);
      clock.textContent = fmtClock(remain);
      rg.setProgress(remain / (est * 1000));
    } else if (running) {
      const el = Math.max(0, now - s.startAt);
      clock.textContent = fmtElapsed(el);
      rg.setProgress((el % 60000) / 60000);
    } else {
      clock.textContent = prefs.sportEstOn ? fmtClock(prefs.sportEstMin * 60000) : '00:00';
      rg.setProgress(1);
    }
  };
  ctx.live.push(paint);
  paint();
  const chrono = card({ class: 'center' }, h('div', { class: 'ring-wrap' }, rg));

  // ----- Séance terminée -----
  const ended = live.sportEnded
    ? card({ class: 'alert-card' },
      h('div', { class: 'alert-row' }, icon('check', 28), h('div', null, h('h3', null, 'Séance terminée'), h('p', { class: 'muted' }, live.sportEnded))),
      btn({ kind: 'primary', block: true, onClick: dismissSportEnded }, 'OK'))
    : null;

  // ----- Choix du sport et démarrage -----
  let control;
  if (!running) {
    const sel = prefs.sportSelected;
    const types = prefs.sportTypes;
    control = card(null,
      cardTitle('fitness', 'Type de sport', 'Choisissez votre activité'),
      h('div', { class: 'chips' },
        types.map((t) => chip(t, t === sel, () => setPref({ sportSelected: t }))),
        chip('Autre', false, async () => {
          const r = await nameDialog('Autre sport', 'Nom du sport', 'Ajouter à ma liste');
          if (!r) return;
          const existing = types.find((t) => t.toLowerCase() === r.value.toLowerCase());
          if (existing) setPref({ sportSelected: existing });
          else if (r.save) setPref({ sportTypes: types.concat(r.value), sportSelected: r.value });
          else setPref({ sportSelected: r.value });
        })),
      !DEFAULT_SPORTS.includes(sel) ? h('div', { class: 'row-actions' },
        h('span', { class: 'muted small' }, types.includes(sel) ? 'Sport personnalisé : ' + sel : 'Sport ponctuel : ' + sel + ' (non enregistré)'),
        types.includes(sel) ? btn({ kind: 'ghost', small: true, icon: 'trash', onClick: async () => {
          if (!(await confirmDialog('Supprimer ce sport ?', '« ' + sel + ' » sera retiré de votre liste.', 'Supprimer'))) return;
          const l = types.filter((t) => t !== sel);
          setPref({ sportTypes: l, sportSelected: (l.length ? l : DEFAULT_SPORTS)[0] });
        } }, 'Supprimer') : null) : null,
      h('div', { class: 'kv' },
        h('div', null, h('div', { class: 'k' }, 'Temps estimé'),
          h('div', { class: 'muted small' }, prefs.sportEstOn ? 'Compte à rebours de ' + fmtMinutes(prefs.sportEstMin) : 'Désactivé : chronomètre normal')),
        h('div', { class: 'inline' },
          prefs.sportEstOn ? btn({ kind: 'ghost', small: true, icon: 'edit', onClick: async () => {
            const m = await minutesDialog('Temps estimé', prefs.sportEstMin);
            if (m != null) setPref({ sportEstMin: m });
          } }, 'Modifier') : null,
          toggle(prefs.sportEstOn, (v) => setPref({ sportEstOn: v }), 'Temps estimé'))),
      h('div', { class: 'spacer-sm' }),
      btn({ kind: 'primary', icon: 'play', block: true, onClick: () => startSport(prefs.sportSelected, prefs.sportEstOn ? prefs.sportEstMin * 60 : 0) }, 'Commencer le sport'));
  } else {
    control = card(null,
      cardTitle('fitness', s.type, est > 0 ? 'Temps estimé : ' + fmtDur(est) : 'Chronomètre en cours'),
      btn({ kind: 'danger', icon: 'stop', block: true, onClick: () => completeSport(false) }, 'Terminer et enregistrer'),
      btn({ kind: 'ghost', block: true, onClick: async () => {
        if (await confirmDialog('Abandonner la séance ?', 'Le temps écoulé ne sera pas enregistré.', 'Abandonner')) abandonSport();
      } }, 'Abandonner sans enregistrer'));
  }

  // ----- Objectif de la semaine -----
  const goalPct = st.goalSec > 0 ? st.weekSec / st.goalSec : 0;
  const perDay = minCeil(Math.ceil(st.leftSec / st.daysLeft));
  const goalCard = card(null,
    cardTitle('fitness', 'Objectif de la semaine', null, btn({ kind: 'ghost', small: true, icon: 'edit', onClick: async () => {
      const m = await minutesDialog('Objectif de la semaine', prefs.sportGoalMin);
      if (m != null) setPref({ sportGoalMin: m });
    } }, 'Modifier')),
    h('div', { class: 'big accent3' }, fmtMinutes(prefs.sportGoalMin)),
    progressBar(goalPct, 'var(--tertiary)'),
    h('p', { class: 'muted small' }, 'Fait cette semaine : ' + fmtDur(st.weekSec)),
    st.leftSec > 0
      ? h('div', null,
        h('p', { class: 'strong' }, 'Reste à faire : ' + fmtMinutes(minCeil(st.leftSec))),
        h('p', { class: 'muted small' }, 'Soit environ ' + fmtMinutes(perDay) + ' par jour sur ' + (st.daysLeft > 1 ? 'les ' + st.daysLeft + ' jours restants' : 'le dernier jour') + ' (aujourd\'hui compris)'))
      : h('p', { class: 'ok-text' }, 'Objectif atteint, bravo !'),
    st.streak > 0 ? h('p', { class: 'accent1 small' }, 'Série en cours : ' + st.streak + ' jour' + (st.streak > 1 ? 's' : '') + ' d\'affilée') : null);

  // ----- Répartition par jour -----
  let split;
  if (!prefs.sportSplit) {
    split = h('p', { class: 'muted' }, 'Activez la répartition pour obtenir un objectif quotidien.');
  } else {
    const plan = prefs.sportDayMin;
    const total = plan.reduce((a, b) => a + b, 0);
    const modeBlock = !prefs.sportSplitCustom
      ? h('div', null,
        h('p', { class: 'strong' }, 'Jours d\'entraînement par semaine'),
        h('div', { class: 'chips' }, [1, 2, 3, 4, 5, 6, 7].map((n) => chip(String(n), prefs.sportSplitDays === n, () => setPref({ sportSplitDays: n })))),
        h('p', { class: 'muted small' }, prefs.sportSplitDays + ' jour' + (prefs.sportSplitDays > 1 ? 's' : '') + ' × ' + fmtMinutes(st.perDayMin) + ' par jour'))
      : h('div', null,
        h('p', { class: 'strong' }, DAY_NAMES.map((d, i) => (plan[i] > 0 ? d.slice(0, 3) + '. ' + plan[i] + ' min' : null)).filter(Boolean).join('  ·  ') || 'Aucun jour planifié'),
        h('p', { class: total === prefs.sportGoalMin ? 'ok-text small' : 'accent3 small' }, 'Total planifié : ' + fmtMinutes(total) + ' (objectif : ' + fmtMinutes(prefs.sportGoalMin) + ')'),
        btn({ kind: 'tonal', small: true, icon: 'edit', onClick: async () => {
          const l = await planDialog();
          if (l) setPref({ sportDayMin: l });
        } }, 'Modifier le planning'));

    let today;
    if (st.targetSec > 0) {
      const leftToday = Math.max(0, st.targetSec - st.todaySec);
      today = h('div', null,
        h('p', { class: 'strong' }, 'Objectif d\'aujourd\'hui : ' + fmtMinutes(st.targetSec / 60)),
        progressBar(st.todaySec / st.targetSec, 'var(--primary)'),
        h('p', { class: leftToday > 0 ? 'muted small' : 'ok-text small' }, leftToday > 0 ? 'Reste aujourd\'hui : ' + fmtMinutes(minCeil(leftToday)) : 'Objectif du jour atteint !'));
    } else {
      today = h('p', { class: 'muted small' }, prefs.sportSplitCustom ? 'Jour de repos prévu aujourd\'hui' : 'Jour de repos : votre quota de séances de la semaine est atteint');
    }
    split = h('div', { class: 'stack' },
      h('div', { class: 'chips' },
        chip('Automatique', !prefs.sportSplitCustom, () => setPref({ sportSplitCustom: false })),
        chip('Personnalisée', prefs.sportSplitCustom, () => setPref({ sportSplitCustom: true }))),
      modeBlock, h('hr'), today);
  }
  const splitCard = card(null,
    cardTitle('calendar', 'Répartition par jour', 'Divise l\'objectif de la semaine en séances quotidiennes',
      toggle(prefs.sportSplit, (v) => setPref({ sportSplit: v }), 'Répartition par jour')),
    split);

  // ----- Aujourd'hui -----
  const todayCard = card(null,
    h('p', { class: 'muted' }, 'Sport d\'aujourd\'hui'),
    h('div', { class: 'big accent3' }, fmtDur(st.todaySec)),
    h('p', { class: 'muted' }, st.todayRecs.length === 0 ? 'Aucune séance pour l\'instant' : st.todayRecs.length === 1 ? '1 séance effectuée' : st.todayRecs.length + ' séances effectuées'),
    btn({ kind: 'tonal', icon: 'history', block: true, onClick: () => ctx.openHistory('sport') }, 'Historique'));

  return h('div', { class: 'grid' }, h('div', { class: 'col' }, ended, chrono, control), h('div', { class: 'col' }, goalCard, splitCard, todayCard));
}

