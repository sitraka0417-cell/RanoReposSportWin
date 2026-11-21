// Outils purs : dates, durées, formats (testés hors navigateur)

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const PERIODS = [
  { id: 'DAY', label: 'Jour' },
  { id: 'WEEK', label: 'Semaine' },
  { id: 'MONTH', label: 'Mois' },
  { id: 'YEAR', label: 'Année' }
];

export const localDate = (y, m, d, h = 0) => new Date(y, m, d, h, 0, 0, 0).getTime();

export function startOfDay(ms) {
  const d = new Date(ms);
  return localDate(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(ms, n) {
  const d = new Date(ms);
  return localDate(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Lundi 00:00 de la semaine contenant ms
export function mondayOf(ms) {
  const d = new Date(startOfDay(ms));
  const wd = (d.getDay() + 6) % 7;
  return addDays(d.getTime(), -wd);
}

// Index du jour de la semaine : 0 = lundi … 6 = dimanche
export function weekdayIndex(ms) {
  return (new Date(ms).getDay() + 6) % 7;
}

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h) parts.push(h + ' h');
  if (m) parts.push(m + ' min');
  if (s || parts.length === 0) parts.push(s + ' s');
  return parts.join(' ');
}

export function fmtMinutes(min) {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return h + ' h ' + m + ' min';
  if (h > 0) return h + ' h';
  return m + ' min';
}

const p2 = (n) => String(n).padStart(2, '0');

// Compte à rebours : arrondi à la seconde supérieure
export function fmtClock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? h + ':' + p2(m) + ':' + p2(s) : p2(m) + ':' + p2(s);
}

// Chronomètre : seconde écoulée entière
export function fmtElapsed(ms) {
  return fmtClock(Math.floor(Math.max(0, ms) / 1000) * 1000);
}

export function fmtHour(ts) {
  const d = new Date(ts);
  return p2(d.getHours()) + ':' + p2(d.getMinutes());
}

export function fmtDay(ms) {
  return cap(new Date(ms).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function fmtLitres(cups, cupMl) {
  return (cups * cupMl / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';
}

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const out = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(out)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Période affichée dans l'historique
export function rangeFor(period, offset, now = Date.now()) {
  const nd = new Date(now);
  if (period === 'DAY') {
    const from = addDays(startOfDay(now), offset);
    const d = new Date(from);
    const buckets = [];
    for (let h = 0; h < 24; h++) {
      buckets.push({
        label: h % 3 === 0 ? String(h) : '',
        from: localDate(d.getFullYear(), d.getMonth(), d.getDate(), h),
        to: localDate(d.getFullYear(), d.getMonth(), d.getDate(), h + 1)
      });
    }
    const label = offset === 0 ? 'Aujourd\'hui' : offset === -1 ? 'Hier' : fmtDay(from);
    return { from, to: addDays(from, 1), label, buckets, unit: 'heure' };
  }
  if (period === 'WEEK') {
    const from = addDays(mondayOf(now), offset * 7);
    const letters = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const buckets = letters.map((l, i) => ({ label: l, from: addDays(from, i), to: addDays(from, i + 1) }));
    const to = addDays(from, 7);
    const f = (ms) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const label = offset === 0 ? 'Cette semaine' : f(from) + ' – ' + f(addDays(to, -1));
    return { from, to, label, buckets, unit: 'jour' };
  }
  if (period === 'MONTH') {
    const first = new Date(nd.getFullYear(), nd.getMonth() + offset, 1);
    const y = first.getFullYear();
    const m = first.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const buckets = [];
    for (let d = 1; d <= days; d++) {
      buckets.push({ label: d === 1 || d % 5 === 0 ? String(d) : '', from: localDate(y, m, d), to: localDate(y, m, d + 1) });
    }
    const label = cap(first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
    return { from: localDate(y, m, 1), to: localDate(y, m + 1, 1), label, buckets, unit: 'jour' };
  }
  const y = nd.getFullYear() + offset;
  const letters = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const buckets = letters.map((l, i) => ({ label: l, from: localDate(y, i, 1), to: localDate(y, i + 1, 1) }));
  return { from: localDate(y, 0, 1), to: localDate(y + 1, 0, 1), label: String(y), buckets, unit: 'mois' };
}

// Somme des valeurs par intervalle
export function bucketize(entries, buckets) {
  return buckets.map((b) => entries.reduce((s, e) => (e.ts >= b.from && e.ts < b.to ? s + e.value : s), 0));
}
