// Workout building, progression and history. Pure functions over state.
import { EXERCISE_BY_ID, EXERCISES } from '../data/exercises.js';
import { PROGRAM_BY_ID } from '../data/programs.js';
import { dateKey, parseKey, daysBetween } from '../dates.js';
import { nextWorkoutKey, countComebacks } from './today.js';

export const TECHNIQUE_DAYS = 14;
export const STOP_PAIN = 7;

// Which exercises load which body area. Used to route around pain.
export const ZONE_LOADS = {
  neck: ['farmer_walk', 'db_shoulder_press', 'machine_shoulder_press', 'back_squat'],
  shoulders: ['db_shoulder_press', 'machine_shoulder_press', 'lateral_raise', 'bb_bench', 'db_bench',
    'incline_db_press', 'pushup', 'assisted_pullup', 'lat_pulldown', 'back_squat'],
  upperBack: ['back_squat', 'db_row', 'farmer_walk', 'rower'],
  lowerBack: ['back_squat', 'goblet_squat', 'db_rdl', 'back_ext', 'rower', 'farmer_walk', 'db_row'],
  elbows: ['db_curl', 'triceps_pushdown', 'pushup', 'bb_bench', 'assisted_pullup'],
  wrists: ['pushup', 'bb_bench', 'db_bench', 'farmer_walk', 'db_curl', 'plank', 'side_plank'],
  hips: ['back_squat', 'goblet_squat', 'split_squat', 'db_rdl', 'glute_bridge', 'leg_press'],
  knees: ['back_squat', 'goblet_squat', 'split_squat', 'leg_ext', 'leg_press', 'incline_walk'],
  ankles: ['back_squat', 'goblet_squat', 'split_squat', 'calf_raise', 'incline_walk', 'farmer_walk'],
};

export const loadsZone = (exId, zones = []) => zones.some((z) => ZONE_LOADS[z]?.includes(exId));

// Default dose for exercises measured in time or per side.
const DOSE = {
  plank: { unit: 'sec', min: 20, max: 40 },
  side_plank: { unit: 'sec', min: 15, max: 30 },
  bird_dog: { unit: 'side', min: 8, max: 8 },
  dead_bug: { unit: 'side', min: 8, max: 8 },
  pallof_press: { unit: 'side', min: 10, max: 10 },
  farmer_walk: { unit: 'sec', min: 30, max: 40 },
};

const BIG_LEGS = ['leg_press', 'goblet_squat', 'back_squat', 'db_rdl', 'split_squat'];

export function restSeconds(exId) {
  const ex = EXERCISE_BY_ID[exId];
  if (ex.group === 'core') return 45;
  if (BIG_LEGS.includes(exId)) return 120;
  return 90;
}

// Exercises measured with external weight.
export const usesWeight = (exId, unit = 'reps') => EXERCISE_BY_ID[exId].equip !== 'W' && unit === 'reps';

export const weightStep = (exId) => (EXERCISE_BY_ID[exId].equip === 'D' ? 2 : 2.5);

const roundTo = (x, step) => Math.round(x / step) * step;

// Limits each program puts on substitutes.
function programRules(programId) {
  if (programId === 'back') return { backSafe: true };
  if (programId === 'dumbbells') return { equip: ['D', 'W'] };
  if (programId === 'machines') return { equip: ['M', 'W'] };
  return {};
}

export function alternatives(exId, { avoid = [], program } = {}) {
  const ex = EXERCISE_BY_ID[exId];
  const rules = programRules(program);
  const ok = (e) => e.id !== exId && e.group !== 'cardio' && !loadsZone(e.id, avoid)
    && (!rules.backSafe || e.backSafe) && (!rules.equip || rules.equip.includes(e.equip));
  const list = [];
  const first = EXERCISE_BY_ID[ex.alt];
  if (first && ok(first)) list.push(first);
  for (const e of EXERCISES) if (e.group === ex.group && ok(e) && !list.includes(e)) list.push(e);
  return list.slice(0, 3);
}

