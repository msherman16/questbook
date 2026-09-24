// First-run setup wizard. Rendered full-screen (outside the app shell) until
// settings.onboarded is true.
import { update, getState, replaceState, demoState, award, AVATARS, SUBJECT_ICONS, SUBJECT_COLORS } from '../store.js';
import { esc, uid, DAYS, fmtTime } from '../util.js';
import { icon, confetti } from '../ui.js';
import { colorVar } from '../components.js';

const STEPS = ['welcome', 'profile', 'classes', 'style', 'done'];
let step = 0;
let draft = null; // unsaved profile edits so re-renders never lose typing
let lastTimes = { start: '09:00', end: '09:50' };

const SUGGESTIONS = [
  ['Math', '📐'], ['English', '✍️'], ['Biology', '🧬'], ['Chemistry', '🧪'], ['Physics', '🔭'], ['History', '🏛️'],
  ['Geography', '🌍'], ['Spanish', '🗣️'], ['French', '🗣️'], ['Computer Science', '💻'], ['Art', '🎨'], ['Music', '🎵'], ['PE', '⚽'],
];

export function renderOnboarding(root) {
  const s = getState();
  draft ??= { ...s.profile };
  const name = STEPS[step];
  root.innerHTML = `
  <div class="onboard">
    <div class="onboard-card card" role="dialog" aria-modal="false" aria-labelledby="ob-title">
      ${step > 0 && step < STEPS.length - 1 ? `
      <div class="onboard-top">
        <button class="btn btn-sm btn-ghost" data-ob="back">${icon('chevronLeft', 16)}Back</button>
        <ol class="onboard-dots" aria-label="Step ${step} of ${STEPS.length - 2}">
          ${STEPS.slice(1, -1).map((_, i) => `<li class="${i + 1 < step ? 'is-done' : i + 1 === step ? 'is-current' : ''}"></li>`).join('')}
        </ol>
        <span class="small muted">Step ${step} of ${STEPS.length - 2}</span>
      </div>` : ''}
      ${SCREENS[name](s)}
    </div>
  </div>`;
  mount(root);
  root.querySelector('[data-autofocus]')?.focus();
}

