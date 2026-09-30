// Pulls plain text out of a note so it can be turned into flashcards.
// Everything runs in the browser: photos are read with Tesseract (OCR),
// PDFs with pdf.js, Word/PowerPoint with JSZip. Libraries load on first use.
import { getFile, putFile } from './files.js';

const CDN = 'https://cdn.jsdelivr.net/npm';
const TESSERACT = `${CDN}/tesseract.js@5/dist/tesseract.min.js`;
const PDFJS = `${CDN}/pdfjs-dist@4.10.38/build`;
const JSZIP = `${CDN}/jszip@3.10.1/dist/jszip.min.js`;
const MAX_OCR_PAGES = 12;

const scripts = new Map();
function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => {
        scripts.delete(src);
        reject(new Error('offline'));
      };
      document.head.appendChild(s);
    }));
  }
  return scripts.get(src);
}

/* OCR --------------------------------------------------------------- */

let worker = null;
let report = () => {};

async function ocrWorker() {
  await loadScript(TESSERACT);
  worker ??= window.Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') report({ label: 'Reading the text…', pct: m.progress });
      else report({ label: 'Getting the text reader ready (first time only)…', pct: null });
    },
  }).catch((err) => {
    worker = null;
    throw err;
  });
  return worker;
}

// Phone photos are huge; shrinking them makes OCR several times faster with no loss in accuracy.
async function toCanvas(blob, max = 2200) {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

async function ocr(canvas) {
  const w = await ocrWorker();
  const { data } = await w.recognize(canvas);
  return { text: data.text || '', confidence: Math.round(data.confidence || 0) };
}

/* PDF --------------------------------------------------------------- */

async function readPdf(blob) {
  report({ label: 'Opening the PDF…', pct: null });
  const pdfjs = await import(`${PDFJS}/pdf.min.mjs`).catch(() => { throw new Error('offline'); });
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    report({ label: `Reading page ${i} of ${doc.numPages}…`, pct: i / doc.numPages });
    const content = await (await doc.getPage(i)).getTextContent();
    let text = '';
    for (const item of content.items) text += item.str + (item.hasEOL ? '\n' : '');
    pages.push(text);
  }
  const typed = pages.join('\n\n').trim();
  // A PDF with real text is done. One with (almost) none is a scan, so OCR the page images.
  if (typed.replace(/\s/g, '').length >= 40 * doc.numPages) return { text: typed, method: 'pdf' };

  const count = Math.min(doc.numPages, MAX_OCR_PAGES);
  const out = [];
  let confidence = 0;
  for (let i = 1; i <= count; i++) {
    report({ label: `Scanning page ${i} of ${count}…`, pct: null });
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const r = await ocr(canvas);
    out.push(r.text);
    confidence += r.confidence;
  }
  return {
    text: out.join('\n\n').trim(), method: 'ocr', confidence: Math.round(confidence / count),
    warning: doc.numPages > count ? `Only the first ${count} of ${doc.numPages} pages were scanned.` : '',
  };
}

/* Word / PowerPoint ------------------------------------------------- */

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function xmlParagraphs(xml, paraTag, textTag) {
  const text = new RegExp(`<${textTag}(?:\\s[^>]*)?>([^<]*)</${textTag}>|<w:tab/>|<w:br/>`, 'g');
  return xml.split(`</${paraTag}>`).map((p) => {
    let line = '';
    for (const m of p.matchAll(text)) line += m[1] !== undefined ? decode(m[1]) : m[0] === '<w:tab/>' ? '\t' : '\n';
    return line;
  }).filter((l) => l.trim());
}

async function readOffice(blob, kind) {
  report({ label: 'Opening the document…', pct: null });
  await loadScript(JSZIP);
  const zip = await window.JSZip.loadAsync(blob);
  if (kind === 'docx') {
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('unreadable');
    return { text: xmlParagraphs(xml, 'w:p', 'w:t').join('\n'), method: 'docx' };
  }
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  const out = [];
  for (const name of slides) out.push(xmlParagraphs(await zip.file(name).async('string'), 'a:p', 'a:t').join('\n'));
  return { text: out.join('\n\n'), method: 'pptx' };
}

/* Public API -------------------------------------------------------- */

export function kindOfFile(name = '', mime = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'pptx') return 'pptx';
  if (mime.startsWith('text/') || ['txt', 'md', 'csv', 'tsv', 'rtf'].includes(ext)) return 'text';
  return 'other';
}

export const canExtract = (note) => note.kind === 'text' || kindOfFile(note.fileName, note.mime) !== 'other';

const FRIENDLY = {
  offline: 'Reading photos and PDFs needs an internet connection the first time. Connect and try again.',
  unreadable: 'This file couldn’t be opened. It may be damaged or password-protected.',
};

// Returns { text, method, confidence?, warning? }. Results are cached next to the file.
export async function extractText(note, onProgress = () => {}) {
  if (note.kind === 'text') return { text: note.text || '', method: 'text' };
  const cacheKey = `text:${note.id}`;
  const cached = await getFile(cacheKey).catch(() => null);
  if (cached?.text) return cached;

  report = onProgress;
  const blob = await getFile(note.id);
  if (!blob) throw new Error('The file isn’t on this device any more. Upload it again.');
  const kind = kindOfFile(note.fileName, note.mime);
  let result;
  try {
    if (kind === 'text') result = { text: await blob.text(), method: 'text' };
    else if (kind === 'pdf') result = await readPdf(blob);
    else if (kind === 'docx' || kind === 'pptx') result = await readOffice(blob, kind);
    else if (kind === 'image') {
      report({ label: 'Getting the text reader ready (first time only)…', pct: null });
      result = { ...(await ocr(await toCanvas(blob).catch(() => { throw new Error('unreadable'); }))), method: 'ocr' };
    } else throw new Error('This file type can’t be read yet. Try a photo, PDF, Word, PowerPoint or text file.');
  } catch (err) {
    throw new Error(FRIENDLY[err.message] || err.message || FRIENDLY.unreadable);
  }
  result.text = tidy(result.text);
  if (result.text) await putFile(cacheKey, result).catch(() => {});
  return result;
}

// Light clean-up of OCR noise without changing the words.
function tidy(text) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .filter((l) => !l.trim() || /[A-Za-z0-9]{2,}/.test(l)) // drop lines that are only stray marks
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
