// Profile and settings (minimal for the skeleton).
import { t, tr, getLang, setLang, LANGS } from '../i18n.js';
import { esc, go } from '../ui.js';
import { store } from '../store.js';
import { signOut } from '../auth.js';
import { PROGRAM_BY_ID } from '../data/programs.js';

const GOALS = { lose: 'goalLose', recomp: 'goalRecomp', gain: 'goalGain', maintain: 'goalMaintain' };

export function profile(root, { rerender }) {
  const s = store.get();
  const program = PROGRAM_BY_ID[s.plan?.program];

  root.innerHTML = `
    <header class="topbar">
      <a href="#/today" class="back">← ${esc(t('back'))}</a>
      <h1>${esc(t('profile'))}</h1>
    </header>
    <main class="content">
      <section class="card">
        <h2>${esc(s.profile?.name ?? '')}</h2>
        <p class="muted">${esc(s.profile?.age)} · ${esc(s.profile?.height)} ${esc(t('cm'))} · ${esc(s.profile?.weight)} ${esc(t('kg'))}</p>
        ${program ? `<p>${esc(t('myPlan'))}: <b>${esc(tr(program.name))}</b></p>` : ''}
        ${s.plan ? `<p>${esc(t('goal'))}: <b>${esc(t(GOALS[s.plan.goal]))}</b> · ${s.plan.targets.kcal} ${esc(t('kcal'))} · ${s.plan.targets.protein} ${esc(t('g'))}</p>` : ''}
      </section>

      <section class="card">
        <p class="label">${esc(t('language'))}</p>
        <div class="chips">
          ${LANGS.map((l) => `<button type="button" data-lang="${l}" class="chip ${l === getLang() ? 'on' : ''}">${l === 'ru' ? 'Русский' : 'English'}</button>`).join('')}
        </div>
      </section>

      <section class="card stack">
        ${s.session?.mode === 'local' ? `<p class="muted small">${esc(t('dataLocal'))}</p>` : ''}
        <button type="button" class="btn ghost" data-act="signout">${esc(t('signOut'))}</button>
        <button type="button" class="btn danger" data-act="reset">${esc(t('resetAll'))}</button>
      </section>

      <p class="muted small">${esc(t('disclaimer'))}</p>
    </main>`;

  root.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    store.update((st) => { st.settings.lang = b.dataset.lang; });
    setLang(b.dataset.lang);
    rerender();
  }));
  root.querySelector('[data-act="signout"]').addEventListener('click', async () => {
    await signOut();
    go('/welcome');
  });
  root.querySelector('[data-act="reset"]').addEventListener('click', () => {
    if (!confirm(t('resetConfirm'))) return;
    store.reset();
    go('/welcome');
  });
}
