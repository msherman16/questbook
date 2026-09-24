import { update, getState, reviewCard, finishGame, subjectById } from '../store.js';
import { esc, uid, todayISO, shuffle, closeEnough, plural } from '../util.js';
import { icon, modal, toast, confirmDialog, empty, progressBar } from '../ui.js';
import { subjectChip, subjectOptions, colorVar } from '../components.js';
import { openTextNote } from './notes.js';

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

const GAMES = {
  flashcards: { name: 'Flashcards', emoji: '🃏', min: 1, blurb: 'Flip, recall, rate yourself. Cards you miss come back sooner (spaced repetition).', technique: 'Active recall + spaced repetition' },
  quiz: { name: 'Quiz Show', emoji: '🎤', min: 4, blurb: 'Ten rapid multiple-choice questions. Go for a perfect score.', technique: 'Practice testing' },
  match: { name: 'Match Rush', emoji: '🧩', min: 3, blurb: 'Pair each term with its meaning against the clock. Beat your best time.', technique: 'Retrieval under time pressure' },
  speed: { name: 'Speed Recall', emoji: '⚡', min: 3, blurb: '60 seconds. See the meaning, type the term. Typos are forgiven.', technique: 'Free recall' },
};

export const TECHNIQUES = [
  { id: 'pomodoro', emoji: '🍅', name: 'Pomodoro', what: 'Work in focused 25-minute blocks with 5-minute breaks. After four, take a longer break.', best: 'Getting started, long sessions, beating procrastination', cta: 'Start a focus block', go: () => (location.hash = '#/timer') },
  { id: 'recall', emoji: '🧠', name: 'Active recall', what: 'Close the book and pull the answer out of your memory before checking. Retrieval is what makes it stick.', best: 'Definitions, vocab, facts, formulas', cta: 'Play Flashcards', go: (start) => start('flashcards') },
  { id: 'spaced', emoji: '📆', name: 'Spaced repetition', what: 'Review just as you’re about to forget: 1 day, 2 days, 4 days, a week. Short sessions beat one long cram.', best: 'Anything with a test date on the calendar', cta: 'Make a test prep plan', go: () => (location.hash = '#/assignments') },
  { id: 'practice', emoji: '📝', name: 'Practice testing', what: 'Quiz yourself in test conditions. Mistakes now are how you avoid mistakes later.', best: 'The week before a quiz or test', cta: 'Play Quiz Show', go: (start) => start('quiz') },
  { id: 'interleave', emoji: '🔀', name: 'Interleaving', what: 'Mix topics and question types instead of drilling one at a time. It trains you to pick the right approach.', best: 'Math, science, anything with problem types', cta: 'Quiz across all decks', go: (start) => start('quiz', 'all') },
  { id: 'feynman', emoji: '🧑‍🏫', name: 'Feynman technique', what: 'Explain the idea in plain words as if teaching someone younger. Where you stumble is where to study.', best: 'Big concepts and “why” questions', cta: 'Open a Feynman sheet', go: () => openTextNote(null, { template: 'feynman' }) },
  { id: 'blurt', emoji: '💭', name: 'Blurting', what: 'Write everything you remember about a topic from memory, then check your notes and fill the gaps in another color.', best: 'Essays, history, biology — content-heavy topics', cta: 'Open a blurt sheet', go: () => openTextNote(null, { template: 'blurt' }) },
  { id: 'dual', emoji: '🎨', name: 'Dual coding', what: 'Pair words with visuals: sketch diagrams, timelines and mind maps next to your notes.', best: 'Processes, cycles, timelines', cta: 'Upload a sketch', go: () => (location.hash = '#/notes') },
];

/* ------------------------------------------------------------------ */
/* Game state (module-level so re-renders don't reset a game)          */
/* ------------------------------------------------------------------ */

let g = { screen: 'hub' };
let interval = null;
let keyHandler = null;
let pickedDeck = localStorageGet('qb:lastDeck') || '';

function localStorageGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function localStorageSet(k, v) {
  try { localStorage.setItem(k, v); } catch {}
}

const rerender = () => update(() => {});
const stopTimers = () => {
  clearInterval(interval);
  interval = null;
};

function pool(s, deckKey) {
  const decks = deckKey === 'all' ? s.decks : s.decks.filter((d) => d.id === deckKey);
  return decks.flatMap((d) => d.cards.map((c) => ({ deckId: d.id, ...c })));
}
const deckName = (s, key) => (key === 'all' ? 'All decks (mixed)' : s.decks.find((d) => d.id === key)?.name || 'Deck');

