// Nutrition tab: simple mode (hand portions, habit, plate, lessons) and exact mode (calories).
import { t, tr } from '../i18n.js';
import { esc, go, tabShell, sheet, bar } from '../ui.js';
import { store } from '../store.js';
import { dateKey, weekStart } from '../dates.js';
import { HABITS, LESSONS, PROTEIN_SOURCES, WEAK_PROTEIN } from '../data/nutrition.js';
import {
  KINDS, portionTargets, portionsOn, estimate, nutritionMode, habitOfWeek, habitWeek, lessonsUnlocked, nextLesson,
} from '../logic/portions.js';
import { nutritionToday, latestWeight } from '../logic/today.js';
import { weightSheet } from './weight.js';

const ICON = { palm: '✋', fist: '✊', cup: '🤲', thumb: '👍' };

export function nutrition(root, { params, rerender }) {
  if (params[0] === 'lesson') return lesson(root, Number(params[1]) || 0);
  if (params[0] === 'protein') return proteinSheet(root);
  return main(root, rerender);
}

// ---------- Main ----------

function main(root, rerender) {
  const state = store.get();
  const mode = nutritionMode(state);
  const weight = latestWeight(state);

  const body = `
    <div class="segmented" role="tablist">
      ${['simple', 'exact'].map((m) => `<button type="button" role="tab" aria-selected="${m === mode}" data-mode="${m}">${esc(t(m === 'simple' ? 'nModeSimple' : 'nModeExact'))}</button>`).join('')}
    </div>
    <p class="muted small">${esc(t(mode === 'simple' ? 'nModeSimpleHint' : 'nModeExactHint'))}</p>

    ${mode === 'simple' ? portionsCard(state) : exactCard(state)}
    ${mode === 'simple' ? habitCard(state) : ''}
    ${mode === 'simple' ? plateCard() : ''}
    ${lessonsCard(state)}

    <section class="card link-card">
      <h2>🥚 ${esc(t('proteinTitle'))}</h2>
      <p class="muted small">${esc(t('proteinHint'))}</p>
      <a class="btn secondary" href="#/nutrition/protein">${esc(t('proteinOpen'))}</a>
    </section>

    <section class="card">
      <h2>${esc(t('weightTitle'))}</h2>
      ${weight ? `<p>${esc(t('weightNow', { kg: weight.kg }))}</p>` : ''}
      <p class="muted small">${esc(t('weightHint'))}</p>
      <button type="button" class="btn secondary" data-act="weight">${esc(t('addWeight'))}</button>
    </section>

    <section class="card muted-card">
      <h2>🍲 ${esc(t('kitchenTitle'))}</h2>
      <p class="muted small">${esc(t('kitchenText'))}</p>
    </section>`;

  root.innerHTML = tabShell('nutrition', t('tabNutrition'), body);

  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    store.update((s) => { s.nutrition.mode = b.dataset.mode; });
    rerender();
  }));
  root.querySelector('[data-act="weight"]').addEventListener('click', () => weightSheet(weight, rerender));

  // Portion steppers
  root.querySelectorAll('[data-portion]').forEach((b) => b.addEventListener('click', () => {
    const { portion, delta } = b.dataset;
    const date = dateKey();
    store.update((s) => {
      const day = { ...portionsOn(s, date) };
      day[portion] = Math.max(0, day[portion] + Number(delta));
      s.nutrition.portions = { ...s.nutrition.portions, [date]: day };
    });
    rerender();
  }));

  // Habit
  root.querySelector('[data-act="habit-today"]')?.addEventListener('click', () => {
    const date = dateKey();
    const habit = habitOfWeek(store.get());
    store.update((s) => {
      const days = { ...s.nutrition.habitDays };
      if (days[date] === habit.id) delete days[date];
      else days[date] = habit.id;
      s.nutrition.habitDays = days;
    });
    rerender();
  });
  root.querySelector('[data-act="habit-change"]')?.addEventListener('click', () => habitPicker(rerender));

  // Exact mode
  root.querySelector('.food-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const kcal = Number(f.kcal.value);
    const protein = Number(f.protein.value || 0);
    if (!(kcal > 0 && kcal < 5000) || protein < 0 || protein > 300) return;
    store.update((s) => {
      s.food.push({ id: crypto.randomUUID(), date: dateKey(), name: f.name.value.trim(), kcal, protein });
    });
    rerender();
  });
  root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    store.update((s) => { s.food = s.food.filter((x) => x.id !== b.dataset.del); });
    rerender();
  }));
}

