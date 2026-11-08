// Workout flow: overview (4.2), exercise (4.3), rest timer (4.4), pain (4.5), swap (4.6), summary (4.7).
import { t, tr, getLang } from '../i18n.js';
import { esc, go, show, sheet, toast } from '../ui.js';
import { store } from '../store.js';
import { EXERCISE_BY_ID } from '../data/exercises.js';
import { PROGRAM_BY_ID } from '../data/programs.js';
import { CUES } from '../data/cues.js';
import { PAIN_ZONES } from '../logic/screening.js';
import {
  alternatives, substituteSpec, newItem, lastPerformance, usesWeight, weightStep, restSeconds,
  stats, records, isComeback, STOP_PAIN,
} from '../logic/workout.js';
import { adjustmentText } from './checkin.js';

const exName = (id) => tr(EXERCISE_BY_ID[id]?.name);
const fmtKg = (kg) => (Math.round(kg * 100) / 100).toLocaleString(getLang());

function rangeText(item) {
  if (item.unit === 'sec') return item.min === item.max ? t('unitSecOne', { n: item.min }) : t('unitSec', item);
  if (item.unit === 'side') return t('unitSide', { n: item.min });
  return item.min === item.max ? t('unitRepsOne', { n: item.min }) : t('unitReps', item);
}

const plannedMinutes = (a) => {
  const plan = store.get().plan;
  if (a.mode === 'easy') return 20;
  if (a.checkin?.time === 'short') return 30;
  return plan?.minutes ?? PROGRAM_BY_ID[a.program]?.minutes ?? 50;
};

export function workout(root, { params, rerender }) {
  const a = store.get().active;
  if (!a) {
    go('/today');
    return;
  }
  if (params[0] === 'ex') return exercise(root, Number(params[1]) || 0, rerender);
  if (params[0] === 'summary') return summary(root);
  return overview(root, a);
}

// ---------- 4.2 Overview ----------

function overview(root, a) {
  root.innerHTML = `
    <header class="topbar">
      <a href="#/today" class="back">← ${esc(t('tabToday'))}</a>
      <h1>${esc(t('woTitle', { key: a.key }))}</h1>
    </header>
    <main class="content no-tabs">
      <p class="muted">${esc(tr(PROGRAM_BY_ID[a.program]?.name))} · ${esc(t('woMeta', { n: a.items.length, min: plannedMinutes(a) }))}</p>
      ${a.adjustments.length ? `
        <section class="card accent">
          <p class="label">${esc(t('ciChanged'))}</p>
          <ul class="reasons">${a.adjustments.map((x) => `<li>${esc(adjustmentText(x))}</li>`).join('')}</ul>
        </section>` : ''}
      <ol class="ex-list">
        ${a.items.map((it, i) => {
          const done = it.sets.filter((s) => s.done).length;
          return `
          <li>
            <a href="#/workout/ex/${i}" class="${done === it.sets.length ? 'done' : ''}">
              <span><b>${esc(exName(it.id))}</b><small>${esc(t('setsX', { sets: it.sets.length, range: rangeText(it) }))}</small></span>
              <em>${done}/${it.sets.length}</em>
            </a>
          </li>`;
        }).join('')}
      </ol>
      <div class="stack">
        <button type="button" class="btn" data-act="start">${esc(t(firstOpen(a) > 0 ? 'continueWorkout' : 'woStart'))}</button>
        <button type="button" class="btn ghost" data-act="exit">${esc(t('finish'))}</button>
      </div>
    </main>`;
  root.querySelector('[data-act="start"]').addEventListener('click', () => go(`/workout/ex/${firstOpen(a)}`));
  root.querySelector('[data-act="exit"]').addEventListener('click', exitSheet);
}

const firstOpen = (a) => {
  const i = a.items.findIndex((it) => it.sets.some((s) => !s.done));
  return i === -1 ? Math.max(0, a.items.length - 1) : i;
};

// ---------- 4.3 Exercise ----------

