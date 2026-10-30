// Time a recorded narration against its script.
//
//   STORY=<id> pnpm align [audio] [--noise -38] [--min-silence 0.18]
//
// Reads <pack>/narration.json ({ at, lines: [{ speaker, text }] }, the script
// or transcript; transcribe the recording first if you only have audio), finds
// the speech in the audio (default: the pack's first recording) and writes
// <pack>/narration.timing.json with every line and phrase in film seconds
// (audio time + at). `pnpm captions` turns that into on-screen copy.
import fs from 'node:fs';
import path from 'node:path';
import { activeStory, ROOT } from '../story/load.js';
import { alignRecording } from '../audio/align.js';

const story = activeStory();
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? Number(args.splice(i, 2)[1]) : d; };
const noise = opt('--noise', -38), minSilence = opt('--min-silence', 0.18);
const scriptFile = path.join(story.dir, 'narration.json');
if (!fs.existsSync(scriptFile)) throw new Error(`no script: write ${path.relative(ROOT, scriptFile)} ({ at, lines: [{ speaker, text }] })`);
const script = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
const rec = story.recordings?.[0];
const audio = args[0] ? path.resolve(args[0]) : rec && path.resolve(story.dir, rec.file);
if (!audio || !fs.existsSync(audio)) throw new Error(`audio not found: ${audio ?? '(no recordings in story.json; pass a file)'}`);
const at = script.at ?? rec?.at ?? 0;

const timing = { audio: path.relative(story.dir, audio), ...alignRecording(audio, script.lines, { at, noise, minSilence }) };
const out = path.join(story.dir, 'narration.timing.json');
fs.writeFileSync(out, `${JSON.stringify(timing, null, 1)}\n`);
for (const l of timing.lines) {
  console.log(`${l.start.toFixed(2).padStart(7)}–${l.end.toFixed(2).padEnd(7)} ${l.speaker}`);
  for (const p of l.phrases) console.log(`    ${p.start.toFixed(2).padStart(7)}–${p.end.toFixed(2).padEnd(7)} ${p.text}`);
}
console.log(`${path.relative(ROOT, out)}  (${timing.lines.length} lines, ${timing.lines.reduce((a, l) => a + l.phrases.length, 0)} phrases)`);
