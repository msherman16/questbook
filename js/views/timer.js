import { update, getState, logSession, timerStart, timerPause, timerReset, timerAddMinutes, timerFinishEarly, timerRemaining, subjectById } from '../store.js';
import { esc, todayISO, addDays, fmtClock, fmtDuration, fmtDate, DAYS, parseISO, startOfWeek } from '../util.js';
import { icon, modal, toast, empty, formData } from '../ui.js';
import { colorVar, subjectOptions } from '../components.js';

const R = 110;
const C = +(2 * Math.PI * R).toFixed(2);
export const TECHNIQUES = ['Pomodoro', 'Active recall', 'Spaced repetition', 'Blurting', 'Feynman technique', 'Interleaving', 'Practice problems', 'Reading & notes'];

export default {
  title: 'Study Timer',
  render(s) {
    const t = s.timer;
    const remaining = timerRemaining(s);
    const total = (t.plannedMin ?? (t.mode === 'focus' ? s.settings.focusMin : s.settings.breakMin)) * 60000;
    const offset = C * (1 - remaining / total);
    const started = t.running || t.remainingMs != null;
    const today = todayISO();

    // Last 7 days, stacked by subject.
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const byDay = days.map((d) => s.sessions.filter((x) => x.date === d));
    const maxDay = Math.max(30, ...byDay.map((l) => l.reduce((a, x) => a + x.minutes, 0)));
    const weekStart = startOfWeek(today);
    const week = s.sessions.filter((x) => x.date >= weekStart);
    const totals = {};
    week.forEach((x) => (totals[x.subjectId || ''] = (totals[x.subjectId || ''] || 0) + x.minutes));
    const weekTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    const maxSub = Math.max(1, ...Object.values(totals));

    return `
    <header class="page-head">
      <div><p class="eyebrow">Study</p><h1>Study Timer</h1><p class="lede">Every focused minute earns 2 XP. Pick a class so your study time is tracked by subject.</p></div>
      <div class="hero-actions"><button class="btn" data-action="log">${icon('plus', 18)}Log time manually</button></div>
    </header>

    <div class="timer-layout">
      <section class="card card-pad timer-card mode-${t.mode}" aria-label="Timer">
        <div class="seg" role="group" aria-label="Mode">
          <button class="seg-btn" data-mode="focus" aria-pressed="${t.mode === 'focus'}">Focus · ${s.settings.focusMin}m</button>
          <button class="seg-btn" data-mode="break" aria-pressed="${t.mode === 'break'}">Break · ${s.settings.breakMin}m</button>
        </div>
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 260 260" aria-hidden="true">
            <circle class="ring-track" cx="130" cy="130" r="${R}"/>
            <circle class="ring-fill" cx="130" cy="130" r="${R}" stroke-dasharray="${C}" style="stroke-dashoffset:${offset}" data-timer-ring data-c="${C}"/>
          </svg>
          <div class="ring-center">
            <div class="ring-time" data-timer-text role="timer" aria-live="off">${fmtClock(remaining)}</div>
            <div class="ring-label">${t.mode === 'focus' ? (t.running ? 'Focusing…' : started ? 'Paused' : 'Ready to focus') : (t.running ? 'On a break' : 'Break time')}</div>
          </div>
        </div>
        <div class="timer-controls">
          ${t.running
            ? `<button class="btn btn-lg btn-primary" data-action="pause">${icon('pause', 20)}Pause</button>`
            : `<button class="btn btn-lg btn-primary" data-action="start">${icon('play', 20)}${started ? 'Resume' : 'Start'}</button>`}
          <button class="icon-btn icon-btn-lg" data-action="plus5" aria-label="Add 5 minutes" title="+5 min"><span class="small strong">+5</span></button>
          <button class="icon-btn icon-btn-lg" data-action="reset" aria-label="Reset" title="Reset">${icon('reset')}</button>
        </div>
        ${t.mode === 'focus' && started ? `<button class="btn btn-sm btn-ghost" data-action="finish">${icon('check', 16)}Finish early & log time</button>` : ''}
        ${t.mode === 'focus' ? `
        <div class="field-row timer-fields">
          <label class="field"><span class="label">Studying</span><select class="input" data-field="subjectId">${subjectOptions(s, t.subjectId, { none: 'General / no class' })}</select></label>
          <label class="field"><span class="label">Technique</span><select class="input" data-field="technique">${TECHNIQUES.map((x) => `<option ${t.technique === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        </div>` : `<p class="muted small break-tip">Stand up, stretch, drink some water. Screens off if you can. ☕</p>`}
      </section>

      <div class="stack">
        <section class="card card-pad" aria-labelledby="h-week">
          <div class="card-head"><h2 id="h-week">Last 7 days</h2><span class="muted small">${fmtDuration(byDay.flat().reduce((a, x) => a + x.minutes, 0))} total</span></div>
          <div class="bars" role="img" aria-label="Minutes studied per day for the last 7 days">
            ${days.map((d, i) => {
              const list = byDay[i];
              const tot = list.reduce((a, x) => a + x.minutes, 0);
              return `<div class="bar-col ${d === today ? 'is-today' : ''}">
                <div class="bar-val">${tot ? fmtDuration(tot) : ''}</div>
                <div class="bar-track">${list.map((x) => `<span class="bar-seg" style="--c:${colorVar(subjectById(s, x.subjectId)?.color)}; height:${(x.minutes / maxDay) * 100}%" title="${esc(subjectById(s, x.subjectId)?.name || 'General')}: ${x.minutes}m"></span>`).join('')}</div>
                <div class="bar-label">${d === today ? 'Today' : DAYS[parseISO(d).getDay()]}</div>
              </div>`;
            }).join('')}
          </div>
        </section>
        <section class="card card-pad" aria-labelledby="h-subj">
          <div class="card-head"><h2 id="h-subj">This week by class</h2><span class="muted small">${fmtDuration(weekTotal)}</span></div>
          ${weekTotal ? `<ul class="hbar-list">${Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([id, min]) => {
            const sub = subjectById(s, id);
            return `<li style="--c:${colorVar(sub?.color)}"><span class="hbar-label">${sub ? `${sub.icon} ${esc(sub.name)}` : 'General'}</span><span class="hbar"><span style="width:${(min / maxSub) * 100}%"></span></span><span class="hbar-val">${fmtDuration(min)}</span></li>`;
          }).join('')}</ul>` : empty({ emoji: '⏱️', title: 'No study time yet this week', text: 'Start a focus block to begin.' })}
        </section>
      </div>
    </div>

    <section class="card card-pad" aria-labelledby="h-sessions">
      <div class="card-head"><h2 id="h-sessions">Recent sessions</h2></div>
      ${s.sessions.length ? `<ul class="session-list">${s.sessions.slice(0, 8).map((x) => {
        const sub = subjectById(s, x.subjectId);
        return `<li style="--c:${colorVar(sub?.color)}">
          <span class="dot" aria-hidden="true"></span>
          <span class="session-main"><strong>${sub ? `${sub.icon} ${esc(sub.name)}` : 'General'}</strong><small class="muted">${esc(x.technique || '')} · ${fmtDate(x.date, { weekday: 'short', month: 'short', day: 'numeric' })}</small></span>
          <span class="session-min">${fmtDuration(x.minutes)}</span>
          <button class="icon-btn" data-delete-session="${x.id}" aria-label="Delete session">${icon('trash', 16)}</button>
        </li>`;
      }).join('')}</ul>` : empty({ emoji: '📖', title: 'No sessions yet' })}
    </section>`;
  },
  mount(el) {
    el.addEventListener('click', (e) => {
      const mode = e.target.closest('[data-mode]')?.dataset.mode;
      if (mode) {
        const s = getState();
        if (s.timer.mode !== mode) timerReset(mode);
        return;
      }
      const del = e.target.closest('[data-delete-session]')?.dataset.deleteSession;
      if (del) {
        // Removing a session also removes the XP it earned.
        return update((s) => {
          const x = s.sessions.find((y) => y.id === del);
          if (!x) return;
          s.sessions = s.sessions.filter((y) => y.id !== del);
          s.xp = Math.max(0, s.xp - x.minutes * 2);
          s.xpLog.unshift({ id: del, amount: -x.minutes * 2, reason: 'Removed a study session', at: Date.now() });
        });
      }
      const a = e.target.closest('[data-action]')?.dataset.action;
      if (a === 'start') {
        timerStart();
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      }
      if (a === 'pause') timerPause();
      if (a === 'reset') timerReset();
      if (a === 'plus5') timerAddMinutes(5);
      if (a === 'finish') timerFinishEarly();
      if (a === 'log') openLogForm();
    });
    el.addEventListener('change', (e) => {
      const f = e.target.dataset.field;
      if (f) update((s) => (s.timer[f] = e.target.value));
    });
  },
};

function openLogForm() {
  const s = getState();
  modal({
    title: 'Log study time',
    size: 'sm',
    body: `<form class="modal-form">
      <div class="modal-body stack">
        <label class="field"><span class="label">Class</span><select class="input" name="subjectId">${subjectOptions(s, s.timer.subjectId, { none: 'General / no class' })}</select></label>
        <div class="field-row">
          <label class="field"><span class="label">Minutes</span><input class="input" type="number" name="minutes" min="1" max="600" value="30" required></label>
          <label class="field"><span class="label">Date</span><input class="input" type="date" name="date" value="${todayISO()}" max="${todayISO()}" required></label>
        </div>
        <label class="field"><span class="label">Technique</span><select class="input" name="technique">${TECHNIQUES.map((x) => `<option>${x}</option>`).join('')}</select></label>
      </div>
      <footer class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Log time</button></footer>
    </form>`,
    onMount(el, close) {
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = formData(e.target);
        const minutes = Math.min(600, Math.max(1, +f.minutes || 0));
        logSession({ subjectId: f.subjectId, minutes, date: f.date || todayISO(), technique: f.technique });
        close();
      });
    },
  });
}