function lastTimeText(state, it) {
  const last = lastPerformance(state, it.id);
  if (!last) return '';
  const done = last.item.sets.filter((s) => s.done);
  const kgs = [...new Set(done.map((s) => s.kg).filter(Boolean))];
  const reps = done.map((s) => s.reps).join(', ');
  return kgs.length === 1 ? `${fmtKg(kgs[0])} ${t('kg')} × ${reps}` : reps;
}

// Exercises that have an interactive machine model in figures/ (built with the Anatomy skill).
const FIGURES = new Set(['leg_press']);

function videoBlock(ex, it) {
  if (FIGURES.has(ex.id)) {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const kg = it?.sets.find((s) => !s.done)?.kg ?? it?.sets[0]?.kg;
    const params = new URLSearchParams({ embed: '1', reps: String(it?.max ?? 10) });
    if (kg) params.set('kg', String(kg));
    const src = `figures/${ex.id}${dark ? '' : '-light'}.html?${params}`;
    const q = encodeURIComponent(t('videoQuery', { name: tr(ex.name) }));
    return `
      <div class="figure-embed"><iframe src="${esc(src)}" title="${esc(tr(ex.name))}" loading="lazy"></iframe></div>
      <a class="link-btn" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">▶ ${esc(t('videoSearch'))}</a>`;
  }
  if (ex.video) {
    return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(ex.video)}" title="${esc(tr(ex.name))}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  const q = encodeURIComponent(t('videoQuery', { name: tr(ex.name) }));
  return `
    <div class="video placeholder">
      <p class="muted small">${esc(t('videoSoon'))}</p>
      <a class="btn secondary" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">▶ ${esc(t('videoSearch'))}</a>
    </div>`;
}

