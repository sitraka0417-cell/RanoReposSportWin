// Réglages et historiques (stockés localement, synchronisés avec Firestore si connecté)
import { uuid } from './util.js';

const K_PREFS = 'rr_prefs';
const K_DATA = 'rr_data';

export const DEFAULT_MODELS = [300, 15];
export const DEFAULT_SPORTS = ['Marche rapide', 'Course'];

export const DEFAULTS = {
  theme: 'dark',
  models: DEFAULT_MODELS.slice(),
  selectedSec: 300,
  autoEnabled: false,
  workSec: 3600,
  autoPauseSec: 300,
  autoConfirm: true,
  waterGoal: 15,
  waterAuto: false,
  waterIntervalSec: 3600,
  cupMl: 125,
  waterNext: 0,
  sportGoalMin: 150,
  sportTypes: DEFAULT_SPORTS.slice(),
  sportSelected: 'Marche rapide',
  sportEstOn: false,
  sportEstMin: 15,
  sportSplit: false,
  sportSplitCustom: false,
  sportSplitDays: 5,
  sportDayMin: [0, 0, 0, 0, 0, 0, 0],
  pinHash: '',
  pinSalt: '',
  autoLockMin: 0,
  sound: true,
  volume: 0.8,
  bringFront: true
};

export const KINDS = ['repos', 'waters', 'sports'];

export const prefs = JSON.parse(JSON.stringify(DEFAULTS));
export const data = { repos: [], waters: [], sports: [] };

const listeners = new Set();
let hooks = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emit(kind) {
  listeners.forEach((fn) => {
    try {
      fn(kind);
    } catch (e) {
      console.error(e);
    }
  });
}
export function setSyncHooks(h) {
  hooks = h;
}

const clampInt = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

function sanitize(p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (!(k in DEFAULTS)) continue;
    const d = DEFAULTS[k];
    if (typeof d === 'boolean') out[k] = !!v;
    else if (typeof d === 'string') out[k] = String(v == null ? '' : v);
    else if (typeof d === 'number') out[k] = Number.isFinite(Number(v)) ? Number(v) : d;
    else out[k] = v;
  }
  if ('theme' in out && !['dark', 'light', 'special'].includes(out.theme)) out.theme = 'dark';
  if ('selectedSec' in out) out.selectedSec = clampInt(out.selectedSec, 1, 86399, 300);
  if ('workSec' in out) out.workSec = clampInt(out.workSec, 1, 86399, 3600);
  if ('autoPauseSec' in out) out.autoPauseSec = clampInt(out.autoPauseSec, 1, 86399, 300);
  if ('waterIntervalSec' in out) out.waterIntervalSec = clampInt(out.waterIntervalSec, 60, 86399, 3600);
  if ('waterGoal' in out) out.waterGoal = clampInt(out.waterGoal, 1, 40, 15);
  if ('cupMl' in out) out.cupMl = clampInt(out.cupMl, 20, 2000, 125);
  if ('sportGoalMin' in out) out.sportGoalMin = clampInt(out.sportGoalMin, 1, 5000, 150);
  if ('sportEstMin' in out) out.sportEstMin = clampInt(out.sportEstMin, 1, 1000, 15);
  if ('sportSplitDays' in out) out.sportSplitDays = clampInt(out.sportSplitDays, 1, 7, 5);
  if ('autoLockMin' in out) out.autoLockMin = clampInt(out.autoLockMin, 0, 240, 0);
  if ('volume' in out) out.volume = Math.min(1, Math.max(0, out.volume));
  if ('models' in out) {
    const l = (Array.isArray(out.models) ? out.models : []).map((n) => clampInt(n, 1, 86399, 0)).filter((n) => n > 0);
    out.models = l.length ? l : DEFAULT_MODELS.slice();
  }
  if ('sportTypes' in out) {
    const l = (Array.isArray(out.sportTypes) ? out.sportTypes : []).map((s) => String(s).trim()).filter(Boolean);
    out.sportTypes = l.length ? l : DEFAULT_SPORTS.slice();
  }
  if ('sportDayMin' in out) {
    const l = Array.isArray(out.sportDayMin) ? out.sportDayMin.map((n) => clampInt(n, 0, 1000, 0)) : [];
    out.sportDayMin = l.length === 7 ? l : [0, 0, 0, 0, 0, 0, 0];
  }
  return out;
}

function savePrefs() {
  try {
    localStorage.setItem(K_PREFS, JSON.stringify(prefs));
  } catch (e) { /* stockage plein ou indisponible */ }
}
function saveData() {
  try {
    localStorage.setItem(K_DATA, JSON.stringify(data));
  } catch (e) { /* stockage plein ou indisponible */ }
}

export function loadAll() {
  try {
    const p = JSON.parse(localStorage.getItem(K_PREFS) || '{}');
    Object.assign(prefs, sanitize(p));
  } catch (e) { /* valeurs par défaut */ }
  try {
    const d = JSON.parse(localStorage.getItem(K_DATA) || '{}');
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    data.repos = (d.repos || []).filter((r) => r && r.id && num(r.ts) && num(r.sec));
    data.waters = (d.waters || []).filter((r) => r && r.id && num(r.ts));
    data.sports = (d.sports || []).filter((r) => r && r.id && num(r.ts) && num(r.sec))
      .map((r) => ({ id: r.id, ts: r.ts, sec: r.sec, type: String(r.type || 'Sport') }));
  } catch (e) { /* aucune donnée */ }
}

export function setPref(patch) {
  Object.assign(prefs, sanitize(patch));
  savePrefs();
  emit('prefs');
}

// ----- Enregistrements -----
function add(kind, rec) {
  data[kind].push(rec);
  saveData();
  emit('data');
  if (hooks) hooks.upsert(kind, rec);
  return rec;
}

export const addRepo = (sec) => add('repos', { id: uuid(), ts: Date.now(), sec: Math.round(sec) });
export const addWater = () => add('waters', { id: uuid(), ts: Date.now() });
export const addSport = (sec, type) => add('sports', { id: uuid(), ts: Date.now(), sec: Math.round(sec), type: String(type || 'Sport') });

export function deleteRecord(kind, id) {
  const n = data[kind].length;
  data[kind] = data[kind].filter((r) => r.id !== id);
  if (data[kind].length === n) return;
  saveData();
  emit('data');
  if (hooks) hooks.remove(kind, id);
}

// Appelés par la synchronisation (pas de renvoi vers Firestore)
export function hasRecord(kind, id) {
  return data[kind].some((r) => r.id === id);
}
export function addRemote(kind, rec) {
  if (hasRecord(kind, rec.id)) return false;
  data[kind].push(rec);
  saveData();
  emit('data');
  return true;
}
export function removeRemote(kind, id) {
  const n = data[kind].length;
  data[kind] = data[kind].filter((r) => r.id !== id);
  if (data[kind].length === n) return false;
  saveData();
  emit('data');
  return true;
}

export function clearLocal() {
  data.repos = [];
  data.waters = [];
  data.sports = [];
  saveData();
  emit('data');
}

export function exportJson() {
  return JSON.stringify({ app: 'Rano & Repos & Sport', exportedAt: new Date().toISOString(), repos: data.repos, waters: data.waters, sports: data.sports }, null, 2);
}
