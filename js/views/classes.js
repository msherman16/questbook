import { update, getState, SUBJECT_COLORS, SUBJECT_ICONS } from '../store.js';
import { esc, uid, todayISO, startOfWeek, DAYS, fmtTime, fmtDuration, plural } from '../util.js';
import { icon, modal, confirmDialog, toast, empty } from '../ui.js';
import { colorVar, openAssignmentForm } from '../components.js';

export default {
  title: 'Classes & Subjects',
  render(s) {
    const weekStart = startOfWeek(todayISO());
    return `
    <header class="page-head">
      <div><p class="eyebrow">Plan</p><h1>Classes & Subjects</h1>
      <p class="lede">Each class gets a color and icon that follows it everywhere — schedule, tasks, notes and games.</p></div>
      <div class="hero-actions"><button class="btn btn-primary" data-action="add">${icon('plus', 18)}Add class</button></div>
    </header>
    ${s.subjects.length ? `<div class="subject-grid">${s.subjects.map((sub) => {
      const open = s.assignments.filter((a) => a.subjectId === sub.id && !a.done).length;
      const mins = s.sessions.filter((x) => x.subjectId === sub.id && x.date >= weekStart).reduce((t, x) => t + x.minutes, 0);
      const notes = s.notes.filter((n) => n.subjectId === sub.id).length;
      const decks = s.decks.filter((d) => d.subjectId === sub.id).length;
      const meetings = [...(sub.meetings || [])].sort((a, b) => ((+a.day + 6) % 7) - ((+b.day + 6) % 7) || a.start.localeCompare(b.start));
      return `
      <article class="card subject-card" style="--c:${colorVar(sub.color)}">
        <div class="subject-banner">
          <span class="subject-icon" aria-hidden="true">${sub.icon}</span>
          <div class="subject-actions">
            <button class="icon-btn icon-btn-on-color" data-action="edit" data-id="${sub.id}" aria-label="Edit ${esc(sub.name)}">${icon('edit', 18)}</button>
            <button class="icon-btn icon-btn-on-color" data-action="delete" data-id="${sub.id}" aria-label="Delete ${esc(sub.name)}">${icon('trash', 18)}</button>
          </div>
        </div>
        <div class="card-pad stack-sm">
          <h2 class="h3">${esc(sub.name)}</h2>
          <p class="muted small">${[sub.teacher, sub.room].filter(Boolean).map(esc).join(' · ') || 'No teacher or room yet'}</p>
          <div class="meeting-list">${meetings.length ? meetings.map((m) => `<span class="meeting"><strong>${DAYS[m.day]}</strong> ${fmtTime(m.start)}–${fmtTime(m.end)}</span>`).join('') : '<span class="muted small">No meeting times</span>'}</div>
          <dl class="mini-stats">
            <div><dt>Open tasks</dt><dd>${open}</dd></div>
            <div><dt>Studied this week</dt><dd>${fmtDuration(mins)}</dd></div>
            <div><dt>Notes · Decks</dt><dd>${notes} · ${decks}</dd></div>
          </dl>
          <div class="row-actions">
            <button class="btn btn-sm" data-action="task" data-id="${sub.id}">${icon('plus', 16)}Task</button>
            <a class="btn btn-sm btn-ghost" href="#/timer" data-action="study" data-id="${sub.id}">${icon('timer', 16)}Study</a>
          </div>
        </div>
      </article>`;
    }).join('')}</div>` : empty({ emoji: '🎒', title: 'Add your first class', text: 'Start with the classes on your timetable. You can add meeting times so your week fills in automatically.', action: `<button class="btn btn-primary" data-action="add">${icon('plus', 18)}Add class</button>` })}`;
  },
  mount(el) {
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      const s = getState();
      const { action, id } = b.dataset;
      if (action === 'add') openSubjectForm();
      if (action === 'edit') openSubjectForm(s.subjects.find((x) => x.id === id));
      if (action === 'task') openAssignmentForm(null, { subjectId: id });
      if (action === 'study') update((st) => (st.timer.subjectId = id));
      if (action === 'delete') {
        const sub = s.subjects.find((x) => x.id === id);
        if (await confirmDialog(`Delete <strong>${esc(sub.name)}</strong>? Its tasks, notes and decks will be kept but marked “General”.`)) {
          update((st) => (st.subjects = st.subjects.filter((x) => x.id !== id)));
          toast('Class deleted', { emoji: '🗑️' });
        }
      }
    });
  },
};

