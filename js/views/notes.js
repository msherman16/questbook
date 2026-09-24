import { update, getState, rewardUpload, subjectById } from '../store.js';
import { esc, uid, fmtBytes, fmtDate, dateISO } from '../util.js';
import { icon, modal, toast, confirmDialog, empty } from '../ui.js';
import { subjectChip, subjectOptions, colorVar } from '../components.js';
import { putFile, getFile, deleteFile } from '../files.js';

const ui = { q: '', subject: '', kind: '' };
const MAX_BYTES = 50 * 1024 * 1024;

export const TEMPLATES = {
  blank: { label: 'Blank', text: '' },
  cornell: { label: 'Cornell notes', text: 'CUES / QUESTIONS\n• \n• \n\nNOTES\n\n\nSUMMARY (2–3 sentences)\n' },
  feynman: { label: 'Feynman: teach it simply', text: 'CONCEPT:\n\nExplain it like you’re teaching a 10-year-old:\n\n\nWhere I got stuck / used jargon:\n\n\nSimpler version (after checking my notes):\n' },
  blurt: { label: 'Blurt sheet', text: 'TOPIC:\n\n1) Everything I remember (no peeking!):\n\n\n2) What I missed after checking notes:\n\n\n3) Review these again:\n' },
  summary: { label: 'Chapter summary', text: 'CHAPTER:\n\nMain idea:\n\nKey terms:\n• \n\nThree things to remember:\n1. \n2. \n3. \n\nQuestions I still have:\n' },
};

function kindOf(n) {
  if (n.kind === 'text') return { icon: 'text', label: 'Note' };
  if (n.mime?.startsWith('image/')) return { icon: 'image', label: 'Image' };
  if (n.mime === 'application/pdf') return { icon: 'file', label: 'PDF' };
  return { icon: 'file', label: (n.fileName?.split('.').pop() || 'File').toUpperCase() };
}

function matches(n) {
  const q = ui.q.trim().toLowerCase();
  if (ui.subject && n.subjectId !== ui.subject) return false;
  if (ui.kind === 'text' && n.kind !== 'text') return false;
  if (ui.kind === 'file' && n.kind !== 'file') return false;
  if (!q) return true;
  return [n.title, n.fileName, n.text, ...(n.tags || [])].some((v) => v && v.toLowerCase().includes(q));
}

function results(s) {
  const list = s.notes.filter(matches).sort((a, b) => b.createdAt - a.createdAt);
  if (!s.notes.length) return empty({ emoji: '🗂️', title: 'Your library is empty', text: 'Upload class handouts, photos of the whiteboard, PDFs, or write notes right here. Each new note earns XP.' });
  if (!list.length) return empty({ emoji: '🔍', title: 'No matches', text: 'Try a different search or filter.' });
  return `<ul class="note-grid">${list.map((n) => {
    const k = kindOf(n);
    const sub = subjectById(s, n.subjectId);
    return `<li><button class="card note-card" data-open="${n.id}" style="--c:${colorVar(sub?.color)}">
      <span class="note-thumb" data-thumb="${n.kind === 'file' && n.mime?.startsWith('image/') ? n.id : ''}">${icon(k.icon, 28)}<span class="note-kind">${k.label}</span></span>
      <span class="note-body">
        <strong class="note-title">${esc(n.title)}</strong>
        ${n.kind === 'text' ? `<span class="note-snippet">${esc(n.text.slice(0, 110))}</span>` : `<span class="note-snippet">${esc(n.fileName)} · ${fmtBytes(n.size)}</span>`}
        <span class="task-meta">${subjectChip(s, n.subjectId)}${(n.tags || []).slice(0, 3).map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}</span>
        <span class="small muted">${fmtDate(dateISO(new Date(n.createdAt)), { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </span>
    </button></li>`;
  }).join('')}</ul>`;
}

export default {
  title: 'Notes Library',
  render(s) {
    const files = s.notes.filter((n) => n.kind === 'file');
    const bytes = files.reduce((a, n) => a + (n.size || 0), 0);
    return `
    <header class="page-head">
      <div><p class="eyebrow">Study</p><h1>Notes Library</h1><p class="lede">One place for every handout, photo and note — searchable and sorted by class. Files stay on this device.</p></div>
      <div class="hero-actions">
        <button class="btn" data-action="write">${icon('edit', 18)}Write a note</button>
        <label class="btn btn-primary file-btn">${icon('upload', 18)}Upload files<input type="file" multiple data-upload hidden></label>
      </div>
    </header>

    <label class="dropzone" data-dropzone>
      <input type="file" multiple data-upload class="sr-only">
      ${icon('upload', 28)}
      <span><strong>Drop files here</strong> or click to browse</span>
      <span class="small muted">PDFs, images, docs, slides — up to 50 MB each · +10 XP per note (5/day)</span>
      <span class="dropzone-sub">
        <span class="small">File into:</span>
        <select class="input input-sm" data-upload-subject aria-label="Class for uploaded files">${subjectOptions(s, ui.subject, { none: 'General' })}</select>
      </span>
    </label>

    <div class="toolbar">
      <div class="search">${icon('search', 18)}<input class="input" type="search" placeholder="Search titles, tags, text…" value="${esc(ui.q)}" data-search aria-label="Search notes"></div>
      <select class="input input-sm" data-filter="subject" aria-label="Filter by class">${subjectOptions(s, ui.subject, { none: 'All classes' })}</select>
      <div class="seg" role="group" aria-label="Type">
        ${[['', 'All'], ['file', 'Files'], ['text', 'Written']].map(([k, l]) => `<button class="seg-btn" data-kind="${k}" aria-pressed="${ui.kind === k}">${l}</button>`).join('')}
      </div>
      <span class="muted small toolbar-end">${s.notes.length} notes · ${fmtBytes(bytes)}</span>
    </div>
    <div data-results>${results(s)}</div>`;
  },
  mount(el, s) {
    loadThumbs(el);
    el.addEventListener('input', (e) => {
      if (!e.target.matches('[data-search]')) return;
      ui.q = e.target.value;
      // Update only the results so the search box keeps focus.
      el.querySelector('[data-results]').innerHTML = results(getState());
      loadThumbs(el);
    });
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-upload]')) {
        const sub = el.querySelector('[data-upload-subject]').value;
        handleFiles([...e.target.files], sub);
        e.target.value = '';
      } else if (e.target.dataset.filter) {
        ui.subject = e.target.value;
        update(() => {});
      }
    });
    el.addEventListener('click', (e) => {
      const k = e.target.closest('[data-kind]');
      if (k) {
        ui.kind = k.dataset.kind;
        return update(() => {});
      }
      if (e.target.closest('[data-action=write]')) return openTextNote(null, { subjectId: ui.subject });
      const o = e.target.closest('[data-open]');
      if (o) openPreview(o.dataset.open);
    });
    const dz = el.querySelector('[data-dropzone]');
    ['dragenter', 'dragover'].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => dz.addEventListener(t, () => dz.classList.remove('is-over')));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      handleFiles([...e.dataTransfer.files], el.querySelector('[data-upload-subject]').value);
    });
  },
};

