// Deliver films to Google Drive, and keep each film's source media there.
//
//   STORY=<id> pnpm drive push [file…]   upload into <root>/<id>/ in Drive
//   STORY=<id> pnpm drive pull           restore the pack's source media
//   pnpm drive                           check the sign-in, list the films
//
// push uploads out/<id>.mp4, out/<id>-share.mp4 and out/<id>-release.md (or
// just the files given) into <root>/<id>/, and the pack's source media
// (input-audio/, input-pictures/: kept out of git) into <root>/<id>/source/,
// so a fresh checkout can rebuild the film after `pnpm drive pull`.
// Unchanged files are skipped; a changed one becomes a new version of the
// file already there, so its link stays the same.
//
// It signs in as the user through their own OAuth client, with the scope
// drive.file: this tool sees only the files it created, never the rest of
// the Drive. From the environment (never in files or chat):
//   GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN
//   GDRIVE_ROOT      top folder (default "opus-video")
//   GDRIVE_ENDPOINT  tests only: one local server standing in for Google
// One-time setup: .claude/skills/story-to-video/references/delivery.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { activeStory, ROOT } from '../story/load.js';

const ENDPOINT = process.env.GDRIVE_ENDPOINT;
const TOKEN_URL = ENDPOINT ? `${ENDPOINT}/token` : 'https://oauth2.googleapis.com/token';
const API = ENDPOINT ?? 'https://www.googleapis.com';
const TOP = process.env.GDRIVE_ROOT || 'opus-video';
const FOLDER = 'application/vnd.google-apps.folder';
const SOURCES = ['input-audio', 'input-pictures'];
const CHUNK = 8 << 20; // resumable uploads take multiples of 256 KiB
const MIME = { mp4: 'video/mp4', md: 'text/markdown', json: 'application/json', txt: 'text/plain', wav: 'audio/wav', mp3: 'audio/mpeg',
  m4a: 'audio/mp4', flac: 'audio/flac', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const mime = (name) => MIME[path.extname(name).slice(1).toLowerCase()] ?? 'application/octet-stream';
const folderLink = (id) => `https://drive.google.com/drive/folders/${id}`;
const fileLink = (id) => `https://drive.google.com/file/d/${id}/view`;
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const sleep = (s) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, s * 1000);

// One request through curl, which goes through HTTPS_PROXY (Node's fetch
// does not). The URL and headers travel in curl's stdin config, so the token
// never shows in `ps`. Returns { status (0 = no answer), headers, body, err }.
function http(method, url, { headers = {}, data, out } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-'));
  const q = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const conf = [`url = ${q(url)}`, `request = ${q(method)}`, ...Object.entries(headers).map(([k, v]) => `header = ${q(`${k}: ${v}`)}`)];
  const args = ['-sS', '--config', '-', '-D', path.join(tmp, 'head'), '-o', out ?? path.join(tmp, 'body'), '-w', '%{http_code}'];
  if (data != null) {
    fs.writeFileSync(path.join(tmp, 'data'), data);
    args.push('--data-binary', `@${path.join(tmp, 'data')}`);
    conf.push('header = "Expect:"'); // no 100-continue round trip before big bodies
  }
  try {
    const r = spawnSync('curl', args, { input: conf.join('\n'), encoding: 'utf8' });
    const read = (f) => (fs.existsSync(path.join(tmp, f)) ? fs.readFileSync(path.join(tmp, f), 'utf8') : '');
    // Through a proxy the header dump starts with the CONNECT answer: keep the last block.
    const head = read('head').trim().split(/\r?\n\r?\n/).pop().split(/\r?\n/).slice(1).filter((l) => l.includes(':'));
    const headers = Object.fromEntries(head.map((l) => [l.slice(0, l.indexOf(':')).trim().toLowerCase(), l.slice(l.indexOf(':') + 1).trim()]));
    return { status: Number(r.stdout) || 0, headers, body: out ? '' : read('body'), err: r.stderr || String(r.error ?? '') };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// Retries what a flaky connection or a busy server drops (after 2, 4, 8, 16 s).
function retry(what, f) {
  for (let k = 1; ; k++) {
    const r = f();
    if (r.status && r.status !== 429 && r.status < 500) return r;
    if (k > 4) throw new Error(`${what}: ${r.status || 'no answer'} ${(r.body || r.err).slice(0, 300)}`);
    sleep(2 ** k);
  }
}

let token;
function auth() {
  if (token) return token;
  const { GDRIVE_CLIENT_ID: id, GDRIVE_CLIENT_SECRET: secret, GDRIVE_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) {
    throw new Error('Drive is not set up: GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET and GDRIVE_REFRESH_TOKEN must be in the environment (.claude/skills/story-to-video/references/delivery.md)');
  }
  const r = retry('Drive sign-in', () => http('POST', TOKEN_URL, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }).toString() }));
  const j = JSON.parse(r.body || '{}');
  if (r.status !== 200) {
    throw new Error(`Drive sign-in failed (${r.status} ${j.error ?? ''}): ${j.error === 'invalid_grant'
      ? 'the refresh token was revoked or has expired; an OAuth app left in "Testing" issues tokens that last 7 days, so publish it and make a new token'
      : j.error_description ?? r.body.slice(0, 200)}`);
  }
  return (token = j.access_token);
}