function meetingRow(m = { day: 1, start: '09:00', end: '09:50' }) {
  return `<div class="meeting-row">
    <select class="input" name="day" aria-label="Day">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${+m.day === d ? 'selected' : ''}>${DAYS[d]}</option>`).join('')}</select>
    <input class="input" type="time" name="start" value="${m.start}" aria-label="Start time" required>
    <span class="muted" aria-hidden="true">–</span>
    <input class="input" type="time" name="end" value="${m.end}" aria-label="End time" required>
    <button type="button" class="icon-btn" data-remove aria-label="Remove meeting time">${icon('x', 18)}</button>
  </div>`;
}

export function openSubjectForm(existing = null) {
  const s = getState();
  const used = new Set(s.subjects.map((x) => x.color));
  const sub = existing || {
    name: '', teacher: '', room: '', meetings: [],
    color: SUBJECT_COLORS.find((c) => !used.has(c)) || SUBJECT_COLORS[s.subjects.length % SUBJECT_COLORS.length],
    icon: SUBJECT_ICONS[s.subjects.length % SUBJECT_ICONS.length],
  };
  modal({
    title: existing ? `Edit ${esc(sub.name)}` : 'Add a class',
    size: 'lg',
    body: `
    <form class="modal-form">
      <div class="modal-body stack">
        <label class="field"><span class="label">Class name</span>
          <input class="input" name="name" required maxlength="60" value="${esc(sub.name)}" placeholder="e.g. Chemistry"></label>
        <div class="field-row">
          <label class="field"><span class="label">Teacher <small class="muted">(optional)</small></span><input class="input" name="teacher" value="${esc(sub.teacher)}"></label>
          <label class="field"><span class="label">Room <small class="muted">(optional)</small></span><input class="input" name="room" value="${esc(sub.room)}"></label>
        </div>
        <fieldset class="field"><legend class="label">Color</legend>
          <div class="swatches">${SUBJECT_COLORS.map((c) => `
            <label class="swatch" style="--c:${colorVar(c)}"><input type="radio" name="color" value="${c}" ${sub.color === c ? 'checked' : ''}><span class="sr-only">${c}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset class="field"><legend class="label">Icon</legend>
          <div class="emoji-picker">${SUBJECT_ICONS.map((i) => `
            <label class="emoji-opt"><input type="radio" name="icon" value="${i}" ${sub.icon === i ? 'checked' : ''}><span>${i}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset class="field"><legend class="label">Meeting times</legend>
          <div class="meetings stack-sm">${(sub.meetings || []).map(meetingRow).join('')}</div>
          <div class="row-actions">
            <button type="button" class="btn btn-sm" data-add-meeting>${icon('plus', 16)}Add time</button>
            <button type="button" class="btn btn-sm btn-ghost" data-weekdays>Same time Mon–Fri</button>
          </div>
        </fieldset>
        <p class="form-error" hidden></p>
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn" data-close>Cancel</button>
        <button class="btn btn-primary">${existing ? 'Save' : 'Add class'}</button>
      </footer>
    </form>`,
    onMount(el, close) {
      const list = el.querySelector('.meetings');
      el.querySelector('[name=name]').focus();
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) e.target.closest('.meeting-row').remove();
        if (e.target.closest('[data-add-meeting]')) {
          const last = list.lastElementChild;
          const next = last ? { day: (+last.querySelector('[name=day]').value % 6) + 1, start: last.querySelector('[name=start]').value, end: last.querySelector('[name=end]').value } : undefined;
          list.insertAdjacentHTML('beforeend', meetingRow(next));
        }
        if (e.target.closest('[data-weekdays]')) {
          const first = list.firstElementChild;
          const start = first?.querySelector('[name=start]').value || '09:00';
          const end = first?.querySelector('[name=end]').value || '09:50';
          list.innerHTML = [1, 2, 3, 4, 5].map((day) => meetingRow({ day, start, end })).join('');
        }
      });
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target.elements;
        const name = f.namedItem('name').value.trim();
        const err = el.querySelector('.form-error');
        const meetings = [...list.querySelectorAll('.meeting-row')].map((r) => ({
          day: +r.querySelector('[name=day]').value, start: r.querySelector('[name=start]').value, end: r.querySelector('[name=end]').value,
        }));
        if (!name) return Object.assign(err, { hidden: false, textContent: 'Give the class a name.' });
        if (meetings.some((m) => !m.start || !m.end || m.end <= m.start)) return Object.assign(err, { hidden: false, textContent: 'Each meeting needs an end time after its start time.' });
        const data = { name, teacher: f.teacher.value.trim(), room: f.room.value.trim(), color: f.color.value, icon: f.icon.value, meetings };
        update((st) => {
          if (existing) Object.assign(st.subjects.find((x) => x.id === existing.id), data);
          else st.subjects.push({ id: uid(), ...data });
        });
        toast(existing ? 'Class updated' : `${data.icon} ${esc(name)} added — ${plural(meetings.length, 'meeting')} a week`, { kind: 'success' });
        close();
      });
    },
  });
}
