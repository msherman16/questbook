// Living style guide: renders the real tokens and components used by the app.
import { SUBJECT_COLORS, AVATARS } from '../store.js';
import { icon, progressBar, toast } from '../ui.js';

const swatch = (name, varName, note = '') =>
  `<div class="ds-swatch"><span class="ds-chip" style="background:var(${varName})"></span><span><strong>${name}</strong><code>${varName}</code>${note ? `<small class="muted">${note}</small>` : ''}</span></div>`;

export default {
  title: 'Design System',
  render() {
    return `
    <header class="page-head">
      <div><p class="eyebrow">You</p><h1>Design System</h1>
      <p class="lede">“Field Notes” — a calm, gender-neutral, accessibility-first system. Every screen in Questbook is built only from these tokens and components.</p></div>
    </header>

    <section class="card card-pad stack" aria-labelledby="ds-principles">
      <h2 id="ds-principles">Principles</h2>
      <div class="ds-principles">
        <div><span class="ds-emoji" aria-hidden="true">🧭</span><h3 class="h4">Neutral by default</h3><p class="small">Color never encodes gender. The brand leans on spruce green and marigold — no pink-vs-blue coding. Avatars are creatures and objects, not gendered people.</p></div>
        <div><span class="ds-emoji" aria-hidden="true">🗣️</span><h3 class="h4">Inclusive language</h3><p class="small">Copy speaks to “you”. Teacher names show without Mr./Ms. The profile asks only for a name and an avatar.</p></div>
        <div><span class="ds-emoji" aria-hidden="true">👓</span><h3 class="h4">Readable first</h3><p class="small">Atkinson Hyperlegible for body text (designed for low-vision readers) and Lexend for headings. Text contrast meets WCAG AA in both themes.</p></div>
        <div><span class="ds-emoji" aria-hidden="true">🎮</span><h3 class="h4">Playful, not childish</h3><p class="small">Rewards use gold, confetti and emoji sparingly. Everything that moves respects “Reduce motion”.</p></div>
        <div><span class="ds-emoji" aria-hidden="true">🎨</span><h3 class="h4">Color is never alone</h3><p class="small">Subject colors always pair with an icon and a name; status uses text and icons as well as color.</p></div>
        <div><span class="ds-emoji" aria-hidden="true">👆</span><h3 class="h4">Comfortable targets</h3><p class="small">Controls are at least 40px tall, every action is keyboard-reachable, and focus rings are always visible.</p></div>
      </div>
    </section>

    <section class="card card-pad stack" aria-labelledby="ds-color">
      <h2 id="ds-color">Color</h2>
      <h3 class="h4">Brand & feedback</h3>
      <div class="ds-swatches">
        ${swatch('Spruce', '--primary', 'Primary actions, focus')}
        ${swatch('Spruce soft', '--primary-soft', 'Selected states')}
        ${swatch('Marigold', '--xp', 'XP, rewards, levels')}
        ${swatch('Success', '--success')}
        ${swatch('Warning', '--warning')}
        ${swatch('Danger', '--danger')}
        ${swatch('Info', '--info')}
      </div>
      <h3 class="h4">Surfaces & text</h3>
      <div class="ds-swatches">
        ${swatch('Paper', '--bg')}${swatch('Surface', '--surface')}${swatch('Surface 2', '--surface-2')}${swatch('Border', '--border')}
        ${swatch('Ink', '--text')}${swatch('Ink 2', '--text-2')}${swatch('Ink 3', '--text-3')}
      </div>
      <h3 class="h4">Subject palette</h3>
      <p class="small muted">Eight evenly spaced hues named after nature, not people. Each is tuned per theme so chips and blocks stay legible.</p>
      <div class="ds-swatches">${SUBJECT_COLORS.map((c) => swatch(c[0].toUpperCase() + c.slice(1), `--c-${c}`)).join('')}</div>
    </section>

    <section class="card card-pad stack" aria-labelledby="ds-type">
      <h2 id="ds-type">Typography</h2>
      <div class="ds-type">
        <div><span class="tiny muted">Display · Lexend 700 · --fs-3xl</span><p style="font:700 var(--fs-3xl)/1.1 var(--font-display); margin:0">Level up your week</p></div>
        <div><span class="tiny muted">H1 · Lexend 700 · --fs-2xl</span><p style="font:700 var(--fs-2xl)/1.2 var(--font-display); margin:0">Assignments & Key Dates</p></div>
        <div><span class="tiny muted">H2 · Lexend 600 · --fs-xl</span><p style="font:600 var(--fs-xl)/1.2 var(--font-display); margin:0">Due soon</p></div>
        <div><span class="tiny muted">Body · Atkinson Hyperlegible 400 · --fs-md</span><p style="margin:0">Finish two days early to earn a bonus. Il1 O0 — distinct letterforms help every reader.</p></div>
        <div><span class="tiny muted">Small · --fs-sm</span><p class="small" style="margin:0">Resets at midnight</p></div>
      </div>
    </section>

    <section class="card card-pad stack" aria-labelledby="ds-comp">
      <h2 id="ds-comp">Components</h2>
      <h3 class="h4">Buttons</h3>
      <div class="row-actions">
        <button class="btn btn-primary" data-demo>${icon('play', 18)}Primary</button>
        <button class="btn" data-demo>Secondary</button>
        <button class="btn btn-ghost" data-demo>Ghost</button>
        <button class="btn btn-xp" data-demo>+30 XP</button>
        <button class="btn btn-danger" data-demo>${icon('trash', 18)}Danger</button>
        <button class="btn btn-primary" disabled>Disabled</button>
        <button class="icon-btn" aria-label="Icon button" data-demo>${icon('edit')}</button>
      </div>
      <h3 class="h4">Chips, badges & tags</h3>
      <div class="row-actions">
        <span class="chip" style="--c:var(--c-sky)"><span aria-hidden="true">📐</span>Algebra II</span>
        <span class="chip" style="--c:var(--c-moss)"><span aria-hidden="true">🧬</span>Biology</span>
        <span class="badge badge-homework">Homework</span><span class="badge badge-quiz">Quiz</span><span class="badge badge-test">Test</span><span class="badge badge-project">Project</span><span class="badge badge-keydate">Key date</span><span class="badge badge-study">Study block</span>
        <span class="xp-tag">+50 XP</span><span class="tag">#unit3</span>
      </div>
      <h3 class="h4">Progress</h3>
      <div class="stack-sm" style="max-width:420px">${progressBar(64, { label: 'Primary' })}${progressBar(40, { tone: 'xp', label: 'XP' })}${progressBar(100, { tone: 'success', label: 'Success' })}</div>
      <h3 class="h4">Form controls</h3>
      <div class="field-row" style="max-width:640px">
        <label class="field"><span class="label">Text input</span><input class="input" placeholder="Placeholder"></label>
        <label class="field"><span class="label">Select</span><select class="input"><option>Option</option></select></label>
      </div>
      <div class="seg" role="group" aria-label="Segmented example"><button class="seg-btn" aria-pressed="true">Week</button><button class="seg-btn" aria-pressed="false">Month</button><button class="seg-btn" aria-pressed="false">List</button></div>
      <h3 class="h4">Task row</h3>
      <ul class="task-list card" style="max-width:640px">
        <li class="task" style="--c:var(--c-iris)">
          <button class="check" aria-pressed="false" aria-label="Example checkbox">${icon('check', 16)}</button>
          <div class="task-main"><div class="task-title">Read Ch. 7</div><div class="task-meta"><span class="chip" style="--c:var(--c-iris)"><span aria-hidden="true">✍️</span>English Lit</span><span class="badge badge-homework">Homework</span><span class="due is-soon">${icon('calendar', 14)}Tomorrow</span></div></div>
          <span class="xp-tag">+20 XP</span>
        </li>
      </ul>
      <h3 class="h4">Avatars</h3>
      <div class="row-actions">${AVATARS.map((a) => `<span class="avatar" aria-hidden="true">${a}</span>`).join('')}</div>
    </section>

    <section class="card card-pad stack" aria-labelledby="ds-tokens">
      <h2 id="ds-tokens">Spacing, radius & elevation</h2>
      <div class="ds-scale">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<div><span class="ds-space" style="width:var(--sp-${n})"></span><code>--sp-${n}</code></div>`).join('')}</div>
      <div class="ds-scale">${['sm', 'md', 'lg', 'xl', 'pill'].map((r) => `<div><span class="ds-radius" style="border-radius:var(--r-${r})"></span><code>--r-${r}</code></div>`).join('')}</div>
      <div class="ds-scale">${[1, 2, 3].map((n) => `<div><span class="ds-radius" style="box-shadow:var(--shadow-${n}); border:none"></span><code>--shadow-${n}</code></div>`).join('')}</div>
      <p class="small muted">Full reference: <code>DESIGN_SYSTEM.md</code> in the project folder.</p>
    </section>`;
  },
  mount(el) {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-demo]')) toast('That’s a demo button 👋', { emoji: '🎨', timeout: 1400 });
    });
  },
};