function exercise(root, index, rerender) {
  const state = store.get();
  const a = state.active;
  const i = Math.min(Math.max(0, index), a.items.length - 1);
  const it = a.items[i];
  const ex = EXERCISE_BY_ID[it.id];
  const hasKg = usesWeight(it.id, it.unit);
  const cues = tr(CUES[it.id]) || [];
  const last = lastTimeText(state, it);
  const isLast = i === a.items.length - 1;
  const repsLabel = { sec: 'secCol', side: 'sideCol' }[it.unit] ?? 'repsCol';

  root.innerHTML = `
    <header class="topbar">
      <a href="#/workout" class="back">← ${esc(t('toList'))}</a>
      <h1 class="center">${i + 1}/${a.items.length}</h1>
      <button type="button" class="icon-btn" data-act="exit" aria-label="${esc(t('exitTitle'))}">✕</button>
    </header>
    <main class="content no-tabs exercise">
      <h2 class="ex-title">${esc(tr(ex.name))}</h2>
      <p class="muted small">${esc(t('setsX', { sets: it.sets.length, range: rangeText(it) }))}</p>
      ${videoBlock(ex, it)}
      <ul class="cues">${cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      ${it.note ? `<p class="note">${esc(t(it.note.k, it.note.vars))}</p>` : ''}

      <div class="sets" role="table">
        <div class="set-row head ${hasKg ? '' : 'no-kg'}" role="row">
          <span role="columnheader">${esc(t('setN'))}</span>
          ${hasKg ? `<span role="columnheader">${esc(t('kg'))}</span>` : ''}
          <span role="columnheader">${esc(t(repsLabel))}</span>
          <span role="columnheader" class="sr-only">✓</span>
        </div>
        ${it.sets.map((s, n) => `
          <div class="set-row ${s.done ? 'done' : ''} ${hasKg ? '' : 'no-kg'}" role="row" data-set="${n}">
            <span class="set-idx" role="cell">${n + 1}</span>
            ${hasKg ? `<input role="cell" type="number" inputmode="decimal" step="0.5" min="0" max="500" name="kg" value="${s.kg ?? ''}" aria-label="${esc(t('kg'))} ${n + 1}">` : ''}
            <input role="cell" type="number" inputmode="numeric" min="0" max="600" name="reps" value="${s.reps ?? ''}" aria-label="${esc(t(repsLabel))} ${n + 1}">
            <button type="button" role="cell" class="tick" aria-pressed="${s.done}" aria-label="${esc(t('markDone', { n: n + 1 }))}">✓</button>
          </div>`).join('')}
      </div>
      <button type="button" class="link-btn" data-act="add-set">${esc(t('addSet'))}</button>
      ${last ? `<p class="muted small">${esc(t('lastTime', { text: last }))}</p>` : ''}

      <div class="row2">
        <button type="button" class="btn secondary" data-act="swap">${esc(t('swap'))}</button>
        <button type="button" class="btn secondary warn-btn" data-act="pain">${esc(t('hurts'))}</button>
      </div>
      <div class="row2 nav-row">
        <button type="button" class="btn ghost" data-act="prev" ${i === 0 ? 'disabled' : ''}>${esc(t('prevEx'))}</button>
        <button type="button" class="btn" data-act="next">${esc(t(isLast ? 'finish' : 'nextEx'))}</button>
      </div>
    </main>`;

  const setValue = (n, field, raw) => {
    const v = raw === '' ? null : Number(String(raw).replace(',', '.'));
    store.update((s) => { s.active.items[i].sets[n][field] = Number.isFinite(v) ? v : null; });
  };

  root.querySelectorAll('.set-row[data-set]').forEach((row) => {
    const n = Number(row.dataset.set);
    row.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => setValue(n, input.name, input.value)));
    row.querySelector('.tick').addEventListener('click', () => {
      // Commit the visible values first, in case "change" hasn't fired yet.
      row.querySelectorAll('input').forEach((input) => setValue(n, input.name, input.value));
      const wasDone = store.get().active.items[i].sets[n].done;
      store.update((s) => { s.active.items[i].sets[n].done = !wasDone; });
      rerender();
      if (!wasDone) {
        const next = nextStep(store.get().active, i, n);
        if (next) startTimer(restSeconds(it.id), next);
      }
    });
  });

  root.querySelector('[data-act="add-set"]').addEventListener('click', () => {
    store.update((s) => {
      const sets = s.active.items[i].sets;
      const lastSet = sets.at(-1);
      sets.push({ kg: lastSet?.kg ?? null, reps: lastSet?.reps ?? it.min, done: false });
    });
    rerender();
  });
  root.querySelector('[data-act="prev"]').addEventListener('click', () => go(`/workout/ex/${i - 1}`));
  root.querySelector('[data-act="next"]').addEventListener('click', () => go(isLast ? '/workout/summary' : `/workout/ex/${i + 1}`));
  root.querySelector('[data-act="exit"]').addEventListener('click', exitSheet);
  root.querySelector('[data-act="swap"]').addEventListener('click', () => swapSheet(i));
  root.querySelector('[data-act="pain"]').addEventListener('click', () => painSheet(i));
}

// What comes after set n of exercise i, for the timer caption.
function nextStep(a, i, n) {
  const it = a.items[i];
  const nextSet = it.sets.findIndex((s, k) => k > n && !s.done);
  if (nextSet !== -1) return t('timerNextSet', { n: nextSet + 1 });
  const nextItem = a.items.slice(i + 1).find((x) => x.sets.some((s) => !s.done));
  return nextItem ? t('timerNextEx', { name: exName(nextItem.id) }) : null;
}

// ---------- 4.4 Rest timer ----------

let beepCtx;
function beep() {
  try {
    beepCtx = beepCtx ?? new AudioContext();
    const o = beepCtx.createOscillator();
    const g = beepCtx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g).connect(beepCtx.destination);
    o.start();
    o.stop(beepCtx.currentTime + 0.25);
  } catch {
    // Audio not available: vibration and text are enough.
  }
}