async function loadThumbs(el) {
  for (const t of el.querySelectorAll('[data-thumb]:not([data-thumb=""])')) {
    try {
      const blob = await getFile(t.dataset.thumb);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      t.style.backgroundImage = `url("${url}")`;
      t.classList.add('has-image');
    } catch {}
  }
}

async function handleFiles(files, subjectId) {
  if (!files.length) return;
  const ok = files.filter((f) => f.size <= MAX_BYTES);
  if (ok.length < files.length) toast(`${files.length - ok.length} file(s) over 50 MB were skipped.`, { kind: 'error', emoji: '⚠️' });
  const added = [];
  for (const f of ok) {
    const id = uid();
    try {
      await putFile(id, f);
      added.push({ id, kind: 'file', title: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, mime: f.type || 'application/octet-stream', size: f.size, subjectId, tags: [], createdAt: Date.now() });
    } catch (err) {
      toast(`Couldn’t store ${esc(f.name)} — device storage may be full.`, { kind: 'error', emoji: '⚠️' });
    }
  }
  if (!added.length) return;
  update((s) => {
    s.notes.push(...added);
    rewardUpload(s, added.length);
  });
  toast(`Uploaded ${added.length} file${added.length > 1 ? 's' : ''}`, { kind: 'success', emoji: '📎' });
}

function tagsField(tags = []) {
  return `<label class="field"><span class="label">Tags <small class="muted">(comma separated)</small></span><input class="input" name="tags" value="${esc(tags.join(', '))}" placeholder="unit 3, formulas"></label>`;
}
const parseTags = (v) => [...new Set(String(v || '').split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))].slice(0, 8);

