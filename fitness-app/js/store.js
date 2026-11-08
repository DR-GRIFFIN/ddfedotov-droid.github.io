// App state. For now it lives in localStorage; the shape is ready to sync with Supabase later.

const KEY = 'orleans:v1';

export const emptyState = () => ({
  session: null,            // { mode: 'local' | 'supabase', userId, email? }
  settings: { lang: null }, // 'ru' | 'en'
  onboarding: { step: 1, done: false, answers: { days: [1, 3, 5], minutes: 60, pain: {}, health: {} } },
  profile: null,            // { name, age, height, weight, experience, activity }
  health: { blocked: false, reasons: [], clearedAt: null },
  plan: null,               // { program, goal, days, minutes, targets: { kcal, protein }, startedAt }
  workouts: [],             // { date, key, ... }
  checks: [],               // morning checks: { workoutDate, light: 'green' | 'yellow' | 'red' }
  weights: [],              // { date, kg }
  food: [],                 // { date, name, kcal, protein }
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const saved = JSON.parse(raw);
    const base = emptyState();
    return { ...base, ...saved, onboarding: { ...base.onboarding, ...saved.onboarding } };
  } catch {
    return emptyState();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or storage full: keep working in memory.
  }
}

export const store = {
  get: () => state,
  // fn receives a draft copy and mutates it.
  update(fn) {
    const draft = structuredClone(state);
    fn(draft);
    state = draft;
    persist();
    listeners.forEach((l) => l(state));
  },
  reset() {
    const lang = state.settings.lang;
    state = emptyState();
    state.settings.lang = lang;
    persist();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