function portionsCard(state) {
  const have = portionsOn(state);
  const goal = portionTargets(state.plan.targets);
  const est = estimate(have);
  return `
    <section class="card">
      <h2>${esc(t('nToday'))}</h2>
      ${KINDS.map((k) => `
        <div class="portion-row">
          <span class="p-ico" aria-hidden="true">${ICON[k]}</span>
          <div class="p-main">
            <div class="p-head"><b>${esc(t('portion_' + k))}</b><span>${have[k]} / ${goal[k]}</span></div>
            <small class="muted">${esc(t('hint_' + k))}</small>
            ${bar(have[k], goal[k])}
          </div>
          <div class="stepper">
            <button type="button" data-portion="${k}" data-delta="-1" aria-label="${esc(t('portionRemove', { name: t('portion_' + k) }))}" ${have[k] ? '' : 'disabled'}>−</button>
            <button type="button" data-portion="${k}" data-delta="1" aria-label="${esc(t('portionAdd', { name: t('portion_' + k) }))}">+</button>
          </div>
        </div>`).join('')}
      <p class="muted small">${esc(t('nApprox', est))}</p>
    </section>`;
}

function habitCard(state) {
  const habit = habitOfWeek(state);
  const week = habitWeek(state);
  const doneToday = week.find((d) => d.today)?.done;
  const count = week.filter((d) => d.done).length;
  return `
    <section class="card">
      <p class="label">${esc(t('habitTitle'))}</p>
      <h2>${esc(tr(habit.name))}</h2>
      <p class="muted small">${esc(tr(habit.hint))}</p>
      <div class="habit-days" aria-label="${esc(t('habitCount', { n: count }))}">
        ${week.map((d) => `<span class="hday ${d.done ? 'on' : ''} ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}"></span>`).join('')}
      </div>
      <button type="button" class="btn ${doneToday ? 'secondary' : ''}" data-act="habit-today" aria-pressed="${Boolean(doneToday)}">
        ${esc(t(doneToday ? 'habitDoneToday' : 'habitMark'))}
      </button>
      <button type="button" class="link-btn" data-act="habit-change">${esc(t('habitChange'))}</button>
    </section>`;
}

function habitPicker(rerender) {
  const current = habitOfWeek(store.get()).id;
  const d = sheet(`
    <div class="stack">
      <h2>${esc(t('habitPick'))}</h2>
      ${HABITS.map((h) => `
        <button type="button" class="option alt ${h.id === current ? 'on' : ''}" data-id="${h.id}">
          <b>${esc(tr(h.name))}</b><small>${esc(tr(h.hint))}</small>
        </button>`).join('')}
      <button type="button" class="btn ghost" data-act="close">${esc(t('cancel'))}</button>
    </div>`);
  d.querySelector('[data-act="close"]').addEventListener('click', () => d.close());
  d.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
    store.update((s) => { s.nutrition.habitChoice = { week: dateKey(weekStart(new Date())), id: b.dataset.id }; });
    d.close();
    rerender();
  }));
}

function plateCard() {
  // Half veggies (left), quarter protein (top right), quarter carbs (bottom right).
  return `
    <section class="card">
      <h2>${esc(t('plateTitle'))}</h2>
      <div class="plate-wrap">
        <svg class="plate" viewBox="0 0 120 120" role="img" aria-label="${esc(t('plateAria'))}">
          <circle cx="60" cy="60" r="58" class="rim"/>
          <path d="M60 10 A50 50 0 0 0 60 110 Z" class="veg"/>
          <path d="M60 60 L60 10 A50 50 0 0 1 110 60 Z" class="prot"/>
          <path d="M60 60 L110 60 A50 50 0 0 1 60 110 Z" class="carb"/>
          <text x="34" y="64" class="lbl">✊</text>
          <text x="76" y="44" class="lbl">✋</text>
          <text x="76" y="88" class="lbl">🤲</text>
        </svg>
        <ul class="legend">
          <li><span class="sw veg"></span>${esc(t('plateVeg'))}</li>
          <li><span class="sw prot"></span>${esc(t('plateProtein'))}</li>
          <li><span class="sw carb"></span>${esc(t('plateCarb'))}</li>
          <li><span class="sw fat"></span>${esc(t('plateFat'))}</li>
        </ul>
      </div>
      <p class="muted small">${esc(t('plateWhere'))}</p>
    </section>`;
}

function lessonsCard(state) {
  const open = lessonsUnlocked(state);
  const read = state.nutrition?.lessonsRead ?? [];
  const next = nextLesson(state);
  const all = read.length >= LESSONS.length;
  return `
    <section class="card">
      <h2>📖 ${esc(t('lessonsTitle'))}</h2>
      ${next != null ? `
        <p>${esc(t('lessonN', { n: next + 1 }))}: <b>${esc(tr(LESSONS[next].title))}</b></p>
        <a class="btn" href="#/nutrition/lesson/${next}">${esc(t('lessonRead'))}</a>`
        : `<p class="muted">${esc(t(all ? 'lessonsComplete' : 'lessonAllRead'))}</p>`}
      <ol class="lesson-list">
        ${LESSONS.map((l, i) => {
          const locked = i >= open;
          const done = read.includes(i);
          return `<li class="${locked ? 'locked' : ''} ${done ? 'done' : ''}">
            ${locked
              ? `<span>🔒 ${esc(tr(l.title))}</span><small>${esc(t('lessonLocked', { n: i - open + 1 }))}</small>`
              : `<a href="#/nutrition/lesson/${i}">${done ? '✓ ' : ''}${esc(tr(l.title))}</a>`}
          </li>`;
        }).join('')}
      </ol>
    </section>`;
}

