// Composants d'interface (DOM natif, sans framework)

const SVG_NS = 'http://www.w3.org/2000/svg';

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') {
        el[k] = v;
        continue;
      }
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, kids);
  return el;
}

export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  append(el, kids);
  return el;
}

const ICONS = {
  timer: 'M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z',
  drop: 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z',
  fitness: 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  remove: 'M19 13H5v-2h14v2z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  trash: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  left: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  right: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  history: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  calendar: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z',
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  google: 'M21.35 11.1H12v2.9h5.35c-.5 2.4-2.55 3.5-5.35 3.5a6 6 0 010-12c1.5 0 2.85.55 3.9 1.45l2.1-2.1A9 9 0 003 12a9 9 0 009 9c5.2 0 8.6-3.65 8.6-8.8 0-.6-.05-1.05-.25-1.1z'
};

export function icon(name, size = 20) {
  return svg('svg', { class: 'icon', viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' },
    svg('path', { d: ICONS[name] || ICONS.info, fill: 'currentColor' }));
}

// ----- Éléments de base -----
export function card(opts, ...kids) {
  const o = opts || {};
  return h('section', { class: 'card' + (o.class ? ' ' + o.class : ''), id: o.id }, kids);
}

export function cardTitle(iconName, title, sub, right) {
  return h('div', { class: 'card-head' },
    iconName ? h('div', { class: 'card-ico' }, icon(iconName, 22)) : null,
    h('div', { class: 'card-titles' }, h('h3', null, title), sub ? h('p', { class: 'muted' }, sub) : null),
    right || null);
}

export function btn(opts, ...label) {
  const o = opts || {};
  return h('button', {
    type: 'button',
    class: 'btn ' + (o.kind || 'tonal') + (o.block ? ' block' : '') + (o.small ? ' small' : ''),
    disabled: !!o.disabled,
    title: o.title,
    onClick: o.onClick
  }, o.icon ? icon(o.icon, o.small ? 16 : 20) : null, label.length ? h('span', null, label) : null);
}

export function iconBtn(iconName, title, onClick, kind = '') {
  return h('button', { type: 'button', class: 'icon-btn ' + kind, title, 'aria-label': title, onClick }, icon(iconName, 20));
}

export function chip(label, selected, onClick, opts) {
  const o = opts || {};
  return h('button', {
    type: 'button',
    class: 'chip' + (selected ? ' on' : ''),
    'aria-pressed': selected ? 'true' : 'false',
    disabled: !!o.disabled,
    onClick
  }, label);
}

export function toggle(checked, onChange, label) {
  const input = h('input', { type: 'checkbox', checked: !!checked, 'aria-label': label || 'Activer', onChange: (e) => onChange(e.target.checked) });
  return h('label', { class: 'switch' }, input, h('span', { class: 'slider' }));
}

export function progressBar(frac, color) {
  const fill = h('div', { class: 'bar-fill', style: { width: Math.round(Math.min(1, Math.max(0, frac)) * 100) + '%', background: color || 'var(--primary)' } });
  const el = h('div', { class: 'bar', role: 'progressbar' }, fill);
  el.set = (f) => { fill.style.width = Math.round(Math.min(1, Math.max(0, f)) * 100) + '%'; };
  return el;
}

export function ring(opts, ...content) {
  const o = Object.assign({ size: 240, stroke: 16, progress: 1, colors: ['#4DB6FF', '#2EE6B6'] }, opts);
  const box = 100;
  const r = (box - o.stroke * box / o.size) / 2;
  const sw = o.stroke * box / o.size;
  const c = 2 * Math.PI * r;
  const gid = 'rg' + Math.random().toString(36).slice(2, 8);
  const arc = svg('circle', {
    class: 'ring-arc', cx: 50, cy: 50, r, fill: 'none', stroke: 'url(#' + gid + ')', 'stroke-width': sw,
    'stroke-linecap': 'round', 'stroke-dasharray': c, 'stroke-dashoffset': c * (1 - Math.min(1, Math.max(0, o.progress))),
    transform: 'rotate(-90 50 50)'
  });
  const el = h('div', { class: 'ring', style: { '--size': o.size + 'px' } },
    svg('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      svg('defs', null, svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 1, y2: 1 },
        svg('stop', { offset: '0%', 'stop-color': o.colors[0] }), svg('stop', { offset: '100%', 'stop-color': o.colors[1] }))),
      svg('circle', { class: 'ring-track', cx: 50, cy: 50, r, fill: 'none', 'stroke-width': sw }),
      arc),
    h('div', { class: 'ring-content' }, content));
  el.setProgress = (p) => arc.setAttribute('stroke-dashoffset', String(c * (1 - Math.min(1, Math.max(0, p)))));
  return el;
}

