import * as store from './store.js';
import { icon, toast, confetti, chime, confirmDialog } from './ui.js';
import { clearFiles } from './files.js';
import { esc, fmtClock } from './util.js';

import home from './views/home.js';
import classes from './views/classes.js';
import schedule from './views/schedule.js';
import assignments from './views/assignments.js';
import timer from './views/timer.js';
import notes from './views/notes.js';
import games from './views/games.js';
import progress from './views/progress.js';
import design from './views/design.js';
import settings from './views/settings.js';
import help from './views/help.js';
import { renderOnboarding } from './views/onboarding.js';

const ROUTES = { home, classes, schedule, assignments, timer, notes, games, progress, design, settings, help };

const NAV = [
  { group: 'Plan', items: [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'classes', label: 'Classes & Subjects', icon: 'layers' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar' },
    { id: 'assignments', label: 'Assignments & Dates', icon: 'checklist' },
  ] },
  { group: 'Study', items: [
    { id: 'timer', label: 'Study Timer', icon: 'timer' },
    { id: 'notes', label: 'Notes Library', icon: 'folder' },
    { id: 'games', label: 'Study Games', icon: 'gamepad' },
  ] },
  { group: 'You', items: [
    { id: 'progress', label: 'Progress & Badges', icon: 'trophy' },
    { id: 'design', label: 'Design System', icon: 'palette' },
    { id: 'settings', label: 'Settings', icon: 'sliders' },
    { id: 'help', label: 'Help & Setup', icon: 'bulb' },
  ] },
];

let currentId = null;
let currentView = null;

const route = () => {
  const [id, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { id: ROUTES[id] ? id : 'home', params: rest };
};

function shell() {
  document.getElementById('app').innerHTML = `
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="shell">
    <header class="topbar">
      <button class="icon-btn" data-nav-toggle aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button>
      <a class="brand" href="#/home"><span class="brand-mark" aria-hidden="true">Q</span>Questbook</a>
      <span class="xp-pill" data-xp-pill></span>
    </header>
    <aside class="sidebar" id="sidebar" aria-label="Main">
      <a class="brand hide-mobile" href="#/home"><span class="brand-mark" aria-hidden="true">Q</span>Questbook</a>
      <a class="profile-card" href="#/progress" data-profile></a>
      <a class="mini-timer" href="#/timer" data-mini-timer hidden></a>
      <nav class="nav">
        ${NAV.map((g) => `
          <div class="nav-group">
            <div class="nav-heading">${g.group}</div>
            ${g.items.map((it) => `<a class="nav-link" href="#/${it.id}" data-route="${it.id}">${icon(it.icon)}<span>${it.label}</span></a>`).join('')}
          </div>`).join('')}
      </nav>
      <button class="theme-toggle" data-theme-toggle>${icon('moon', 18)}<span>Theme</span></button>
    </aside>
    <div class="scrim" data-nav-toggle></div>
    <main class="main" id="main" tabindex="-1"></main>
  </div>`;

  document.querySelectorAll('[data-nav-toggle]').forEach((b) => b.addEventListener('click', () => setNav(!document.querySelector('.shell').classList.contains('nav-open'))));
  document.querySelector('.sidebar').addEventListener('click', (e) => {
    if (e.target.closest('a')) setNav(false);
  });
  document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    store.update((s) => (s.settings.theme = order[(order.indexOf(s.settings.theme) + 1) % 3]));
    toast(`Theme: ${store.getState().settings.theme}`, { emoji: '🎨', timeout: 1500 });
  });
}

function setNav(open) {
  document.querySelector('.shell').classList.toggle('nav-open', open);
  document.querySelector('.topbar [data-nav-toggle]').setAttribute('aria-expanded', String(open));
}