const SCREENS = {
  welcome: () => `
    <div class="onboard-hero">
      <span class="brand-mark brand-mark-lg" aria-hidden="true">Q</span>
      <h1 id="ob-title">Welcome to Questbook</h1>
      <p class="lede">Your school year, played like a game. Plan classes and deadlines, track study time, keep notes in one place, and level up as you go.</p>
    </div>
    <ul class="onboard-features">
      <li><span aria-hidden="true">🗓️</span><div><strong>Plan</strong><span>Classes, schedule, assignments and key dates</span></div></li>
      <li><span aria-hidden="true">⏱️</span><div><strong>Focus</strong><span>A study timer that tracks time by class</span></div></li>
      <li><span aria-hidden="true">🎮</span><div><strong>Play</strong><span>Flashcards, quizzes and games for test prep</span></div></li>
      <li><span aria-hidden="true">⭐</span><div><strong>Level up</strong><span>XP, streaks, badges and daily quests</span></div></li>
    </ul>
    <div class="onboard-actions stack-sm">
      <button class="btn btn-primary btn-lg btn-block" data-ob="next" data-autofocus>Set up my planner ${icon('chevronRight', 18)}</button>
      <button class="btn btn-block" data-ob="demo">${icon('sparkles', 16)}Explore with demo data first</button>
    </div>
    <p class="tiny muted center onboard-privacy">${icon('eye', 14)} No account needed. Everything stays private in this browser on this device.</p>`,

  profile: () => `
    <h1 id="ob-title" class="onboard-title">What should we call you?</h1>
    <p class="muted">This is just for you — it shows on your dashboard.</p>
    <div class="stack">
      <label class="field"><span class="label">Name or nickname</span>
        <input class="input input-lg" data-draft="name" maxlength="40" value="${esc(draft.name)}" placeholder="e.g. Sam" autocomplete="nickname" data-autofocus></label>
      <fieldset class="field"><legend class="label">Pick an avatar</legend>
        <div class="emoji-picker emoji-picker-lg">${AVATARS.map((a) => `<label class="emoji-opt"><input type="radio" name="ob-avatar" data-draft="avatar" value="${a}" ${draft.avatar === a ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div>
      </fieldset>
      <label class="field"><span class="label">Pronouns <small class="muted">(optional)</small></span>
        <input class="input" data-draft="pronouns" maxlength="30" value="${esc(draft.pronouns)}" placeholder="e.g. they/them" list="ob-pronouns">
        <datalist id="ob-pronouns"><option>they/them</option><option>she/her</option><option>he/him</option><option>she/they</option><option>he/they</option><option>any pronouns</option></datalist>
      </label>
    </div>
    <div class="onboard-actions"><button class="btn btn-primary btn-lg btn-block" data-ob="next">Continue ${icon('chevronRight', 18)}</button></div>`,

  classes: (s) => `
    <h1 id="ob-title" class="onboard-title">Add your classes</h1>
    <p class="muted">Add what’s on your timetable. Meeting times build your weekly schedule — you can fine-tune everything later.</p>
    ${s.subjects.length ? `<ul class="ob-class-list">${s.subjects.map((sub) => `
      <li style="--c:${colorVar(sub.color)}">
        <span class="ob-class-icon" aria-hidden="true">${sub.icon}</span>
        <span class="ob-class-main"><strong>${esc(sub.name)}</strong><small class="muted">${sub.meetings.length ? `${sub.meetings.map((m) => DAYS[m.day]).join(', ')} · ${fmtTime(sub.meetings[0].start)}–${fmtTime(sub.meetings[0].end)}` : 'No meeting times'}</small></span>
        <button class="icon-btn" data-ob-remove="${sub.id}" aria-label="Remove ${esc(sub.name)}">${icon('x', 18)}</button>
      </li>`).join('')}</ul>` : ''}
    <form class="ob-class-form card" data-ob-form>
      <div class="ob-suggest" aria-label="Quick picks">${SUGGESTIONS.filter(([n]) => !s.subjects.some((x) => x.name === n)).slice(0, 8).map(([n, i]) => `<button type="button" class="ob-pill" data-suggest="${esc(n)}" data-icon="${i}">${i} ${n}</button>`).join('')}</div>
      <div class="field-row">
        <label class="field ob-name"><span class="label">Class name</span><input class="input" name="className" maxlength="60" placeholder="e.g. Algebra II" ${s.subjects.length ? '' : 'data-autofocus'}></label>
        <label class="field ob-icon"><span class="label">Icon</span><select class="input" name="classIcon">${(() => {
          const next = SUBJECT_ICONS.find((i) => !s.subjects.some((x) => x.icon === i)) || SUBJECT_ICONS[0];
          return SUBJECT_ICONS.map((i) => `<option ${i === next ? 'selected' : ''}>${i}</option>`).join('');
        })()}</select></label>
      </div>
      <fieldset class="field"><legend class="label">Meets on</legend>
        <div class="ob-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="ob-day"><input type="checkbox" name="day" value="${d}" ${d >= 1 && d <= 5 ? 'checked' : ''}><span>${DAYS[d]}</span></label>`).join('')}</div>
      </fieldset>
      <div class="field-row">
        <label class="field"><span class="label">Starts</span><input class="input" type="time" name="start" value="${lastTimes.start}"></label>
        <label class="field"><span class="label">Ends</span><input class="input" type="time" name="end" value="${lastTimes.end}"></label>
      </div>
      <p class="form-error" hidden></p>
      <button class="btn">${icon('plus', 16)}Add class</button>
    </form>
    <div class="onboard-actions">
      <button class="btn btn-primary btn-lg btn-block" data-ob="next">${s.subjects.length ? `Continue with ${s.subjects.length} ${s.subjects.length === 1 ? 'class' : 'classes'}` : 'Skip for now'} ${icon('chevronRight', 18)}</button>
    </div>`,

  style: (s) => {
    const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" class="seg-btn" data-ob-set="${key}" data-value="${v}" aria-pressed="${String(s.settings[key]) === String(v)}">${l}</button>`).join('')}</div>`;
    return `
    <h1 id="ob-title" class="onboard-title">How do you like to study?</h1>
    <p class="muted">You can change any of these later in Settings.</p>
    <div class="stack">
      <div class="setting"><div><strong>Focus block length</strong><p class="small muted">25 minutes is the classic Pomodoro.</p></div>${seg('focusMin', [[15, '15m'], [25, '25m'], [45, '45m'], [50, '50m']])}</div>
      <div class="setting"><div><strong>Break length</strong></div>${seg('breakMin', [[5, '5m'], [10, '10m'], [15, '15m']])}</div>
      <div class="setting"><div><strong>Theme</strong></div>${seg('theme', [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}</div>
      <div class="setting"><div><strong>Text size</strong></div>${seg('textSize', [['normal', 'Default'], ['large', 'Large'], ['xl', 'Extra large']])}</div>
      <div class="setting"><div><strong>Reduce motion</strong><p class="small muted">Turns off confetti and animations.</p></div>${seg('reduceMotion', [[false, 'Off'], [true, 'On']])}</div>
    </div>
    <div class="onboard-actions"><button class="btn btn-primary btn-lg btn-block" data-ob="next">Finish setup ${icon('check', 18)}</button></div>`;
  },

  done: (s) => `
    <div class="onboard-hero">
      <div class="onboard-avatar" aria-hidden="true">${s.profile.avatar}</div>
      <h1 id="ob-title">You’re all set${s.profile.name ? `, ${esc(s.profile.name)}` : ''}!</h1>
      <p class="lede">You just earned your first <strong class="text-xp">25 XP</strong>. Here’s how to keep it going:</p>
    </div>
    <ol class="onboard-next">
      <li><span aria-hidden="true">📝</span><div><strong>Add what’s due</strong><span>Homework, tests and key dates — check them off for XP.</span></div></li>
      <li><span aria-hidden="true">⏱️</span><div><strong>Start a focus block</strong><span>Every focused minute earns 2 XP and builds your streak.</span></div></li>
      <li><span aria-hidden="true">🃏</span><div><strong>Make a flashcard deck</strong><span>Paste “term :: meaning” lines and four study games unlock.</span></div></li>
    </ol>
    <div class="onboard-actions"><button class="btn btn-primary btn-lg btn-block" data-ob="finish" data-autofocus>Go to my dashboard ${icon('chevronRight', 18)}</button></div>
    <p class="tiny muted center">Need a hand later? Open <strong>Help & Setup</strong> in the menu.</p>`,
};

function saveDraft(root) {
  root.querySelectorAll('[data-draft]').forEach((el) => {
    if (el.type === 'radio' && !el.checked) return;
    draft[el.dataset.draft] = el.value.trim();
  });
}

function go(root, n) {
  step = Math.max(0, Math.min(STEPS.length - 1, n));
  renderOnboarding(root);
  window.scrollTo(0, 0);
}

function mount(root) {
  const card = root.querySelector('.onboard-card');
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ob],[data-ob-set],[data-ob-remove],[data-suggest]');
    if (!b) return;
    if (b.dataset.suggest) {
      const f = root.querySelector('[data-ob-form]');
      f.elements.className.value = b.dataset.suggest;
      f.elements.classIcon.value = b.dataset.icon;
      f.elements.className.focus();
      return;
    }
    if (b.dataset.obRemove) return update((s) => (s.subjects = s.subjects.filter((x) => x.id !== b.dataset.obRemove)));
    if (b.dataset.obSet) {
      const raw = b.dataset.value;
      const v = raw === 'true' ? true : raw === 'false' ? false : /^\d+$/.test(raw) ? +raw : raw;
      return update((s) => (s.settings[b.dataset.obSet] = v));
    }
    const a = b.dataset.ob;
    if (a === 'back') return go(root, step - 1);
    if (a === 'demo') {
      step = 0;
      draft = null;
      replaceState(demoState());
      return;
    }
    if (a === 'next') {
      if (STEPS[step] === 'profile') {
        saveDraft(root);
        update((s) => Object.assign(s.profile, draft));
      }
      if (STEPS[step] === 'style') {
        // Reaching the last screen is the reward moment.
        update((s) => award(s, 25, 'Finished setup'));
        confetti();
      }
      return go(root, step + 1);
    }
    if (a === 'finish') {
      step = 0;
      draft = null;
      location.hash = '#/home';
      update((s) => (s.settings.onboarded = true));
    }
  });
  card.addEventListener('input', (e) => {
    if (e.target.dataset.draft) saveDraft(root);
  });
  card.addEventListener('change', (e) => {
    if (e.target.dataset.draft) saveDraft(root);
  });
  root.querySelector('[data-ob-form]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.className.value.trim();
    const days = [...e.target.querySelectorAll('[name=day]:checked')].map((x) => +x.value);
    const err = e.target.querySelector('.form-error');
    if (!name) return Object.assign(err, { hidden: false, textContent: 'Type a class name or tap a quick pick.' });
    if (days.length && (!f.start.value || !f.end.value || f.end.value <= f.start.value)) return Object.assign(err, { hidden: false, textContent: 'The end time needs to be after the start time.' });
    lastTimes = { start: f.start.value || lastTimes.start, end: f.end.value || lastTimes.end };
    update((s) => {
      const used = new Set(s.subjects.map((x) => x.color));
      s.subjects.push({
        id: uid(), name, icon: f.classIcon.value, teacher: '', room: '',
        color: SUBJECT_COLORS.find((c) => !used.has(c)) || SUBJECT_COLORS[s.subjects.length % SUBJECT_COLORS.length],
        meetings: days.map((day) => ({ day, start: f.start.value, end: f.end.value })),
      });
    });
    root.querySelector('[data-ob-form] [name=className]')?.focus();
  });
}