function start(game, deckKey) {
  const s = getState();
  deckKey = deckKey || pickedDeck || s.decks[0]?.id;
  if (!deckKey || !s.decks.length) return toast('Create a deck first — it only takes a minute.', { emoji: '🃏' });
  const cards = pool(s, deckKey);
  if (cards.length < GAMES[game].min) return toast(`${GAMES[game].name} needs at least ${GAMES[game].min} cards in the deck.`, { kind: 'error', emoji: '🃏' });
  stopTimers();
  g = { screen: 'play', game, deckKey, done: false };

  if (game === 'flashcards') {
    const today = todayISO();
    const due = cards.filter((c) => !c.due || c.due <= today);
    g.practice = !due.length;
    g.queue = shuffle(due.length ? due : cards).slice(0, 20);
    Object.assign(g, { i: 0, flipped: false, right: 0, wrong: 0 });
  }
  if (game === 'quiz') {
    g.questions = shuffle(cards).slice(0, 10).map((c) => {
      const others = shuffle(cards.filter((o) => o.back !== c.back)).slice(0, 3).map((o) => o.back);
      return { prompt: c.front, answer: c.back, options: shuffle([c.back, ...others]) };
    });
    Object.assign(g, { i: 0, picked: null, score: 0 });
  }
  if (game === 'match') {
    const set = shuffle(cards).slice(0, 6);
    g.tiles = shuffle(set.flatMap((c, i) => [{ id: uid(), pair: i, text: c.front, side: 'term' }, { id: uid(), pair: i, text: c.back, side: 'def' }]));
    Object.assign(g, { selected: null, matched: [], wrong: [], startAt: Date.now(), endAt: null, misses: 0 });
    interval = setInterval(() => {
      const el = document.querySelector('[data-match-time]');
      if (el) el.textContent = secs(Date.now() - g.startAt);
    }, 200);
  }
  if (game === 'speed') {
    Object.assign(g, { cards: shuffle(cards), idx: 0, score: 0, seen: 0, log: [], endAt: Date.now() + 60000, feedback: null });
    interval = setInterval(() => {
      const left = Math.max(0, g.endAt - Date.now());
      const el = document.querySelector('[data-speed-time]');
      if (el) el.textContent = Math.ceil(left / 1000);
      const bar = document.querySelector('[data-speed-bar]');
      if (bar) bar.style.width = `${(left / 60000) * 100}%`;
      if (left <= 0) endSpeed();
    }, 200);
  }
  rerender();
  window.scrollTo(0, 0);
}

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

function toHub() {
  stopTimers();
  g = { screen: 'hub' };
  rerender();
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export default {
  title: 'Study Games',
  leave() {
    stopTimers();
    g = { screen: 'hub' };
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
  },
  render(s) {
    if (g.screen === 'play') return playScreen(s);
    return hub(s);
  },
  mount(el) {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = (e) => onKey(e);
    document.addEventListener('keydown', keyHandler);
    el.addEventListener('click', onClick);
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-deck-pick]')) {
        pickedDeck = e.target.value;
        localStorageSet('qb:lastDeck', pickedDeck);
      }
    });
    el.addEventListener('submit', (e) => {
      if (!e.target.matches('[data-speed-form]')) return;
      e.preventDefault();
      submitSpeed(e.target.elements.answer.value);
    });
    el.querySelector('[data-autofocus]')?.focus();
  },
};

