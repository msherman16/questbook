// "Make flashcards from notes": choose a source → read its text → review
// suggested cards → save as a deck that every study game can use.
import { update, getState, award, rewardUpload, subjectById } from '../store.js';
import { esc, uid, todayISO, plural, fmtBytes } from '../util.js';
import { icon, modal, toast, empty } from '../ui.js';
import { subjectOptions } from '../components.js';
import { putFile } from '../files.js';
import { extractText, canExtract, kindOfFile } from '../extract.js';
import { findCards } from '../cardgen.js';

const ACCEPT = 'image/*,.pdf,.txt,.md,.csv,.docx,.pptx';
const MAX_BYTES = 50 * 1024 * 1024;

// Save an uploaded/scanned file into the Notes Library and return its note record.
export async function storeFileNote(file, subjectId = '') {
  if (file.size > MAX_BYTES) throw new Error('That file is over 50 MB.');
  const id = uid();
  await putFile(id, file);
  const note = { id, kind: 'file', title: file.name.replace(/\.[^.]+$/, '') || 'Scan', fileName: file.name || 'scan.jpg', mime: file.type || 'application/octet-stream', size: file.size, subjectId, tags: [], createdAt: Date.now() };
  update((s) => {
    s.notes.push(note);
    rewardUpload(s, 1);
  });
  return note;
}

/* Step 1: choose a source ------------------------------------------ */

export function openDeckBuilder({ noteId, subjectId = '' } = {}) {
  const s = getState();
  if (noteId) return readNote(s.notes.find((n) => n.id === noteId));
  const readable = s.notes.filter(canExtract).sort((a, b) => b.createdAt - a.createdAt);

  modal({
    title: 'Make flashcards from notes',
    size: 'lg',
    body: `<div class="modal-body stack">
      <p class="muted small">Questbook reads your notes, finds terms and their meanings, and lets you check every card before saving. Nothing leaves this device.</p>
      <div class="source-grid">
        <label class="source-card">
          <input type="file" accept="image/*" capture="environment" data-src-file hidden>
          <span class="source-emoji" aria-hidden="true">📷</span><strong>Scan with camera</strong><span class="small muted">Take a photo of a page or the whiteboard</span>
        </label>
        <label class="source-card">
          <input type="file" accept="${ACCEPT}" data-src-file hidden>
          <span class="source-emoji" aria-hidden="true">📎</span><strong>Upload a file</strong><span class="small muted">Photo, PDF, Word, PowerPoint or text</span>
        </label>
      </div>
      ${readable.length ? `
      <div class="field"><span class="label">Or pick from your Notes Library</span>
        <ul class="source-notes">${readable.slice(0, 30).map((n) => `
          <li><button type="button" class="source-note" data-src-note="${n.id}">
            ${icon(n.kind === 'text' ? 'text' : kindOfFile(n.fileName, n.mime) === 'image' ? 'image' : 'file', 18)}
            <span class="source-note-title">${esc(n.title)}</span>
            <span class="small muted">${subjectById(s, n.subjectId)?.name ? esc(subjectById(s, n.subjectId).name) : 'General'}${n.size ? ` · ${fmtBytes(n.size)}` : ''}</span>
          </button></li>`).join('')}</ul>
      </div>` : ''}
      <label class="field"><span class="label">Or paste text</span>
        <textarea class="input" rows="5" data-src-text placeholder="Paste notes, a study guide, or a vocab list…"></textarea></label>
    </div>
    <footer class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn btn-primary" data-src-paste>Use pasted text</button></footer>`,
    onMount(el, close) {
      el.addEventListener('change', async (e) => {
        if (!e.target.matches('[data-src-file]') || !e.target.files[0]) return;
        const file = e.target.files[0];
        close();
        try {
          readNote(await storeFileNote(file, subjectId));
        } catch (err) {
          toast(esc(err.message), { kind: 'error', emoji: '⚠️', timeout: 6000 });
        }
      });
      el.addEventListener('click', (e) => {
        const n = e.target.closest('[data-src-note]');
        if (n) {
          close();
          return readNote(getState().notes.find((x) => x.id === n.dataset.srcNote));
        }
        if (e.target.closest('[data-src-paste]')) {
          const text = el.querySelector('[data-src-text]').value.trim();
          if (!text) return el.querySelector('[data-src-text]').focus();
          close();
          openReview({ text, title: '', subjectId, method: 'text' });
        }
      });
    },
  });
}

/* Step 2: read the note -------------------------------------------- */

