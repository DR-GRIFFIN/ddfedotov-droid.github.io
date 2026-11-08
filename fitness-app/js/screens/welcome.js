import { t, getLang, setLang, LANGS } from '../i18n.js';
import { esc } from '../ui.js';
import { hasSupabase } from '../config.js';
import { startLocal, signInWithGoogle, signInWithEmail } from '../auth.js';
import { store } from '../store.js';

export function welcome(root, { rerender }) {
  const online = hasSupabase();
  root.innerHTML = `
    <main class="center-screen">
      <div class="lang-switch" role="group" aria-label="Language">
        ${LANGS.map((l) => `<button type="button" data-lang="${l}" class="chip ${l === getLang() ? 'on' : ''}">${l.toUpperCase()}</button>`).join('')}
      </div>
      <img src="icon.svg" alt="" class="logo" width="88" height="88">
      <h1 class="brand">${esc(t('appName'))}</h1>
      <p class="lead">${esc(t('tagline'))}</p>

      <div class="stack">
        <button type="button" class="btn" data-act="google" ${online ? '' : 'disabled'}>${esc(t('signInGoogle'))}</button>
        <form class="email-form stack" ${online ? '' : 'hidden'}>
          <input type="email" required placeholder="${esc(t('emailPlaceholder'))}" autocomplete="email" aria-label="Email">
          <button type="submit" class="btn secondary">${esc(t('sendLink'))}</button>
        </form>
        <button type="button" class="btn secondary" data-act="email" ${online ? 'hidden' : 'disabled'}>${esc(t('signInEmail'))}</button>
        <button type="button" class="btn ${online ? 'ghost' : ''}" data-act="local">${esc(t('continueLocal'))}</button>
        ${online ? '' : `<p class="muted small">${esc(t('localNote'))}</p>`}
        <p class="muted small form-msg" role="status"></p>
      </div>
    </main>`;

  root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    store.update((s) => { s.settings.lang = b.dataset.lang; });
    setLang(b.dataset.lang);
    rerender();
  }));

  const msg = root.querySelector('.form-msg');
  root.querySelector('[data-act="local"]').addEventListener('click', () => {
    startLocal();
    rerender();
  });
  root.querySelector('[data-act="google"]').addEventListener('click', () => {
    signInWithGoogle().catch(() => { msg.textContent = t('signInError'); });
  });
  root.querySelector('.email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = e.target.querySelector('input').value.trim();
    signInWithEmail(email)
      .then(() => { msg.textContent = t('linkSent', { email }); })
      .catch(() => { msg.textContent = t('signInError'); });
  });
}
