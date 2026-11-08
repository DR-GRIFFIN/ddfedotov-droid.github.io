// Today: week goal, comebacks, card of the day, nutrition summary.
import { t, tr, weekdayLong } from '../i18n.js';
import { esc, go, tabShell, toast, bar } from '../ui.js';
import { store } from '../store.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { openCheckin } from './checkin.js';
import { weightSheet } from './weight.js';
import { nutritionMode, portionsOn, portionTargets } from '../logic/portions.js';
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
    case 'active':
      return `
        <section class="card day accent">
          <h2>${esc(t('activeTitle', { key: card.key }))}</h2>
          <p>${esc(t('activeText'))}</p>
          <button type="button" class="btn" data-go="/workout">${esc(t('continueWorkout'))}</button>
        </section>`;
    case 'painPause':
      return `
        <section class="card day warn">
          <h2>${esc(t('painPauseTitle'))}</h2>
          <p>${esc(t('painPauseText'))}</p>
          <button type="button" class="btn secondary" data-act="pain-gone">${esc(t('painGone'))}</button>
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

// Simple mode: the two portions that matter most for a beginner.
function simpleSummary(state) {
  const have = portionsOn(state);
  const goal = portionTargets(state.plan.targets);
  return ['palm', 'fist'].map((k) => `
    <div class="meter">
      <span>${esc(t('portion_' + k))}</span><b>${have[k]} / ${goal[k]} ${esc(t('unit_' + k))}</b>
    </div>
    ${bar(have[k], goal[k])}`).join('');
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
  const check = ['blocked', 'active'].includes(card.kind) ? null : pendingMorningCheck(state);
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
      ${nutritionMode(state) === 'simple' ? simpleSummary(state) : `
      <div class="meter">
        <span>${esc(t('kcal'))}</span><b>${food.kcal} / ${food.target.kcal}</b>
      </div>
      ${bar(food.kcal, food.target.kcal)}
      <div class="meter">
        <span>${esc(t('protein'))}</span><b>${food.protein} / ${food.target.protein} ${esc(t('g'))}</b>
      </div>
      ${bar(food.protein, food.target.protein)}`}
      ${weight ? `<p class="muted small">${esc(t('weightNow', { kg: weight.kg }))}</p>` : ''}
      <div class="row2">
        <button type="button" class="btn secondary" data-act="food">${esc(t('addFood'))}</button>
        <button type="button" class="btn secondary" data-act="weight">${esc(t('addWeight'))}</button>
      </div>
    </section>`;

  root.innerHTML = tabShell('today', t('hello', { name: state.profile?.name ?? '' }), body);

  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  root.querySelectorAll('[data-act="workout"]').forEach((b) => b.addEventListener('click', () => openCheckin(b.dataset.mode ?? 'normal')));
  root.querySelector('[data-act="pain-gone"]')?.addEventListener('click', () => {
    store.update((s) => { s.painResolvedAt = new Date().toISOString(); });
    rerender();
  });
  root.querySelector('[data-act="food"]').addEventListener('click', () => go('/nutrition'));
  root.querySelector('[data-act="weight"]').addEventListener('click', () => weightSheet(weight, rerender));

  root.querySelectorAll('[data-light]').forEach((b) => b.addEventListener('click', () => {
    const light = b.dataset.light;
    store.update((s) => { s.checks.push({ workoutDate: check.workoutDate, light, at: new Date().toISOString() }); });
    toast(t({ green: 'mGreenReply', yellow: 'mYellowReply', red: 'mRedReply' }[light]));
    rerender();
  }));
}