// Spec for a substitute: keeps sets and rep range unless the new exercise is measured differently.
export function substituteSpec(spec, newId) {
  const next = { ...spec, id: newId, origId: spec.origId ?? spec.id };
  if (DOSE[newId]) Object.assign(next, DOSE[newId]);
  else if (spec.unit !== 'reps') Object.assign(next, { unit: 'reps', min: 10, max: 12 });
  return next;
}

const sorted = (state) => [...(state.workouts ?? [])].sort((a, b) => a.date.localeCompare(b.date));

export function lastPerformance(state, exId) {
  const list = sorted(state);
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i].items?.find((it) => it.id === exId && it.sets.some((s) => s.done));
    if (item) return { date: list[i].date, item, feel: list[i].feel };
  }
  return null;
}

export function bestSet(state, exId) {
  let best = null;
  for (const w of state.workouts ?? []) {
    for (const it of w.items ?? []) {
      if (it.id !== exId) continue;
      for (const s of it.sets) {
        if (!s.done || !s.kg) continue;
        if (!best || s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps)) best = { kg: s.kg, reps: s.reps };
      }
    }
  }
  return best;
}

export function inTechniqueWeeks(state, now = new Date()) {
  const start = state.plan?.startedAt;
  return start ? daysBetween(parseKey(start), now) < TECHNIQUE_DAYS : true;
}

// The last morning check was "a bit sore" for the latest workout.
export function lastCheckYellow(state) {
  const last = sorted(state).at(-1);
  if (!last) return false;
  const check = (state.checks ?? []).filter((c) => c.workoutDate === last.date).at(-1);
  return check?.light === 'yellow';
}

// Suggested sets for one exercise: double progression.
// All sets at the top of the range last time → add one weight step, start again from the bottom.
export function suggest(state, spec, { lighter = 1, now = new Date() } = {}) {
  const hasKg = usesWeight(spec.id, spec.unit);
  const last = lastPerformance(state, spec.id);
  const step = weightStep(spec.id);
  const technique = inTechniqueWeeks(state, now);
  let kg = null;
  let reps = Array(spec.sets).fill(spec.min);
  let note = last ? null : { k: 'noteFirst', vars: { n: spec.max } };

  if (last) {
    const done = last.item.sets.filter((s) => s.done);
    const allTop = done.length >= spec.sets && done.every((s) => s.reps >= spec.max);
    const lastKg = hasKg ? Math.max(0, ...done.map((s) => s.kg || 0)) || null : null;
    kg = lastKg;
    reps = Array.from({ length: spec.sets }, (_, i) => Math.min(spec.max, Math.max(spec.min, done[i]?.reps ?? spec.min)));
    if (allTop && hasKg && lastKg) {
      if (technique) note = { k: 'noteTechnique' };
      else if (last.feel === 'hard') note = { k: 'noteHard' };
      else if (lighter < 1) note = null;
      else {
        kg = lastKg + step;
        reps = Array(spec.sets).fill(spec.min);
        note = { k: 'noteUp', vars: { step, n: spec.max } };
      }
    }
  }
  if (kg && lighter < 1) {
    kg = Math.max(step, roundTo(kg * lighter, step));
    note = { k: 'noteLighter' };
  }
  return { sets: reps.map((r) => ({ kg, reps: r, done: false })), note };
}

const itemFrom = (state, spec, lighter) => {
  const { sets, note } = suggest(state, spec, { lighter });
  return { id: spec.id, origId: spec.origId ?? null, unit: spec.unit, min: spec.min, max: spec.max, sets, note };
};

