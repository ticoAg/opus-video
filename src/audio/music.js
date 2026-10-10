// The score engine. What to play comes from the active story pack
// (stories/<id>/story.json, "music"): tempo, chord chart keyed to the same
// seconds as the scenes, the theme (bars of eighth notes) and, per section,
// an ordered list of "layers" (pads, strum, bassline, drums, melody, arp ...).
// Every layer op below is generic; a new story only writes JSON.
// Everything is placed on the same beat grid as the visuals (src/lib/util.js).
import { NOTE, mtof, BEAT, BAR } from '../lib/util.js';
import { pluck, glock, musicbox, marimba, pad, bass, tuba, kick, clap, shaker, woodblock, cymbal } from './instruments.js';
import { activeStory } from '../story/load.js';
import { LAYER_OPS } from '../story/vocab.js';

const PLAN = activeStory().music ?? {};
const CH = PLAN.chordTones ?? {
  C: ['C', 'E', 'G'], G: ['G', 'B', 'D'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'],
  Dm: ['D', 'F', 'A'], Em: ['E', 'G', 'B'],
};
const f = (n) => mtof(NOTE(n));

// [start, end, chord] across the whole film.
export const CHORDS = PLAN.chords ?? [];
const chordAt = (t) => CHORDS.find(([a, z]) => t >= a && t < z)?.[2];
const voicing = (name, oct = 4) => CH[name].map((n, i) => `${n}${oct + (i > 0 && 'CDEFGAB'.indexOf(n) < 'CDEFGAB'.indexOf(CH[name][0]) ? 1 : 0)}`);

// The main theme, in eighth notes: [note, start8th, length8ths] per bar.
const THEME = PLAN.theme ?? [];
const E8 = BEAT / 2;

// Durations in a plan may be seconds or grid names.
const STEPS = { bar: BAR, halfbar: BAR / 2, beat: BEAT, '8th': E8, '16th': E8 / 2 };
const step = (v, dflt) => (v === undefined ? dflt : typeof v === 'string' ? STEPS[v] : v);
const PERC = { kick, clap, shaker, cymbal, woodblock: (o) => woodblock(o?.freq, o) };
const TONAL = { pluck, glock, musicbox, marimba, bass, tuba };

export function score(music, perc) {
  const put = (bus, sig, t, o) => bus.add(sig, t, o);
  const melody = (bars, t0, inst, gain, pan = 0, oct = 0) => {
    bars.forEach((b, bi) => THEME[b].forEach(([n, s, l]) => {
      const t = t0 + bi * BAR + s * E8;
      const fr = f(n) * 2 ** oct;
      const sig = inst === 'marimba' ? marimba(fr, { dur: 0.9 }) : inst === 'glock' ? glock(fr, { dur: 1.2 })
        : inst === 'musicbox' ? musicbox(fr) : pluck(fr, { dur: l * E8 + 0.8, bright: 0.7, seed: s + bi });
      put(music, sig, t, { gain, pan });
    }));
  };
  const pads = (a, z, gain, cutoff = 1300) => {
    for (const [s, e, c] of CHORDS) {
      if (e <= a || s >= z) continue;
      const t0 = Math.max(s, a), t1 = Math.min(e, z);
      put(music, pad(voicing(c, 4).map(f), t1 - t0, { cutoff, attack: 0.25, release: 0.5, seed: t0 }), t0, { gain, pan: 0 });
    }
  };
  const bassline = (a, z, gain, pattern = [0, 2]) => {
    for (let t = a; t < z - 1e-6; t += BAR) {
      for (const beat of pattern) {
        const tt = t + beat * BEAT;
        const c = chordAt(tt);
        if (!c || tt >= z) continue;
        const root = `${CH[c][0]}2`;
        put(music, bass(f(root), { dur: 0.42 }), tt, { gain });
        put(music, bass(f(root) * 2, { dur: 0.2 }), tt + BEAT * 1.5, { gain: gain * 0.45 });
      }
    }
  };
  const strum = (a, z, gain, pattern = [0, 1, 1.5, 2, 3, 3.5]) => {
    for (let t = a; t < z - 1e-6; t += BAR) {
      for (const beat of pattern) {
        const tt = t + beat * BEAT;
        const c = chordAt(tt);
        if (!c || tt >= z) continue;
        voicing(c, 4).concat(`${CH[c][0]}5`).forEach((n, k) => {
          put(music, pluck(f(n), { dur: 0.5, bright: 0.55, decay: 0.993, seed: k + beat * 3 }), tt + k * 0.012, { gain: gain * (beat % 1 ? 0.6 : 1), pan: -0.25 + k * 0.1 });
        });
      }
    }
  };
  const drums = (a, z, { kicks = [0, 2], claps = [1, 3], shake = true, gain = 1 } = {}) => {
    for (let t = a; t < z - 1e-6; t += BAR) {
      kicks.forEach((b) => t + b * BEAT < z && put(perc, kick(), t + b * BEAT, { gain: 0.8 * gain }));
      claps.forEach((b) => t + b * BEAT < z && put(perc, clap({ seed: Math.round(t * 10 + b) }), t + b * BEAT, { gain: 0.45 * gain, pan: 0.1 }));
      if (shake) for (let e = 0; e < 8; e++) if (t + e * E8 < z) put(perc, shaker({ seed: e + Math.round(t) }), t + e * E8, { gain: (e % 2 ? 0.5 : 0.3) * gain, pan: 0.35 });
    }
  };
  const arp = (a, z, inst, gain, step = E8, oct = 5, pan = 0) => {
    let k = 0;
    for (let t = a; t < z - 1e-6; t += step, k++) {
      const c = chordAt(t);
      if (!c) continue;
      const notes = voicing(c, oct);
      const n = [notes[0], notes[1], notes[2], notes[1]][k % 4];
      const sig = inst === 'musicbox' ? musicbox(f(n)) : inst === 'marimba' ? marimba(f(n), { dur: 0.6 }) : glock(f(n), { dur: 1 });
      put(music, sig, t, { gain, pan: pan + (k % 2 ? 0.2 : -0.2) });
    }
  };

  const voice = (inst, fr, l = 2) => (inst === 'marimba' ? marimba(fr, { dur: 0.9 }) : inst === 'glock' ? glock(fr, { dur: 1.2 })
    : inst === 'musicbox' ? musicbox(fr) : pluck(fr, { dur: l * E8 + 0.8, bright: 0.7, seed: 0 }));
  const opt = (L, keys) => Object.fromEntries(keys.filter((k) => L[k] !== undefined).map((k) => [k, L[k]]));

  // Layer ops: each takes one JSON layer object. Order inside a section is
  // the order things are mixed in.
  const OPS = {
    pads: (L) => pads(L.a, L.z, L.gain, L.cutoff),
    arp: (L) => arp(L.a, L.z, L.inst, L.gain, step(L.step, E8), L.oct, L.pan),
    melody: (L) => melody(L.bars, L.at, L.inst, L.gain, L.pan, L.oct),
    strum: (L) => strum(L.a, L.z, L.gain, L.pattern),
    bassline: (L) => bassline(L.a, L.z, L.gain, L.pattern),
    drums: (L) => drums(L.a, L.z, opt(L, ['kicks', 'claps', 'shake', 'gain'])),
    // One hit: { bus: music|perc, inst, opts, at, gain, pan }.
    hit: (L) => {
      const sig = PERC[L.inst] ? PERC[L.inst](L.opts) : TONAL[L.inst](f(L.note), L.opts);
      put(L.bus === 'perc' ? perc : music, sig, L.at, opt(L, ['gain', 'pan']));
    },
    // Repeated percussion hit every `step` in [a, z).
    pulse: (L) => { for (let t = L.a; t < L.z; t += step(L.step)) put(perc, PERC[L.inst](L.opts), t, opt(L, ['gain', 'pan'])); },
    // Clap roll with rising amplitude.
    clapRoll: (L) => {
      for (let t = L.a; t < L.z; t += step(L.step)) put(perc, clap({ amp: L.amp + (t - L.a) * L.ampSlope, seed: Math.round(t * 100) }), t, { gain: L.gain });
    },
    // Oom-pah march: tuba roots on 1/3, chord stabs on 2/4, woodblock offbeats.
    oompah: (L) => {
      for (let t = L.a; t < L.z - 1e-6; t += BEAT) {
        const c = chordAt(t);
        const beat = Math.round((t - L.a) / BEAT) % 2;
        if (beat === 0) put(music, tuba(f(`${CH[c][beat ? 2 : 0]}2`) * (Math.round((t - L.a) / BEAT) % 4 === 2 ? 1.5 : 1)), t, { gain: L.tuba });
        else voicing(c, 4).forEach((n, k) => put(music, pluck(f(n), { dur: 0.25, bright: 0.5, seed: k }), t + k * 0.01, { gain: L.chord }));
        put(perc, woodblock(beat ? 1200 : 900), t + E8, { gain: L.woodblock, pan: 0.4 });
      }
    },
    // Half-time groove: long bass root + soft kick per bar, shaker on 3.
    halftime: (L) => {
      for (let t = L.a; t < L.z; t += BAR) {
        const c = chordAt(t);
        put(music, bass(f(`${CH[c][0]}2`), { dur: 1.2, drive: 1.1 }), t, { gain: L.bass });
        put(perc, kick({ amp: 0.6 }), t, { gain: L.kick });
        put(perc, shaker({ seed: Math.round(t), len: 0.12 }), t + BEAT * 2, { gain: L.shaker });
      }
    },
    // Fingerpicked uke on eighths: root, fifth, third, octave.
    fingerpick: (L) => {
      for (let t = L.a, k = 0; t < L.z; t += E8, k++) {
        const c = chordAt(t);
        const notes = voicing(c, 4);
        const n = [notes[0], notes[2], notes[1], `${CH[c][0]}5`][k % 4];
        put(music, pluck(f(n), { dur: 1.2, bright: 0.45, seed: k }), t, { gain: L.gain, pan: k % 2 ? 0.25 : -0.25 });
      }
    },
    // Chord roots on a fixed grid.
    rootBass: (L) => {
      for (let t = L.a; t < L.z; t += step(L.step)) put(music, bass(f(`${CH[chordAt(t)][0]}2`), { dur: L.dur, drive: L.drive }), t, { gain: L.gain });
    },
    // Big ending: strummed chord (+ extra notes), glock sparkle, pad, bass, kick, cymbal.
    finalChord: (L) => {
      const t0 = L.at;
      voicing(L.chord, 4).concat(L.extra ?? []).forEach((n, k) => {
        put(music, pluck(f(n), { dur: 3.2, bright: 0.7, seed: k }), t0 + k * 0.015, { gain: 0.3, pan: -0.3 + k * 0.08 });
        put(music, glock(f(n) * 2, { dur: 2.5 }), t0 + k * 0.02, { gain: 0.08 });
      });
      put(music, pad(voicing(L.chord, 4).map(f), 2.2, { cutoff: 1800, attack: 0.02, release: 1.2 }), t0, { gain: 0.3 });
      put(music, bass(f(`${CH[L.chord][0]}2`), { dur: 2, drive: 1.3 }), t0, { gain: 0.55 });
      put(perc, kick(), t0, { gain: 0.9 });
      put(perc, cymbal({ dur: 3 }), t0, { gain: 0.55 });
    },
    // A literal phrase of notes, one every `step` seconds.
    phrase: (L) => L.notes.forEach((n, k) => put(music, voice(L.inst, f(n)), L.at + k * step(L.step), opt(L, ['gain', 'pan']))),
  };

  for (const k of LAYER_OPS) if (!OPS[k]) throw new Error(`music.js: layer op "${k}" listed in vocab.js is not implemented`);
  for (const section of PLAN.sections ?? []) {
    for (const L of section.layers ?? []) {
      const op = OPS[L.op];
      if (!op) throw new Error(`music section "${section.id}": unknown layer op "${L.op}"`);
      op(L);
    }
  }
}

export { LAYER_OPS };