function hub(s) {
  const today = todayISO();
  if (pickedDeck && pickedDeck !== 'all' && !s.decks.some((d) => d.id === pickedDeck)) pickedDeck = '';
  const deckSelect = `<select class="input input-sm" data-deck-pick aria-label="Deck to play">
    ${s.decks.map((d) => `<option value="${d.id}" ${pickedDeck === d.id ? 'selected' : ''}>${subjectById(s, d.subjectId)?.icon || '🃏'} ${esc(d.name)} (${d.cards.length})</option>`).join('')}
    ${s.decks.length > 1 ? `<option value="all" ${pickedDeck === 'all' ? 'selected' : ''}>🔀 All decks (mixed)</option>` : ''}
  </select>`;
  return `
  <header class="page-head">
    <div><p class="eyebrow">Study</p><h1>Study Games</h1><p class="lede">Turn your flashcard decks into games. Every game is built on a study technique that research shows actually works.</p></div>
    <div class="hero-actions"><button class="btn btn-primary" data-action="new-deck">${icon('plus', 18)}New deck</button></div>
  </header>

  <section aria-labelledby="h-play">
    <div class="section-head"><h2 id="h-play">Play</h2>${s.decks.length ? `<label class="inline-field"><span class="small muted">Deck</span>${deckSelect}</label>` : ''}</div>
    <div class="game-grid">
      ${Object.entries(GAMES).map(([id, gm]) => `
        <article class="card game-card game-${id}">
          <div class="game-art" aria-hidden="true">${gm.emoji}</div>
          <div class="card-pad stack-sm">
            <h3>${gm.name}</h3>
            <p class="small">${gm.blurb}</p>
            <p class="tiny muted">${icon('bulb', 14)} ${gm.technique}</p>
            <button class="btn btn-primary btn-block" data-play="${id}" ${s.decks.length ? '' : 'disabled'}>${icon('play', 16)}Play</button>
          </div>
        </article>`).join('')}
    </div>
  </section>

  <section aria-labelledby="h-decks">
    <div class="section-head"><h2 id="h-decks">Your decks</h2></div>
    ${s.decks.length ? `<ul class="deck-grid">${s.decks.map((d) => {
      const due = d.cards.filter((c) => !c.due || c.due <= today).length;
      const mastered = d.cards.filter((c) => (c.box || 1) >= 4).length;
      const sub = subjectById(s, d.subjectId);
      return `<li class="card deck-card" style="--c:${colorVar(sub?.color)}">
        <div class="card-pad stack-sm">
          <div class="deck-top"><h3>${esc(d.name)}</h3>${subjectChip(s, d.subjectId)}</div>
          <p class="small muted">${plural(d.cards.length, 'card')} · ${due ? `<strong class="text-warning">${due} due</strong>` : 'none due'} · ${mastered} mastered</p>
          ${progressBar(d.cards.length ? (mastered / d.cards.length) * 100 : 0, { tone: 'success', label: 'Mastery' })}
          <div class="row-actions">
            <button class="btn btn-sm btn-primary" data-play="flashcards" data-deck="${d.id}">${icon('play', 16)}Review${due ? ` ${due}` : ''}</button>
            <button class="btn btn-sm" data-action="edit-deck" data-id="${d.id}">${icon('edit', 16)}Edit</button>
            <button class="icon-btn" data-action="delete-deck" data-id="${d.id}" aria-label="Delete ${esc(d.name)}">${icon('trash', 16)}</button>
          </div>
        </div>
      </li>`;
    }).join('')}</ul>` : empty({ emoji: '🃏', title: 'No decks yet', text: 'A deck is a set of term → meaning cards. Paste a list and every game unlocks.', action: `<button class="btn btn-primary" data-action="new-deck">${icon('plus', 18)}Create a deck</button>` })}
  </section>

  <section aria-labelledby="h-tech">
    <div class="section-head"><h2 id="h-tech">Study techniques</h2><span class="small muted">Pick one that fits what you’re studying</span></div>
    <div class="tech-grid">
      ${TECHNIQUES.map((t) => `
        <article class="card card-pad tech-card">
          <div class="tech-head"><span class="tech-emoji" aria-hidden="true">${t.emoji}</span><h3>${t.name}</h3></div>
          <p class="small">${t.what}</p>
          <p class="tiny muted"><strong>Best for:</strong> ${t.best}</p>
          <button class="btn btn-sm btn-ghost tech-cta" data-tech="${t.id}">${t.cta} ${icon('chevronRight', 16)}</button>
        </article>`).join('')}
    </div>
  </section>`;
}

function playHeader(s, extra = '') {
  const gm = GAMES[g.game];
  return `<div class="play-head">
    <button class="btn btn-sm btn-ghost" data-action="quit">${icon('chevronLeft', 16)}Games</button>
    <div class="play-title"><span aria-hidden="true">${gm.emoji}</span><strong>${gm.name}</strong><span class="muted small">${esc(deckName(s, g.deckKey))}</span></div>
    <div class="play-extra">${extra}</div>
  </div>`;
}

