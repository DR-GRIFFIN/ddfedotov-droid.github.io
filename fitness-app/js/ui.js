// Small UI helpers shared by screens.
import { t } from './i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export const go = (path) => { location.hash = '#' + path; };

const ICONS = {
  today: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  program: '<path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/>',
  nutrition: '<path d="M7 3v8a3 3 0 0 0 3 3v7M10 3v6M4 3v6a3 3 0 0 0 3 3M17 21V3c-2 1-3 4-3 7s1 4 3 4"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  friends: '<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M18 15a6 6 0 0 1 4 5.5V21"/>',
  user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"/>',
};

export const icon = (name) =>
  `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`;

const TABS = [
  ['today', '/today', 'tabToday'],
  ['program', '/program', 'tabProgram'],
  ['nutrition', '/nutrition', 'tabNutrition'],
  ['progress', '/progress', 'tabProgress'],
  ['friends', '/friends', 'tabFriends'],
];

// Wraps a tab screen with the header and bottom navigation.
export function tabShell(active, title, body) {
  return `
    <header class="topbar">
      <h1>${esc(title)}</h1>
      <a class="avatar" href="#/profile" aria-label="${esc(t('profile'))}">${icon('user')}</a>
    </header>
    <main class="content">${body}</main>
    <nav class="tabbar">
      ${TABS.map(([id, path, label]) => `
        <a href="#${path}" class="${id === active ? 'active' : ''}" ${id === active ? 'aria-current="page"' : ''}>
          ${icon(id)}<span>${esc(t(label))}</span>
        </a>`).join('')}
    </nav>`;
}

let toastTimer;
export function toast(text) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// Bottom sheet built on <dialog>. Returns the dialog; content wires its own buttons.
export function sheet(innerHtml) {
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.innerHTML = innerHtml;
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  document.body.append(d);
  d.showModal();
  return d;
}

export const bar = (value, max) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}"><span style="width:${pct}%"></span></div>`;
};
