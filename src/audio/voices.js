// Spoken narration + character lines (text-to-speech) for story packs.
//
//   node src/audio/voices.js [--story id] [--force]    -> <buildDir>/voices/*.wav + manifest.json
//
// A pack opts in with a top-level "voices" cast (speaker -> TTS voice) and
// marks what is spoken:
//   - scenes[].copy.lines[].speaker   speak that on-screen line (text = line.say ?? line.text
//                                     with 「」（）… stripped), starting at line.at
//   - scenes[].dialogue[]             extra spoken lines with no on-screen text
//                                     { at, speaker, text, rate?, pitch?, gain?, pan?, maxDur? }
// Each line is fitted into its slot (until the next spoken line, or maxDur) by
// raising the speaking rate; render-audio.js mixes the stems on a dialogue bus
// (with music ducking) into the soundtrack, so render.js muxes them as usual.
//
// TTS engine: Microsoft Edge neural voices via the `edge-tts` CLI (needs network).
// Looked up as $EDGE_TTS, then `edge-tts` on PATH, then ../.venv-tts/bin/edge-tts
// (python3 -m venv ../.venv-tts && ../.venv-tts/bin/pip install edge-tts).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { activeStory, ROOT } from '../story/load.js';
import { SR } from './dsp.js';

export const cleanSpoken = (s) => s.replace(/[「」『』（）()]/g, '').replace(/…+/g, '。').replace(/——+/g, '，').replace(/\s*·\s*/g, '，').trim();

// Every spoken line of a story, sorted by time, with its fitted slot length.
export function spokenLines(story) {
  const cast = story.voices ?? {};
  const out = [];
  for (const s of story.scenes) {
    for (const l of s.copy?.lines ?? []) {
      if (!l.speaker) continue;
      out.push({ scene: s.id, at: l.voiceAt ?? l.at, speaker: l.speaker, text: cleanSpoken(l.say ?? l.text), ...pick(l, ['rate', 'pitch', 'gain', 'pan', 'maxDur']) });
    }
    for (const d of s.dialogue ?? []) out.push({ scene: s.id, ...d, text: cleanSpoken(d.text) });
  }
  out.sort((a, b) => a.at - b.at);
  out.forEach((l, i) => {
    const next = out[i + 1]?.at ?? story.duration;
    l.slot = Math.max(0.4, Math.min(l.maxDur ?? Infinity, next - l.at - 0.08));
    const c = cast[l.speaker] ?? {};
    l.voice = c.voice;
    l.pitch ??= c.pitch ?? '+0Hz';
    l.baseRate = pct(l.rate ?? c.rate ?? '+0%');
    l.gain ??= c.gain ?? 1;
    l.pan ??= c.pan ?? 0;
  });
  return out;
}

function pick(o, keys) { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; }
const pct = (s) => Number(String(s).replace('%', ''));
const fmtPct = (n) => { const r = Math.round(n) || 0; return `${r >= 0 ? '+' : ''}${r}%`; };

function findTTS() {
  const cands = [process.env.EDGE_TTS, 'edge-tts', path.resolve(ROOT, '../.venv-tts/bin/edge-tts')].filter(Boolean);
  for (const c of cands) {
    const r = spawnSync(c, ['--help'], { stdio: 'ignore' });
    if (!r.error && r.status === 0) return c;
  }
  return null;
}

// Minimal PCM16 mono WAV read/write.
export function readWavMono(file) {
  const b = fs.readFileSync(file);
  let o = 12, fmt = null;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') {
      if (!fmt || fmt.bits !== 16) throw new Error(`${file}: expected 16-bit PCM`);
      const n = Math.floor(len / 2 / fmt.ch), x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = b.readInt16LE(o + 8 + i * 2 * fmt.ch) / 32768;
      return { sr: fmt.sr, data: x };
    }
    o += 8 + len + (len & 1);
  }
  throw new Error(`${file}: no data chunk`);
}

