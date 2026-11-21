import { h, card, btn, chip, iconBtn, barChart, icon, confirmDialog } from '../ui.js';
import { data, prefs, deleteRecord } from '../store.js';
import { PERIODS, rangeFor, bucketize, fmtDur, fmtHour, fmtDay, fmtLitres, startOfDay } from '../util.js';

const hist = { kind: '', period: 'DAY', offset: 0, detail: false };
const KIND = { repo: 'repos', water: 'waters', sport: 'sports' };
const TITLE = { repo: 'Historique des repos', water: 'Historique de l\'eau', sport: 'Historique du sport' };
const COLOR = { repo: 'var(--secondary)', water: 'var(--primary)', sport: 'var(--tertiary)' };

export function historyScreen(ctx, kind) {
  if (hist.kind !== kind) Object.assign(hist, { kind, period: 'DAY', offset: 0, detail: false });
  const isWater = kind === 'water';
  const isSport = kind === 'sport';

  const all = kind === 'repo'
    ? data.repos.map((r) => ({ id: r.id, ts: r.ts, value: r.sec, label: '' }))
    : isSport
      ? data.sports.map((r) => ({ id: r.id, ts: r.ts, value: r.sec, label: r.type }))
      : data.waters.map((r) => ({ id: r.id, ts: r.ts, value: 1, label: '' }));

  const rg = rangeFor(hist.period, hist.offset);
  const entries = all.filter((e) => e.ts >= rg.from && e.ts < rg.to).sort((a, b) => a.ts - b.ts);
  const total = entries.reduce((s, e) => s + e.value, 0);
  const fmtVal = (v) => (isWater ? v + ' verre' + (v > 1 ? 's' : '') : fmtDur(v));
  const color = COLOR[kind];
  const set = (patch) => {
    Object.assign(hist, patch);
    ctx.render();
  };

  // ----- Barre de navigation -----
  const head = h('div', { class: 'hist-head' },
    btn({ kind: 'ghost', icon: 'left', onClick: ctx.closeHistory }, 'Retour'),
    h('h2', null, TITLE[kind]));

  const periods = h('div', { class: 'chips' }, PERIODS.map((p) => chip(p.label, hist.period === p.id, () => set({ period: p.id, offset: 0 }))));
  const nav = h('div', { class: 'range-nav' },
    iconBtn('left', 'Période précédente', () => set({ offset: hist.offset - 1 })),
    h('div', { class: 'range-label' }, rg.label),
    iconBtn('right', 'Période suivante', () => (hist.offset < 0 ? set({ offset: hist.offset + 1 }) : null), hist.offset >= 0 ? 'disabled' : ''));

  // ----- Total -----
  let totalBody;
  if (isWater) {
    totalBody = [h('div', { class: 'big accent1' }, fmtVal(total)), h('p', { class: 'muted' }, 'soit environ ' + fmtLitres(total, prefs.cupMl))];
  } else if (isSport) {
    const byType = new Map();
    entries.forEach((e) => byType.set(e.label, (byType.get(e.label) || 0) + e.value));
    totalBody = [
      h('div', { class: 'big accent3' }, fmtDur(total)),
      h('p', { class: 'muted' }, entries.length === 1 ? '1 séance' : entries.length + ' séances'),
      hist.period === 'WEEK' ? h('p', { class: 'muted small' }, 'Objectif de la semaine : ' + fmtDur(prefs.sportGoalMin * 60)) : null,
      [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => h('p', { class: 'muted small' }, n + ' : ' + fmtDur(v)))
    ];
  } else {
    totalBody = [h('div', { class: 'big accent2' }, fmtDur(total)), h('p', { class: 'muted' }, entries.length + ' repos')];
  }
  const totalCard = card(null, h('p', { class: 'muted' }, 'Total · ' + rg.label), totalBody);

  // ----- Graphique -----
  const values = bucketize(entries, rg.buckets);
  const chart = card(null, barChart(rg.buckets, values, color, (v) => (v > 0 ? fmtVal(v) : 'Aucune donnée')));

  // ----- Liste -----
  const del = (e) => async () => {
    if (await confirmDialog('Supprimer cet élément ?', fmtDay(e.ts) + ' à ' + fmtHour(e.ts), 'Supprimer')) deleteRecord(KIND[kind], e.id);
  };
  const row = (e) => h('li', { class: 'hrow' },
    h('span', { class: 'hrow-t' }, fmtHour(e.ts)),
    h('span', { class: 'hrow-v' }, isSport ? e.label + ' · ' + fmtDur(e.value) : isWater ? '1 verre (' + prefs.cupMl + ' ml)' : fmtDur(e.value)),
    iconBtn('trash', 'Supprimer', del(e), 'danger'));

  let list;
  if (entries.length === 0) {
    list = h('p', { class: 'muted center-text' }, 'Aucune donnée sur cette période.');
  } else if (hist.period === 'DAY') {
    list = h('ul', { class: 'hlist' }, entries.map(row));
  } else {
    const groups = new Map();
    entries.forEach((e) => {
      const k = startOfDay(e.ts);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    });
    const days = [...groups.entries()].sort((a, b) => b[0] - a[0]);
    list = h('div', null,
      h('div', { class: 'row-actions' },
        h('span', { class: 'muted small' }, 'Par jour'),
        btn({ kind: 'ghost', small: true, onClick: () => set({ detail: !hist.detail }) }, hist.detail ? 'Masquer le détail' : 'Afficher le détail')),
      days.map(([day, l]) => {
        const sum = l.reduce((s, e) => s + e.value, 0);
        return h('div', { class: 'hday' },
          h('div', { class: 'hday-head' }, h('span', null, fmtDay(day)), h('b', { style: { color } }, fmtVal(sum))),
          hist.detail ? h('ul', { class: 'hlist' }, l.map(row)) : null);
      }));
  }
  const listCard = card(null, list);

  return h('div', { class: 'history' }, head, h('div', { class: 'hist-controls' }, periods, nav), h('div', { class: 'grid' }, h('div', { class: 'col' }, totalCard, chart), h('div', { class: 'col' }, listCard)));
}
