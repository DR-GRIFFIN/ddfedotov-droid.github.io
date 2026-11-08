// Service worker: app shell works offline.
// Network first, cache as fallback, so new versions arrive without manual cache busting.
const CACHE = 'orleans-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './js/i18n.js',
  './js/store.js',
  './js/auth.js',
  './js/ui.js',
  './js/dates.js',
  './js/data/exercises.js',
  './js/data/programs.js',
  './js/data/cues.js',
  './js/data/nutrition.js',
  './js/logic/portions.js',
  './js/logic/workout.js',
  './js/logic/nutrition.js',
  './js/logic/screening.js',
  './js/logic/recommend.js',
  './js/logic/today.js',
  './js/screens/welcome.js',
  './js/screens/onboarding.js',
  './js/screens/health-stop.js',
  './js/screens/recommendation.js',
  './js/screens/today.js',
  './js/screens/profile.js',
  './js/screens/placeholder.js',
  './js/screens/checkin.js',
  './js/screens/workout.js',
  './js/screens/nutrition.js',
  './js/screens/weight.js',
  './figures/leg_press.html',
  './figures/leg_press-light.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