function summary(s, { emoji, title, lines, xp }) {
  return `${playHeader(s)}
  <section class="card card-pad summary">
    <div class="summary-emoji" aria-hidden="true">${emoji}</div>
    <h2>${title}</h2>
    ${lines.map((l) => `<p>${l}</p>`).join('')}
    <p class="xp-burst">+${xp} XP</p>
    <div class="row-actions center">
      <button class="btn btn-primary" data-play="${g.game}" data-deck="${g.deckKey}">${icon('reset', 16)}Play again</button>
      <button class="btn" data-action="quit">Back to games</button>
    </div>
  </section>`;
}

function playScreen(s) {
  if (g.game === 'flashcards') return flashcardsScreen(s);
  if (g.game === 'quiz') return quizScreen(s);
  if (g.game === 'match') return matchScreen(s);
  if (g.game === 'speed') return speedScreen(s);
  return '';
}

/* Flashcards -------------------------------------------------------- */

function flashcardsScreen(s) {
  if (g.done) {
    const total = g.right + g.wrong;
    return summary(s, {
      emoji: g.right === total ? '🌟' : '💪',
      title: g.right === total ? 'Perfect recall!' : 'Session complete',
      lines: [`You recalled <strong>${g.right}</strong> of ${total} cards.`, g.wrong ? `${plural(g.wrong, 'card')} will come back today — that’s spaced repetition working for you.` : 'Those cards move up a box and come back later.'],
      xp: g.xp,
    });
  }
  const c = g.queue[g.i];
  return `${playHeader(s, `<span class="small muted">${g.i + 1} / ${g.queue.length}</span>`)}
  ${progressBar((g.i / g.queue.length) * 100, { label: 'Session progress' })}
  ${g.practice && g.i === 0 ? `<p class="notice">${icon('sparkles', 16)} All caught up on due cards — this is a bonus practice round.</p>` : ''}
  <div class="flash-wrap">
    <button class="flashcard ${g.flipped ? 'is-flipped' : ''}" data-action="flip" aria-label="${g.flipped ? 'Answer shown' : 'Show answer'}" data-autofocus>
      <span class="flash-face flash-front"><span class="flash-hint">Term</span><span class="flash-text">${esc(c.front)}</span><span class="flash-tap">Tap or press Space to flip</span></span>
      <span class="flash-face flash-back"><span class="flash-hint">Meaning</span><span class="flash-text">${esc(c.back)}</span></span>
    </button>
    <div class="flash-actions" ${g.flipped ? '' : 'hidden'}>
      <button class="btn btn-lg btn-again" data-grade="0">${icon('reset', 18)}Again <kbd>1</kbd></button>
      <button class="btn btn-lg btn-got" data-grade="1">${icon('check', 18)}Got it <kbd>2</kbd></button>
    </div>
    <p class="tiny muted center">Box ${c.box || 1} of 5 · Be honest — it only helps you.</p>
  </div>`;
}

function gradeCard(correct) {
  const c = g.queue[g.i];
  correct ? g.right++ : g.wrong++;
  g.i++;
  g.flipped = false;
  if (g.i >= g.queue.length) {
    g.done = true;
    g.xp = g.right * 2 + 10;
    reviewCard(c.deckId, c.id, correct);
    finishGame({ game: 'Flashcards', deckKey: g.deckKey, xp: 10, label: 'Finished a flashcard session' });
  } else reviewCard(c.deckId, c.id, correct);
}

/* Quiz -------------------------------------------------------------- */

