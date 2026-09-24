import { getState, update, TYPES } from '../store.js';
import { esc, todayISO, addDays, daysBetween, parseISO, startOfWeek, dateISO } from '../util.js';
import { icon, empty } from '../ui.js';
import { assignmentRow, colorVar, openAssignmentForm, handleTaskAction, subjectOptions } from '../components.js';

const ui = { status: 'open', subject: '', type: '', monthOffset: 0 };

export default {
  title: 'Assignments & Dates',
  render(s, params) {
    const mode = params[0] === 'calendar' ? 'calendar' : 'list';
    return `
    <header class="page-head">
      <div><p class="eyebrow">Plan</p><h1>Assignments & Key Dates</h1>
      <p class="lede">Check things off to earn XP. Finishing 2+ days early earns a bonus.</p></div>
      <div class="hero-actions">
        <div class="seg" role="tablist" aria-label="View">
          <a class="seg-link" href="#/assignments" role="tab" aria-selected="${mode === 'list'}">${icon('list', 16)}List</a>
          <a class="seg-link" href="#/assignments/calendar" role="tab" aria-selected="${mode === 'calendar'}">${icon('grid', 16)}Calendar</a>
        </div>
        <button class="btn btn-primary" data-action="add">${icon('plus', 18)}Add</button>
      </div>
    </header>
    <div class="toolbar">
      ${mode === 'list' ? `<div class="seg" role="group" aria-label="Status">
        ${[['open', 'To do'], ['overdue', 'Overdue'], ['done', 'Done'], ['all', 'All']].map(([k, l]) => `<button class="seg-btn" data-status="${k}" aria-pressed="${ui.status === k}">${l}</button>`).join('')}
      </div>` : ''}
      <label class="sr-only" for="f-subject">Subject</label>
      <select class="input input-sm" id="f-subject" data-filter="subject">${subjectOptions(s, ui.subject, { none: 'All subjects' })}</select>
      <label class="sr-only" for="f-type">Type</label>
      <select class="input input-sm" id="f-type" data-filter="type"><option value="">All types</option>${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${ui.type === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
    </div>
    ${mode === 'list' ? listView(s) : calendarView(s)}`;
  },
  mount(el) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action],[data-status],[data-month],[data-day-add]');
      if (!b) return;
      if (b.dataset.status) {
        ui.status = b.dataset.status;
        return update(() => {});
      }
      if (b.dataset.month) {
        ui.monthOffset = +b.dataset.month === 0 ? 0 : ui.monthOffset + +b.dataset.month;
        return update(() => {});
      }
      if (b.dataset.dayAdd) return openAssignmentForm(null, { due: b.dataset.dayAdd, subjectId: ui.subject || undefined });
      if (b.dataset.action === 'add') return openAssignmentForm(null, { subjectId: ui.subject || undefined });
      if (b.dataset.action === 'open') return openAssignmentForm(getState().assignments.find((a) => a.id === b.dataset.id));
      handleTaskAction(b.dataset.action, b.dataset.id);
    });
    el.addEventListener('change', (e) => {
      const f = e.target.dataset.filter;
      if (!f) return;
      ui[f] = e.target.value;
      update(() => {});
    });
  },
};

function filtered(s) {
  return s.assignments.filter((a) => (!ui.subject || a.subjectId === ui.subject) && (!ui.type || a.type === ui.type));
}

function listView(s) {
  const today = todayISO();
  const weekEnd = addDays(startOfWeek(today), 6);
  let items = filtered(s);
  if (ui.status === 'open') items = items.filter((a) => !a.done);
  if (ui.status === 'overdue') items = items.filter((a) => !a.done && a.due < today);
  if (ui.status === 'done') items = items.filter((a) => a.done);
  items.sort((a, b) => (ui.status === 'done' ? b.due.localeCompare(a.due) : a.due.localeCompare(b.due)));

  if (!items.length) {
    const msg = {
      open: ['🎉', 'You’re all caught up', 'Nothing left to do. Add upcoming work or key dates to stay ahead.'],
      overdue: ['🙌', 'Nothing overdue', 'Nice work staying on top of things.'],
      done: ['🌱', 'Nothing finished yet', 'Completed tasks will show up here with the XP you earned.'],
      all: ['📝', 'No assignments yet', 'Add homework, tests, projects and key dates like exam weeks or trips.'],
    }[ui.status];
    return empty({ emoji: msg[0], title: msg[1], text: msg[2], action: `<button class="btn btn-primary" data-action="add">${icon('plus', 18)}Add assignment</button>` });
  }

  const groups = ui.status === 'done' ? [['Completed', items]] : [
    ['Overdue', items.filter((a) => !a.done && a.due < today)],
    ['Today', items.filter((a) => a.due === today)],
    ['Tomorrow', items.filter((a) => daysBetween(today, a.due) === 1)],
    ['Later this week', items.filter((a) => daysBetween(today, a.due) > 1 && a.due <= weekEnd)],
    ['Coming up', items.filter((a) => a.due > weekEnd)],
    ['Earlier', items.filter((a) => a.done && a.due < today)],
  ];
  return groups.filter(([, list]) => list.length).map(([label, list]) => `
    <section class="task-group" aria-label="${label}">
      <h2 class="group-title ${label === 'Overdue' ? 'is-overdue' : ''}">${label} <span class="count">${list.length}</span></h2>
      <ul class="task-list card">${list.map((a) => assignmentRow(s, a)).join('')}</ul>
    </section>`).join('');
}

function calendarView(s) {
  const today = todayISO();
  const base = parseISO(today);
  const first = new Date(base.getFullYear(), base.getMonth() + ui.monthOffset, 1);
  const firstISO = dateISO(first);
  const gridStart = startOfWeek(firstISO);
  const month = first.getMonth();
  const items = filtered(s);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Drop a trailing week that belongs entirely to the next month.
  const weeks = parseISO(cells[35]).getMonth() !== month ? cells.slice(0, 35) : cells;

  return `
  <div class="card cal">
    <div class="cal-head">
      <button class="icon-btn" data-month="-1" aria-label="Previous month">${icon('chevronLeft')}</button>
      <h2>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
      <button class="icon-btn" data-month="1" aria-label="Next month">${icon('chevronRight')}</button>
      <button class="btn btn-sm" data-month="0">Today</button>
    </div>
    <div class="cal-grid" role="grid">
      ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="cal-dow" role="columnheader">${d}</div>`).join('')}
      ${weeks.map((iso) => {
        const d = parseISO(iso);
        const list = items.filter((a) => a.due === iso);
        return `<div class="cal-cell ${d.getMonth() !== month ? 'is-out' : ''} ${iso === today ? 'is-today' : ''}" role="gridcell">
          <div class="cal-date"><span>${d.getDate()}</span><button class="cal-add" data-day-add="${iso}" aria-label="Add on ${d.toDateString()}">${icon('plus', 14)}</button></div>
          ${list.map((a) => {
            const sub = s.subjects.find((x) => x.id === a.subjectId);
            const key = ['test', 'quiz', 'keydate', 'project'].includes(a.type);
            return `<button class="cal-item ${a.done ? 'is-done' : ''} ${key ? 'is-key' : ''}" style="--c:${colorVar(sub?.color)}" data-action="open" data-id="${a.id}" title="${esc(a.title)} (${TYPES[a.type].label})">${key ? '★ ' : ''}${esc(a.title)}</button>`;
          }).join('')}
        </div>`;
      }).join('')}
    </div>
    <p class="muted small cal-legend">★ = test, quiz, project or key date</p>
  </div>`;
}
