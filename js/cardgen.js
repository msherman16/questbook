// Turns plain note text into flashcard suggestions using patterns students
// actually write: "term: meaning", "term - meaning", question/answer pairs,
// "X is Y" sentences, dated events, and headings followed by bullet points.
// It never invents content: every card is lifted from the text, and the
// student reviews the list before anything is saved.
//
// To swap in an AI generator later, replace findCards() with a function that
// returns the same shape: [{ front, back, kind }].

const SEPARATORS = ['::', '\t', ' = ', ' → ', ' -> ', ' => ', ' – ', ' — ', ' - ', ': '];
const LABELS = new Set(['note', 'notes', 'example', 'examples', 'eg', 'ex', 'remember', 'tip', 'hint', 'summary', 'cues', 'cue', 'questions', 'topic', 'concept', 'chapter', 'unit', 'date', 'name', 'http', 'https', 'page', 'source', 'homework', 'due', 'todo', 'title', 'class', 'period', 'teacher']);
const PRONOUNS = new Set(['it', 'this', 'that', 'these', 'those', 'they', 'he', 'she', 'we', 'you', 'i', 'there', 'here', 'which', 'who', 'what', 'one', 'each', 'some', 'many', 'most', 'all', 'both', 'another', 'other', 'also', 'so', 'then', 'but', 'and', 'because', 'if', 'when', 'today', 'tomorrow']);
const BULLET = /^\s*(?:[-•*▪◦●·‣>]+|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s+/;

const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const stripEnd = (s) => s.replace(/[\s.;,:]+$/, '').trim();
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const unArticle = (s) => s.replace(/^(?:the|a|an)\s+/i, '');

function bySeparator(line) {
  for (const sep of SEPARATORS) {
    const i = line.indexOf(sep);
    if (i <= 0) continue;
    const front = stripEnd(line.slice(0, i));
    const back = line.slice(i + sep.length).trim();
    const n = words(front).length;
    if (!front || back.length < 2 || n > 7 || front.length > 70) continue;
    if (LABELS.has(front.toLowerCase().replace(/[^a-z]/g, ''))) continue;
    if (sep === ': ' && /^\d{1,2}$/.test(front)) continue; // "10: 30" style times
    if (/^(?:unit|chapter|lesson|week|section|period|part)\s*\d/i.test(back) || /\bnotes$/i.test(back)) continue; // page titles
    return { front, back: stripEnd(back) || back, kind: 'pair' };
  }
  return null;
}

function byYear(line) {
  const m = line.match(/^(?:in|by|around|circa|c\.)?\s*(\d{4})\s*[,:–—-]\s*(.{6,})$/i);
  return m ? { front: m[1], back: cap(stripEnd(m[2])), kind: 'date' } : null;
}

function bySentence(sentence) {
  const s = stripEnd(sentence);
  if (s.length < 14 || s.length > 260 || s.endsWith('?')) return null;

  // "In 1215, the Magna Carta was signed" → 1215 :: The Magna Carta was signed
  const y = s.match(/^(?:in|by)\s+(\d{4}),?\s+(.{8,})$/i);
  if (y) return { front: y[1], back: cap(y[2]), kind: 'date' };

  // "The process of … is called photosynthesis" → photosynthesis :: The process of …
  let m = s.match(/^(.{10,}?)\s+(?:is|are|was|were)\s+(?:called|known as|termed|named)\s+(?:the\s+|an?\s+)?(.{2,50})$/i);
  if (m && words(m[2]).length <= 5) return { front: cap(m[2]), back: cap(m[1]), kind: 'sentence' };

  // "Mitochondria are the powerhouse of the cell" → Mitochondria :: The powerhouse of the cell
  m = s.match(/^(.{2,60}?)\s+(is defined as|refers to|means|is|are|was|were|consists of|describes|measures|causes)\s+(.{8,})$/i);
  if (!m) return null;
  const subject = unArticle(m[1]);
  const w = words(subject);
  if (!w.length || w.length > 5 || PRONOUNS.has(w[0].toLowerCase()) || /[,;()]/.test(subject)) return null;
  if (/^(?:not|also|often|usually|very|going|able|important|why|how)\b/i.test(m[3])) return null;
  const verb = m[2].toLowerCase();
  const rest = ['is', 'are', 'was', 'were', 'means', 'refers to', 'is defined as'].includes(verb) ? m[3] : `${verb} ${m[3]}`;
  return { front: cap(subject), back: cap(unArticle(rest).length > 3 ? rest : m[3]), kind: 'sentence' };
}

export function findCards(text) {
  const raw = text.replace(/\r/g, '').split('\n');
  const lines = raw.map((r) => ({ raw: r, bullet: BULLET.test(r) || /^\s{2,}\S/.test(r), text: r.replace(BULLET, '').replace(/[ ]{2,}/g, ' ').trim() }));
  const cards = [];
  const used = new Set();
  const add = (card, ...idx) => {
    if (!card) return false;
    cards.push({ ...card, line: idx[0] });
    idx.forEach((i) => used.add(i));
    return true;
  };
  const nextLine = (i) => {
    for (let j = i + 1; j < lines.length && j <= i + 2; j++) if (lines[j].text) return j;
    return -1;
  };

  // Pass 1: question / answer pairs (two lines each).
  lines.forEach((l, i) => {
    if (used.has(i) || !l.text) return;
    const q = l.text.match(/^(?:q(?:uestion)?\s*\d*\s*[:.)-]\s*)(.+)/i);
    const j = nextLine(i);
    if (j < 0 || used.has(j)) return;
    const a = lines[j].text.match(/^(?:a(?:nswer|ns)?\s*[:.)-]\s*)(.+)/i);
    if (q && a) return add({ front: q[1].trim(), back: stripEnd(a[1]), kind: 'qa' }, i, j);
    if (l.text.endsWith('?') && l.text.length > 8 && !lines[j].text.endsWith('?')) {
      add({ front: l.text, back: stripEnd((a ? a[1] : lines[j].text)), kind: 'qa' }, i, j);
    }
  });

  // Pass 2: single-line patterns.
  lines.forEach((l, i) => {
    if (used.has(i) || !l.text) return;
    if (add(byYear(l.text), i)) return;
    if (add(bySeparator(l.text), i)) return;
    let found = false;
    for (const sentence of l.text.split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/)) found = add(bySentence(sentence), i) || found;
  });

  // Pass 3: a short heading followed by bullet points that produced no cards of their own.
  lines.forEach((l, i) => {
    if (used.has(i) || !l.text || l.bullet) return;
    const heading = stripEnd(l.text);
    if (heading.length > 50 || words(heading).length > 6 || /[.!?]$/.test(l.text) || LABELS.has(heading.toLowerCase())) return;
    const points = [];
    const idx = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].text) { if (points.length) break; continue; }
      if (!lines[j].bullet || used.has(j)) break;
      points.push(stripEnd(lines[j].text));
      idx.push(j);
    }
    if (points.length >= 1 && points.length <= 6) add({ front: heading, back: points.join('; '), kind: 'list' }, i, ...idx);
  });

  // Tidy: drop duplicates and junk, keep things a sensible length.
  const seen = new Set();
  return cards
    .sort((a, b) => a.line - b.line) // keep the order they appear in the notes
    .map(({ line, ...c }) => ({ ...c, front: c.front.trim(), back: c.back.trim().slice(0, 260) }))
    .filter((c) => {
      const key = c.front.toLowerCase();
      if (!c.front || !c.back || c.front.toLowerCase() === c.back.toLowerCase() || seen.has(key)) return false;
      if (!/[A-Za-z0-9]/.test(c.front) || !/[A-Za-z0-9]{2}/.test(c.back)) return false;
      seen.add(key);
      return true;
    });
}
