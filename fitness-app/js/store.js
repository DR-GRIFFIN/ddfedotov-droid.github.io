// App state. For now it lives in localStorage; the shape is ready to sync with Supabase later.

const KEY = 'orleans:v1';

export const emptyState = () => ({
  session: null,            // { mode: 'local' | 'supabase', userId, email? }
  settings: { lang: null }, // 'ru' | 'en'
  onboarding: { step: 1, done: false, answers: { days: [1, 3, 5], minutes: 60, pain: {}, health: {} } },
  profile: null,            // { name, age, height, weight, experience, activity }
  health: { blocked: false, reasons: [], clearedAt: null },
  plan: null,               // { program, goal, days, minutes, targets: { kcal, protein }, startedAt }
  workouts: [],             // { date, key, mode, items: [{ id, sets: [{ kg, reps, done }] }], feel, painAfter }
  active: null,             // workout in progress, same shape as a saved workout
  swaps: {},                // exercises replaced after pain: { originalId: substituteId }
  painResolvedAt: null,     // user said the pain from a red morning check is gone
  checks: [],               // morning checks: { workoutDate, light: 'green' | 'yellow' | 'red' }
  weights: [],              // { date, kg }
  food: [],                 // exact mode entries: { id, date, name, kcal, protein }
  nutrition: {
    mode: 'simple',         // 'simple' (hand portions) | 'exact' (calories)
    portions: {},           // { 'YYYY-MM-DD': { palm, fist, cup, thumb } }
    habitDays: {},          // { 'YYYY-MM-DD': habitId }
    habitChoice: null,      // { week: 'YYYY-MM-DD' (Monday), id }
    lessonsRead: [],        // lesson indexes
  },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const saved = JSON.parse(raw);
    const base = emptyState();
    return {
      ...base,
      ...saved,
      onboarding: { ...base.onboarding, ...saved.onboarding },
      nutrition: { ...base.nutrition, ...saved.nutrition },
    };
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
