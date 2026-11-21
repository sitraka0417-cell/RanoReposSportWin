// Moteur des chronomètres : repos, séance de sport, rappels d'eau.
// Tout est basé sur l'heure de fin (horodatage) : exact même après une mise en veille.
import { prefs, setPref, addRepo, addWater, addSport, data, deleteRecord, emit } from './store.js';
import { fmtDur, startOfDay, addDays } from './util.js';
import { startAlarm, stopAlarm, playOnce, toast, attention } from './notify.js';

const K_RUN = 'rr_run';

const idleRest = () => ({ phase: 'IDLE', endAt: 0, totalMs: 0, auto: false, pauseSec: 0 });
const idleSport = () => ({ running: false, startAt: 0, estSec: 0, type: '' });

// État conservé entre les lancements
export const run = { rest: idleRest(), sport: idleSport() };
// État temporaire (non conservé)
export const live = { ringing: false, title: '', text: '', waterAlert: false, sportEnded: null };

function persist() {
  try {
    localStorage.setItem(K_RUN, JSON.stringify(run));
  } catch (e) { /* ignoré */ }
}

export function restore() {
  try {
    const r = JSON.parse(localStorage.getItem(K_RUN) || '{}');
    const phases = ['IDLE', 'PAUSE', 'WORK', 'WAIT_PAUSE', 'WAIT_WORK'];
    if (r.rest && phases.includes(r.rest.phase)) run.rest = Object.assign(idleRest(), r.rest);
    if (r.sport && r.sport.running) run.sport = Object.assign(idleSport(), r.sport);
  } catch (e) { /* démarrage à zéro */ }
}

function changed() {
  persist();
  emit('run');
}

// ---------- Alertes ----------
function ring(title, text) {
  live.ringing = true;
  live.title = title;
  live.text = text;
  startAlarm();
  toast(title, text);
  attention();
}

function ping(title, text) {
  playOnce();
  toast(title, text);
  attention();
}

export function dismissAlarm() {
  stopAlarm();
  live.ringing = false;
  emit('run');
}

// ---------- Repos ----------
function begin(phase, ms, auto, pauseSec) {
  stopAlarm();
  live.ringing = false;
  run.rest = { phase, endAt: Date.now() + ms, totalMs: ms, auto, pauseSec: pauseSec != null ? pauseSec : (run.rest.pauseSec || 0) };
  changed();
}

export function startPause(sec) {
  if (run.rest.phase !== 'IDLE') return;
  begin('PAUSE', sec * 1000, false, Math.round(sec));
}

export function startAuto() {
  if (run.rest.phase !== 'IDLE') return;
  begin('WORK', prefs.workSec * 1000, true, prefs.autoPauseSec);
}

export function nextStep() {
  const p = run.rest.phase;
  if (p === 'WAIT_PAUSE') begin('PAUSE', prefs.autoPauseSec * 1000, true, prefs.autoPauseSec);
  else if (p === 'WAIT_WORK') begin('WORK', prefs.workSec * 1000, true, prefs.autoPauseSec);
}

export function stopRest() {
  const r = run.rest;
  if (r.phase === 'PAUSE') {
    const startedAt = r.endAt - r.totalMs;
    const elapsed = Math.round((Math.min(Date.now(), r.endAt) - startedAt) / 1000);
    if (elapsed >= 5) addRepo(elapsed);
  }
  stopAlarm();
  live.ringing = false;
  run.rest = idleRest();
  changed();
}

function onRestEnd() {
  const r = run.rest;
  if (r.phase === 'WORK') {
    const text = 'Prenez ' + fmtDur(prefs.autoPauseSec) + ' de repos';
    if (prefs.autoConfirm) {
      run.rest = Object.assign({}, r, { phase: 'WAIT_PAUSE', endAt: 0, totalMs: 0 });
      changed();
      ring('Temps de pause', text);
    } else {
      ping('Temps de pause', text);
      begin('PAUSE', prefs.autoPauseSec * 1000, true, prefs.autoPauseSec);
    }
  } else if (r.phase === 'PAUSE') {
    addRepo(r.pauseSec || Math.round(r.totalMs / 1000));
    if (r.auto) {
      if (prefs.autoConfirm) {
        run.rest = Object.assign({}, r, { phase: 'WAIT_WORK', endAt: 0, totalMs: 0 });
        changed();
        ring('Repos terminé', 'Au travail maintenant');
      } else {
        ping('Repos terminé', 'Au travail maintenant');
        begin('WORK', prefs.workSec * 1000, true, prefs.autoPauseSec);
      }
    } else {
      run.rest = idleRest();
      changed();
      ring('Repos terminé', 'Au travail maintenant');
    }
  }
}

