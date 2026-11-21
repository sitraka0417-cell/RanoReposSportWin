import { h, card, cardTitle, btn, chip, toggle, ring, icon, iconBtn, durationDialog, minutesDialog } from '../ui.js';
import { prefs, setPref } from '../store.js';
import { live, drinkGlass, snoozeWater, undoGlass, todayWaters } from '../engine.js';
import { fmtDur, fmtHour, fmtLitres } from '../util.js';

const CUPS = [125, 150, 200, 250, 300, 500];

export function waterScreen(ctx) {
  const list = todayWaters();
  const cups = list.length;
  const goal = prefs.waterGoal;

  const rg = ring({ size: 240, stroke: 16, progress: Math.min(1, cups / goal), colors: ['#4DB6FF', '#7CF5E0'] },
    h('div', { class: 'ring-time' }, cups + ' / ' + goal),
    h('div', { class: 'ring-sub' }, 'verres · ' + fmtLitres(cups, prefs.cupMl)));

  const alert = live.waterAlert
    ? card({ class: 'alert-card' },
      h('div', { class: 'alert-row' }, icon('drop', 28), h('div', null, h('h3', null, 'C\'est l\'heure de boire !'), h('p', { class: 'muted' }, 'Déjà ' + cups + ' sur ' + goal + ' verres aujourd\'hui'))),
      h('div', { class: 'btn-row' },
        btn({ kind: 'primary', icon: 'drop', onClick: drinkGlass }, 'J\'ai bu un verre'),
        btn({ kind: 'ghost', onClick: snoozeWater }, 'Plus tard (10 min)')))
    : null;

  const main = card({ class: 'center' },
    h('div', { class: 'ring-wrap' }, rg),
    cups >= goal ? h('p', { class: 'ok-text' }, 'Objectif atteint, bravo !') : h('p', { class: 'muted' }, 'Encore ' + (goal - cups) + ' verre' + (goal - cups > 1 ? 's' : '') + ' pour atteindre votre objectif'),
    h('div', { class: 'btn-col' },
      btn({ kind: 'primary', icon: 'drop', block: true, onClick: drinkGlass }, 'J\'ai bu un verre'),
      btn({ kind: 'ghost', block: true, disabled: cups === 0, onClick: undoGlass }, 'Annuler le dernier verre')));

  const todayCard = card(null,
    cardTitle('drop', 'Aujourd\'hui', cups === 0 ? 'Aucun verre enregistré pour l\'instant' : cups + ' verre' + (cups > 1 ? 's' : '') + ' bu' + (cups > 1 ? 's' : '')),
    cups ? h('div', { class: 'chips' }, list.map((w) => h('span', { class: 'tag' }, fmtHour(w.ts)))) : null,
    h('div', { class: 'spacer-sm' }),
    btn({ kind: 'tonal', icon: 'history', block: true, onClick: () => ctx.openHistory('water') }, 'Historique'));

  const goalCard = card(null,
    cardTitle('check', 'Objectif du jour', fmtLitres(goal, prefs.cupMl) + ' par jour'),
    h('div', { class: 'stepper' },
      iconBtn('remove', 'Un verre de moins', () => setPref({ waterGoal: goal - 1 })),
      h('div', { class: 'stepper-v' }, goal, h('span', null, ' verres')),
      iconBtn('add', 'Un verre de plus', () => setPref({ waterGoal: goal + 1 }))),
    h('p', { class: 'muted small' }, 'Taille d\'un verre'),
    h('div', { class: 'chips' },
      CUPS.map((ml) => chip(ml + ' ml', prefs.cupMl === ml, () => setPref({ cupMl: ml }))),
      !CUPS.includes(prefs.cupMl) ? chip(prefs.cupMl + ' ml', true, () => {}) : null,
      chip('Autre', false, async () => {
        const v = await minutesDialog('Taille d\'un verre', prefs.cupMl, { unit: 'ml', min: 20, max: 2000 });
        if (v != null) setPref({ cupMl: v });
      })));

  const next = prefs.waterAuto
    ? (prefs.waterNext > 0 ? 'Prochain rappel à ' + fmtHour(prefs.waterNext) : 'Touchez « J\'ai bu un verre » pour lancer le prochain rappel')
    : 'Une alarme sonne après chaque verre pour vous rappeler de boire.';
  const remind = card(null,
    cardTitle('bell', 'Rappels automatiques', 'Un rappel après chaque verre', toggle(prefs.waterAuto, (v) => setPref({ waterAuto: v, waterNext: v ? prefs.waterNext : 0 }), 'Rappels automatiques')),
    prefs.waterAuto ? h('div', { class: 'stack' },
      h('div', { class: 'kv' },
        h('div', null, h('div', { class: 'k' }, 'Intervalle entre deux rappels'), h('div', { class: 'v' }, fmtDur(prefs.waterIntervalSec))),
        btn({ kind: 'ghost', small: true, icon: 'edit', onClick: async () => {
          const s = await durationDialog('Intervalle entre deux rappels', prefs.waterIntervalSec);
          if (s != null) setPref({ waterIntervalSec: Math.max(60, s) });
        } }, 'Modifier')),
      h('p', { class: 'muted small' }, next)) : h('p', { class: 'muted' }, next));

  return h('div', { class: 'grid' }, h('div', { class: 'col' }, alert, main), h('div', { class: 'col' }, todayCard, goalCard, remind));
}
