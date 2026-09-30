// Push this folder to GitHub as one commit using the Git Data API.
// Useful when the local `git` command isn't available.
//
//   GH_TOKEN=$(gh auth token) node scripts/publish.js "Commit message"
//
// Remember to bump VERSION in sw.js first so installed apps pick up the update.
const fs = require('fs');
const path = require('path');
const https = require('https');

const repo = process.env.GH_REPO || 'msherman16/questbook';
const dir = path.resolve(__dirname, '..');
const message = process.argv[2];
const token = process.env.GH_TOKEN;
const SKIP = new Set(['.DS_Store', '.git', 'node_modules']);

if (!token || !message) {
  console.error('Usage: GH_TOKEN=$(gh auth token) node scripts/publish.js "Commit message"');
  process.exit(1);
}

function api(method, url, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com', path: `/repos/${repo}${url}`, method,
      headers: {
        Authorization: `Bearer ${token}`, 'User-Agent': 'questbook-publish', Accept: 'application/vnd.github+json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let out = '';
      res.on('data', (c) => (out += c));
      res.on('end', () => (res.statusCode >= 300 ? reject(new Error(`${method} ${url} → ${res.statusCode}: ${out}`)) : resolve(out ? JSON.parse(out) : {})));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [path.relative(dir, p)];
  });
}

(async () => {
  const files = walk(dir);
  const tree = [];
  for (const f of files) {
    const blob = await api('POST', '/git/blobs', { content: fs.readFileSync(path.join(dir, f)).toString('base64'), encoding: 'base64' });
    tree.push({ path: f.split(path.sep).join('/'), mode: '100644', type: 'blob', sha: blob.sha });
    process.stdout.write('.');
  }
  const ref = await api('GET', '/git/ref/heads/main');
  const t = await api('POST', '/git/trees', { tree }); // no base_tree: the folder becomes the whole repo
  const commit = await api('POST', '/git/commits', { message, tree: t.sha, parents: [ref.object.sha] });
  await api('PATCH', '/git/refs/heads/main', { sha: commit.sha });
  console.log(`\nPushed ${files.length} files to ${repo} as ${commit.sha.slice(0, 7)}`);
})().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});
