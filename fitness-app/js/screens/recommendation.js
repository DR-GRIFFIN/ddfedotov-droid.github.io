// Plan recommendation after the questionnaire: program + nutrition targets.
import { t, tr } from '../i18n.js';
import { esc, go } from '../ui.js';
import { store } from '../store.js';
import { PROGRAMS, PROGRAM_BY_ID } from '../data/programs.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { dateKey } from '../dates.js';

const programCard = (p, selected, recommended) => `
  <label class="option program ${selected ? 'on' : ''}">
    <input type="radio" name="program" value="${p.id}" ${selected ? 'checked' : ''}>
    <span>
      <b>${esc(tr(p.name))}${recommended ? ` <em class="tag">${esc(t('recommended'))}</em>` : ''}</b>
      <small>${esc(tr(p.about))}</small>
      <small class="muted">${esc(t('perWeek', { n: p.perWeek }))} · ${esc(t('aboutMin', { n: p.minutes }))}</small>
    </span>
  </label>`;

export function recommendation(root) {
  const { plan } = store.get();
  const current = PROGRAM_BY_ID[plan.program];
  const preview = (current.workouts.A ?? []).map((s) => tr(EXERCISE_BY_ID[s.id]?.name)).join(', ');

  root.innerHTML = `
    <main class="flow">
      <h1>${esc(t('recTitle'))}</h1>

      <section class="card">
        <p class="label">${esc(t('recProgram'))}</p>
        <h2>${esc(tr(current.name))}</h2>
        <p class="muted">${esc(t('perWeek', { n: current.perWeek }))} · ${esc(t('aboutMin', { n: current.minutes }))}</p>
        <p class="small">A: ${esc(preview)}</p>
        ${plan.program === plan.recommended ? `
          <p class="label">${esc(t('recWhy'))}</p>
          <ul class="reasons">${(plan.reasons ?? []).map((r) => `<li>${esc(t(r))}</li>`).join('')}</ul>` : ''}
      </section>

      <details class="card other-programs">
        <summary>${esc(t('recOther'))}</summary>
        <div class="stack">
          ${PROGRAMS.map((p) => programCard(p, p.id === plan.program, p.id === plan.recommended)).join('')}
        </div>
      </details>

      <form class="card stack nutrition-form">
        <p class="label">${esc(t('recNutrition'))}</p>
        <div class="row2">
          <label class="field">${esc(t('kcal'))}
            <input name="kcal" type="number" inputmode="numeric" min="1200" max="5000" step="50" value="${plan.targets.kcal}">
          </label>
          <label class="field">${esc(t('protein'))}, ${esc(t('g'))}
            <input name="protein" type="number" inputmode="numeric" min="50" max="350" step="5" value="${plan.targets.protein}">
          </label>
        </div>
        <p class="muted small">${esc(t('recNutritionHint'))}</p>
        <button type="submit" class="btn">${esc(t('recStart'))}</button>
      </form>
    </main>`;

  root.querySelectorAll('[name="program"]').forEach((r) => r.addEventListener('change', () => {
    store.update((s) => { s.plan.program = r.value; });
    recommendation(root);
    root.querySelector('.other-programs').open = true;
  }));

  root.querySelector('.nutrition-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const kcal = Number(f.kcal.value);
    const protein = Number(f.protein.value);
    store.update((s) => {
      if (kcal >= 1200 && kcal <= 5000) s.plan.targets.kcal = kcal;
      if (protein >= 50 && protein <= 350) s.plan.targets.protein = protein;
      s.plan.confirmed = true;
      s.plan.startedAt = s.plan.startedAt ?? dateKey();
    });
    go('/today');
  });
}