function renderChrome(s) {
  const lv = store.levelInfo(s.xp);
  const st = store.streak(s);
  document.querySelector('[data-profile]').innerHTML = `
    <span class="avatar" aria-hidden="true">${s.profile.avatar}</span>
    <span class="profile-meta">
      <span class="profile-name">${esc(s.profile.name || 'Student')}</span>
      <span class="profile-sub">Lv ${lv.level} · ${lv.title}${st ? ` · 🔥 ${st}` : ''}</span>
      <span class="progress progress-xp progress-thin"><span style="width:${lv.pct}%"></span></span>
    </span>`;
  document.querySelector('[data-xp-pill]').innerHTML = `${icon('star', 14)} ${s.xp} XP`;
  document.querySelectorAll('.nav-link').forEach((a) => {
    if (a.dataset.route === currentId) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const themeIcon = s.settings.theme === 'dark' ? 'moon' : s.settings.theme === 'light' ? 'sun' : 'sparkles';
  document.querySelector('[data-theme-toggle]').innerHTML = `${icon(themeIcon, 18)}<span>Theme: ${s.settings.theme}</span>`;
  renderMiniTimer(s);
}

function renderMiniTimer(s) {
  const el = document.querySelector('[data-mini-timer]');
  const t = s.timer;
  const active = t.running || t.remainingMs != null;
  el.hidden = !active || currentId === 'timer';
  if (!el.hidden) {
    el.innerHTML = `${icon(t.running ? 'timer' : 'pause', 18)}<span>${t.mode === 'focus' ? 'Focus' : 'Break'}</span><strong data-timer-text>${fmtClock(store.timerRemaining(s))}</strong>`;
  }
}

function applySettings(s) {
  const root = document.documentElement;
  if (s.settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.settings.theme;
  root.dataset.text = s.settings.textSize;
  if (s.settings.reduceMotion) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
}

function renderView({ focus = false } = {}) {
  const { id, params } = route();
  const s = store.getState();
  if (id !== currentId) currentView?.leave?.();
  const changed = id !== currentId;
  currentId = id;
  currentView = ROUTES[id];
  const main = document.getElementById('main');
  const el = document.createElement('div');
  el.className = `view view-${id}`;
  el.innerHTML = (s.isDemo ? demoBanner() : '') + currentView.render(s, params);
  main.replaceChildren(el);
  currentView.mount?.(el, s, params);
  document.title = `${currentView.title} · Questbook`;
  renderChrome(s);
  if (changed) {
    window.scrollTo(0, 0);
    if (focus) main.focus({ preventScroll: true });
  }
}

store.onEvent((e) => {
  const s = store.getState();
  if (e.type === 'xp' && e.amount > 0 && e.amount >= 10) toast(`+${e.amount} XP · ${esc(e.reason)}`, { kind: 'xp', emoji: '⭐', timeout: 2400 });
  if (e.type === 'level') {
    toast(`Level up! You’re now level ${e.level} — ${e.title}`, { kind: 'xp', emoji: '🚀', timeout: 4500 });
    confetti();
  }
  if (e.type === 'badge') {
    toast(`Badge unlocked: <strong>${e.badge.name}</strong>`, { kind: 'success', emoji: e.badge.emoji, timeout: 4500 });
    confetti();
  }
  if (e.type === 'timer-done') {
    if (s.settings.sound) chime();
    toast(e.wasFocus ? 'Focus block complete — take a break!' : 'Break’s over. Ready for another round?', { kind: 'success', emoji: e.wasFocus ? '🎉' : '☕', timeout: 5000 });
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Questbook', { body: e.wasFocus ? 'Focus block complete — take a break!' : 'Break’s over.' });
    }
  }
  if (e.type === 'error') toast(e.message, { kind: 'error', emoji: '⚠️', timeout: 6000 });
});

// Timer ticks update only the clock elements, never the whole view.
setInterval(() => {
  store.timerTick();
  const s = store.getState();
  if (!s.timer.running) return;
  const text = fmtClock(store.timerRemaining(s));
  document.querySelectorAll('[data-timer-text]').forEach((n) => (n.textContent = text));
  document.querySelectorAll('[data-timer-ring]').forEach((ring) => {
    const total = (s.timer.plannedMin || 1) * 60000;
    ring.style.strokeDashoffset = String(ring.dataset.c * (1 - store.timerRemaining(s) / total));
  });
  document.title = `${text} · ${s.timer.mode === 'focus' ? 'Focus' : 'Break'} · Questbook`;
}, 1000);

function demoBanner() {
  return `<div class="demo-banner" role="note">
    <span aria-hidden="true">✨</span>
    <span><strong>You’re exploring demo data.</strong> Look around, then set up your own planner when you’re ready.</span>
    <button class="btn btn-sm btn-primary" data-start-fresh>Set up my planner</button>
  </div>`;
}

document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-start-fresh]')) return;
  const ok = await confirmDialog('This clears the demo data and opens the setup wizard.', { title: 'Set up your own planner?', confirmLabel: 'Start setup', danger: false });
  if (!ok) return;
  await clearFiles().catch(() => {});
  store.startFresh();
});

// The app shell only exists once setup is finished; before that the wizard owns the page.
let shellMounted = false;
function render() {
  const s = store.getState();
  applySettings(s);
  if (!s.settings.onboarded) {
    currentView?.leave?.();
    currentView = null;
    currentId = null;
    shellMounted = false;
    renderOnboarding(document.getElementById('app'));
    return;
  }
  if (!shellMounted) {
    shell();
    shellMounted = true;
  }
  if (currentView?.shouldRerender?.(s) === false) return renderChrome(s);
  renderView();
}

store.init();
render();
store.subscribe(render);
window.addEventListener('hashchange', () => shellMounted && renderView({ focus: true }));

// Offline support + "install as app". Only on https or localhost, where service workers are allowed.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
