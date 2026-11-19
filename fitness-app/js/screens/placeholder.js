// Tabs that come in later stages.
import { t } from '../i18n.js';
import { esc, tabShell } from '../ui.js';

const TITLES = { program: 'tabProgram', progress: 'tabProgress', friends: 'tabFriends' };

export const placeholder = (tab) => (root) => {
  root.innerHTML = tabShell(tab, t(TITLES[tab]), `
    <section class="card empty">
      <p>${esc(t('soon'))}</p>
    </section>`);
};
