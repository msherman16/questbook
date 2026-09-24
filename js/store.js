// Single source of truth. All structured data lives in localStorage;
// uploaded files live in IndexedDB (see files.js).
import { uid, todayISO, addDays, daysBetween } from './util.js';

const KEY = 'questbook:v1';

let state;
let pending = [];
const listeners = new Set();
const eventListeners = new Set();

/* ------------------------------------------------------------------ */
/* Catalogs                                                            */
/* ------------------------------------------------------------------ */

export const SUBJECT_COLORS = ['ember', 'sun', 'moss', 'sea', 'sky', 'iris', 'plum', 'slate'];
export const SUBJECT_ICONS = ['📐', '🔢', '🧪', '🧬', '🔭', '🌍', '🏛️', '📚', '✍️', '🗣️', '💻', '🎨', '🎵', '🎭', '⚽', '🧮'];
// Avatars are creatures and objects, never gendered people.
export const AVATARS = ['🦉', '🐙', '🦊', '🐢', '🦔', '🐝', '🐉', '🤖', '🪐', '🌵', '🌊', '⚡'];

export const TYPES = {
  homework: { label: 'Homework', xp: 20 },
  quiz: { label: 'Quiz', xp: 30 },
  test: { label: 'Test', xp: 50 },
  project: { label: 'Project', xp: 60 },
  study: { label: 'Study block', xp: 15 },
  keydate: { label: 'Key date', xp: 10 },
};

export const LEVEL_TITLES = ['Spark', 'Explorer', 'Pathfinder', 'Tinkerer', 'Scholar', 'Strategist', 'Trailblazer', 'Luminary', 'Polymath', 'Legend'];

// XP needed to *reach* a level: L1=0, L2=100, L3=300, L4=600, L5=1000 …
export const xpToReach = (level) => 50 * (level - 1) * level;

export function levelInfo(xp) {
  let level = 1;
  while (xp >= xpToReach(level + 1)) level++;
  const floor = xpToReach(level);
  const next = xpToReach(level + 1);
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    into: xp - floor,
    need: next - floor,
    pct: Math.round(((xp - floor) / (next - floor)) * 100),
  };
}

export const BADGES = [
  { id: 'first-quest', emoji: '🎯', name: 'First Quest', desc: 'Complete your first assignment', test: (s) => s.assignments.some((a) => a.done) },
  { id: 'early-bird', emoji: '🐦', name: 'Early Bird', desc: 'Finish something 2+ days before it’s due', test: (s) => s.assignments.some((a) => a.done && a.early) },
  { id: 'planner', emoji: '🗺️', name: 'Planner', desc: 'Create a test prep plan', test: (s) => s.assignments.some((a) => a.prepFor) },
  { id: 'deep-focus', emoji: '🧘', name: 'Deep Focus', desc: 'Log 5 study sessions', test: (s) => s.sessions.length >= 5 },
  { id: 'marathon', emoji: '🏃', name: 'Marathon', desc: 'Study 2 hours in a single day', test: (s) => maxDayMinutes(s) >= 120 },
  { id: 'streak-3', emoji: '🔥', name: 'On a Roll', desc: 'Keep a 3-day streak', test: (s) => streak(s) >= 3 },
  { id: 'streak-7', emoji: '☄️', name: 'Unstoppable', desc: 'Keep a 7-day streak', test: (s) => streak(s) >= 7 },
  { id: 'librarian', emoji: '📚', name: 'Librarian', desc: 'Keep 5 notes in your library', test: (s) => s.notes.length >= 5 },
  { id: 'card-shark', emoji: '🃏', name: 'Card Shark', desc: 'Recall 50 flashcards correctly', test: (s) => s.stats.cardsCorrect >= 50 },
  { id: 'game-on', emoji: '🎮', name: 'Game On', desc: 'Play 5 study games', test: (s) => s.stats.gamesPlayed >= 5 },
  { id: 'flawless', emoji: '💎', name: 'Flawless', desc: 'Score 100% in Quiz Show', test: (s) => s.stats.perfectQuizzes >= 1 },
  { id: 'level-5', emoji: '🎓', name: 'Scholar', desc: 'Reach level 5', test: (s) => levelInfo(s.xp).level >= 5 },
];