// ---------- Sport ----------
export function startSport(type, estSec) {
  if (run.sport.running) return;
  stopAlarm();
  live.sportEnded = null;
  run.sport = { running: true, startAt: Date.now(), estSec: estSec || 0, type };
  changed();
}

export function sportDue(now) {
  const s = run.sport;
  return s.running && s.estSec > 0 && now >= s.startAt + s.estSec * 1000;
}

export function completeSport(auto) {
  const s = run.sport;
  if (!s.running) return;
  let sec = Math.round((Date.now() - s.startAt) / 1000);
  if (auto && s.estSec > 0) sec = s.estSec;
  const type = s.type;
  run.sport = idleSport();
  if (sec >= 10) {
    addSport(sec, type);
    live.sportEnded = 'Séance enregistrée : ' + type + ', ' + fmtDur(sec);
  } else {
    live.sportEnded = 'Séance trop courte pour être enregistrée';
  }
  changed();
  if (auto) {
    startAlarm(12000);
    toast('Temps de sport écoulé', sec >= 10 ? 'Séance enregistrée : ' + type + ', ' + fmtDur(sec) : 'Séance trop courte');
    attention();
  }
}

export function abandonSport() {
  if (!run.sport.running) return;
  run.sport = idleSport();
  live.sportEnded = null;
  changed();
}

export function dismissSportEnded() {
  stopAlarm();
  live.sportEnded = null;
  emit('run');
}

// ---------- Eau ----------
export function todayWaters(now = Date.now()) {
  const from = startOfDay(now);
  const to = addDays(from, 1);
  return data.waters.filter((w) => w.ts >= from && w.ts < to).sort((a, b) => a.ts - b.ts);
}

export function drinkGlass() {
  stopAlarm();
  live.waterAlert = false;
  addWater();
  if (prefs.waterAuto) setPref({ waterNext: Date.now() + prefs.waterIntervalSec * 1000 });
  emit('run');
}

export function snoozeWater() {
  stopAlarm();
  live.waterAlert = false;
  setPref({ waterNext: Date.now() + 10 * 60 * 1000 });
  emit('run');
}

export function undoGlass() {
  const l = todayWaters();
  if (l.length) deleteRecord('waters', l[l.length - 1].id);
}

// ---------- Horloge ----------
export function tick(now = Date.now()) {
  const r = run.rest;
  if ((r.phase === 'PAUSE' || r.phase === 'WORK') && now >= r.endAt) onRestEnd();
  if (sportDue(now)) completeSport(true);
  if (prefs.waterAuto && prefs.waterNext > 0 && now >= prefs.waterNext && !live.waterAlert) {
    live.waterAlert = true;
    const cups = todayWaters(now).length;
    playOnce();
    toast('C\'est l\'heure de boire', 'Déjà ' + cups + ' sur ' + prefs.waterGoal + ' verres aujourd\'hui');
    attention();
    emit('run');
  }
}

// Texte affiché dans l'info-bulle de l'icône de la zone de notification
export function trayText(now = Date.now()) {
  const r = run.rest;
  const clock = (ms) => {
    const t = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(t / 60) + ' min ' + String(t % 60).padStart(2, '0') + ' s';
  };
  const parts = [];
  if (r.phase === 'PAUSE') parts.push('Repos : ' + clock(r.endAt - now));
  else if (r.phase === 'WORK') parts.push('Travail : ' + clock(r.endAt - now));
  else if (r.phase === 'WAIT_PAUSE') parts.push('Il est temps de faire une pause');
  else if (r.phase === 'WAIT_WORK') parts.push('Reprenez le travail');
  if (run.sport.running) {
    parts.push(run.sport.estSec > 0
      ? 'Sport : ' + clock(run.sport.startAt + run.sport.estSec * 1000 - now)
      : 'Sport : ' + clock(now - run.sport.startAt));
  }
  return parts.join(' · ');
}
