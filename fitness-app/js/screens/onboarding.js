// Questionnaire: one question per screen, 8 steps.
import { t, weekdayShort } from '../i18n.js';
import { esc, go } from '../ui.js';
import { store } from '../store.js';
import { HEALTH_QUESTIONS, PAIN_ZONES, screen } from '../logic/screening.js';
import { recommend } from '../logic/recommend.js';
import { targets } from '../logic/nutrition.js';
import { dateKey } from '../dates.js';

export const TOTAL_STEPS = 8;

// Radio-style options as big cards.
const choice = (name, value, current, title, hint) => `
  <label class="option ${current === value ? 'on' : ''}">
    <input type="radio" name="${name}" value="${value}" ${current === value ? 'checked' : ''}>
    <span><b>${esc(t(title))}</b>${hint ? `<small>${esc(t(hint))}</small>` : ''}</span>
  </label>`;

const STEPS = {
  1: {
    title: 'q1Title',
    body: (a) => `
      <label class="field">${esc(t('name'))}
        <input name="name" autocomplete="given-name" maxlength="40" value="${esc(a.name ?? '')}" required>
      </label>
      <div class="row3">
        <label class="field">${esc(t('age'))}
          <input name="age" type="number" inputmode="numeric" min="16" max="80" value="${esc(a.age ?? '')}" required>
        </label>
        <label class="field">${esc(t('height'))}, ${esc(t('cm'))}
          <input name="height" type="number" inputmode="numeric" min="140" max="220" value="${esc(a.height ?? '')}" required>
        </label>
        <label class="field">${esc(t('weight'))}, ${esc(t('kg'))}
          <input name="weight" type="number" inputmode="decimal" step="0.1" min="40" max="250" value="${esc(a.weight ?? '')}" required>
        </label>
      </div>`,
    read(form) {
      const name = form.name.value.trim();
      const age = Number(form.age.value);
      const height = Number(form.height.value);
      const weight = Number(String(form.weight.value).replace(',', '.'));
      if (!name) return { error: 'errName' };
      if (!(age >= 16 && age <= 80)) return { error: 'errAge' };
      if (!(height >= 140 && height <= 220)) return { error: 'errHeight' };
      if (!(weight >= 40 && weight <= 250)) return { error: 'errWeight' };
      return { values: { name, age, height, weight } };
    },
  },
  2: {
    title: 'q2Title',
    body: (a) => [
      choice('experience', 'never', a.experience, 'expNever'),
      choice('experience', 'new', a.experience, 'expNew'),
      choice('experience', 'break', a.experience, 'expBreak'),
    ].join(''),
    read: (form) => (form.experience.value ? { values: { experience: form.experience.value } } : { error: 'q2Title' }),
  },
  3: {
    title: 'q3Title',
    body: (a) => [
      choice('goal', 'lose', a.goal, 'goalLose', 'goalLoseHint'),
      choice('goal', 'recomp', a.goal, 'goalRecomp', 'goalRecompHint'),
      choice('goal', 'gain', a.goal, 'goalGain', 'goalGainHint'),
      choice('goal', 'maintain', a.goal, 'goalMaintain', 'goalMaintainHint'),
    ].join(''),
    read: (form) => (form.goal.value ? { values: { goal: form.goal.value } } : { error: 'q3Title' }),
  },
  4: {
    title: 'q4Title',
    body: (a) => `
      <p class="label">${esc(t('q4Days'))}</p>
      <div class="chips">
        ${[1, 2, 3, 4, 5, 6, 7].map((d) => `
          <label class="chip ${a.days?.includes(d) ? 'on' : ''}">
            <input type="checkbox" name="days" value="${d}" ${a.days?.includes(d) ? 'checked' : ''}>${esc(weekdayShort(d))}
          </label>`).join('')}
      </div>
      <p class="label">${esc(t('q4Minutes'))}</p>
      <div class="chips">
        ${[30, 45, 60].map((m) => `
          <label class="chip ${a.minutes === m ? 'on' : ''}">
            <input type="radio" name="minutes" value="${m}" ${a.minutes === m ? 'checked' : ''}>${m} ${esc(t('min'))}
          </label>`).join('')}
      </div>`,
    read(form) {
      const days = [...form.querySelectorAll('[name="days"]:checked')].map((i) => Number(i.value));
      if (days.length < 2 || days.length > 4) return { error: 'errDays' };
      return { values: { days, minutes: Number(form.minutes.value || 60) } };
    },
  },
  5: {
    title: 'q5Title',
    body: (a) => [
      choice('where', 'gym', a.where, 'whereGym', 'whereGymHint'),
      choice('where', 'dumbbells', a.where, 'whereDb', 'whereDbHint'),
    ].join(''),
    read: (form) => (form.where.value ? { values: { where: form.where.value } } : { error: 'q5Title' }),
  },
  6: {
    title: 'q6Title',
    body: (a) => [
      choice('activity', 'low', a.activity, 'actLow', 'actLowHint'),
      choice('activity', 'mid', a.activity, 'actMid', 'actMidHint'),
      choice('activity', 'high', a.activity, 'actHigh', 'actHighHint'),
    ].join(''),
    read: (form) => (form.activity.value ? { values: { activity: form.activity.value } } : { error: 'q6Title' }),
  },
  7: {
    title: 'q7Title',
    hint: 'q7Hint',
    body: (a) => HEALTH_QUESTIONS.map((q) => `
      <fieldset class="yesno">
        <legend>${esc(t('hq_' + q))}</legend>
        <label class="chip ${a.health?.[q] === false ? 'on' : ''}"><input type="radio" name="${q}" value="no" ${a.health?.[q] === false ? 'checked' : ''}>${esc(t('no'))}</label>
        <label class="chip ${a.health?.[q] === true ? 'on' : ''}"><input type="radio" name="${q}" value="yes" ${a.health?.[q] === true ? 'checked' : ''}>${esc(t('yes'))}</label>
      </fieldset>`).join(''),
    read(form) {
      const health = {};
      for (const q of HEALTH_QUESTIONS) {
        const v = form[q].value;
        if (!v) return { error: 'hq_' + q };
        health[q] = v === 'yes';
      }
      return { values: { health } };
    },
  },
  8: {
    title: 'q8Title',
    hint: 'q8Hint',
    body: (a) => `
      <div class="chips">
        ${PAIN_ZONES.map((z) => `
          <label class="chip ${a.pain?.[z] != null ? 'on' : ''}">
            <input type="checkbox" name="zone" value="${z}" ${a.pain?.[z] != null ? 'checked' : ''}>${esc(t('zone_' + z))}
          </label>`).join('')}
      </div>
      <div class="pain-levels">
        ${PAIN_ZONES.filter((z) => a.pain?.[z] != null).map((z) => painSlider(z, a.pain[z])).join('')}
      </div>`,
    read(form) {
      const pain = {};
      form.querySelectorAll('[name="zone"]:checked').forEach((i) => {
        const slider = form.querySelector(`[name="pain_${i.value}"]`);
        pain[i.value] = slider ? Number(slider.value) : 3;
      });
      return { values: { pain } };
    },
  },
};