function quizScreen(s) {
  const total = g.questions.length;
  if (g.done) {
    const pct = Math.round((g.score / total) * 100);
    return summary(s, {
      emoji: pct === 100 ? '💎' : pct >= 70 ? '🎉' : '📚',
      title: pct === 100 ? 'Flawless!' : pct >= 70 ? 'Nice work!' : 'Good practice',
      lines: [`You scored <strong>${g.score} / ${total}</strong> (${pct}%).`, pct < 70 ? 'Try Flashcards on this deck, then come back for a rematch.' : 'Practice testing like this is one of the best ways to prep.'],
      xp: g.xp,
    });
  }
  const q = g.questions[g.i];
  return `${playHeader(s, `<span class="score-pill">${icon('star', 14)} ${g.score}</span>`)}
  ${progressBar((g.i / total) * 100, { label: 'Quiz progress' })}
  <section class="card card-pad quiz">
    <p class="small muted">Question ${g.i + 1} of ${total}</p>
    <h2 class="quiz-prompt">${esc(q.prompt)}</h2>
    <div class="quiz-options" role="group" aria-label="Answers">
      ${q.options.map((o, i) => {
        let cls = '';
        if (g.picked != null) {
          if (o === q.answer) cls = 'is-right';
          else if (i === g.picked) cls = 'is-wrong';
        }
        return `<button class="quiz-opt ${cls}" data-pick="${i}" ${g.picked != null ? 'disabled' : ''} ${i === 0 && g.picked == null ? 'data-autofocus' : ''}><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`;
      }).join('')}
    </div>
    ${g.picked != null ? `<div class="quiz-next"><p class="${q.options[g.picked] === q.answer ? 'text-success' : 'text-danger'}" role="status"><strong>${q.options[g.picked] === q.answer ? 'Correct! +3 XP' : 'Not quite.'}</strong></p><button class="btn btn-primary" data-action="next" data-autofocus>${g.i + 1 < total ? 'Next' : 'See results'} ${icon('chevronRight', 16)}</button></div>` : ''}
  </section>`;
}

function pickQuiz(i) {
  if (g.picked != null) return;
  g.picked = i;
  const q = g.questions[g.i];
  if (q.options[i] === q.answer) g.score++;
  rerender();
}
function nextQuiz() {
  g.i++;
  g.picked = null;
  if (g.i >= g.questions.length) {
    const perfect = g.score === g.questions.length;
    g.done = true;
    g.xp = g.score * 3 + 15 + (perfect ? 20 : 0);
    finishGame({ game: 'Quiz Show', deckKey: g.deckKey, xp: g.xp, perfect, label: `Quiz Show: ${g.score}/${g.questions.length}` });
  } else rerender();
}

/* Match ------------------------------------------------------------- */

function matchScreen(s) {
  const best = s.gameBests[`Match Rush:${g.deckKey}`];
  if (g.done) {
    const t = g.endAt - g.startAt;
    return summary(s, {
      emoji: g.newBest ? '🏆' : '🧩',
      title: g.newBest ? 'New best time!' : 'All matched!',
      lines: [`Time: <strong>${secs(t)}</strong> with ${plural(g.misses, 'miss', 'misses')}.`, best ? `Best on this deck: ${secs(best)}` : ''],
      xp: g.xp,
    });
  }
  return `${playHeader(s, `<span class="score-pill">${icon('clock', 14)} <span data-match-time>${secs(Date.now() - g.startAt)}</span></span>${best ? `<span class="small muted hide-sm">Best ${secs(best)}</span>` : ''}`)}
  <p class="small muted">Select a term, then its meaning.</p>
  <div class="match-grid">
    ${g.tiles.map((t) => {
      const matched = g.matched.includes(t.pair);
      const sel = g.selected === t.id;
      const wrong = g.wrong.includes(t.id);
      return `<button class="match-tile tile-${t.side} ${matched ? 'is-matched' : ''} ${sel ? 'is-selected' : ''} ${wrong ? 'is-wrong' : ''}" data-tile="${t.id}" ${matched ? 'disabled' : ''} aria-pressed="${sel}">${esc(t.text)}</button>`;
    }).join('')}
  </div>`;
}

function pickTile(id) {
  const t = g.tiles.find((x) => x.id === id);
  if (!t || g.matched.includes(t.pair)) return;
  g.wrong = [];
  if (!g.selected) {
    g.selected = id;
    return rerender();
  }
  if (g.selected === id) {
    g.selected = null;
    return rerender();
  }
  const first = g.tiles.find((x) => x.id === g.selected);
  if (first.pair === t.pair && first.side !== t.side) {
    g.matched.push(t.pair);
    g.selected = null;
    if (g.matched.length === g.tiles.length / 2) {
      stopTimers();
      g.endAt = Date.now();
      const time = g.endAt - g.startAt;
      const prev = getState().gameBests[`Match Rush:${g.deckKey}`];
      g.newBest = !prev || time < prev;
      g.done = true;
      g.xp = 20 + (time < 30000 ? 10 : 0) + (g.newBest && prev ? 10 : 0);
      return finishGame({ game: 'Match Rush', deckKey: g.deckKey, xp: g.xp, timeMs: time, label: `Match Rush in ${secs(time)}` });
    }
  } else {
    g.misses++;
    g.wrong = [first.id, t.id];
    g.selected = null;
  }
  rerender();
}

