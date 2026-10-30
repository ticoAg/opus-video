// Narration first: speak the script with TTS, then build the film on it.
//
//   STORY=<id> pnpm narrate [--force]
//
// Reads <pack>/narration.json:
//   { "at": 3.0,            film time where the narration starts (title before it)
//     "gap": 0.6,           pause after each line, seconds
//     "lines": [{ "speaker": "narrator", "text": "…", "gap": 1.2, "rate": "-5%" }] }
// speaks every line with its speaker's voice from story.json "voices" (any
// provider of src/audio/tts.js; clips cached in <buildDir>/narration/), joins
// the clips and pauses into <pack>/input-audio/narration.wav, and writes
// <pack>/narration.timing.json: every line and phrase in film seconds.
//
// Then: add { "file": "input-audio/narration.wav", "at": <at> } to
// "recordings", put scene cuts in the pauses between lines, and run
// `pnpm captions --write`. Speakers share one mono track (their "gain"
// applies; "pan" does not).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { activeStory, ROOT } from '../story/load.js';
import { SR } from '../audio/dsp.js';
import { speak } from '../audio/tts.js';
import { readWavMono, writeWavMono } from '../audio/wav.js';
import { cleanSpoken } from '../audio/voices.js';
import { speechSegments, alignPhrases, splitPhrases, weight, r2 } from '../audio/align.js';

const story = activeStory();
const force = process.argv.includes('--force');
const scriptFile = path.join(story.dir, 'narration.json');
if (!fs.existsSync(scriptFile)) throw new Error(`no script: write ${path.relative(ROOT, scriptFile)} ({ at, gap, lines: [{ speaker, text }] })`);
const script = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
const cast = story.voices ?? {};
const at = script.at ?? 0;
const cacheDir = path.join(story.paths.build, 'narration');
fs.mkdirSync(cacheDir, { recursive: true });

const clips = [];
for (const [i, line] of script.lines.entries()) {
  const speaker = line.speaker ?? 'narrator';
  const c = cast[speaker];
  if (!c) throw new Error(`line ${i + 1}: speaker "${speaker}" has no voice in story.json "voices"`);
  const l = {
    text: cleanSpoken(line.text), voice: c.voice, provider: c.provider ?? 'edge-tts', model: c.model,
    rate: Number(String(line.rate ?? c.rate ?? '+0%').replace('%', '')), pitch: line.pitch ?? c.pitch ?? '+0Hz',
  };
  const key = crypto.createHash('sha1').update(JSON.stringify([l.provider, l.model, l.voice, l.rate, l.pitch, l.text])).digest('hex').slice(0, 12);
  const file = path.join(cacheDir, `${key}.wav`);
  if (force || !fs.existsSync(file)) speak(l, file);
  const { data } = readWavMono(file);
  // Phrase timing inside the clip (TTS pauses at commas are short and clean).
  const phrases = splitPhrases(line.text);
  const { segments } = speechSegments(file, { noise: -40, minSilence: 0.1 });
  const times = alignPhrases(segments.length ? segments : [[0, data.length / SR]], phrases.map(weight));
  clips.push({ speaker, text: line.text, data, gain: c.gain ?? 1, gap: line.gap ?? script.gap ?? 0.6, phrases: phrases.map((text, k) => ({ text, ...times[k] })), file });
}

// Lay the clips end to end with their pauses.
const total = clips.reduce((a, c, i) => a + c.data.length / SR + (i < clips.length - 1 ? c.gap : 0), 0);
const out = new Float32Array(Math.ceil(total * SR) + 1);
const lines = [];
let t = 0;
for (const c of clips) {
  const o = Math.round(t * SR);
  for (let i = 0; i < c.data.length; i++) out[o + i] += c.data[i] * c.gain;
  lines.push({
    speaker: c.speaker, text: c.text, start: r2(at + t), end: r2(at + t + c.data.length / SR),
    phrases: c.phrases.map((p) => ({ text: p.text, start: r2(at + t + p.start), end: r2(at + t + p.end) })),
  });
  t += c.data.length / SR + c.gap;
}
const wav = path.join(story.dir, 'input-audio', 'narration.wav');
fs.mkdirSync(path.dirname(wav), { recursive: true });
writeWavMono(wav, out, SR);
const timing = { audio: 'input-audio/narration.wav', at, duration: r2(total), lines };
const timingFile = path.join(story.dir, 'narration.timing.json');
fs.writeFileSync(timingFile, `${JSON.stringify(timing, null, 1)}\n`);

for (const l of lines) console.log(`${l.start.toFixed(2).padStart(7)}–${l.end.toFixed(2).padEnd(7)} ${l.speaker.padEnd(9)} ${l.text}`);
console.log(`${path.relative(ROOT, wav)}  (${total.toFixed(1)}s, film ${at}s–${(at + total).toFixed(1)}s)`);
console.log(`${path.relative(ROOT, timingFile)}  (${lines.length} lines, ${lines.reduce((a, l) => a + l.phrases.length, 0)} phrases)`);
const rec = (story.recordings ?? []).find((r) => path.resolve(story.dir, r.file) === wav);
if (!rec) console.log(`next: add { "file": "input-audio/narration.wav", "at": ${at} } to "recordings" in story.json`);
else if (rec.at !== at) console.log(`note: story.json plays the narration at ${rec.at}s, the timing assumes ${at}s`);
