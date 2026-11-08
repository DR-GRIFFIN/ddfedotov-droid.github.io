// Today: week goal, comebacks, card of the day, nutrition summary.
import { t, tr, weekdayLong } from '../i18n.js';
import { esc, go, tabShell, toast, sheet, bar } from '../ui.js';
import { store } from '../store.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { dateKey } from '../dates.js';
import {
  todayCard, weekProgress, countComebacks, pendingMorningCheck, nutritionToday, latestWeight,
} from '../logic/today.js';

const exerciseList = (workout) => workout.map((s) => tr(EXERCISE_BY_ID[s.id]?.name)).join(', ');

function dayCard(card, state) {
  switch (card.kind) {
    case 'blocked':
      return `
        <section class="card day warn">
          <h2>${esc(t('blockedTitle'))}</h2>
          <p>${esc(t('blockedText'))}</p>
          <button type="button" class="btn secondary" data-go="/health-stop">${esc(t('blockedOpen'))}</button>
        </section>`;
    case 'done':
      return `
        <section class="card day ok">
          <h2>${esc(t('doneTitle'))}</h2>
          <p>${esc(t('doneText'))}</p>
        </section>`;
    case 'comeback':
      return `
        <section class="card day accent">
          <h2>${esc(t('comebackTitle'))}</h2>
          <p>${esc(t('comebackText', { n: card.daysAway }))}</p>
          <div class="stack">
            <button type="button" class="btn" data-act="workout" data-mode="easy">${esc(t('comebackEasy'))}</button>
            <button type="button" class="btn ghost" data-act="workout">${esc(t('comebackFull'))}</button>
          </div>
        </section>`;
    case 'workout':
      return `
        <section class="card day">
          <h2>${esc(t('workoutTitle', { key: card.key, min: state.plan.minutes ?? card.program.minutes }))}</h2>
          <p class="muted">${esc(tr(card.program.name))}</p>
          <p class="small">${esc(exerciseList(card.workout))}</p>
          <button type="button" class="btn" data-act="workout">${esc(t('startWorkout'))}</button>
        </section>`;
    default:
      return `
        <section class="card day">
          <h2>${esc(t('restTitle'))}</h2>
          <p>${esc(t('restText'))}</p>
          ${card.next ? `<p class="muted small">${esc(t('restNext', { day: weekdayLong(card.next) }))} · ${esc(t('workoutTitle', { key: card.key, min: state.plan.minutes }))}</p>` : ''}
        </section>`;
  }
}

function morningCard(check) {
  return `
    <section class="card morning">
      <h2>${esc(t('morningTitle'))}</h2>
      <div class="lights">
        <button type="button" class="light green" data-light="green">${esc(t('mGreen'))}</button>
        <button type="button" class="light yellow" data-light="yellow">${esc(t('mYellow'))}</button>
        <button type="button" class="light red" data-light="red">${esc(t('mRed'))}</button>
      </div>
    </section>`;
}

export function today(root, { rerender }) {
  const state = store.get();
  const card = todayCard(state);
  const week = weekProgress(state);
  const comebacks = countComebacks(state);
  const check = card.kind === 'blocked' ? null : pendingMorningCheck(state);
  const food = nutritionToday(state);
  const weight = latestWeight(state);

  const dots = Array.from({ length: week.goal }, (_, i) => `<span class="dot ${i < week.done ? 'on' : ''}"></span>`).join('');

  const body = `
    <section class="week">
      <div>
        <p class="label">${esc(t('week'))}</p>
        <div class="dots" aria-label="${esc(t('weekOf', week))}">${dots}</div>
      </div>
      <div class="week-num">
        <b>${esc(t('weekOf', week))}</b>
        ${week.extra ? `<small>${esc(t('weekExtra', { n: week.extra }))}</small>` : ''}
        <small class="comebacks">↩ ${esc(t('comebacks', { n: comebacks }))}</small>
      </div>
    </section>

    ${check ? morningCard(check) : ''}
    ${dayCard(card, state)}

    <section class="card">
      <h2>${esc(t('nutrition'))}</h2>
      <div class="meter">
        <span>${esc(t('kcal'))}</span><b>${food.kcal} / ${food.target.kcal}</b>
      </div>
      ${bar(food.kcal, food.target.kcal)}
      <div class="meter">
        <span>${esc(t('protein'))}</span><b>${food.protein} / ${food.target.protein} ${esc(t('g'))}</b>
      </div>
      ${bar(food.protein, food.target.protein)}
      ${weight ? `<p class="muted small">${esc(t('weightNow', { kg: weight.kg }))}</p>` : ''}
      <div class="row2">
        <button type="button" class="btn secondary" data-act="food">${esc(t('addFood'))}</button>
        <button type="button" class="btn secondary" data-act="weight">${esc(t('addWeight'))}</button>
      </div>
    </section>`;

  root.innerHTML = tabShell('today', t('hello', { name: state.profile?.name ?? '' }), body);

  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  root.querySelectorAll('[data-act="workout"]').forEach((b) => b.addEventListener('click', () => toast(t('soonWorkout'))));
  root.querySelector('[data-act="food"]').addEventListener('click', () => toast(t('soonFood')));
  root.querySelector('[data-act="weight"]').addEventListener('click', () => weightSheet(weight, rerender));

  root.querySelectorAll('[data-light]').forEach((b) => b.addEventListener('click', () => {
    const light = b.dataset.light;
    store.update((s) => { s.checks.push({ workoutDate: check.workoutDate, light, at: new Date().toISOString() }); });
    toast(t({ green: 'mGreenReply', yellow: 'mYellowReply', red: 'mRedReply' }[light]));
    rerender();
  }));
}

function weightSheet(last, rerender) {
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