/* Speed recall ------------------------------------------------------ */

function speedScreen(s) {
  if (g.done) {
    return summary(s, {
      emoji: g.score >= 8 ? '⚡' : '🏁',
      title: `${plural(g.score, 'answer')} in 60 seconds`,
      lines: [
        `${g.score} right out of ${g.seen} seen.`,
        g.log.filter((l) => !l.ok).length ? `Review: ${g.log.filter((l) => !l.ok).slice(0, 5).map((l) => `<strong>${esc(l.answer)}</strong>`).join(', ')}` : 'No misses — incredible.',
      ],
      xp: g.xp,
    });
  }
  const c = g.cards[g.idx % g.cards.length];
  const left = Math.max(0, g.endAt - Date.now());
  return `${playHeader(s, `<span class="score-pill">${icon('star', 14)} ${g.score}</span><span class="score-pill tone-ember">${icon('clock', 14)} <span data-speed-time>${Math.ceil(left / 1000)}</span>s</span>`)}
  <div class="progress progress-ember"><span data-speed-bar style="width:${(left / 60000) * 100}%"></span></div>
  <section class="card card-pad speed">
    <p class="small muted">What’s the term for…</p>
    <h2 class="quiz-prompt">${esc(c.back)}</h2>
    <form class="speed-form" data-speed-form autocomplete="off">
      <input class="input input-lg" name="answer" aria-label="Your answer" placeholder="Type the term…" data-autofocus autocapitalize="off" spellcheck="false">
      <button class="btn btn-primary btn-lg">Enter</button>
      <button type="button" class="btn btn-lg" data-action="skip">Skip</button>
    </form>
    ${g.feedback ? `<p class="speed-feedback ${g.feedback.ok ? 'text-success' : 'text-danger'}" role="status">${g.feedback.ok ? '✓ Correct' : `✗ It was <strong>${esc(g.feedback.answer)}</strong>`}</p>` : '<p class="speed-feedback" aria-hidden="true">&nbsp;</p>'}
  </section>`;
}

function submitSpeed(value, skip = false) {
  if (g.done) return;
  const c = g.cards[g.idx % g.cards.length];
  const ok = !skip && closeEnough(value, c.front);
  if (ok) g.score++;
  g.seen++;
  g.log.push({ ok, answer: c.front });
  g.feedback = { ok, answer: c.front };
  g.idx++;
  if (g.idx % g.cards.length === 0) g.cards = shuffle(g.cards);
  rerender();
}
function endSpeed() {
  if (g.done) return;
  stopTimers();
  g.done = true;
  g.xp = g.score * 4 + 10;
  finishGame({ game: 'Speed Recall', deckKey: g.deckKey, xp: g.xp, label: `Speed Recall: ${g.score} correct` });
}

/* Events ------------------------------------------------------------ */

async function onClick(e) {
  const s = getState();
  const play = e.target.closest('[data-play]');
  if (play) return start(play.dataset.play, play.dataset.deck);
  const tech = e.target.closest('[data-tech]');
  if (tech) return TECHNIQUES.find((t) => t.id === tech.dataset.tech)?.go(start);
  const tile = e.target.closest('[data-tile]');
  if (tile) return pickTile(tile.dataset.tile);
  const pick = e.target.closest('[data-pick]');
  if (pick) return pickQuiz(+pick.dataset.pick);
  const grade = e.target.closest('[data-grade]');
  if (grade) return gradeCard(grade.dataset.grade === '1');

  const a = e.target.closest('[data-action]')?.dataset.action;
  const id = e.target.closest('[data-action]')?.dataset.id;
  if (a === 'flip') {
    g.flipped = !g.flipped;
    return rerender();
  }
  if (a === 'next') return nextQuiz();
  if (a === 'skip') return submitSpeed('', true);
  if (a === 'quit') {
    if (!g.done && g.game !== 'flashcards' && !(await confirmDialog('Quit this game? Progress in this round won’t be saved.', { title: 'Quit game?', confirmLabel: 'Quit' }))) return;
    return toHub();
  }
  if (a === 'new-deck') return openDeckForm();
  if (a === 'edit-deck') return openDeckForm(s.decks.find((d) => d.id === id));
  if (a === 'delete-deck') {
    const d = s.decks.find((x) => x.id === id);
    if (await confirmDialog(`Delete the deck “${esc(d.name)}” and its ${d.cards.length} cards?`)) update((st) => (st.decks = st.decks.filter((x) => x.id !== id)));
  }
}

