import { getState, update } from '../store.js';
import { esc, todayISO, addDays, startOfWeek, parseISO, fmtDate, fmtTime, toMin, DAYS } from '../util.js';
import { icon, empty } from '../ui.js';
import { colorVar, openAssignmentForm } from '../components.js';
import { openSubjectForm } from './classes.js';

const HOUR = 60; // px per hour
let weekOffset = 0;

export default {
  title: 'Schedule',
  leave() {
    weekOffset = 0;
  },
  render(s) {
    const today = todayISO();
    const start = addDays(startOfWeek(today), weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const meetings = s.subjects.flatMap((sub) => (sub.meetings || []).map((m) => ({ sub, ...m })));
    const hasWeekend = meetings.some((m) => +m.day === 0 || +m.day === 6) ||
      s.assignments.some((a) => days.slice(5).includes(a.due));
    const shown = hasWeekend ? days : days.slice(0, 5);

    let lo = 8 * 60, hi = 15 * 60;
    meetings.forEach((m) => { lo = Math.min(lo, toMin(m.start)); hi = Math.max(hi, toMin(m.end)); });
    lo = Math.floor(lo / 60) * 60;
    hi = Math.ceil(hi / 60) * 60;
    const hours = [];
    for (let t = lo; t < hi; t += 60) hours.push(t);
    const height = ((hi - lo) / 60) * HOUR;

    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const label = `${fmtDate(start, { month: 'short', day: 'numeric' })} – ${fmtDate(addDays(start, 6), { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return `
    <header class="page-head">
      <div><p class="eyebrow">Plan</p><h1>Schedule</h1><p class="lede">Your week at a glance — classes plus anything due.</p></div>
      <div class="hero-actions">
        <div class="week-nav" role="group" aria-label="Week">
          <button class="icon-btn" data-week="-1" aria-label="Previous week">${icon('chevronLeft')}</button>
          <button class="btn btn-sm" data-week="0">This week</button>
          <button class="icon-btn" data-week="1" aria-label="Next week">${icon('chevronRight')}</button>
        </div>
      </div>
    </header>
    <p class="week-label">${label}</p>
    ${!s.subjects.length ? empty({ emoji: '🗓️', title: 'No classes yet', text: 'Add classes with meeting times and they’ll appear here.', action: `<button class="btn btn-primary" data-action="add-class">${icon('plus', 18)}Add class</button>` }) : `
    <div class="card week-scroll" tabindex="0" aria-label="Weekly timetable">
      <div class="week" style="--cols:${shown.length}; --hour:${HOUR}px">
        <div class="week-corner"></div>
        ${shown.map((iso) => {
          const due = s.assignments.filter((a) => a.due === iso);
          return `<div class="week-head ${iso === today ? 'is-today' : ''}">
            <div class="week-day"><span>${DAYS[parseISO(iso).getDay()]}</span><strong>${parseISO(iso).getDate()}</strong></div>
            <div class="week-due">${due.slice(0, 3).map((a) => {
              const sub = s.subjects.find((x) => x.id === a.subjectId);
              return `<button class="due-chip ${a.done ? 'is-done' : ''}" style="--c:${colorVar(sub?.color)}" data-edit="${a.id}" title="${esc(a.title)}">${esc(a.title)}</button>`;
            }).join('')}${due.length > 3 ? `<a class="small link" href="#/assignments">+${due.length - 3} more</a>` : ''}</div>
          </div>`;
        }).join('')}
        <div class="week-times" style="height:${height}px">${hours.map((t) => `<span style="top:${((t - lo) / 60) * HOUR}px">${fmtTime(`${Math.floor(t / 60)}:00`)}</span>`).join('')}</div>
        ${shown.map((iso) => {
          const dow = parseISO(iso).getDay();
          const blocks = meetings.filter((m) => +m.day === dow);
          return `<div class="week-col ${iso === today ? 'is-today' : ''}" style="height:${height}px">
            ${hours.map((t) => `<span class="week-line" style="top:${((t - lo) / 60) * HOUR}px"></span>`).join('')}
            ${blocks.map((m) => {
              const top = ((toMin(m.start) - lo) / 60) * HOUR;
              const h = Math.max(24, ((toMin(m.end) - toMin(m.start)) / 60) * HOUR);
              return `<button class="block" style="--c:${colorVar(m.sub.color)}; top:${top}px; height:${h}px" data-class="${m.sub.id}" aria-label="${esc(m.sub.name)}, ${fmtTime(m.start)} to ${fmtTime(m.end)}">
                <strong>${m.sub.icon} ${esc(m.sub.name)}</strong>
                <small>${fmtTime(m.start)}–${fmtTime(m.end)}${m.sub.room ? ` · ${esc(m.sub.room)}` : ''}</small>
              </button>`;
            }).join('')}
            ${iso === today && nowMin >= lo && nowMin <= hi ? `<span class="now-line" style="top:${((nowMin - lo) / 60) * HOUR}px" aria-label="Now"></span>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>
    <p class="muted small hint">Tip: click a class block to edit its times, or a due chip to edit the task.</p>`}`;
  },
  mount(el) {
    el.addEventListener('click', (e) => {
      const s = getState();
      const w = e.target.closest('[data-week]');
      if (w) {
        weekOffset = +w.dataset.week === 0 ? 0 : weekOffset + +w.dataset.week;
        update(() => {}); // re-render
        return;
      }
      const c = e.target.closest('[data-class]');
      if (c) openSubjectForm(s.subjects.find((x) => x.id === c.dataset.class));
      const d = e.target.closest('[data-edit]');
      if (d) openAssignmentForm(s.assignments.find((x) => x.id === d.dataset.edit));
      if (e.target.closest('[data-action=add-class]')) openSubjectForm();
    });
  },
};