async function readNote(note) {
  if (!note) return;
  if (!canExtract(note)) {
    return toast('This file type can’t be read yet. Try a photo, PDF, Word, PowerPoint or text file.', { kind: 'error', emoji: '⚠️', timeout: 6000 });
  }
  let cancelled = false;
  const m = modal({
    title: 'Reading your notes…',
    size: 'sm',
    body: `<div class="modal-body stack reading">
      <div class="reading-emoji" aria-hidden="true">🔎</div>
      <p class="strong" data-read-label role="status">Opening “${esc(note.title)}”…</p>
      <div class="progress"><span data-read-bar style="width:8%"></span></div>
      <p class="small muted">Photos take the longest — usually 5 to 20 seconds per page.</p>
    </div>
    <footer class="modal-foot"><button type="button" class="btn" data-close>Cancel</button></footer>`,
    onClose: () => (cancelled = true),
  });
  try {
    const result = await extractText(note, ({ label, pct }) => {
      if (cancelled) return;
      m.el.querySelector('[data-read-label]').textContent = label;
      if (pct != null) m.el.querySelector('[data-read-bar]').style.width = `${Math.max(8, pct * 100)}%`;
    });
    if (cancelled) return;
    cancelled = true;
    m.close();
    openReview({ ...result, title: note.title, subjectId: note.subjectId, noteId: note.id });
  } catch (err) {
    if (cancelled) return;
    cancelled = true;
    m.close();
    toast(esc(err.message), { kind: 'error', emoji: '⚠️', timeout: 7000 });
  }
}

/* Step 3: review and save ------------------------------------------ */