export function openTextNote(existing = null, defaults = {}) {
  const s = getState();
  const n = existing || { title: '', text: TEMPLATES[defaults.template || 'blank'].text, subjectId: defaults.subjectId || '', tags: [] };
  modal({
    title: existing ? 'Edit note' : 'New note',
    size: 'lg',
    body: `<form class="modal-form">
      <div class="modal-body stack">
        ${existing ? '' : `<div class="field"><span class="label">Template</span><div class="seg seg-wrap">${Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="seg-btn" data-template="${k}" aria-pressed="${(defaults.template || 'blank') === k}">${t.label}</button>`).join('')}</div></div>`}
        <label class="field"><span class="label">Title</span><input class="input" name="title" required maxlength="120" value="${esc(n.title)}" placeholder="${defaults.template === 'feynman' ? 'e.g. Photosynthesis, simply' : 'e.g. Chapter 5 key ideas'}"></label>
        <div class="field-row">
          <label class="field"><span class="label">Class</span><select class="input" name="subjectId">${subjectOptions(s, n.subjectId, { none: 'General' })}</select></label>
          ${tagsField(n.tags)}
        </div>
        <label class="field"><span class="label">Note</span><textarea class="input textarea-note" name="text" rows="14">${esc(n.text)}</textarea></label>
      </div>
      <footer class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">${existing ? 'Save' : 'Save note'}</button></footer>
    </form>`,
    onMount(el, close) {
      el.querySelector('[name=title]').focus();
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-template]');
        if (!t) return;
        const ta = el.querySelector('[name=text]');
        if (ta.value.trim() && !Object.values(TEMPLATES).some((x) => x.text === ta.value)) {
          ta.value += '\n\n' + TEMPLATES[t.dataset.template].text;
        } else ta.value = TEMPLATES[t.dataset.template].text;
        el.querySelectorAll('[data-template]').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
      });
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target.elements;
        const title = f.namedItem('title').value.trim() || 'Untitled note';
        const data = { title, subjectId: f.subjectId.value, tags: parseTags(f.tags.value), text: f.text.value };
        update((st) => {
          if (existing) Object.assign(st.notes.find((x) => x.id === existing.id), data);
          else {
            st.notes.push({ id: uid(), kind: 'text', createdAt: Date.now(), ...data });
            rewardUpload(st, 1);
          }
        });
        toast(existing ? 'Note saved' : 'Note added to your library', { kind: 'success', emoji: '📝' });
        close();
      });
    },
  });
}

async function openPreview(id) {
  const s = getState();
  const n = s.notes.find((x) => x.id === id);
  if (!n) return;
  let url = null;
  let blob = null;
  if (n.kind === 'file') {
    try { blob = await getFile(id); } catch {}
    if (blob) url = URL.createObjectURL(blob);
  }
  let preview;
  if (n.kind === 'text') preview = `<pre class="note-text">${esc(n.text)}</pre>`;
  else if (!url) preview = empty({ emoji: '⚠️', title: 'File not found on this device', text: 'It may have been cleared from browser storage.' });
  else if (n.mime.startsWith('image/')) preview = `<img class="preview-img" src="${url}" alt="${esc(n.title)}">`;
  else if (n.mime === 'application/pdf') preview = `<iframe class="preview-frame" src="${url}" title="${esc(n.title)}"></iframe>`;
  else if (n.mime.startsWith('text/') || /\.(md|txt|csv|json)$/i.test(n.fileName)) preview = `<pre class="note-text">${esc((await blob.text()).slice(0, 20000))}</pre>`;
  else preview = empty({ emoji: '📄', title: 'No preview for this file type', text: 'Download it to open in another app.' });

  modal({
    title: esc(n.title),
    size: 'xl',
    body: `<div class="modal-body stack">
        <div class="task-meta">${subjectChip(s, n.subjectId)}${(n.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}${n.kind === 'file' ? `<span class="small muted">${esc(n.fileName)} · ${fmtBytes(n.size)}</span>` : ''}</div>
        ${preview}
      </div>
      <footer class="modal-foot">
        <button type="button" class="btn btn-ghost btn-danger-text" data-del>${icon('trash', 18)}Delete</button>
        <span class="spacer"></span>
        ${url ? `<a class="btn" href="${url}" download="${esc(n.fileName)}">${icon('download', 18)}Download</a>` : ''}
        <button type="button" class="btn btn-primary" data-edit>${icon('edit', 18)}${n.kind === 'text' ? 'Edit' : 'Rename & tag'}</button>
      </footer>`,
    onClose: () => url && setTimeout(() => URL.revokeObjectURL(url), 1000),
    onMount(el, close) {
      el.querySelector('[data-edit]').addEventListener('click', () => {
        close();
        n.kind === 'text' ? openTextNote(n) : openFileMeta(n);
      });
      el.querySelector('[data-del]').addEventListener('click', async () => {
        close();
        if (!(await confirmDialog(`Delete “${esc(n.title)}” from your library?`))) return;
        if (n.kind === 'file') await deleteFile(n.id).catch(() => {});
        update((st) => (st.notes = st.notes.filter((x) => x.id !== n.id)));
        toast('Deleted', { emoji: '🗑️' });
      });
    },
  });
}

function openFileMeta(n) {
  const s = getState();
  modal({
    title: 'Rename & tag',
    size: 'sm',
    body: `<form class="modal-form"><div class="modal-body stack">
      <label class="field"><span class="label">Title</span><input class="input" name="title" value="${esc(n.title)}" required></label>
      <label class="field"><span class="label">Class</span><select class="input" name="subjectId">${subjectOptions(s, n.subjectId, { none: 'General' })}</select></label>
      ${tagsField(n.tags)}
    </div><footer class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></footer></form>`,
    onMount(el, close) {
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target.elements;
        update((st) => Object.assign(st.notes.find((x) => x.id === n.id), { title: f.namedItem('title').value.trim() || n.fileName, subjectId: f.subjectId.value, tags: parseTags(f.tags.value) }));
        close();
      });
    },
  });
}
