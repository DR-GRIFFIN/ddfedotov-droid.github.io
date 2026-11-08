// Weight entry sheet, shared by Today and Nutrition.
import { t } from '../i18n.js';
import { esc, sheet } from '../ui.js';
import { store } from '../store.js';
import { dateKey } from '../dates.js';

export function weightSheet(last, rerender) {
  const d = sheet(`
    <form method="dialog" class="stack">
      <h2>${esc(t('weightTitle'))}</h2>
      <label class="field">${esc(t('weight'))}, ${esc(t('kg'))}
        <input name="kg" type="number" inputmode="decimal" step="0.1" min="40" max="250" value="${last?.kg ?? ''}" required autofocus>
      </label>
      <p class="muted small">${esc(t('weightHint'))}</p>
      <div class="row2">
        <button type="button" class="btn ghost" value="cancel">${esc(t('cancel'))}</button>
        <button type="submit" class="btn">${esc(t('save'))}</button>
      </div>
    </form>`);
  d.querySelector('[value="cancel"]').addEventListener('click', () => d.close());
  d.querySelector('form').addEventListener('submit', (e) => {
    const kg = Number(String(e.target.kg.value).replace(',', '.'));
    if (!(kg >= 40 && kg <= 250)) {
      e.preventDefault();
      return;
    }
    const date = dateKey();
    store.update((s) => {
      s.weights = s.weights.filter((w) => w.date !== date);
      s.weights.push({ date, kg });
      if (s.profile) s.profile.weight = kg;
    });
    rerender();
  });
}