export const QUESTS = [
  { id: 'focus', emoji: '⏱️', label: 'Focus for 25 minutes', target: 25, xp: 30, progress: (s, d) => minutesOn(s, d) },
  { id: 'cards', emoji: '🃏', label: 'Review 10 flashcards', target: 10, xp: 20, progress: (s, d) => s.daily[d]?.cards || 0 },
  { id: 'task', emoji: '✅', label: 'Finish 1 assignment', target: 1, xp: 25, progress: (s, d) => s.assignments.filter((a) => a.doneAt === d).length },
];

/* ------------------------------------------------------------------ */
/* Derived values                                                      */
/* ------------------------------------------------------------------ */

export const minutesOn = (s, iso) => s.sessions.filter((x) => x.date === iso).reduce((t, x) => t + x.minutes, 0);

function maxDayMinutes(s) {
  const byDay = {};
  s.sessions.forEach((x) => (byDay[x.date] = (byDay[x.date] || 0) + x.minutes));
  return Math.max(0, ...Object.values(byDay));
}

export function streak(s) {
  let d = todayISO();
  if (!s.activeDays[d]) d = addDays(d, -1); // today isn't over yet
  let n = 0;
  while (s.activeDays[d]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export const subjectById = (s, id) => s.subjects.find((x) => x.id === id);

/* ------------------------------------------------------------------ */
/* Store plumbing                                                      */
/* ------------------------------------------------------------------ */

export const getState = () => state;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const onEvent = (fn) => eventListeners.add(fn);
const emit = (e) => pending.push(e);

export function update(mutator) {
  mutator(state);
  checkBadges(state);
  persist();
  listeners.forEach((fn) => fn(state));
  const events = pending;
  pending = [];
  events.forEach((e) => eventListeners.forEach((fn) => fn(e)));
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn(err);
    emit({ type: 'error', message: 'Couldn’t save. Browser storage may be full or blocked.' });
  }
}

export function init() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  try {
    state = raw ? migrate(JSON.parse(raw)) : blank(); // new visitors start empty and see the setup wizard
  } catch {
    state = blank();
  }
  persist();
}

export function replaceState(next) {
  state = migrate(next);
  update(() => {});
}

function migrate(s) {
  const b = blank();
  // Data saved before onboarding existed belongs to someone already set up.
  if (s.settings && !('onboarded' in s.settings)) s.settings.onboarded = true;
  return {
    ...b,
    ...s,
    profile: { ...b.profile, ...s.profile },
    stats: { ...b.stats, ...s.stats },
    timer: { ...b.timer, ...s.timer },
    settings: { ...b.settings, ...s.settings },
  };
}

export function blank() {
  return {
    version: 1,
    profile: { name: '', avatar: '🦉', pronouns: '' },
    xp: 0,
    subjects: [],
    assignments: [],
    sessions: [],
    notes: [],
    decks: [],
    xpLog: [],
    activeDays: {},
    badges: {},
    questClaims: {},
    daily: {},
    gameBests: {},
    stats: { cardsReviewed: 0, cardsCorrect: 0, gamesPlayed: 0, perfectQuizzes: 0, uploads: 0 },
    timer: { mode: 'focus', running: false, endAt: null, remainingMs: null, plannedMin: null, subjectId: '', technique: 'Pomodoro' },
    settings: { theme: 'system', textSize: 'normal', reduceMotion: false, focusMin: 25, breakMin: 5, sound: true, onboarded: false, checklistDismissed: false },
    isDemo: false,
    gettingStartedClaimed: false,
  };
}

/* ------------------------------------------------------------------ */
/* Gamification core                                                   */
/* ------------------------------------------------------------------ */