// checkin: { feel: 'bad'|'meh'|'ok'|'great', sleep: 'bad'|'ok'|'good', pain: 0..10, zones: [], time: 'plan'|'short' }
export function buildWorkout(state, { mode = 'normal', checkin = null, now = new Date() } = {}) {
  const programId = state.plan.program;
  const program = PROGRAM_BY_ID[programId];
  const key = nextWorkoutKey(state);
  let specs = program.workouts[key].map((s) => ({ ...s }));
  const adjustments = [];
  let lighter = 1;

  if (mode === 'easy') {
    specs = specs.slice(0, 4).map((s) => ({ ...s, sets: Math.min(2, s.sets) }));
    lighter = 0.7;
    adjustments.push({ k: 'adjEasy' });
  }
  if (checkin?.time === 'short' && mode !== 'easy') {
    specs = specs.slice(0, 4);
    adjustments.push({ k: 'adjShort' });
  }
  if (checkin && (checkin.sleep === 'bad' || checkin.feel === 'bad')) {
    specs = specs.map((s) => ({ ...s, sets: Math.max(1, s.sets - 1) }));
    adjustments.push({ k: 'adjTired' });
  }
  if (lastCheckYellow(state) && lighter > 0.9) {
    lighter = 0.9;
    adjustments.push({ k: 'adjYellow' });
  }

  const avoid = checkin?.pain > 0 ? checkin.zones ?? [] : [];
  const out = [];
  for (let spec of specs) {
    const saved = state.swaps?.[spec.id];
    if (saved && EXERCISE_BY_ID[saved]) {
      spec = substituteSpec(spec, saved);
      adjustments.push({ k: 'adjSaved', ids: [spec.origId, saved] });
    }
    if (loadsZone(spec.id, avoid)) {
      const alt = alternatives(spec.id, { avoid, program: programId })[0];
      if (alt) {
        adjustments.push({ k: 'adjPain', ids: [spec.id, alt.id] });
        spec = substituteSpec(spec, alt.id);
      } else {
        adjustments.push({ k: 'adjDrop', ids: [spec.id] });
        continue;
      }
    }
    out.push(spec);
  }

  return {
    date: dateKey(now),
    key,
    mode,
    program: programId,
    startedAt: now.toISOString(),
    checkin,
    adjustments,
    painEvents: [],
    items: out.map((s) => itemFrom(state, s, lighter)),
  };
}

export const newItem = (state, spec) => itemFrom(state, spec, 1);

export function stats(workout) {
  let volume = 0;
  let setsDone = 0;
  let setsTotal = 0;
  for (const it of workout.items) {
    for (const s of it.sets) {
      setsTotal++;
      if (!s.done) continue;
      setsDone++;
      if (s.kg) volume += s.kg * (s.reps || 0);
    }
  }
  const end = workout.finishedAt ? new Date(workout.finishedAt) : new Date();
  const minutes = Math.max(1, Math.round((end - new Date(workout.startedAt)) / 60000));
  return { volume: Math.round(volume), setsDone, setsTotal, minutes };
}

// New personal bests in this workout compared to history.
export function records(state, workout) {
  const out = [];
  for (const it of workout.items) {
    const prev = bestSet(state, it.id);
    let top = null;
    for (const s of it.sets) {
      if (s.done && s.kg && (!top || s.kg > top.kg || (s.kg === top.kg && s.reps > top.reps))) top = s;
    }
    if (top && prev && (top.kg > prev.kg || (top.kg === prev.kg && top.reps > prev.reps))) {
      out.push({ id: it.id, kg: top.kg, reps: top.reps });
    }
  }
  return out;
}

// Would saving this workout add a comeback?
export function isComeback(state, workout) {
  const after = { ...state, workouts: [...state.workouts, { date: workout.date }] };
  return countComebacks(after) > countComebacks(state) ? countComebacks(after) : 0;
}

// Saves an unfinished workout left from a previous day (only if something was done).
export function settleStale(state, now = new Date()) {
  const a = state.active;
  if (!a || a.date === dateKey(now)) return;
  const anyDone = a.items.some((it) => it.sets.some((s) => s.done));
  if (anyDone) state.workouts.push({ ...a, finishedAt: a.startedAt, feel: null, painAfter: null });
  state.active = null;
}
