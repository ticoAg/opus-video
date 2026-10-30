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
// TTS engine: the voice's "provider" (default edge-tts; also any local command or
// an OpenAI-compatible endpoint), see src/audio/tts.js. For narration that the
// film should follow instead (no squeezing into slots), use `pnpm narrate`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { activeStory, ROOT } from '../story/load.js';
import { speak, fmtPct } from './tts.js';

export { readWavMono } from './wav.js';

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
    l.provider = c.provider ?? 'edge-tts';
    l.model = c.model;
    l.pitch ??= c.pitch ?? '+0Hz';
    l.baseRate = pct(l.rate ?? c.rate ?? '+0%');
    l.gain ??= c.gain ?? 1;
    l.pan ??= c.pan ?? 0;
  });
  return out;
}

function pick(o, keys) { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; }
const pct = (s) => Number(String(s).replace('%', ''));
export function voicesDir(story) { return path.join(story.paths.build, 'voices'); }

async function main() {
  const story = activeStory();
  const force = process.argv.includes('--force');
  const lines = spokenLines(story);
  if (!lines.length) { console.log(`story "${story.id}": no spoken lines (nothing to do)`); return; }
  const bad = lines.filter((l) => !l.voice);
  if (bad.length) throw new Error(`speakers without a voice in "voices": ${[...new Set(bad.map((l) => l.speaker))].join(', ')}`);
  const dir = voicesDir(story);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = [];
  for (const [i, l] of lines.entries()) {
    const id = [l.voice, l.pitch, l.baseRate, l.slot.toFixed(2), l.text, ...(l.provider !== 'edge-tts' || l.model ? [l.provider, l.model] : [])];
    const key = crypto.createHash('sha1').update(JSON.stringify(id)).digest('hex').slice(0, 10);
    const file = path.join(dir, `${String(i).padStart(2, '0')}_${l.speaker}_${key}.wav`);
    let dur, rate = l.baseRate;
    const cached = path.join(dir, `${key}.json`);
    if (!force && fs.existsSync(file) && fs.existsSync(cached)) ({ dur, rate } = JSON.parse(fs.readFileSync(cached, 'utf8')));
    else {
      dur = speak({ ...l, rate }, file);
      // Too long for its slot? speed up (TTS rate keeps pitch natural), max +60%.
      for (let k = 0; k < 3 && dur > l.slot; k++) {
        rate = Math.min(60, (100 + rate) * (dur / l.slot) * 1.03 - 100);
        dur = speak({ ...l, rate }, file);
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
