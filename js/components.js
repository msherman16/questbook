// Domain components shared by several views.
import { TYPES, subjectById, update, getState, toggleAssignment } from './store.js';
import { esc, uid, todayISO, addDays, daysBetween, relDay } from './util.js';
import { icon, modal, toast, confirmDialog, formData } from './ui.js';

export const colorVar = (c) => `var(--c-${c || 'slate'})`;

export function subjectChip(s, id) {
  const sub = subjectById(s, id);
  if (!sub) return `<span class="chip" style="--c:var(--c-slate)">General</span>`;
  return `<span class="chip" style="--c:${colorVar(sub.color)}"><span aria-hidden="true">${sub.icon}</span>${esc(sub.name)}</span>`;
}

export const typeBadge = (type) => `<span class="badge badge-${type}">${TYPES[type]?.label || type}</span>`;

export function dueLabel(a) {
  const n = daysBetween(todayISO(), a.due);
  let cls = '';
  let text = relDay(a.due);
  if (!a.done && n < 0) {
    cls = 'is-overdue';
    text = `Overdue · ${text}`;
  } else if (!a.done && n <= 1) cls = 'is-soon';
  return `<span class="due ${cls}">${icon('calendar', 14)}${text}</span>`;
}

export function subjectOptions(s, selected = '', { none = 'No subject' } = {}) {
  return `<option value="">${none}</option>` +
    s.subjects.map((x) => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${x.icon} ${esc(x.name)}</option>`).join('');
}

export function assignmentRow(s, a, { compact = false } = {}) {
  const sub = subjectById(s, a.subjectId);
  const canPrep = !a.done && (a.type === 'test' || a.type === 'quiz') && daysBetween(todayISO(), a.due) > 0;
  const reward = a.done ? a.xpAwarded : TYPES[a.type]?.xp;
  return `
  <li class="task ${a.done ? 'is-done' : ''}" style="--c:${colorVar(sub?.color)}">
    <button class="check" data-action="toggle" data-id="${a.id}" aria-pressed="${a.done}" aria-label="${a.done ? 'Mark not done' : 'Mark done'}: ${esc(a.title)}">${icon('check', 16)}</button>
    <div class="task-main">
      <div class="task-title">${esc(a.title)}</div>
      <div class="task-meta">${subjectChip(s, a.subjectId)}${typeBadge(a.type)}${dueLabel(a)}</div>
    </div>
    <span class="xp-tag ${a.done ? 'is-earned' : ''}" title="${a.done ? 'XP earned' : 'XP reward'}">+${reward} XP</span>
    ${compact ? '' : `
    <div class="task-actions">
      ${canPrep ? `<button class="btn btn-sm btn-ghost" data-action="prep" data-id="${a.id}" title="Create a spaced-review plan">${icon('map', 16)}<span class="hide-sm">Prep plan</span></button>` : ''}
      <button class="icon-btn" data-action="edit-task" data-id="${a.id}" aria-label="Edit ${esc(a.title)}">${icon('edit', 18)}</button>
      <button class="icon-btn" data-action="delete-task" data-id="${a.id}" aria-label="Delete ${esc(a.title)}">${icon('trash', 18)}</button>
    </div>`}
  </li>`;
}

export function openAssignmentForm(existing = null, defaults = {}) {
  const s = getState();
  const a = existing || { title: '', subjectId: defaults.subjectId || s.subjects[0]?.id || '', type: defaults.type || 'homework', due: defaults.due || addDays(todayISO(), 1), notes: '' };
  modal({
    title: existing ? 'Edit assignment' : 'Add assignment or key date',
    body: `
      <form class="modal-form" novalidate>
        <div class="modal-body stack">
          <label class="field"><span class="label">Title</span>
            <input class="input" name="title" required maxlength="120" value="${esc(a.title)}" placeholder="e.g. Chapter 4 reading"></label>
          <div class="field-row">
            <label class="field"><span class="label">Subject</span>
              <select class="input" name="subjectId">${subjectOptions(s, a.subjectId)}</select></label>
            <label class="field"><span class="label">Due date</span>
              <input class="input" type="date" name="due" required value="${a.due}"></label>
          </div>
          <fieldset class="field"><legend class="label">Type</legend>
            <div class="seg seg-wrap">
              ${Object.entries(TYPES).map(([k, t]) => `
                <label class="seg-opt"><input type="radio" name="type" value="${k}" ${a.type === k ? 'checked' : ''}><span>${t.label} <small>+${t.xp}</small></span></label>`).join('')}
            </div>
          </fieldset>
          <label class="field"><span class="label">Notes <small class="muted">(optional)</small></span>
            <textarea class="input" name="notes" rows="3" placeholder="Pages, rubric, links…">${esc(a.notes)}</textarea></label>
          <p class="form-error" hidden></p>
        </div>
        <footer class="modal-foot">
          <button type="button" class="btn" data-close>Cancel</button>
          <button class="btn btn-primary">${existing ? 'Save changes' : 'Add'}</button>
        </footer>
      </form>`,
    onMount: (el, close) => {
      el.querySelector('[name=title]').focus();
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = formData(e.target);
        if (!f.title.trim() || !f.due) {
          const err = el.querySelector('.form-error');
          err.textContent = 'Add a title and a due date.';
          err.hidden = false;
          return;
        }
        update((st) => {
          if (existing) {
            Object.assign(st.assignments.find((x) => x.id === existing.id), { ...f, title: f.title.trim() });
          } else {
            st.assignments.push({ id: uid(), ...f, title: f.title.trim(), done: false, doneAt: null, early: false, xpAwarded: 0, prepFor: null });
          }
        });
        toast(existing ? 'Saved' : `Added “${esc(f.title.trim())}”`, { kind: 'success', emoji: '📝' });
        close();
      });
    },
  });
}

export async function deleteAssignment(id) {
  const a = getState().assignments.find((x) => x.id === id);
  if (!a) return;
  if (await confirmDialog(`Delete “${esc(a.title)}”? This can’t be undone.`)) {
    update((s) => (s.assignments = s.assignments.filter((x) => x.id !== id)));
  }
}

// Spaced-repetition prep plan: review blocks at expanding gaps before the test.
const PREP_STEPS = [
  { offset: 7, what: 'Skim notes + make flashcards' },
  { offset: 5, what: 'Flashcards (active recall)' },
  { offset: 3, what: 'Practice with Quiz Show' },
  { offset: 2, what: 'Blurt everything, then check' },
  { offset: 1, what: 'Teach it back (Feynman) + light review' },
];
export function createPrepPlan(id) {
  const s = getState();
  const a = s.assignments.find((x) => x.id === id);
  if (!a) return;
  if (s.assignments.some((x) => x.prepFor === id)) {
    toast('A prep plan already exists for this one.', { emoji: '🗺️' });
    return;
  }
  const today = todayISO();
  const steps = PREP_STEPS.filter((p) => addDays(a.due, -p.offset) >= today);
  if (!steps.length) {
    toast('Too close to the date for a plan — try a Quiz Show round now!', { emoji: '⚡' });
    return;
  }
  update((st) => {
    steps.forEach((p, i) => {
      st.assignments.push({
        id: uid(), title: `Prep ${i + 1}/${steps.length}: ${p.what} — ${a.title}`, subjectId: a.subjectId, type: 'study',
        due: addDays(a.due, -p.offset), notes: `Part of the prep plan for “${a.title}”.`, done: false, doneAt: null, early: false, xpAwarded: 0, prepFor: id,
      });
    });
  });
  toast(`Added ${steps.length} review sessions before “${esc(a.title)}”`, { kind: 'success', emoji: '🗺️' });
}

// Shared click handling for any list that renders assignmentRow().
export function handleTaskAction(action, id) {
  const s = getState();
  if (action === 'toggle') toggleAssignment(id);
  else if (action === 'edit-task') openAssignmentForm(s.assignments.find((x) => x.id === id));
  else if (action === 'delete-task') deleteAssignment(id);
  else if (action === 'prep') createPrepPlan(id);
  else return false;
  return true;
}
