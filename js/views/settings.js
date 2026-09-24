import { update, getState, replaceState, demoState, blank } from '../store.js';
import { esc, fmtBytes, todayISO } from '../util.js';
import { icon, toast, confirmDialog } from '../ui.js';
import { clearFiles, storageEstimate } from '../files.js';
import { openProfile } from './progress.js';

export default {
  title: 'Settings',
  render(s) {
    const st = s.settings;
    const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button class="seg-btn" data-set="${key}" data-value="${v}" aria-pressed="${String(st[key]) === String(v)}">${l}</button>`).join('')}</div>`;
    return `
    <header class="page-head"><div><p class="eyebrow">You</p><h1>Settings</h1><p class="lede">Make Questbook comfortable to use. Everything is stored privately on this device.</p></div></header>
    <div class="settings">
      <section class="card card-pad stack">
        <h2 class="h3">Appearance & accessibility</h2>
        <div class="setting"><div><strong>Theme</strong><p class="small muted">System follows your device.</p></div>${seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']])}</div>
        <div class="setting"><div><strong>Text size</strong><p class="small muted">Scales the whole interface.</p></div>${seg('textSize', [['normal', 'Default'], ['large', 'Large'], ['xl', 'Extra large']])}</div>
        <div class="setting"><div><strong>Reduce motion</strong><p class="small muted">Turns off confetti, flips and animations.</p></div>${seg('reduceMotion', [[false, 'Off'], [true, 'On']])}</div>
        <div class="setting"><div><strong>Timer sound</strong><p class="small muted">A soft chime when a block ends.</p></div>${seg('sound', [[true, 'On'], [false, 'Off']])}</div>
      </section>
      <section class="card card-pad stack">
        <h2 class="h3">Study timer</h2>
        <div class="setting"><div><strong>Focus length</strong></div>${seg('focusMin', [[15, '15m'], [25, '25m'], [45, '45m'], [50, '50m']])}</div>
        <div class="setting"><div><strong>Break length</strong></div>${seg('breakMin', [[5, '5m'], [10, '10m'], [15, '15m']])}</div>
      </section>
      <section class="card card-pad stack">
        <h2 class="h3">Profile</h2>
        <div class="setting"><div><strong>${s.profile.avatar} ${esc(s.profile.name || 'Student')}</strong><p class="small muted">${s.profile.pronouns ? esc(s.profile.pronouns) : 'No pronouns set'}</p></div><div class="row-actions"><button class="btn" data-action="profile">${icon('edit', 16)}Edit</button><button class="btn btn-ghost" data-action="wizard">${icon('reset', 16)}Run setup again</button></div></div>
      </section>
      <section class="card card-pad stack">
        <h2 class="h3">Your data</h2>
        <p class="small muted" data-usage>Checking storage…</p>
        <div class="row-actions">
          <button class="btn" data-action="export">${icon('download', 16)}Export backup (.json)</button>
          <label class="btn file-btn">${icon('upload', 16)}Import backup<input type="file" accept="application/json,.json" data-import hidden></label>
        </div>
        <p class="tiny muted">Backups include classes, tasks, decks, study history and written notes. Uploaded files stay on this device and aren’t included.</p>
        <hr>
        <div class="row-actions">
          <button class="btn" data-action="demo">${icon('sparkles', 16)}Load demo data</button>
          <button class="btn btn-danger" data-action="wipe">${icon('trash', 16)}Erase everything</button>
        </div>
      </section>
    </div>`;
  },
  mount(el) {
    storageEstimate().then((e) => {
      const n = el.querySelector('[data-usage]');
      if (n) n.textContent = e ? `Using ${fmtBytes(e.usage)} of about ${fmtBytes(e.quota)} available on this device.` : 'Storage details unavailable in this browser.';
    });
    el.addEventListener('click', async (e) => {
      const set = e.target.closest('[data-set]');
      if (set) {
        const raw = set.dataset.value;
        const v = raw === 'true' ? true : raw === 'false' ? false : /^\d+$/.test(raw) ? +raw : raw;
        return update((s) => {
          s.settings[set.dataset.set] = v;
          // Keep an idle timer in sync with new lengths.
          if (!s.timer.running && s.timer.remainingMs == null) s.timer.plannedMin = null;
        });
      }
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'profile') openProfile();
      if (a === 'wizard') update((s) => (s.settings.onboarded = false));
      if (a === 'export') {
        const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
        const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `questbook-backup-${todayISO()}.json` });
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }
      if (a === 'demo' && (await confirmDialog('Replace your current data with the demo semester? Export a backup first if you want to keep it.', { title: 'Load demo data?', confirmLabel: 'Load demo' }))) {
        replaceState(demoState());
        toast('Demo data loaded', { emoji: '✨' });
      }
      if (a === 'wipe' && (await confirmDialog('This erases all classes, tasks, notes, files, decks and XP on this device. It can’t be undone.', { title: 'Erase everything?', confirmLabel: 'Erase' }))) {
        await clearFiles().catch(() => {});
        replaceState(blank());
        toast('All data erased. Fresh start!', { emoji: '🌱' });
        location.hash = '#/classes';
      }
    });
    el.addEventListener('change', async (e) => {
      if (!e.target.matches('[data-import]')) return;
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || !Array.isArray(data.subjects) || !Array.isArray(data.assignments)) throw new Error('bad');
        if (await confirmDialog('Replace your current data with this backup?', { title: 'Import backup?', confirmLabel: 'Import', danger: false })) {
          replaceState(data);
          toast('Backup imported', { kind: 'success', emoji: '📦' });
        }
      } catch {
        toast('That file isn’t a Questbook backup.', { kind: 'error', emoji: '⚠️' });
      }
      e.target.value = '';
    });
  },
};