function startTimer(seconds, caption) {
  let end = Date.now() + seconds * 1000;
  const total = () => Math.max(seconds, Math.ceil((end - startedAt) / 1000));
  const startedAt = Date.now();
  const d = sheet(`
    <div class="stack timer">
      <p class="label">${esc(t('timerTitle'))}</p>
      <div class="ring" style="--p:1"><span class="time" role="timer" aria-live="off">0:00</span></div>
      <p class="muted center caption">${esc(caption)}</p>
      <div class="row2">
        <button type="button" class="btn secondary" data-act="add">${esc(t('timerAdd'))}</button>
        <button type="button" class="btn" data-act="skip">${esc(t('timerSkip'))}</button>
      </div>
    </div>`);
  const timeEl = d.querySelector('.time');
  const ring = d.querySelector('.ring');
  let finished = false;
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    timeEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    ring.style.setProperty('--p', String(left / total()));
    if (left === 0 && !finished) {
      finished = true;
      navigator.vibrate?.([200, 100, 200]);
      beep();
      d.querySelector('.caption').textContent = `${t('timerDone')} · ${caption}`;
      setTimeout(() => d.open && d.close(), 1500);
    }
  };
  tick();
  const timer = setInterval(tick, 250);
  d.addEventListener('close', () => clearInterval(timer));
  d.querySelector('[data-act="add"]').addEventListener('click', () => { end += 30000; finished = false; tick(); });
  d.querySelector('[data-act="skip"]').addEventListener('click', () => d.close());
}

// ---------- Replacing an exercise ----------

// Replaces item i with another exercise. Done sets stay as their own item.
// Returns the index of the new item.
function replaceItem(i, newId, { remember = false, restore = false } = {}) {
  let target = i;
  store.update((s) => {
    const a = s.active;
    const it = a.items[i];
    const spec = { id: it.id, origId: it.origId, unit: it.unit, min: it.min, max: it.max, sets: it.sets.length };
    let next;
    if (restore) {
      const original = PROGRAM_BY_ID[a.program]?.workouts[a.key]?.find((x) => x.id === newId);
      next = original ? { ...original, sets: spec.sets } : { ...substituteSpec(spec, newId), origId: null };
      delete s.swaps[newId];
    } else {
      next = substituteSpec(spec, newId);
      if (remember) s.swaps[next.origId] = newId;
    }
    const fresh = newItem(s, next);
    const done = it.sets.filter((x) => x.done);
    if (done.length) {
      it.sets = done;
      a.items.splice(i + 1, 0, fresh);
      target = i + 1;
    } else {
      a.items[i] = fresh;
    }
  });
  return target;
}

// ---------- 4.6 Swap ----------

function swapSheet(i) {
  const state = store.get();
  const a = state.active;
  const it = a.items[i];
  const canRestore = it.origId && state.swaps[it.origId] === it.id;
  const d = sheet(`
    <div class="stack">
      <h2>${esc(t('swapTitle'))}</h2>
      <p class="label">${esc(t('swapWhy'))}</p>
      <div class="chips">
        ${['busy', 'noequip', 'awkward', 'pain'].map((w) => `<button type="button" class="chip" data-why="${w}">${esc(t('why_' + w))}</button>`).join('')}
      </div>
      <div class="alts"></div>
      ${canRestore ? `<button type="button" class="btn ghost" data-act="restore">${esc(t('swapRestore', { name: exName(it.origId) }))}</button>` : ''}
      <button type="button" class="btn ghost" data-act="close">${esc(t('cancel'))}</button>
    </div>`);

  d.querySelector('[data-act="close"]').addEventListener('click', () => d.close());
  d.querySelector('[data-act="restore"]')?.addEventListener('click', () => {
    const idx = replaceItem(i, it.origId, { restore: true });
    d.close();
    toast(t('swapRestored', { name: exName(it.origId) }));
    show(`/workout/ex/${idx}`);
  });
  d.querySelectorAll('[data-why]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.why === 'pain') {
      d.close();
      painSheet(i);
      return;
    }
    d.querySelectorAll('[data-why]').forEach((x) => x.classList.toggle('on', x === b));
    const alts = alternatives(it.id, { program: a.program });
    const box = d.querySelector('.alts');
    box.innerHTML = alts.length
      ? `<p class="label">${esc(t('swapPick'))}</p>${alts.map((e) => `<button type="button" class="option alt" data-id="${e.id}"><b>${esc(tr(e.name))}</b></button>`).join('')}`
      : `<p class="muted">${esc(t('swapNone'))}</p>`;
    box.querySelectorAll('[data-id]').forEach((x) => x.addEventListener('click', () => {
      const idx = replaceItem(i, x.dataset.id);
      d.close();
      show(`/workout/ex/${idx}`);
    }));
  }));
}

