// Check a film before (and after) the full render.
//
//   STORY=<id> pnpm qa [--no-images]
//
// Text checks: the story validator; captions (too long, overlapping, fading
// before they are fully written); scene cuts that land inside a spoken
// phrase (narration.timing.json); narration running past the film; the
// soundtrack's loudness and peak once `pnpm audio` has run.
// Images in <buildDir>/qa/: a still in the middle of every scene and a
// contact sheet across every cut. Look at them before rendering the film.
// The report also goes to <buildDir>/qa/report.md.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { activeStory, ROOT } from '../story/load.js';
import { validatePack } from '../story/validate.js';
import { captionLines } from '../video/kit/captions.js';

const story = activeStory();
const noImages = process.argv.includes('--no-images');
const dir = path.join(story.paths.build, 'qa');
fs.mkdirSync(dir, { recursive: true });
const report = [];
const say = (level, msg) => { report.push(`- ${level === 'ok' ? '✓' : level === 'warn' ? '⚠' : '✗'} ${msg}`); };

// 1. The validator.
const { errs, warns } = await validatePack(story.id);
errs.forEach((e) => say('err', `story: ${e}`));
warns.forEach((w) => say('warn', `story: ${w}`));
if (!errs.length && !warns.length) say('ok', 'story.json validates');

// 2. Captions written in step with the narration.
const cjk = (s) => [...s].filter((ch) => /[\u3040-\u30ff\u3400-\u9fff]/.test(ch)).length > s.length / 3;
const lines = (() => { try { return captionLines(); } catch (e) { say('err', `captions: ${e.message}`); return []; } })();
lines.forEach((l, i) => {
  const n = [...l.text].length, max = cjk(l.text) ? 16 : 48;
  if (n > max) say('warn', `caption at ${l.times[0].toFixed(2)}s is ${n} characters (keep to about ${max}): ${l.text}`);
  const done = l.times[l.times.length - 1];
  if (l.out < done + 0.2) say('warn', `caption at ${l.times[0].toFixed(2)}s fades ${(done + 0.2 - l.out).toFixed(2)}s after its last character: ${l.text}`);
  const next = lines[i + 1];
  if (next && next.times[0] < l.out) say('err', `captions overlap at ${next.times[0].toFixed(2)}s: "${l.text}" / "${next.text}"`);
});
if (lines.length) say('ok', `${lines.length} caption lines checked`);

// 3. Cuts in pauses, not mid-phrase; the narration fits the film.
const timingFile = path.join(story.dir, 'narration.timing.json');
if (fs.existsSync(timingFile)) {
  const timing = JSON.parse(fs.readFileSync(timingFile, 'utf8'));
  const phrases = timing.lines.flatMap((l) => l.phrases);
  for (const s of story.scenes.slice(1)) {
    const cut = s.start - (s.lead || 0) / 2;
    const p = phrases.find((x) => cut > x.start + 0.15 && cut < x.end - 0.15);
    if (p) say('warn', `cut into "${s.id}" (${cut.toFixed(2)}s, mid-crossfade) falls inside the phrase "${p.text}" (${p.start}–${p.end}s)`);
  }
  const end = timing.at + timing.duration;
  if (end > story.duration - 1) say('warn', `narration ends at ${end.toFixed(2)}s; the film (${story.duration}s) leaves under 1 s after it`);
  else say('ok', `narration ${timing.at}–${end.toFixed(2)}s inside the film (${story.duration}s)`);
}

// 4. Soundtrack level.
if (fs.existsSync(story.paths.soundtrack)) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', story.paths.soundtrack, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(r.stderr)?.[1]), peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(r.stderr)?.[1]);
  if (lufs < -18 || lufs > -13) say('warn', `soundtrack loudness ${lufs} LUFS (aim for -16 ± 2)`);
  else say('ok', `soundtrack loudness ${lufs} LUFS, true peak ${peak} dBFS`);
} else say('warn', `no soundtrack yet (STORY=${story.id} pnpm audio)`);

// 5. Images to look at.
if (!noImages) {
  const render = (args) => spawnSync('node', [path.join(ROOT, 'src/video/render.js'), '--out', dir, ...args], { encoding: 'utf8', env: { ...process.env, STORY: story.id } });
  const mids = story.scenes.map((s) => ((s.start + s.end) / 2).toFixed(2));
  render(['--still', ...mids]);
  for (const s of story.scenes.slice(1)) {
    const a = s.start - (s.lead || 0) - 0.6, z = s.start + 0.9;
    render(['--sheet', a.toFixed(2), z.toFixed(2), ((z - a) / 12).toFixed(3)]);
  }
  say('ok', `stills of every scene and a sheet across every cut in ${path.relative(ROOT, dir)}/`);
}

const text = `# QA: ${story.meta.title} (${story.id})\n\n${report.join('\n')}\n`;
fs.writeFileSync(path.join(dir, 'report.md'), text);
console.log(text);
process.exit(errs.length || report.some((l) => l.startsWith('- ✗')) ? 1 : 0);
