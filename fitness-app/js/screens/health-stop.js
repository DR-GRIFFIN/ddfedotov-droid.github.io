// Shown when screening finds a reason to see a doctor first.
import { t } from '../i18n.js';
import { esc, go } from '../ui.js';
import { store } from '../store.js';

export function healthStop(root) {
  const { reasons = [] } = store.get().health;
  const next = store.get().plan?.confirmed ? '/today' : '/plan';

  root.innerHTML = `
    <main class="flow">
      <div class="badge warn" aria-hidden="true">!</div>
      <h1>${esc(t('stopTitle'))}</h1>
      <p>${esc(t('stopText'))}</p>
      <section class="card">
        <p class="label">${esc(t('stopBecause'))}</p>
        <ul class="reasons">
          ${reasons.map((r) => `<li>${esc(r.type === 'health'
            ? t('hq_' + r.key).replace(/\?$/, '')
            : t('stopPain', { zone: t('zone_' + r.key), n: r.level }))}</li>`).join('')}
        </ul>
      </section>
      <form class="stack">
        <label class="check">
          <input type="checkbox" name="confirm">
          <span>${esc(t('stopConfirm'))}</span>
        </label>
        <button type="submit" class="btn" disabled>${esc(t('stopCleared'))}</button>
        <button type="button" class="btn ghost" data-act="later">${esc(t('stopLater'))}</button>
        <p class="muted small">${esc(t('stopNutrition'))}</p>
      </form>
    </main>`;

  const form = root.querySelector('form');
  const submit = form.querySelector('[type="submit"]');
  form.confirm.addEventListener('change', () => { submit.disabled = !form.confirm.checked; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.confirm.checked) return;
    store.update((s) => { s.health.clearedAt = new Date().toISOString(); });
    go(next);
  });
  root.querySelector('[data-act="later"]').addEventListener('click', () => go(next));
}