function synth(tts, l, rate, file) {
  const mp3 = `${file}.mp3`;
  let r;
  for (let k = 0; k < 3; k++) { // the service occasionally drops a request
    r = spawnSync(tts, ['--voice', l.voice, `--rate=${fmtPct(rate)}`, `--pitch=${l.pitch}`, '--text', l.text, '--write-media', mp3], { encoding: 'utf8' });
    if (r.status === 0) break;
  }
  if (r.status !== 0) throw new Error(`edge-tts failed for "${l.text}": ${r.stderr || r.error}`);
  // mono 48k PCM16, trim leading/trailing silence, short fade-out
  const f = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', String(SR),
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,afade=t=in:d=0.03,areverse',
    '-c:a', 'pcm_s16le', file], { encoding: 'utf8' });
  fs.rmSync(mp3, { force: true });
  if (f.status !== 0) throw new Error(`ffmpeg failed: ${f.stderr}`);
  return readWavMono(file).data.length / SR;
}

export function voicesDir(story) { return path.join(story.paths.build, 'voices'); }

async function main() {
  const story = activeStory();
  const force = process.argv.includes('--force');
  const lines = spokenLines(story);
  if (!lines.length) { console.log(`story "${story.id}": no spoken lines (nothing to do)`); return; }
  const bad = lines.filter((l) => !l.voice);
  if (bad.length) throw new Error(`speakers without a voice in "voices": ${[...new Set(bad.map((l) => l.speaker))].join(', ')}`);
  const tts = findTTS();
  const dir = voicesDir(story);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = [];
  for (const [i, l] of lines.entries()) {
    const key = crypto.createHash('sha1').update(JSON.stringify([l.voice, l.pitch, l.baseRate, l.slot.toFixed(2), l.text])).digest('hex').slice(0, 10);
    const file = path.join(dir, `${String(i).padStart(2, '0')}_${l.speaker}_${key}.wav`);
    let dur, rate = l.baseRate;
    const cached = path.join(dir, `${key}.json`);
    if (!force && fs.existsSync(file) && fs.existsSync(cached)) ({ dur, rate } = JSON.parse(fs.readFileSync(cached, 'utf8')));
    else {
      if (!tts) throw new Error('edge-tts not found: set EDGE_TTS or `pip install edge-tts` (see header of src/audio/voices.js)');
      dur = synth(tts, l, rate, file);
      // Too long for its slot? speed up (TTS rate keeps pitch natural), max +60%.
      for (let k = 0; k < 3 && dur > l.slot; k++) {
        rate = Math.min(60, (100 + rate) * (dur / l.slot) * 1.03 - 100);
        dur = synth(tts, l, rate, file);
        if (rate >= 60) break;
      }
      fs.writeFileSync(cached, JSON.stringify({ dur, rate }));
    }
    const over = dur > l.slot + 0.05 ? `  !! overruns slot by ${(dur - l.slot).toFixed(2)}s` : '';
    console.log(`${l.at.toFixed(2).padStart(6)}s  ${l.speaker.padEnd(9)} ${dur.toFixed(2)}s/${l.slot.toFixed(2)}s  rate ${fmtPct(rate).padStart(4)}  ${l.text}${over}`);
    manifest.push({ at: l.at, speaker: l.speaker, voice: l.voice, text: l.text, rate: fmtPct(rate), dur: +dur.toFixed(3), gain: l.gain, pan: l.pan, file: path.basename(file) });
  }
  // drop stale stems
  const keep = new Set(manifest.flatMap((m) => [m.file, m.file.replace(/^\d+_[^_]+_/, '').replace('.wav', '.json')]));
  for (const f of fs.readdirSync(dir)) if (f !== 'manifest.json' && !keep.has(f)) fs.rmSync(path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${path.relative(ROOT, dir)}/manifest.json  (${manifest.length} lines)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