// ---------- 4.5 Pain ----------

function painSheet(i) {
  const a = store.get().active;
  const it = a.items[i];
  const d = sheet(`
    <form class="stack">
      <h2>${esc(t('painTitle'))}</h2>
      <div class="chips">
        ${PAIN_ZONES.map((z) => `<label class="chip"><input type="checkbox" name="zone" value="${z}">${esc(t('zone_' + z))}</label>`).join('')}
      </div>
      <p class="label">${esc(t('painHow'))}</p>
      <div class="chips">
        ${['light', 'mid', 'strong'].map((l) => `<label class="chip"><input type="radio" name="level" value="${l}">${esc(t({ light: 'painLight', mid: 'painMid', strong: 'painStrong' }[l]))}</label>`).join('')}
      </div>
      <div class="row2">
        <button type="button" class="btn ghost" data-act="cancel">${esc(t('cancel'))}</button>
        <button type="submit" class="btn" disabled>${esc(t('painApply'))}</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  const submit = form.querySelector('[type="submit"]');
  form.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type === 'radio') form.querySelectorAll('[name="level"]').forEach((r) => r.closest('label').classList.toggle('on', r.checked));
    else input.closest('label').classList.toggle('on', input.checked);
    submit.disabled = !form.level.value;
  });
  form.querySelector('[data-act="cancel"]').addEventListener('click', () => d.close());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const level = form.level.value;
    const zones = [...form.querySelectorAll('[name="zone"]:checked')].map((x) => x.value);
    store.update((s) => { s.active.painEvents.push({ id: it.id, zones, level, at: new Date().toISOString() }); });

    if (level === 'light') {
      const step = weightStep(it.id);
      store.update((s) => {
        for (const set of s.active.items[i].sets) {
          if (!set.done && set.kg) set.kg = Math.max(step, Math.round((set.kg * 0.8) / step) * step);
        }
      });
      d.close();
      toast(t('painLightReply', { cue: (tr(CUES[it.id]) || [''])[0].toLowerCase() }));
      show(location.hash.slice(1));
      return;
    }

    if (level === 'mid') {
      const alt = alternatives(it.id, { avoid: zones, program: a.program })[0];
      d.close();
      if (alt) {
        const idx = replaceItem(i, alt.id, { remember: true });
        toast(t('painMidReply', { name: tr(alt.name) }));
        show(`/workout/ex/${idx}`);
      } else {
        toast(t('painMidNone'));
        show(location.hash.slice(1));
      }
      return;
    }

    d.innerHTML = `
      <div class="stack">
        <div class="badge warn" aria-hidden="true">!</div>
        <h2>${esc(t('painStrongTitle'))}</h2>
        <p>${esc(t('painStrongText'))}</p>
        <button type="button" class="btn" data-act="stop">${esc(t('painStop'))}</button>
      </div>`;
    d.querySelector('[data-act="stop"]').addEventListener('click', () => { d.close(); go('/workout/summary'); });
  });
}

// ---------- Leaving the workout ----------

function exitSheet() {
  const d = sheet(`
    <div class="stack">
      <h2>${esc(t('exitTitle'))}</h2>
      <button type="button" class="btn" data-act="save">${esc(t('exitSave'))}</button>
      <button type="button" class="btn danger" data-act="discard">${esc(t('exitDiscard'))}</button>
      <button type="button" class="btn ghost" data-act="continue">${esc(t('exitContinue'))}</button>
    </div>`);
  d.querySelector('[data-act="save"]').addEventListener('click', () => { d.close(); go('/workout/summary'); });
  d.querySelector('[data-act="continue"]').addEventListener('click', () => d.close());
  d.querySelector('[data-act="discard"]').addEventListener('click', () => {
    if (!confirm(t('exitDiscardConfirm'))) return;
    store.update((s) => { s.active = null; });
    d.close();
    go('/today');
  });
}

// ---------- 4.7 Summary ----------

function summary(root) {
  const state = store.get();
  const a = state.active;
  const st = stats(a);
  const recs = records(state, a);
  const comeback = isComeback(state, a);
  const strongPain = a.painEvents.some((p) => p.level === 'strong');
  const startPain = Math.max(a.checkin?.pain ?? 0, strongPain ? STOP_PAIN : 0);

  root.innerHTML = `
    <header class="topbar">
      <a href="#/workout" class="back">← ${esc(t('toList'))}</a>
      <h1>${esc(t('sumTitle'))}</h1>
    </header>
    <main class="content no-tabs">
      ${comeback ? `<section class="card accent"><h2>↩ ${esc(t('sumComeback', { n: comeback }))}</h2></section>` : ''}
      <section class="card stats">
        <div><small>${esc(t('sumTime'))}</small><b>${esc(t('minN', { n: st.minutes }))}</b></div>
        <div><small>${esc(t('sumVolume'))}</small><b>${esc(t('kgN', { n: st.volume }))}</b></div>
        <div><small>${esc(t('sumSets'))}</small><b>${st.setsDone}/${st.setsTotal}</b></div>
      </section>
      ${recs.length ? `
        <section class="card ok">
          <p class="label">🏆 ${esc(t('sumRecords'))}</p>
          <ul class="reasons">${recs.map((r) => `<li>${esc(t('sumRecord', { name: exName(r.id), kg: fmtKg(r.kg), reps: r.reps }))}</li>`).join('')}</ul>
        </section>` : ''}
      <form class="card stack">
        <label class="field slider">
          <span><output>${esc(t('sumPainAfter', { n: startPain }))}</output></span>
          <input type="range" name="pain" min="0" max="10" step="1" value="${startPain}">
        </label>
        <p class="warn-text small" ${startPain >= STOP_PAIN ? '' : 'hidden'}>${esc(t('sumPainHigh', { n: startPain }))}</p>
        <p class="label">${esc(t('sumFeel'))}</p>
        <div class="chips">
          ${['easy', 'normal', 'hard'].map((f) => `
            <label class="chip ${f === 'normal' ? 'on' : ''}"><input type="radio" name="feel" value="${f}" ${f === 'normal' ? 'checked' : ''}>${esc(t({ easy: 'feelEasy', normal: 'feelNormal', hard: 'feelHard' }[f]))}</label>`).join('')}
        </div>
        <button type="submit" class="btn">${esc(t('sumSave'))}</button>
      </form>
    </main>`;

  const form = root.querySelector('form');
  const warn = form.querySelector('.warn-text');
  form.pain.addEventListener('input', () => {
    const n = Number(form.pain.value);
    form.querySelector('output').textContent = t('sumPainAfter', { n });
    warn.textContent = t('sumPainHigh', { n });
    warn.hidden = n < STOP_PAIN;
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'feel') form.querySelectorAll('[name="feel"]').forEach((r) => r.closest('label').classList.toggle('on', r.checked));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let saved = false;
    store.update((s) => {
      const w = s.active;
      // Keep only exercises with at least one finished set; a workout with none is not saved.
      w.items = w.items.map((it) => ({ ...it, sets: it.sets.filter((x) => x.done) })).filter((it) => it.sets.length);
      if (w.items.length) {
        s.workouts.push({ ...w, finishedAt: new Date().toISOString(), painAfter: Number(form.pain.value), feel: form.feel.value });
        saved = true;
      }
      s.active = null;
    });
    if (saved) toast(t('saved'));
    go('/today');
  });
}
