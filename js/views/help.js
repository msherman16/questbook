// In-app getting-started guide, install instructions, privacy notes and FAQ.
import { update, getState, replaceState, demoState } from '../store.js';
import { icon, confirmDialog, toast } from '../ui.js';

// Chrome/Edge/Android fire this when the app can be installed; keep it for the Install button.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
});
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const QUICK_START = [
  ['🎒', 'Add your classes', 'Give each class a color, icon and meeting times. Your weekly schedule builds itself.', '#/classes', 'Open Classes'],
  ['📝', 'Add what’s due', 'Homework, quizzes, tests, projects and key dates like exam week. Check them off for XP.', '#/assignments', 'Open Assignments'],
  ['🗺️', 'Plan for tests', 'On any quiz or test, tap “Prep plan” to schedule short review sessions before the day.', '#/assignments', 'See assignments'],
  ['⏱️', 'Study with the timer', 'Pick a class and start a focus block. Every focused minute earns 2 XP.', '#/timer', 'Open Timer'],
  ['📎', 'Build your notes library', 'Drop in PDFs, photos of the board and handouts, or write notes from a template.', '#/notes', 'Open Notes'],
  ['🃏', 'Make a flashcard deck', 'Paste “term :: meaning” lines, then play Flashcards, Quiz Show, Match Rush and Speed Recall.', '#/games', 'Open Games'],
];

const FAQ = [
  ['Do I need an account?', 'No. Questbook runs entirely in your browser. There’s nothing to sign up for and no password to remember.'],
  ['Who can see my data?', 'Only you. Your classes, notes and files are saved in this browser on this device and are never uploaded to a server — not even to us.'],
  ['Will it work offline?', 'Yes, after your first visit. Install it to your home screen and it opens like a normal app, even without Wi-Fi.'],
  ['How do I move to a new phone or computer?', 'Go to Settings → Export backup, send the .json file to your new device, then Settings → Import backup there. Uploaded files aren’t in the backup, so re-upload any you need.'],
  ['What happens if I clear my browser data?', 'Your Questbook data is cleared too. Export a backup now and then (Settings → Export backup) so you can restore it.'],
  ['Can I use it on more than one device?', 'Each device keeps its own copy. Use Export/Import to copy your planner from one to another.'],
  ['Which browsers work?', 'Current versions of Chrome, Edge, Safari (Mac, iPhone and iPad) and Firefox.'],
];

export default {
  title: 'Help & Setup',
  render(s) {
    return `
    <header class="page-head">
      <div><p class="eyebrow">You</p><h1>Help & Setup</h1><p class="lede">Everything you need to get Questbook working for you, in about five minutes.</p></div>
      <div class="hero-actions"><button class="btn" data-action="wizard">${icon('reset', 16)}Run setup again</button></div>
    </header>

    <section aria-labelledby="h-quick">
      <div class="section-head"><h2 id="h-quick">Quick start</h2></div>
      <ol class="help-steps">
        ${QUICK_START.map(([emoji, title, text, href, cta], i) => `
          <li class="card card-pad">
            <span class="help-num" aria-hidden="true">${i + 1}</span>
            <div class="stack-sm">
              <h3><span aria-hidden="true">${emoji}</span> ${title}</h3>
              <p class="small">${text}</p>
              <a class="link" href="${href}">${cta} →</a>
            </div>
          </li>`).join('')}
      </ol>
    </section>

    <section class="card card-pad stack" aria-labelledby="h-install">
      <div class="card-head"><h2 id="h-install">Install it like an app</h2>${standalone() ? '<span class="xp-tag is-earned">Installed ✓</span>' : ''}</div>
      <p class="small muted">Installing gives you a home-screen icon, a full-screen window and offline access. It’s free and takes a few seconds.</p>
      ${installPrompt && !standalone() ? `<div><button class="btn btn-primary" data-action="install">${icon('download', 16)}Install Questbook</button></div>` : ''}
      <div class="help-install">
        <div><h3 class="h4">📱 iPhone & iPad</h3><ol class="small"><li>Open this page in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button.</li><li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol></div>
        <div><h3 class="h4">🤖 Android</h3><ol class="small"><li>Open this page in <strong>Chrome</strong>.</li><li>Tap the <strong>⋮</strong> menu.</li><li>Choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li></ol></div>
        <div><h3 class="h4">💻 Computer</h3><ol class="small"><li>Open this page in <strong>Chrome</strong> or <strong>Edge</strong>.</li><li>Click the <strong>install icon</strong> at the right end of the address bar.</li><li>Click <strong>Install</strong>.</li></ol></div>
      </div>
    </section>

    <div class="dash-grid">
      <section class="card card-pad stack-sm" aria-labelledby="h-privacy">
        <h2 id="h-privacy" class="h3">🔒 Your data & privacy</h2>
        <ul class="help-bullets small">
          <li>Everything is stored <strong>only on this device</strong>, in this browser.</li>
          <li>No accounts, no tracking, no ads. Nothing is uploaded.</li>
          <li>Clearing your browser’s site data erases your planner — <strong>export a backup</strong> regularly.</li>
          <li>On a shared computer, use <strong>Settings → Erase everything</strong> when you’re done.</li>
        </ul>
        <div class="row-actions"><a class="btn btn-sm" href="#/settings">${icon('download', 16)}Back up my data</a></div>
      </section>
      <section class="card card-pad stack-sm" aria-labelledby="h-xp">
        <h2 id="h-xp" class="h3">⭐ How XP works</h2>
        <ul class="help-bullets small">
          <li>Finish homework +20, quizzes +30, tests +50, projects +60.</li>
          <li>Finish 2+ days early for a +10 bonus.</li>
          <li>+2 XP for every focused minute and every flashcard you get right.</li>
          <li>Daily quests, badges and a streak for studying every day.</li>
        </ul>
        <div class="row-actions"><a class="btn btn-sm" href="#/progress">${icon('trophy', 16)}See my progress</a></div>
      </section>
    </div>

    <section class="card card-pad" aria-labelledby="h-faq">
      <div class="card-head"><h2 id="h-faq">Questions</h2></div>
      <div class="faq">
        ${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p class="small">${a}</p></details>`).join('')}
      </div>
    </section>

    <section class="card card-pad stack-sm" aria-labelledby="h-reset">
      <h2 id="h-reset" class="h3">Start over or explore</h2>
      <p class="small muted">Run the setup wizard again (keeps your data), or load the demo semester to look around.${s.isDemo ? ' You’re viewing demo data right now.' : ''}</p>
      <div class="row-actions">
        <button class="btn" data-action="wizard">${icon('reset', 16)}Run setup again</button>
        ${s.isDemo ? '' : `<button class="btn btn-ghost" data-action="demo">${icon('sparkles', 16)}Load demo data</button>`}
      </div>
    </section>`;
  },
  mount(el) {
    el.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'wizard') update((s) => (s.settings.onboarded = false));
      if (a === 'install' && installPrompt) {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        installPrompt = null;
        if (outcome === 'accepted') toast('Installed! Look for Questbook on your home screen.', { kind: 'success', emoji: '📲' });
        update(() => {});
      }
      if (a === 'demo' && (await confirmDialog('Replace your current data with the demo semester? Export a backup first if you want to keep it.', { title: 'Load demo data?', confirmLabel: 'Load demo' }))) {
        replaceState(demoState());
      }
    });
  },
};