function api(method, p, { query, body } = {}) {
  const url = `${API}${p}${query ? `?${new URLSearchParams(query)}` : ''}`;
  const headers = { Authorization: `Bearer ${auth()}`, ...(body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}) };
  const r = retry(`Drive ${method} ${p}`, () => http(method, url, { headers, data: body && JSON.stringify(body) }));
  if (r.status >= 300) throw new Error(`Drive ${method} ${p}: ${r.status} ${r.body.slice(0, 300)}`);
  return JSON.parse(r.body || '{}');
}

function list(parent) {
  const files = [];
  let pageToken;
  do {
    const r = api('GET', '/drive/v3/files', { query: { q: `'${parent}' in parents and trashed = false`, spaces: 'drive', pageSize: 1000,
      fields: 'nextPageToken, files(id, name, mimeType, size, md5Checksum)', ...(pageToken ? { pageToken } : {}) } });
    files.push(...r.files);
    pageToken = r.nextPageToken;
  } while (pageToken);
  return files;
}

// The top folder is found wherever the user moved it (parent null): with
// drive.file only this tool's own folders can match.
function find(name, parent, isFolder) {
  const q = [`name = '${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`, ...(parent ? [`'${parent}' in parents`] : []),
    'trashed = false', `mimeType ${isFolder ? '=' : '!='} '${FOLDER}'`].join(' and ');
  return api('GET', '/drive/v3/files', { query: { q, spaces: 'drive', fields: 'files(id, name, size, md5Checksum)' } }).files[0];
}
const folder = (name, parent) => find(name, parent, true)
  ?? api('POST', '/drive/v3/files', { query: { fields: 'id' }, body: { name, mimeType: FOLDER, parents: [parent ?? 'root'] } });

function md5(file) {
  const h = crypto.createHash('md5'), buf = Buffer.alloc(CHUNK), fd = fs.openSync(file, 'r');
  try { for (let n; (n = fs.readSync(fd, buf, 0, CHUNK, null)) > 0;) h.update(buf.subarray(0, n)); } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

// A resumable upload in chunks: when a chunk is lost, ask Drive how much
// arrived and go on from there. Prints one line; returns the file id.
function upload(file, parent, label) {
  const name = path.basename(file), size = fs.statSync(file).size;
  if (!size) { console.log(`${label}  empty, skipped`); return null; }
  const old = find(name, parent, false);
  if (old && old.md5Checksum === md5(file)) { console.log(`${label}  ${mb(size)}  unchanged  ${fileLink(old.id)}`); return old.id; }
  const bearer = { Authorization: `Bearer ${auth()}` };
  const init = retry(`Drive upload of ${name}`, () => http(old ? 'PATCH' : 'POST', `${API}/upload/drive/v3/files${old ? `/${old.id}` : ''}?uploadType=resumable`, {
    headers: { ...bearer, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime(name), 'X-Upload-Content-Length': size },
    data: JSON.stringify(old ? {} : { name, parents: [parent] }) }));
  const session = init.headers.location;
  if (init.status !== 200 || !session) throw new Error(`Drive upload of ${name}: ${init.status} ${init.body.slice(0, 300)}`);
  const put = (range, data) => http('PUT', session, { headers: { ...bearer, 'Content-Type': mime(name), 'Content-Range': range }, data });
  const received = (r) => { const m = /bytes=\d+-(\d+)/.exec(r.headers.range ?? ''); return m ? Number(m[1]) + 1 : 0; };
  const t0 = Date.now(), fd = fs.openSync(file, 'r');
  let done;
  try {
    for (let at = 0, lost = 0; !done;) {
      const n = Math.min(CHUNK, size - at), buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, at);
      let r = put(`bytes ${at}-${at + n - 1}/${size}`, buf);
      if (r.status === 404 || r.status === 410) throw new Error(`Drive upload of ${name}: the upload session expired, run push again`);
      if (![200, 201, 308].includes(r.status)) {
        if (++lost > 4) throw new Error(`Drive upload of ${name}: ${r.status || 'no answer'} ${(r.body || r.err).slice(0, 300)}`);
        sleep(2 ** lost);
        r = retry(`Drive upload of ${name}`, () => put(`bytes */${size}`, ''));
      } else lost = 0;
      if (r.status === 200 || r.status === 201) done = JSON.parse(r.body || '{}');
      else if (r.status === 308) at = received(r);
    }
  } finally { fs.closeSync(fd); }
  const id = done.id ?? old?.id;
  console.log(`${label}  ${mb(size)}  ${old ? 'updated' : 'uploaded'} in ${((Date.now() - t0) / 1000).toFixed(0)} s  ${fileLink(id)}`);
  return id;
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else if (e.isFile()) yield p;
  }
}