const painSlider = (zone, value) => `
  <label class="field slider" data-zone="${zone}">
    <span>${esc(t('zone_' + zone))} — <output>${esc(t('painLevel', { n: value }))}</output></span>
    <input type="range" name="pain_${zone}" min="0" max="10" step="1" value="${value}">
  </label>`;

export function onboarding(root, { params }) {
  const n = Math.min(TOTAL_STEPS, Math.max(1, Number(params[0]) || 1));
  const step = STEPS[n];
  const answers = store.get().onboarding.answers;

  root.innerHTML = `
    <main class="flow">
      <div class="progress-line" aria-hidden="true"><span style="width:${(n / TOTAL_STEPS) * 100}%"></span></div>
      <p class="muted small">${esc(t('stepOf', { n, total: TOTAL_STEPS }))}</p>
      <h1>${esc(t(step.title))}</h1>
      ${step.hint ? `<p class="muted">${esc(t(step.hint))}</p>` : ''}
      <form class="stack" novalidate>
        ${step.body(answers)}
        <p class="error" role="alert"></p>
        <div class="actions">
          ${n > 1 ? `<button type="button" class="btn ghost" data-act="back">${esc(t('back'))}</button>` : ''}
          <button type="submit" class="btn">${esc(t(n === TOTAL_STEPS ? 'done' : 'next'))}</button>
        </div>
      </form>
    </main>`;

  const form = root.querySelector('form');

  // Keep chip/option highlight in sync with inputs.
  form.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type === 'radio') {
      form.querySelectorAll(`[name="${input.name}"]`).forEach((r) => r.closest('label')?.classList.toggle('on', r.checked));
    }
    if (input.type === 'checkbox') input.closest('label')?.classList.toggle('on', input.checked);
    if (input.name === 'zone') {
      const box = form.querySelector('.pain-levels');
      const existing = box.querySelector(`[data-zone="${input.value}"]`);
      if (input.checked && !existing) box.insertAdjacentHTML('beforeend', painSlider(input.value, 3));
      if (!input.checked && existing) existing.remove();
    }
  });
  form.addEventListener('input', (e) => {
    if (e.target.type === 'range') {
      e.target.closest('label').querySelector('output').textContent = t('painLevel', { n: e.target.value });
    }
  });

  root.querySelector('[data-act="back"]')?.addEventListener('click', () => go(`/onboarding/${n - 1}`));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { values, error } = step.read(form);
    if (error) {
      form.querySelector('.error').textContent = t(error);
      return;
    }
    store.update((s) => {
      Object.assign(s.onboarding.answers, values);
      s.onboarding.step = Math.min(TOTAL_STEPS, n + 1);
    });
    if (n < TOTAL_STEPS) go(`/onboarding/${n + 1}`);
    else finish();
  });
}

// Turns answers into profile, health status and a draft plan.
function finish() {
  store.update((s) => {
    const a = s.onboarding.answers;
    s.profile = {
      name: a.name, age: a.age, height: a.height, weight: a.weight,
      experience: a.experience, activity: a.activity, where: a.where,
    };
    const result = screen(a);
    s.health = { blocked: result.blocked, reasons: result.reasons, clearedAt: null, answers: a.health, pain: a.pain };
    const rec = recommend(a);
    s.plan = {
      program: rec.program,
      recommended: rec.program,
      reasons: rec.reasons,
      goal: a.goal,
      days: a.days,
      minutes: a.minutes,
      targets: targets({ ...a }),
      confirmed: false,
      startedAt: null,
    };
    s.weights = [{ date: dateKey(), kg: a.weight }];
    s.onboarding.done = true;
  });
  go(store.get().health.blocked ? '/health-stop' : '/plan');
}
