// Sons (générés, aucun fichier audio) et notifications Windows
import { prefs } from './store.js';

let ctx = null;
let loop = null;
let loopStop = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function chime(volume) {
  const a = audio();
  if (!a) return;
  const vol = volume == null ? prefs.volume : volume;
  const t0 = a.currentTime + 0.02;
  [[659.25, 0], [880, 0.18], [1318.5, 0.36]].forEach(([f, dt]) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.5 * vol), t0 + dt + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.7);
    o.connect(g);
    g.connect(a.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.75);
  });
}

export function playOnce() {
  if (prefs.sound) chime();
}

export function startAlarm(maxMs = 45000) {
  stopAlarm();
  if (!prefs.sound) return;
  chime();
  loop = setInterval(chime, 2200);
  loopStop = setTimeout(stopAlarm, maxMs);
}

export function stopAlarm() {
  if (loop) clearInterval(loop);
  if (loopStop) clearTimeout(loopStop);
  loop = null;
  loopStop = null;
}

export function toast(title, body) {
  try {
    const n = new Notification(title, { body, silent: true });
    n.onclick = () => {
      if (window.api) window.api.focus();
    };
  } catch (e) { /* notifications indisponibles */ }
}

// Fait apparaître la fenêtre (ou la fait clignoter dans la barre des tâches)
export function attention() {
  if (window.api) window.api.alert(prefs.bringFront);
}