function onKey(e) {
  if (g.screen !== 'play' || g.done || e.target.closest('input, textarea, select, dialog')) return;
  if (g.game === 'flashcards') {
    if ((e.key === ' ' || e.key === 'Enter') && e.target.closest('button')) return; // native button click handles it
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      g.flipped = !g.flipped;
      rerender();
    } else if (g.flipped && (e.key === '1' || e.key === '2')) gradeCard(e.key === '2');
  }
  if (g.game === 'quiz') {
    const n = +e.key;
    if (g.picked == null && n >= 1 && n <= 4) pickQuiz(n - 1);
    else if (g.picked != null && e.key === 'Enter' && !e.target.closest('button')) nextQuiz();
  }
}

/* Deck editor ------------------------------------------------------- */

function openDeckForm(existing = null) {
  const s = getState();
  const d = existing || { name: '', subjectId: '', cards: [] };
  modal({
    title: existing ? `Edit “${esc(d.name)}”` : 'New flashcard deck',
    size: 'lg',
    body: `<form class="modal-form"><div class="modal-body stack">
      <div class="field-row">
        <label class="field"><span class="label">Deck name</span><input class="input" name="deckName" required maxlength="60" value="${esc(d.name)}" placeholder="e.g. Unit 3 vocab"></label>
        <label class="field"><span class="label">Class</span><select class="input" name="subjectId">${subjectOptions(s, d.subjectId, { none: 'General' })}</select></label>
      </div>
      <label class="field"><span class="label">Cards — one per line: <code>term :: meaning</code></span>
        <textarea class="input textarea-code" name="cards" rows="12" placeholder="Photosynthesis :: How plants turn light into chemical energy&#10;Mitochondria :: Makes ATP for the cell">${esc(d.cards.map((c) => `${c.front} :: ${c.back}`).join('\n'))}</textarea>
        <span class="hint small muted">Tip: you can also paste from a spreadsheet — tab-separated or “term - meaning” lines work too. <span data-count></span></span>
      </label>
      <p class="form-error" hidden></p>
    </div>
    <footer class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">${existing ? 'Save deck' : 'Create deck'}</button></footer></form>`,
    onMount(el, close) {
      const ta = el.querySelector('[name=cards]');
      const count = () => (el.querySelector('[data-count]').textContent = `· ${plural(parseCards(ta.value).length, 'card')} detected`);
      ta.addEventListener('input', count);
      count();
      el.querySelector('[name=deckName]').focus();
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target.elements;
        const name = f.deckName.value.trim();
        const parsed = parseCards(ta.value);
        const err = el.querySelector('.form-error');
        if (!name) return Object.assign(err, { hidden: false, textContent: 'Give the deck a name.' });
        if (!parsed.length) return Object.assign(err, { hidden: false, textContent: 'Add at least one card using “term :: meaning”.' });
        // Keep review progress for cards that didn't change.
        const prev = new Map((existing?.cards || []).map((c) => [c.front.toLowerCase(), c]));
        const cards = parsed.map(([front, back]) => {
          const old = prev.get(front.toLowerCase());
          return old ? { ...old, front, back } : { id: uid(), front, back, box: 1, due: todayISO() };
        });
        update((st) => {
          if (existing) Object.assign(st.decks.find((x) => x.id === existing.id), { name, subjectId: f.subjectId.value, cards });
          else {
            const id = uid();
            st.decks.push({ id, name, subjectId: f.subjectId.value, cards });
            pickedDeck = id;
          }
        });
        toast(`${esc(name)}: ${plural(cards.length, 'card')} ready`, { kind: 'success', emoji: '🃏' });
        close();
      });
    },
  });
}

function parseCards(text) {
  return text.split('\n').map((line) => {
    const l = line.trim();
    if (!l) return null;
    const sep = l.includes('::') ? '::' : l.includes('\t') ? '\t' : l.includes(' - ') ? ' - ' : l.includes(' — ') ? ' — ' : l.includes(':') ? ':' : null;
    if (!sep) return null;
    const i = l.indexOf(sep);
    const front = l.slice(0, i).trim();
    const back = l.slice(i + sep.length).trim();
    return front && back ? [front, back] : null;
  }).filter(Boolean);
}