export function barChart(buckets, values, color, fmtVal) {
  const max = Math.max(...values, 1);
  const wrap = h('div', { class: 'bars', style: { '--n': values.length } });
  values.forEach((v, i) => {
    wrap.append(h('div', { class: 'bar-col', title: fmtVal(v) },
      h('div', { class: 'bar-track' },
        h('div', { class: 'bar-v', style: { height: v > 0 ? Math.max(4, (v / max) * 100) + '%' : '0', background: color } })),
      h('div', { class: 'bar-label' }, buckets[i].label)));
  });
  return wrap;
}

export function section(title) {
  return h('h4', { class: 'section-title' }, title);
}

// ----- Dialogues -----
export function modal({ title, body, actions, wide }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'modal' + (wide ? ' wide' : '') });
    const finish = (v) => {
      if (dlg.open) dlg.close();
      dlg.remove();
      resolve(v);
    };
    const foot = h('div', { class: 'modal-actions' }, actions.map((a) => h('button', {
      type: 'button',
      class: 'btn ' + (a.kind || 'ghost'),
      onClick: () => {
        const v = typeof a.run === 'function' ? a.run() : a.value;
        if (v !== undefined) finish(v);
      }
    }, a.label)));
    dlg.append(h('div', { class: 'modal-box' }, h('h2', null, title), h('div', { class: 'modal-body' }, body), foot));
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish(null);
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) finish(null);
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
        const p = dlg.querySelector('.btn.primary');
        if (p) p.click();
      }
    });
    document.getElementById('dialogs').append(dlg);
    dlg.showModal();
    const first = dlg.querySelector('input:not([type=checkbox])');
    if (first) {
      first.focus();
      if (first.select) first.select();
    }
  });
}

export async function confirmDialog(title, text, okLabel, danger = true) {
  const r = await modal({
    title,
    body: h('p', null, text),
    actions: [
      { label: 'Annuler', kind: 'ghost', value: false },
      { label: okLabel || 'Confirmer', kind: danger ? 'danger' : 'primary', value: true }
    ]
  });
  return r === true;
}

const numInput = (value, max, label) => h('label', { class: 'num' },
  h('input', { type: 'number', min: 0, max, value: String(value), inputmode: 'numeric', 'aria-label': label }),
  h('span', null, label));

// Durée en heures / minutes / secondes → retourne des secondes (ou null)
export function durationDialog(title, initialSec) {
  const hh = numInput(Math.floor(initialSec / 3600), 23, 'h');
  const mm = numInput(Math.floor((initialSec % 3600) / 60), 59, 'min');
  const ss = numInput(initialSec % 60, 59, 's');
  const err = h('p', { class: 'error', role: 'alert' });
  const val = (n) => Math.max(0, Math.floor(Number(n.querySelector('input').value) || 0));
  return modal({
    title,
    body: h('div', null, h('div', { class: 'num-row' }, hh, mm, ss), err),
    actions: [
      { label: 'Annuler', kind: 'ghost', value: null },
      {
        label: 'Valider', kind: 'primary',
        run: () => {
          const sec = Math.min(86399, val(hh) * 3600 + val(mm) * 60 + val(ss));
          if (sec <= 0) {
            err.textContent = 'Entrez une durée supérieure à zéro.';
            return undefined;
          }
          return sec;
        }
      }
    ]
  });
}

export function minutesDialog(title, initial, opts) {
  const o = Object.assign({ hint: '', unit: 'min', min: 1, max: 5000 }, opts);
  const input = h('input', { type: 'number', min: o.min, max: o.max, value: String(initial), inputmode: 'numeric', 'aria-label': o.unit });
  const err = h('p', { class: 'error', role: 'alert' });
  return modal({
    title,
    body: h('div', null, o.hint ? h('p', { class: 'muted' }, o.hint) : null, h('label', { class: 'num wide' }, input, h('span', null, o.unit)), err),
    actions: [
      { label: 'Annuler', kind: 'ghost', value: null },
      {
        label: 'Valider', kind: 'primary',
        run: () => {
          const n = Math.floor(Number(input.value) || 0);
          if (n < o.min || n > o.max) {
            err.textContent = 'Entrez un nombre entre ' + o.min + ' et ' + o.max + '.';
            return undefined;
          }
          return n;
        }
      }
    ]
  });
}

// Saisie d'un nom + option « ajouter à ma liste » → { value, save } ou null
export function nameDialog(title, label, saveLabel) {
  const input = h('input', { type: 'text', maxlength: 30, placeholder: label, 'aria-label': label });
  const save = h('input', { type: 'checkbox', checked: true });
  const err = h('p', { class: 'error', role: 'alert' });
  return modal({
    title,
    body: h('div', null,
      h('label', { class: 'field' }, h('span', null, label), input),
      h('label', { class: 'check' }, save, h('span', null, saveLabel)), err),
    actions: [
      { label: 'Annuler', kind: 'ghost', value: null },
      {
        label: 'Valider', kind: 'primary',
        run: () => {
          const v = input.value.trim();
          if (!v) {
            err.textContent = 'Entrez un nom.';
            return undefined;
          }
          return { value: v, save: save.checked };
        }
      }
    ]
  });
}

export function toastMsg(text) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: 'toast', role: 'status' }, text);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}
