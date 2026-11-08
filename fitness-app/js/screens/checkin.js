// Check-in before a workout (screen 4.1): 4 quick questions, then the adjusted plan.
import { t, tr } from '../i18n.js';
import { esc, go, sheet } from '../ui.js';
import { store } from '../store.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { PAIN_ZONES } from '../logic/screening.js';
import { buildWorkout, STOP_PAIN } from '../logic/workout.js';

const exName = (id) => tr(EXERCISE_BY_ID[id]?.name);

export const adjustmentText = (a) => t(a.k, { a: exName(a.ids?.[0]), b: exName(a.ids?.[1]) });

const radios = (name, values, current, label) => `
  <div class="chips">
    ${values.map((v) => `
      <label class="chip ${v === current ? 'on' : ''}">
        <input type="radio" name="${name}" value="${v}" ${v === current ? 'checked' : ''}>${esc(label(v))}
      </label>`).join('')}
  </div>`;

const FEEL_ICON = { bad: '😫', meh: '😐', ok: '🙂', great: '💪' };

function begin(workout) {
  store.update((s) => { s.active = workout; });
  go('/workout');
}

export function openCheckin(mode = 'normal') {
  const d = sheet(`
    <form class="stack checkin">
      <h2>${esc(t('ciTitle'))}</h2>
      <p class="label">${esc(t('ciFeel'))}</p>
      ${radios('feel', ['bad', 'meh', 'ok', 'great'], 'ok', (v) => `${FEEL_ICON[v]} ${t('feel_' + v)}`)}
      <p class="label">${esc(t('ciSleep'))}</p>
      ${radios('sleep', ['bad', 'ok', 'good'], 'ok', (v) => t('sleep_' + v))}
      <label class="field slider">
        <span><output>${esc(t('ciPain', { n: 0 }))}</output></span>
        <input type="range" name="pain" min="0" max="10" step="1" value="0">
      </label>
      <div class="zones" hidden>
        <p class="label">${esc(t('ciWhere'))}</p>
        <div class="chips">
          ${PAIN_ZONES.map((z) => `<label class="chip"><input type="checkbox" name="zone" value="${z}">${esc(t('zone_' + z))}</label>`).join('')}
        </div>
      </div>
      ${mode === 'easy' ? '' : `<p class="label">${esc(t('ciTime'))}</p>${radios('time', ['plan', 'short'], 'plan', (v) => t('time_' + v))}`}
      <div class="row2">
        <button type="button" class="btn ghost" data-act="cancel">${esc(t('cancel'))}</button>
        <button type="submit" class="btn">${esc(t('ciNext'))}</button>
      </div>
    </form>`);

  const form = d.querySelector('form');
  const zones = form.querySelector('.zones');
  form.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type === 'radio') {
      form.querySelectorAll(`[name="${input.name}"]`).forEach((r) => r.closest('label').classList.toggle('on', r.checked));
    }
    if (input.type === 'checkbox') input.closest('label').classList.toggle('on', input.checked);
  });
  form.pain.addEventListener('input', () => {
    form.querySelector('output').textContent = t('ciPain', { n: form.pain.value });
    zones.hidden = Number(form.pain.value) === 0;
  });
  form.querySelector('[data-act="cancel"]').addEventListener('click', () => d.close());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const checkin = {
      feel: form.feel.value,
      sleep: form.sleep.value,
      pain: Number(form.pain.value),
      zones: [...form.querySelectorAll('[name="zone"]:checked')].map((i) => i.value),
      time: form.time?.value ?? 'plan',
    };

    if (checkin.pain >= STOP_PAIN) {
      d.innerHTML = `
        <div class="stack">
          <div class="badge warn" aria-hidden="true">!</div>
          <h2>${esc(t('ciStopTitle'))}</h2>
          <p>${esc(t('ciStopText', { n: checkin.pain }))}</p>
          <button type="button" class="btn" data-act="close">${esc(t('close'))}</button>
        </div>`;
      d.querySelector('[data-act="close"]').addEventListener('click', () => d.close());
      return;
    }

    const state = store.get();
    const adjusted = buildWorkout(state, { mode, checkin });
    if (adjusted.adjustments.length === 0) {
      d.close();
      begin(adjusted);
      return;
    }
    d.innerHTML = `
      <div class="stack">
        <h2>${esc(t('ciChanged'))}</h2>
        <ul class="reasons">${adjusted.adjustments.map((a) => `<li>${esc(adjustmentText(a))}</li>`).join('')}</ul>
        <button type="button" class="btn" data-act="ok">${esc(t('ciOk'))}</button>
        <button type="button" class="btn ghost" data-act="plan">${esc(t('ciAsPlanned'))}</button>
      </div>`;
    d.querySelector('[data-act="ok"]').addEventListener('click', () => { d.close(); begin(adjusted); });
    d.querySelector('[data-act="plan"]').addEventListener('click', () => {
      d.close();
      // Saved swaps and comeback mode still apply; today's check-in adjustments are skipped.
      const plain = buildWorkout(store.get(), { mode });
      plain.checkin = { ...checkin, declined: true };
      begin(plain);
    });
  });
}