function exactCard(state) {
  const food = nutritionToday(state);
  const today = dateKey();
  const entries = state.food.filter((f) => f.date === today);
  return `
    <section class="card">
      <h2>${esc(t('nToday'))}</h2>
      <div class="meter"><span>${esc(t('kcal'))}</span><b>${food.kcal} / ${food.target.kcal}</b></div>
      ${bar(food.kcal, food.target.kcal)}
      <div class="meter"><span>${esc(t('protein'))}</span><b>${food.protein} / ${food.target.protein} ${esc(t('g'))}</b></div>
      ${bar(food.protein, food.target.protein)}
    </section>
    <section class="card">
      <h2>${esc(t('exactAdd'))}</h2>
      <form class="stack food-form">
        <label class="field">${esc(t('foodName'))}
          <input name="name" maxlength="80" placeholder="${esc(t('foodNamePh'))}">
        </label>
        <div class="row2">
          <label class="field">${esc(t('kcal'))}
            <input name="kcal" type="number" inputmode="numeric" min="1" max="5000" required>
          </label>
          <label class="field">${esc(t('exactProtein'))}
            <input name="protein" type="number" inputmode="numeric" min="0" max="300">
          </label>
        </div>
        <button type="submit" class="btn">${esc(t('exactAddBtn'))}</button>
        <p class="muted small">${esc(t('exactAiSoon'))}</p>
      </form>
      ${entries.length ? `
        <ul class="food-list">
          ${entries.map((f) => `
            <li><span>${esc(f.name || '—')}</span><small>${f.kcal} ${esc(t('kcal'))} · ${f.protein} ${esc(t('g'))}</small>
              <button type="button" class="icon-btn small" data-del="${esc(f.id)}" aria-label="${esc(t('exactDelete'))}">✕</button></li>`).join('')}
        </ul>` : `<p class="muted small">${esc(t('exactEmpty'))}</p>`}
    </section>`;
}

// ---------- Lesson ----------

function lesson(root, i) {
  const state = store.get();
  const idx = Math.min(Math.max(0, i), LESSONS.length - 1);
  if (idx >= lessonsUnlocked(state)) {
    go('/nutrition');
    return;
  }
  const l = LESSONS[idx];
  const lines = tr(l.body);
  let html = '';
  let inList = false;
  for (const line of lines) {
    const item = line.startsWith('• ');
    if (item && !inList) { html += '<ul>'; inList = true; }
    if (!item && inList) { html += '</ul>'; inList = false; }
    html += item ? `<li>${esc(line.slice(2))}</li>` : `<p>${esc(line)}</p>`;
  }
  if (inList) html += '</ul>';

  root.innerHTML = `
    <header class="topbar">
      <a href="#/nutrition" class="back">← ${esc(t('tabNutrition'))}</a>
    </header>
    <main class="content no-tabs lesson">
      <p class="label">${esc(t('lessonN', { n: idx + 1 }))} / ${LESSONS.length}</p>
      <h1>${esc(tr(l.title))}</h1>
      <article>${html}</article>
      <button type="button" class="btn" data-act="done">${esc(t('lessonDone'))}</button>
    </main>`;
  root.querySelector('[data-act="done"]').addEventListener('click', () => {
    store.update((s) => {
      if (!s.nutrition.lessonsRead.includes(idx)) s.nutrition.lessonsRead = [...s.nutrition.lessonsRead, idx];
    });
    go('/nutrition');
  });
}

// ---------- Protein cheat sheet ----------

function proteinSheet(root) {
  const palms = (g) => Math.max(0.5, Math.round((g / 25) * 2) / 2).toLocaleString();
  root.innerHTML = `
    <header class="topbar">
      <a href="#/nutrition" class="back">← ${esc(t('tabNutrition'))}</a>
    </header>
    <main class="content no-tabs">
      <h1>${esc(t('proteinTitle'))}</h1>
      <p class="muted">${esc(t('proteinHint'))}</p>
      <ul class="protein-list">
        ${PROTEIN_SOURCES.map((p) => `
          <li>
            <div><b>${esc(tr(p.name))}</b><small>${esc(tr(p.portion))}</small></div>
            <div class="p-val"><b>${esc(t('proteinG', { n: p.protein }))}</b><small>✋ ${esc(t('palmsN', { n: palms(p.protein) }))}</small></div>
          </li>`).join('')}
      </ul>
      <section class="card warn"><p>⚠️ ${esc(tr(WEAK_PROTEIN))}</p></section>
    </main>`;
}