function push(story, files) {
  const film = folder(story.id, folder(TOP, null).id);
  const out = (s) => story.paths.video.replace(/\.mp4$/, s);
  const own = files.length ? files.map((f) => path.resolve(f)) : [out('.mp4'), out('-share.mp4'), out('-release.md')].filter((f) => fs.existsSync(f));
  if (!own.length) console.log(`no film in ${path.relative(ROOT, path.dirname(out('.mp4')))}/ yet (STORY=${story.id} pnpm video, then pnpm share)`);
  for (const f of own) upload(f, film.id, `${TOP}/${story.id}/${path.basename(f)}`);
  const sources = files.length ? [] : SOURCES.map((d) => path.join(story.dir, d)).filter((d) => fs.existsSync(d)).flatMap((d) => [...walk(d)]);
  if (sources.length) {
    // Mirror the pack's folders under source/, so pull puts every file back.
    const ids = new Map([['', folder('source', film.id).id]]);
    for (const f of sources) {
      const rel = path.relative(story.dir, f).split(path.sep);
      for (let i = 1; i < rel.length; i++) {
        const key = rel.slice(0, i).join('/');
        if (!ids.has(key)) ids.set(key, folder(rel[i - 1], ids.get(rel.slice(0, i - 1).join('/'))).id);
      }
      upload(f, ids.get(rel.slice(0, -1).join('/')), `${TOP}/${story.id}/source/${rel.join('/')}`);
    }
  }
  console.log(`${TOP}/${story.id}/  ${folderLink(film.id)}`);
}

function pull(story) {
  const top = find(TOP, null, true), film = top && find(story.id, top.id, true), src = film && find('source', film.id, true);
  if (!src) throw new Error(`nothing to pull: no ${TOP}/${story.id}/source/ in Drive (push it first)`);
  const get = (id, dir) => {
    for (const f of list(id)) {
      if (/[\\/]/.test(f.name) || f.name === '.' || f.name === '..') continue;
      const p = path.join(dir, f.name);
      if (f.mimeType === FOLDER) { get(f.id, p); continue; }
      const label = path.relative(ROOT, p);
      if (fs.existsSync(p) && md5(p) === f.md5Checksum) { console.log(`${label}  unchanged`); continue; }
      fs.mkdirSync(dir, { recursive: true });
      const part = `${p}.part`;
      const r = retry(`Drive download of ${f.name}`, () => http('GET', `${API}/drive/v3/files/${f.id}?alt=media`, { headers: { Authorization: `Bearer ${auth()}` }, out: part }));
      if (r.status !== 200) {
        const e = fs.existsSync(part) ? fs.readFileSync(part, 'utf8').slice(0, 300) : r.err;
        fs.rmSync(part, { force: true });
        throw new Error(`Drive download of ${f.name}: ${r.status} ${e}`);
      }
      fs.renameSync(part, p);
      console.log(`${label}  ${mb(fs.statSync(p).size)}`);
    }
  };
  get(src.id, story.dir);
}

function check() {
  auth();
  const top = find(TOP, null, true);
  if (!top) { console.log(`signed in to Drive; no ${TOP}/ yet (push makes it)`); return; }
  console.log(`signed in to Drive; ${TOP}/  ${folderLink(top.id)}`);
  for (const f of list(top.id).filter((f) => f.mimeType === FOLDER)) console.log(`  ${f.name}/  ${folderLink(f.id)}`);
}

// activeStory() takes `--story <id>` out of argv, so read the files after it.
const cmd = process.argv[2];
if (cmd === 'push') { const story = activeStory(); push(story, process.argv.slice(3)); }
else if (cmd === 'pull') pull(activeStory());
else if (!cmd || cmd === 'check') check();
else throw new Error(`unknown command "${cmd}": push, pull or check`);
