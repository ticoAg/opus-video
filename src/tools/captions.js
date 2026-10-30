// On-screen captions from a narration timing (pnpm narrate / pnpm align).
//
//   STORY=<id> pnpm captions [--max 14] [--write]
//
// Each line of the script is cut into display lines at phrase boundaries:
// at most `--max` characters each (default 14 for Chinese and Japanese text,
// 42 otherwise), few lines of even length, cut where the voice pauses. Every
// display line gets `beats` (one [start, end] per phrase), so the kit writes
// it in as it is spoken (src/video/kit/captions.js). Without --write the lines
// are printed; with --write they replace the beat-timed lines in story.json,
// each in the scene that is on screen when it starts.
import fs from 'node:fs';
import path from 'node:path';
import { activeStory, ROOT } from '../story/load.js';
import { weight } from '../audio/align.js';
import { formatJson } from '../lib/json.js';

const story = activeStory();
const args = process.argv.slice(2);
const timingFile = path.join(story.dir, 'narration.timing.json');
if (!fs.existsSync(timingFile)) throw new Error(`no timing: run STORY=${story.id} pnpm narrate (TTS) or pnpm align (recording) first`);
const timing = JSON.parse(fs.readFileSync(timingFile, 'utf8'));
const text = timing.lines.map((l) => l.text).join('');
const cjk = [...text].filter((ch) => /[぀-ヿ㐀-鿿]/.test(ch)).length > text.length / 3;
const mi = args.indexOf('--max');
const MAX = mi >= 0 ? Number(args[mi + 1]) : cjk ? 14 : 42;
const len = (s) => (cjk ? [...s].length : s.length);

// Split one line's phrases into display lines of <= MAX characters (a phrase
// longer than MAX gets a line of its own): few lines, even lengths, and cuts
// where the voice pauses longest. Tries the fewest lines that fit and one more.
function group(phrases) {
  const n = phrases.length, L = phrases.map((p) => len(p.text));
  const pause = phrases.map((p, i) => (i ? Math.max(0, p.start - phrases[i - 1].end) : 0));
  const span = (a, b) => L.slice(a, b).reduce((s, x) => s + x, 0);
  let best = null, bestCost = Infinity, kMin = null;
  for (let k = 1; k <= n; k++) {
    if (kMin != null && k > kMin + 1) break;
    // f[j][i]: best cost splitting phrases [0, i) into j lines.
    const f = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
    const from = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(-1));
    f[0][0] = 0;
    for (let j = 1; j <= k; j++) {
      for (let i = 1; i <= n; i++) {
        for (let p = i - 1; p >= 0; p--) {
          const s = span(p, i);
          if (s > MAX && i - p > 1) break;
          const c = f[j - 1][p] + ((MAX - Math.min(s, MAX)) / MAX) ** 2 - (p ? pause[p] : 0);
          if (c < f[j][i]) { f[j][i] = c; from[j][i] = p; }
        }
      }
    }
    if (f[k][n] === Infinity) continue;
    kMin ??= k;
    const cost = f[k][n] + 0.5 * k;
    if (cost < bestCost) {
      const cuts = [n];
      for (let j = k, i = n; j > 0; j--) { i = from[j][i]; cuts.unshift(i); }
      best = cuts.slice(1).map((z, j) => phrases.slice(cuts[j], z));
      bestCost = cost;
    }
  }
  return best;
}

const lines = timing.lines.flatMap((l) => group(l.phrases).map((ps) => ({
  text: ps.map((p) => p.text).join(cjk ? '' : ' '),
  beats: ps.map((p) => [p.start, p.end]),
})));

// The scene on screen when a line starts: the last one (story order) whose
// window holds that time.
const sceneAt = (t) => [...story.scenes].reverse().find((s) => t >= s.start - (s.lead || 0) && t < s.end + (s.tail || 0)) ?? story.scenes[0];
const byScene = new Map(story.scenes.map((s) => [s.id, []]));
for (const l of lines) byScene.get(sceneAt(l.beats[0][0]).id).push(l);

for (const s of story.scenes) {
  for (const l of byScene.get(s.id)) console.log(`${s.id.padEnd(12)} ${l.beats[0][0].toFixed(2).padStart(7)}  ${l.text}`);
}
console.log(`${lines.length} caption lines (max ${MAX} chars, ${weight(text)} letters)`);

if (args.includes('--write')) {
  const raw = JSON.parse(fs.readFileSync(story.file, 'utf8'));
  for (const s of raw.scenes) {
    const keep = (s.copy?.lines ?? []).filter((l) => !l.beats);
    const add = byScene.get(s.id) ?? [];
    if (!keep.length && !add.length && !s.copy) continue;
    s.copy = { ...s.copy, lines: [...keep, ...add] };
  }
  fs.writeFileSync(story.file, `${formatJson(raw)}\n`);
  console.log(`wrote ${path.relative(ROOT, story.file)}`);
}
