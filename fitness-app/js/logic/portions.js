// Simple nutrition mode: hand portions instead of calories.
// Typical values per portion (men): palm of protein ≈ 25 g protein / 120 kcal,
// fist of veggies ≈ 25 kcal, cupped hand of carbs ≈ 110 kcal (3 g protein), thumb of fat ≈ 100 kcal.
import { HABITS, LESSONS } from '../data/nutrition.js';
import { dateKey, parseKey, daysBetween, weekStart, addDays } from '../dates.js';

export const KINDS = ['palm', 'fist', 'cup', 'thumb'];

const PER = {
  palm: { kcal: 120, protein: 25 },
  fist: { kcal: 25, protein: 1 },
  cup: { kcal: 110, protein: 3 },
  thumb: { kcal: 100, protein: 0 },
};

const VEGGIE_FISTS = 5;

// Converts kcal/protein targets into daily portions.
export function portionTargets({ kcal, protein }) {
  const palm = Math.max(3, Math.round(protein / PER.palm.protein));
  const fist = VEGGIE_FISTS;
  const rest = Math.max(0, kcal - palm * PER.palm.kcal - fist * PER.fist.kcal);
  const cup = Math.max(2, Math.round((rest * 0.55) / PER.cup.kcal));
  const thumb = Math.max(2, Math.round((rest * 0.45) / PER.thumb.kcal));
  return { palm, fist, cup, thumb };
}

export function estimate(portions = {}) {
  let kcal = 0;
  let protein = 0;
  for (const k of KINDS) {
    kcal += (portions[k] ?? 0) * PER[k].kcal;
    protein += (portions[k] ?? 0) * PER[k].protein;
  }
  return { kcal, protein };
}

export const nutritionMode = (state) => state.nutrition?.mode ?? 'simple';

export const portionsOn = (state, date = dateKey()) => ({ palm: 0, fist: 0, cup: 0, thumb: 0, ...(state.nutrition?.portions?.[date] ?? {}) });

// Habit of the week: rotates every week since the plan started, unless the user picked one this week.
export function habitOfWeek(state, now = new Date()) {
  const week = dateKey(weekStart(now));
  const choice = state.nutrition?.habitChoice;
  if (choice?.week === week) return HABITS.find((h) => h.id === choice.id) ?? HABITS[0];
  const start = state.plan?.startedAt ? weekStart(parseKey(state.plan.startedAt)) : weekStart(now);
  const n = Math.max(0, Math.floor(daysBetween(start, weekStart(now)) / 7));
  return HABITS[n % HABITS.length];
}

// Mon..Sun of this week: was this week's habit done each day?
export function habitWeek(state, now = new Date()) {
  const start = weekStart(now);
  const habit = habitOfWeek(state, now);
  const done = state.nutrition?.habitDays ?? {};
  return Array.from({ length: 7 }, (_, i) => {
    const key = dateKey(addDays(start, i));
    return { date: key, done: done[key] === habit.id, today: key === dateKey(now), future: key > dateKey(now) };
  });
}

// One lesson opens per day from the start of the plan.
export function lessonsUnlocked(state, now = new Date()) {
  const start = state.plan?.startedAt ? parseKey(state.plan.startedAt) : now;
  return Math.min(LESSONS.length, Math.max(1, daysBetween(start, now) + 1));
}

export function nextLesson(state, now = new Date()) {
  const read = state.nutrition?.lessonsRead ?? [];
  const open = lessonsUnlocked(state, now);
  for (let i = 0; i < open; i++) if (!read.includes(i)) return i;
  return null;
}
