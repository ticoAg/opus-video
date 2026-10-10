// Builds the soundtrack: the score (music.js) plus every scene's sound cues
// (the same cue list the visuals are timed from), mixed, reverbed, limited,
// and written to build/soundtrack.wav.
import fs from 'node:fs';
import path from 'node:path';
import { SR, Bus, reverb, echo, biquad } from './dsp.js';
import { SFX } from './sfx.js';
import { score } from './music.js';
import { CUES, DURATION } from '../video/scenes/index.js';
import { BUILD_DIR } from '../extract/common.js';
import { BEAT } from '../lib/util.js';
import { activeStory } from '../story/load.js';
import { spokenLines, voicesDir, readWavMono } from './voices.js';

const LEN = DURATION + 0.5;
const t0 = performance.now();

const music = new Bus(LEN);
const perc = new Bus(LEN);
const sfx = new Bus(LEN);

score(music, perc);
console.log(`score        ${((performance.now() - t0) / 1000).toFixed(1)}s`);

const missing = new Set();
for (const c of CUES) {
  const gen = SFX[c.sfx];
  if (!gen) { missing.add(c.sfx); continue; }
  if (!c.gain) continue;
  sfx.add(gen(c), c.t, { gain: c.gain, pan: c.pan ?? 0, panTo: c.panTo ?? null, panLfo: c.panLfo ?? 0 });
}
if (missing.size) console.warn('missing sfx:', [...missing].join(', '));
console.log(`sfx (${CUES.length} cues) ${((performance.now() - t0) / 1000).toFixed(1)}s`);

// Dialogue: TTS stems from `pnpm voices` (src/audio/voices.js), if the pack has
// spoken lines. Music/percussion (and a little of the sfx) duck under speech.
const dialogue = new Bus(LEN);
let hasDialogue = false;
if (spokenLines(activeStory()).length) {
  const mf = path.join(voicesDir(activeStory()), 'manifest.json');
  if (!fs.existsSync(mf)) console.warn(`spoken lines found but no stems: run STORY=${activeStory().id} pnpm voices`);
  else {
    const lines = JSON.parse(fs.readFileSync(mf, 'utf8'));
    for (const l of lines) {
      const { data } = readWavMono(path.join(path.dirname(mf), l.file));
      dialogue.add(data, l.at, { gain: 1.5 * (l.gain ?? 1), pan: l.pan ?? 0 });
    }
    hasDialogue = lines.length > 0;
    // Ducking envelope from the dialogue level (fast attack, slow release).
    const att = Math.exp(-1 / (0.03 * SR)), rel = Math.exp(-1 / (0.35 * SR));
    let e = 0;
    for (let i = 0; i < dialogue.n; i++) {
      const lvl = Math.min(1, Math.max(Math.abs(dialogue.L[i]), Math.abs(dialogue.R[i])) * 8);
      e = lvl > e ? att * e + (1 - att) * lvl : rel * e + (1 - rel) * lvl;
      const duck = 1 - 0.65 * e; // about -9 dB under speech
      music.L[i] *= duck; music.R[i] *= duck;
      perc.L[i] *= duck; perc.R[i] *= duck;
      const d2 = 1 - 0.5 * e;
      sfx.L[i] *= d2; sfx.R[i] *= d2;
    }
    // Speech-to-bed ratio per line (dialogue vs the ducked music/perc/sfx it sits on).
    const snr = lines.map((l) => {
      const a = Math.round(l.at * SR), z = Math.min(dialogue.n, a + Math.round(l.dur * SR));
      let d = 0, b = 0;
      for (let i = a; i < z; i++) {
        d += dialogue.L[i] ** 2 + dialogue.R[i] ** 2;
        const bl = music.L[i] * 0.8 + perc.L[i] * 0.75 + sfx.L[i], br = music.R[i] * 0.8 + perc.R[i] * 0.75 + sfx.R[i];
        b += bl * bl + br * br;
      }
      return [10 * Math.log10((d + 1e-12) / (b + 1e-12)), l];
    }).sort((x, y) => x[0] - y[0]);
    console.log(`dialogue (${lines.length} lines) speech/bed dB  min ${snr[0][0].toFixed(1)} (${snr[0][1].at}s ${snr[0][1].speaker})  median ${snr[snr.length >> 1][0].toFixed(1)}`);
    console.log(`dialogue (${lines.length} lines) ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  }
}

// Mix: music + percussion + effects, with shared reverb and a music echo.
const send = new Bus(LEN);
send.addStereo(music, 0.35);
send.addStereo(sfx, 0.18);
send.addStereo(perc, 0.08);
if (hasDialogue) send.addStereo(dialogue, 0.06); // a touch of room on the voices
const verb = reverb(send, { room: 0.82, damp: 0.35 });
const delay = echo(music, { time: BEAT * 0.75, feedback: 0.3 }); // dotted eighth

const master = new Bus(LEN);
master.addStereo(music, 0.8);
master.addStereo(perc, 0.75);
master.addStereo(sfx, 1.0);
master.addStereo(verb, 0.9);
master.addStereo(delay, 0.12);
if (hasDialogue) master.addStereo(dialogue, 1.0);
const rms = (b) => {
  let a = 0;
  for (let i = 0; i < b.n; i++) a += b.L[i] ** 2 + b.R[i] ** 2;
  return (10 * Math.log10(a / (2 * b.n) + 1e-12)).toFixed(1);
};
console.log(`mix          ${((performance.now() - t0) / 1000).toFixed(1)}s   rms dB  music ${rms(music)}  perc ${rms(perc)}  sfx ${rms(sfx)}${hasDialogue ? `  dialogue ${rms(dialogue)}` : ''}`);

// Soften the very top end of the whole mix.
for (const ch of [master.L, master.R]) {
  const lp = biquad().set(15000, 0.6);
  for (let i = 0; i < ch.length; i++) ch[i] = lp.run(ch[i]);
}

// Gentle bus compression (envelope follower) + soft clip, then normalise.
let envl = 0;
const att = Math.exp(-1 / (0.005 * SR)), rel = Math.exp(-1 / (0.15 * SR));
let peak = 0;
for (let i = 0; i < master.n; i++) {
  const lvl = Math.max(Math.abs(master.L[i]), Math.abs(master.R[i]));
  envl = lvl > envl ? att * envl + (1 - att) * lvl : rel * envl + (1 - rel) * lvl;
  const thr = 0.5;
  const g = envl > thr ? (thr + (envl - thr) / 3) / envl : 1;
  master.L[i] = Math.tanh(master.L[i] * g * 1.1);
  master.R[i] = Math.tanh(master.R[i] * g * 1.1);
  peak = Math.max(peak, Math.abs(master.L[i]), Math.abs(master.R[i]));
}
const norm = 0.7 / peak; // about -14 LUFS, with headroom for AAC
// Fade out the last half second.
const fadeN = Math.round(0.5 * SR);
const pcm = Buffer.alloc(master.n * 4);
for (let i = 0; i < master.n; i++) {
  const f = i > master.n - fadeN ? (master.n - i) / fadeN : 1;
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, master.L[i] * norm * f)) * 32767), i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, master.R[i] * norm * f)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
fs.mkdirSync(BUILD_DIR, { recursive: true });
const out = activeStory().paths.soundtrack;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([header, pcm]));
console.log(`${out}  (${LEN.toFixed(1)}s, ${((performance.now() - t0) / 1000).toFixed(1)}s total)`);

