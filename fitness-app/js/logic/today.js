// What the Today screen shows. Pure functions over the stored state, easy to test.
import { dateKey, parseKey, daysBetween, isoDay, weekStart, addDays } from '../dates.js';
import { PROGRAM_BY_ID } from '../data/programs.js';

export const COMEBACK_GAP_DAYS = 5;

const sortedWorkouts = (state) => [...(state.workouts ?? [])].sort((a, b) => a.date.localeCompare(b.date));

// A comeback is a workout after at least one planned training day was missed.
// The first workout ever is not a comeback.
export function countComebacks(state) {
  const days = state.plan?.days ?? [];
  const list = sortedWorkouts(state);
  let count = 0;
  for (let i = 1; i < list.length; i++) {
    const prev = parseKey(list[i - 1].date);
    const cur = parseKey(list[i].date);
    for (let d = addDays(prev, 1); d < cur; d = addDays(d, 1)) {
      if (days.includes(isoDay(d))) { count++; break; }
    }
  }
  return count;
}

export function weekProgress(state, now = new Date()) {
  const start = dateKey(weekStart(now));
  const end = dateKey(addDays(weekStart(now), 6));
  const done = (state.workouts ?? []).filter((w) => w.date >= start && w.date <= end).length;
  const goal = state.plan?.days?.length ?? 3;
  return { done: Math.min(done, goal), goal, extra: Math.max(0, done - goal) };
}

export function nextWorkoutKey(state) {
  const last = sortedWorkouts(state).at(-1);
  return last?.key === 'A' ? 'B' : 'A';
}

export function nextTrainingDay(state, now = new Date()) {
  const days = state.plan?.days ?? [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(now, i);
    if (days.includes(isoDay(d))) return d;
  }
  return null;
}

// Main card on Today. One of:
// blocked | comeback | done | workout | rest
export function todayCard(state, now = new Date()) {
  const program = PROGRAM_BY_ID[state.plan?.program];
  if (state.health?.blocked && !state.health?.clearedAt) return { kind: 'blocked' };

  const today = dateKey(now);
  const list = sortedWorkouts(state);
  const last = list.at(-1);
  if (last?.date === today) return { kind: 'done', program };

  const key = nextWorkoutKey(state);
  const workout = program?.workouts[key] ?? [];
  if (last && daysBetween(parseKey(last.date), now) >= COMEBACK_GAP_DAYS) {
    return { kind: 'comeback', program, key, workout, daysAway: daysBetween(parseKey(last.date), now) };
  }
  if ((state.plan?.days ?? []).includes(isoDay(now))) return { kind: 'workout', program, key, workout };
  return { kind: 'rest', program, key, workout, next: nextTrainingDay(state, now) };
}

// Morning check after yesterday's workout, if not answered yet.
export function pendingMorningCheck(state, now = new Date()) {
  const yesterday = dateKey(addDays(now, -1));
  const w = (state.workouts ?? []).find((x) => x.date === yesterday);
  if (!w) return null;
  const answered = (state.checks ?? []).some((c) => c.workoutDate === yesterday);
  return answered ? null : { workoutDate: yesterday };
}

export function nutritionToday(state, now = new Date()) {
  const today = dateKey(now);
  const eaten = (state.food ?? []).filter((f) => f.date === today);
  return {
    kcal: eaten.reduce((s, f) => s + (f.kcal || 0), 0),
    protein: eaten.reduce((s, f) => s + (f.protein || 0), 0),
    target: state.plan?.targets ?? { kcal: 0, protein: 0 },
  };
}

export function latestWeight(state) {
  return [...(state.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;
}
