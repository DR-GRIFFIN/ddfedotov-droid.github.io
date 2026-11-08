// Entry point: language, session, hash router with guards.
import { store } from './store.js';
import { setLang, detectLang } from './i18n.js';
import { restoreSession } from './auth.js';
import { welcome } from './screens/welcome.js';
import { onboarding } from './screens/onboarding.js';
import { healthStop } from './screens/health-stop.js';
import { recommendation } from './screens/recommendation.js';
import { today } from './screens/today.js';
import { profile } from './screens/profile.js';
import { placeholder } from './screens/placeholder.js';
import { workout } from './screens/workout.js';
import { settleStale } from './logic/workout.js';

const root = document.getElementById('app');

const ROUTES = {
  welcome,
  onboarding,
  'health-stop': healthStop,
  plan: recommendation,
  today,
  profile,
  workout,
  program: placeholder('program'),
  nutrition: placeholder('nutrition'),
  progress: placeholder('progress'),
  friends: placeholder('friends'),
};

// Where the user must be, given their progress. Returns a path or null if the request is fine.
function guard(name, state) {
  if (!state.session) return name === 'welcome' ? null : '/welcome';
  if (!state.onboarding.done) return name === 'onboarding' ? null : `/onboarding/${state.onboarding.step}`;
  if (!state.plan?.confirmed) return ['plan', 'health-stop'].includes(name) ? null : '/plan';
  if (['welcome', 'onboarding', 'plan'].includes(name)) return '/today';
  if (name === 'workout' && (!state.active || (state.health?.blocked && !state.health?.clearedAt))) return '/today';
  return null;
}

let lastPath = null;

function route() {
  const [name = 'today', ...params] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const target = guard(ROUTES[name] ? name : 'today', store.get());
  if (target) {
    location.replace('#' + target);
    return;
  }
  const screen = ROUTES[name] ?? today;
  screen(root, { params, rerender: route });
  // Scroll to top only when moving to another screen, not on a re-render of the same one.
  if (location.hash !== lastPath) window.scrollTo(0, 0);
  lastPath = location.hash;
}

async function start() {
  const state = store.get();
  setLang(state.settings.lang ?? detectLang());
  await restoreSession();
  store.update(settleStale);
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start();