export function award(s, amount, reason, { date } = {}) {
  const before = levelInfo(s.xp).level;
  s.xp = Math.max(0, s.xp + amount);
  const top = s.xpLog[0];
  // Merge rapid repeats (e.g. 20 flashcards) into one history line.
  if (top && top.reason === reason && Date.now() - top.at < 15 * 60 * 1000 && Math.sign(top.amount) === Math.sign(amount)) {
    top.amount += amount;
    top.at = Date.now();
  } else {
    s.xpLog.unshift({ id: uid(), amount, reason, at: Date.now() });
    if (s.xpLog.length > 300) s.xpLog.length = 300;
  }
  if (amount > 0) s.activeDays[date || todayISO()] = true;
  emit({ type: 'xp', amount, reason });
  const after = levelInfo(s.xp).level;
  if (after > before) emit({ type: 'level', level: after, title: levelInfo(s.xp).title });
}

function checkBadges(s, silent = false) {
  for (const b of BADGES) {
    if (!s.badges[b.id] && b.test(s)) {
      s.badges[b.id] = Date.now();
      if (!silent) emit({ type: 'badge', badge: b });
    }
  }
}

function bumpDaily(s, key, n = 1) {
  const d = todayISO();
  s.daily[d] = s.daily[d] || {};
  s.daily[d][key] = (s.daily[d][key] || 0) + n;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function toggleAssignment(id) {
  update((s) => {
    const a = s.assignments.find((x) => x.id === id);
    if (!a) return;
    if (!a.done) {
      const early = daysBetween(todayISO(), a.due) >= 2;
      const xp = (TYPES[a.type]?.xp || 10) + (early ? 10 : 0);
      Object.assign(a, { done: true, doneAt: todayISO(), early, xpAwarded: xp });
      award(s, xp, `Completed “${a.title}”${early ? ' early' : ''}`);
    } else {
      if (a.xpAwarded) award(s, -a.xpAwarded, `Reopened “${a.title}”`);
      Object.assign(a, { done: false, doneAt: null, early: false, xpAwarded: 0 });
    }
  });
}

export function logSession({ subjectId, minutes, date = todayISO(), technique = '' }) {
  minutes = Math.round(minutes);
  if (minutes < 1) return;
  update((s) => {
    s.sessions.unshift({ id: uid(), subjectId, minutes, date, technique, at: Date.now() });
    const sub = subjectById(s, subjectId);
    award(s, minutes * 2, `Studied ${sub ? sub.name : 'something'} for ${minutes} min`, { date });
  });
}

const INTERVALS = [0, 1, 2, 4, 7, 14]; // Leitner box → days until next review

export function reviewCard(deckId, cardId, correct) {
  update((s) => {
    const card = s.decks.find((d) => d.id === deckId)?.cards.find((c) => c.id === cardId);
    if (!card) return;
    card.box = correct ? Math.min(5, (card.box || 1) + 1) : 1;
    card.due = addDays(todayISO(), correct ? INTERVALS[card.box] : 0);
    s.stats.cardsReviewed++;
    bumpDaily(s, 'cards');
    if (correct) {
      s.stats.cardsCorrect++;
      award(s, 2, 'Flashcard recall');
    } else {
      s.activeDays[todayISO()] = true;
    }
  });
}

export function finishGame({ game, deckKey, xp, perfect = false, timeMs = null, label }) {
  update((s) => {
    s.stats.gamesPlayed++;
    if (perfect) s.stats.perfectQuizzes++;
    if (timeMs != null) {
      const key = `${game}:${deckKey}`;
      if (!s.gameBests[key] || timeMs < s.gameBests[key]) s.gameBests[key] = timeMs;
    }
    bumpDaily(s, 'games');
    award(s, xp, label || `Played ${game}`);
  });
}

export function claimQuest(id) {
  update((s) => {
    const q = QUESTS.find((x) => x.id === id);
    const key = `${todayISO()}:${id}`;
    if (!q || s.questClaims[key] || q.progress(s, todayISO()) < q.target) return;
    s.questClaims[key] = true;
    award(s, q.xp, `Daily quest: ${q.label}`);
  });
}

export function rewardUpload(s, count) {
  // Up to 5 rewarded uploads per day so the library can't be farmed for XP.
  const d = todayISO();
  const done = s.daily[d]?.uploads || 0;
  const rewardable = Math.max(0, Math.min(count, 5 - done));
  bumpDaily(s, 'uploads', count);
  s.stats.uploads += count;
  if (rewardable) award(s, rewardable * 10, `Added ${rewardable === 1 ? 'a note' : rewardable + ' notes'} to the library`);
}

/* Timer ------------------------------------------------------------- */

export const timerDurationMs = (s) => (s.timer.mode === 'focus' ? s.settings.focusMin : s.settings.breakMin) * 60000;
export const timerRemaining = (s) =>
  s.timer.running ? Math.max(0, s.timer.endAt - Date.now()) : s.timer.remainingMs ?? timerDurationMs(s);

export function timerStart() {
  update((s) => {
    const t = s.timer;
    if (t.running) return;
    if (t.remainingMs == null) t.plannedMin = t.mode === 'focus' ? s.settings.focusMin : s.settings.breakMin;
    const ms = t.remainingMs ?? timerDurationMs(s);
    Object.assign(t, { running: true, endAt: Date.now() + ms, remainingMs: ms });
  });
}
export function timerPause() {
  update((s) => {
    const t = s.timer;
    if (!t.running) return;
    Object.assign(t, { running: false, remainingMs: Math.max(0, t.endAt - Date.now()), endAt: null });
  });
}
export function timerReset(mode) {
  update((s) => {
    Object.assign(s.timer, { running: false, endAt: null, remainingMs: null, plannedMin: null });
    if (mode) s.timer.mode = mode;
  });
}
export function timerAddMinutes(n) {
  update((s) => {
    const t = s.timer;
    if (t.running) t.endAt += n * 60000;
    else t.remainingMs = (t.remainingMs ?? timerDurationMs(s)) + n * 60000;
    t.plannedMin = (t.plannedMin ?? (t.mode === 'focus' ? s.settings.focusMin : s.settings.breakMin)) + n;
  });
}
// Stop a focus block early and still log the minutes spent.
export function timerFinishEarly() {
  const s = state;
  const t = s.timer;
  if (t.mode !== 'focus' || t.plannedMin == null) return;
  const elapsed = Math.floor((t.plannedMin * 60000 - timerRemaining(s)) / 60000);
  const subjectId = t.subjectId;
  const technique = t.technique;
  timerReset('break');
  if (elapsed >= 1) logSession({ subjectId, minutes: elapsed, technique });
}
export function timerTick() {
  const s = state;
  const t = s.timer;
  if (!t.running || Date.now() < t.endAt) return;
  const wasFocus = t.mode === 'focus';
  const minutes = t.plannedMin || s.settings.focusMin;
  const { subjectId, technique } = t;
  update((st) => {
    Object.assign(st.timer, { running: false, endAt: null, remainingMs: null, plannedMin: null, mode: wasFocus ? 'break' : 'focus' });
    emit({ type: 'timer-done', wasFocus });
  });
  if (wasFocus) logSession({ subjectId, minutes, technique });
}

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

const cards = (pairs) => pairs.map(([front, back]) => ({ id: uid(), front, back, box: 1, due: todayISO() }));

export function demoState() {
  const s = blank();
  const t = todayISO();
  const d = (n) => addDays(t, n);
  s.profile = { name: 'Rowan', avatar: '🦉', pronouns: '' };
  s.isDemo = true;
  s.settings.onboarded = true;
  s.settings.checklistDismissed = true;

  const sub = (name, icon, color, teacher, room, meetings) => ({ id: uid(), name, icon, color, teacher, room, meetings });
  const mwf = (start, end) => [1, 3, 5].map((day) => ({ day, start, end }));
  const tth = (start, end) => [2, 4].map((day) => ({ day, start, end }));
  const daily = (start, end) => [1, 2, 3, 4, 5].map((day) => ({ day, start, end }));

  const algebra = sub('Algebra II', '📐', 'sky', 'Dr. Okafor', 'B-204', daily('08:00', '08:50'));
  const bio = sub('Biology', '🧬', 'moss', 'T. Nguyen', 'Lab 3', mwf('09:00', '10:15'));
  const history = sub('World History', '🏛️', 'ember', 'R. Castillo', 'C-110', tth('09:00', '10:15'));
  const english = sub('English Lit', '✍️', 'iris', 'J. Patel', 'A-018', daily('10:30', '11:20'));
  const spanish = sub('Spanish II', '🗣️', 'sun', 'A. Lindqvist', 'A-201', mwf('12:30', '13:20'));
  const cs = sub('Computer Science', '💻', 'sea', 'K. Mensah', 'Tech Lab', tth('13:00', '14:15'));
  s.subjects = [algebra, bio, history, english, spanish, cs];

  const task = (title, subject, type, due, extra = {}) => ({
    id: uid(), title, subjectId: subject.id, type, due, notes: '', done: false, doneAt: null, early: false, xpAwarded: 0, prepFor: null, ...extra,
  });
  s.assignments = [
    task('Problem set 3.4 — quadratics', algebra, 'homework', d(1)),
    task('Cell structure quiz', bio, 'quiz', d(3)),
    task('Read Ch. 7: The Great Gatsby', english, 'homework', d(2)),
    task('Unit 2 test: Revolutions', history, 'test', d(6)),
    task('Vocab list 5 flashcards', spanish, 'homework', d(0)),
    task('Portfolio website project', cs, 'project', d(12)),
    task('Lab report: osmosis', bio, 'homework', d(-1)),
    task('Midterm exams begin', algebra, 'keydate', d(19), { notes: 'Midterm week — all classes.' }),
    task('Science fair proposals due', bio, 'keydate', d(9)),
    task('Essay outline: symbolism', english, 'homework', d(-3), { done: true, doneAt: d(-4), early: false, xpAwarded: 20 }),
    task('Loops worksheet', cs, 'homework', d(-2), { done: true, doneAt: d(-4), early: true, xpAwarded: 30 }),
  ];

  s.sessions = [
    { id: uid(), subjectId: algebra.id, minutes: 25, date: d(-1), technique: 'Pomodoro', at: Date.now() - 86400000 },
    { id: uid(), subjectId: bio.id, minutes: 40, date: d(-1), technique: 'Active recall', at: Date.now() - 86400000 },
    { id: uid(), subjectId: history.id, minutes: 30, date: d(-2), technique: 'Blurting', at: Date.now() - 2 * 86400000 },
    { id: uid(), subjectId: spanish.id, minutes: 20, date: d(-3), technique: 'Spaced repetition', at: Date.now() - 3 * 86400000 },
    { id: uid(), subjectId: english.id, minutes: 45, date: d(-4), technique: 'Pomodoro', at: Date.now() - 4 * 86400000 },
    { id: uid(), subjectId: cs.id, minutes: 50, date: d(-6), technique: 'Pomodoro', at: Date.now() - 6 * 86400000 },
  ];
  [-1, -2, -3, -4, -6, -8, -9, -10, -13].forEach((n) => (s.activeDays[d(n)] = true));

  s.decks = [
    { id: uid(), name: 'Cell structures', subjectId: bio.id, cards: cards([
      ['Mitochondria', 'Produces ATP through cellular respiration'],
      ['Ribosome', 'Builds proteins from amino acids'],
      ['Nucleus', 'Stores DNA and controls cell activity'],
      ['Cell membrane', 'Controls what enters and leaves the cell'],
      ['Chloroplast', 'Site of photosynthesis in plant cells'],
      ['Golgi apparatus', 'Packages and ships proteins'],
      ['Lysosome', 'Breaks down waste using enzymes'],
      ['Endoplasmic reticulum', 'Folds proteins and makes lipids'],
    ]) },
    { id: uid(), name: 'Common verbs', subjectId: spanish.id, cards: cards([
      ['hablar', 'to speak'], ['comer', 'to eat'], ['vivir', 'to live'], ['tener', 'to have'],
      ['ir', 'to go'], ['hacer', 'to do / to make'], ['poder', 'to be able to'], ['querer', 'to want'],
    ]) },
    { id: uid(), name: 'Key dates', subjectId: history.id, cards: cards([
      ['1215', 'Magna Carta is signed'], ['1453', 'Fall of Constantinople'], ['1776', 'US Declaration of Independence'],
      ['1789', 'French Revolution begins'], ['1848', 'Revolutions sweep Europe'], ['1914', 'World War I begins'], ['1989', 'Fall of the Berlin Wall'],
    ]) },
    { id: uid(), name: 'Formulas', subjectId: algebra.id, cards: cards([
      ['Quadratic formula', 'x = (−b ± √(b² − 4ac)) / 2a'], ['Slope', '(y₂ − y₁) / (x₂ − x₁)'], ['Slope-intercept form', 'y = mx + b'],
      ['Difference of squares', 'a² − b² = (a + b)(a − b)'], ['Vertex x-coordinate', 'x = −b / 2a'], ['Point-slope form', 'y − y₁ = m(x − x₁)'],
    ]) },
  ];

  s.notes = [
    { id: uid(), kind: 'text', title: 'Cell organelles — Cornell notes', subjectId: bio.id, tags: ['cells', 'unit 2'], createdAt: Date.now() - 3 * 86400000,
      text: 'CUES\n• What makes energy?\n• Where are proteins built?\n\nNOTES\nMitochondria convert glucose into ATP. Ribosomes (free or on rough ER) assemble proteins.\n\nSUMMARY\nOrganelles divide the work of the cell like departments in a company.' },
    { id: uid(), kind: 'text', title: 'Causes of the French Revolution', subjectId: history.id, tags: ['revolutions'], createdAt: Date.now() - 2 * 86400000,
      text: '1. Debt from foreign wars\n2. Unequal taxation across the three estates\n3. Enlightenment ideas about rights\n4. Bread shortages and rising prices' },
  ];

  s.xp = 420;
  s.xpLog = [
    { id: uid(), amount: 80, reason: 'Studied Biology for 40 min', at: Date.now() - 86400000 },
    { id: uid(), amount: 50, reason: 'Studied Algebra II for 25 min', at: Date.now() - 86400000 - 3600000 },
    { id: uid(), amount: 30, reason: 'Completed “Loops worksheet” early', at: Date.now() - 4 * 86400000 },
    { id: uid(), amount: 20, reason: 'Completed “Essay outline: symbolism”', at: Date.now() - 4 * 86400000 },
  ];
  s.stats = { ...s.stats, cardsReviewed: 34, cardsCorrect: 27, gamesPlayed: 3 };
  checkBadges(s, true);
  return s;
}

/* ------------------------------------------------------------------ */
/* Onboarding                                                          */
/* ------------------------------------------------------------------ */

export const GETTING_STARTED = [
  { id: 'class', emoji: '🎒', label: 'Add your classes', href: '#/classes', done: (s) => s.subjects.length > 0 },
  { id: 'task', emoji: '📝', label: 'Add an assignment or key date', href: '#/assignments', done: (s) => s.assignments.length > 0 },
  { id: 'focus', emoji: '⏱️', label: 'Finish a focus session', href: '#/timer', done: (s) => s.sessions.length > 0 },
  { id: 'deck', emoji: '🃏', label: 'Make a flashcard deck', href: '#/games', done: (s) => s.decks.length > 0 },
  { id: 'note', emoji: '📎', label: 'Add a note to your library', href: '#/notes', done: (s) => s.notes.length > 0 },
  { id: 'check', emoji: '✅', label: 'Check off your first task', href: '#/assignments', done: (s) => s.assignments.some((a) => a.done) },
];

export function claimGettingStarted() {
  update((s) => {
    if (s.gettingStartedClaimed || !GETTING_STARTED.every((g) => g.done(s))) return;
    s.gettingStartedClaimed = true;
    s.settings.checklistDismissed = true;
    award(s, 50, 'Finished getting started');
  });
}

// Wipe everything and send the person back through the setup wizard.
export function startFresh() {
  replaceState(blank());
}