function openReview({ text, title, subjectId, method, confidence, warning }) {
  const s = getState();
  let cards = findCards(text).map((c) => ({ ...c, id: uid(), on: true }));
  const lowQuality = method === 'ocr' && confidence != null && confidence < 65;

  const row = (c) => `
    <li class="bcard ${c.on ? '' : 'is-off'}" data-id="${c.id}">
      <input type="checkbox" class="bcard-check" ${c.on ? 'checked' : ''} aria-label="Include this card">
      <div class="bcard-fields">
        <input class="input" data-f="front" value="${esc(c.front)}" placeholder="Term or question" aria-label="Term">
        <textarea class="input" data-f="back" rows="2" placeholder="Meaning or answer" aria-label="Meaning">${esc(c.back)}</textarea>
      </div>
      <button type="button" class="icon-btn" data-remove aria-label="Remove card">${icon('x', 18)}</button>
    </li>`;

  const list = () => (cards.length ? cards.map(row).join('') : `<li>${empty({
    emoji: '🧐', title: 'No cards found yet',
    text: text.trim() ? 'These notes don’t have clear “term – meaning” pairs. Edit the text so each line looks like <code>term: meaning</code> and tap <strong>Find cards again</strong>, or add cards by hand.' : 'We couldn’t read any text from this file. Try a sharper, well-lit photo taken straight on, or type the key terms in the text box.',
  })}</li>`);

  modal({
    title: 'Review your flashcards',
    size: 'xl',
    body: `<form class="modal-form">
      <div class="modal-body builder">
        <section class="builder-text stack-sm">
          <div class="builder-head"><h3 class="h4">1 · Text from your notes</h3>${method === 'ocr' && confidence != null ? `<span class="badge ${lowQuality ? 'badge-test' : 'badge-study'}">Scan quality ${confidence}%</span>` : ''}</div>
          ${lowQuality ? `<p class="notice notice-warn">${icon('eye', 16)} This scan was hard to read. Handwriting and blurry or angled photos are tricky — check the text below and fix mistakes.</p>` : ''}
          ${warning ? `<p class="notice">${esc(warning)}</p>` : ''}
          <textarea class="input textarea-note builder-textarea" data-text aria-label="Text from your notes" spellcheck="false">${esc(text)}</textarea>
          <div class="row-actions"><button type="button" class="btn btn-sm" data-rescan>${icon('reset', 16)}Find cards again</button><span class="tiny muted">Fix the text, then re-run to update the cards.</span></div>
          <details class="builder-help small"><summary>What gets turned into a card?</summary>
            <ul class="help-bullets"><li><code>term: meaning</code>, <code>term - meaning</code> or <code>term = meaning</code></li><li>A question on one line with its answer on the next</li><li>Sentences like “A catalyst is a substance that…”</li><li>Dates like <code>1776 - Declaration signed</code></li><li>A short heading followed by bullet points</li></ul>
          </details>
        </section>
        <section class="builder-cards stack-sm">
          <div class="builder-head"><h3 class="h4">2 · Cards <span class="count" data-count></span></h3><button type="button" class="btn btn-sm" data-add>${icon('plus', 16)}Add card</button></div>
          <ul class="bcard-list" data-list>${list()}</ul>
        </section>
      </div>
      <footer class="modal-foot builder-foot">
        <label class="field"><span class="label">Save to</span>
          <select class="input" name="target"><option value="">New deck</option>${s.decks.map((d) => `<option value="${d.id}">Add to “${esc(d.name)}”</option>`).join('')}</select></label>
        <label class="field" data-new-only><span class="label">Deck name</span><input class="input" name="deckName" maxlength="60" value="${esc(title)}" placeholder="e.g. Unit 3 vocab"></label>
        <label class="field" data-new-only><span class="label">Class</span><select class="input" name="subjectId">${subjectOptions(s, subjectId, { none: 'General' })}</select></label>
        <p class="form-error" hidden></p>
        <div class="builder-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary" data-save>Save deck</button></div>
      </footer>
    </form>`,
    onMount(el, close) {
      const listEl = el.querySelector('[data-list]');
      const refresh = () => {
        const n = cards.filter((c) => c.on && c.front.trim() && c.back.trim()).length;
        el.querySelector('[data-count]').textContent = `${n} selected`;
        el.querySelector('[data-save]').textContent = n ? `Save ${plural(n, 'card')}` : 'Save deck';
        el.querySelector('[data-save]').disabled = !n;
      };
      const redraw = () => {
        listEl.innerHTML = list();
        refresh();
      };
      refresh();

      el.addEventListener('input', (e) => {
        const li = e.target.closest('.bcard');
        if (!li) return;
        const c = cards.find((x) => x.id === li.dataset.id);
        if (e.target.dataset.f) c[e.target.dataset.f] = e.target.value;
        if (e.target.matches('.bcard-check')) {
          c.on = e.target.checked;
          li.classList.toggle('is-off', !c.on);
        }
        refresh();
      });
      el.addEventListener('change', (e) => {
        if (e.target.name !== 'target') return;
        el.querySelectorAll('[data-new-only]').forEach((f) => (f.hidden = !!e.target.value));
      });
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) {
          cards = cards.filter((c) => c.id !== e.target.closest('.bcard').dataset.id);
          return redraw();
        }
        if (e.target.closest('[data-add]')) {
          cards.push({ id: uid(), on: true, front: '', back: '', kind: 'manual' });
          redraw();
          listEl.lastElementChild.querySelector('input.input').focus();
          return;
        }
        if (e.target.closest('[data-rescan]')) {
          text = el.querySelector('[data-text]').value;
          // Keep anything the student typed by hand; replace the auto-found cards.
          cards = [...findCards(text).map((c) => ({ ...c, id: uid(), on: true })), ...cards.filter((c) => c.kind === 'manual' && (c.front || c.back))];
          redraw();
          toast(`Found ${plural(cards.length, 'card')}`, { emoji: '🔎', timeout: 1800 });
        }
      });
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target.elements;
        const picked = cards.filter((c) => c.on && c.front.trim() && c.back.trim());
        const err = el.querySelector('.form-error');
        const target = f.target.value;
        const name = f.deckName.value.trim();
        if (!picked.length) return;
        if (!target && !name) {
          Object.assign(err, { hidden: false, textContent: 'Give the deck a name.' });
          return f.deckName.focus();
        }
        let deckId = target;
        let added = 0;
        update((st) => {
          const fresh = (c) => ({ id: uid(), front: c.front.trim(), back: c.back.trim(), box: 1, due: todayISO() });
          if (target) {
            const deck = st.decks.find((d) => d.id === target);
            const have = new Set(deck.cards.map((c) => c.front.toLowerCase()));
            const extra = picked.filter((c) => !have.has(c.front.trim().toLowerCase())).map(fresh);
            deck.cards.push(...extra);
            added = extra.length;
          } else {
            deckId = uid();
            st.decks.push({ id: deckId, name, subjectId: f.subjectId.value, cards: picked.map(fresh) });
            added = picked.length;
          }
          if (added) award(st, 15, 'Turned notes into flashcards');
        });
        try { localStorage.setItem('qb:lastDeck', deckId); } catch {}
        close();
        toast(added ? `${plural(added, 'card')} saved — ready to play!` : 'Those cards were already in that deck.', { kind: 'success', emoji: '🃏', timeout: 4000 });
        location.hash = '#/games';
      });
    },
  });
}
