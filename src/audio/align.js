// Timing a narration: where its phrases start and end. Shared by
// `pnpm narrate` (TTS, one clip per line) and `pnpm align` (a recording).
//
// Speech is found with ffmpeg silencedetect; the script's phrases (text split
// after ，。！？；, . ! ? ;) are then laid over the speech segments in order
// by a small dynamic programme: each phrase takes a run of whole segments
// whose speaking time best matches its share of the characters, preferring
// boundaries at longer pauses and avoiding long pauses inside a phrase.
//
// Timing files (<pack>/narration.timing.json) look like
//   { audio, at, duration, lines: [{ speaker, text, start, end,
//     phrases: [{ text, start, end }] }] }    // film seconds
import { spawnSync } from 'node:child_process';

const PUNCT = /[，。！？、；：,.!?;:]/;
const BREAK = /[，。！？；,.!?;]/;

// Phrases of a line: split after ，。！？； (and , . ! ? ;), punctuation kept.
export function splitPhrases(text) {
  const out = [];
  let cur = '';
  for (const ch of text.trim()) {
    cur += ch;
    if (BREAK.test(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// How much speaking a phrase takes: its letters (CJK characters, Latin
// letters and digits), punctuation and spaces excluded.
export const weight = (s) => Math.max(1, [...s].filter((ch) => !PUNCT.test(ch) && !/\s/.test(ch)).length);

// Speech segments [[start, end], ...] (seconds) of an audio file. Quiet blips
// (breaths, lip noise: more than `breathDb` below the typical speech level)
// are left out and returned as `breaths`.
export function speechSegments(file, { noise = -38, minSilence = 0.18, breathDb = 10 } = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${noise}dB:d=${minSilence}`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${r.stderr.slice(-300)}`);
  const dur = Number(/Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr)?.slice(1).reduce((a, v, i) => a + Number(v) * [3600, 60, 1][i], 0));
  const silences = [];
  for (const m of r.stderr.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === 'start') silences.push([Number(m[2]), dur]);
    else if (silences.length) silences[silences.length - 1][1] = Number(m[2]);
  }
  const all = [];
  let t = 0;
  for (const [a, z] of silences) { if (a > t + 0.02) all.push([t, a]); t = z; }
  if (dur > t + 0.02) all.push([t, dur]);
  // Level of each segment (RMS dB, 16 kHz mono is plenty).
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }).stdout;
  const x = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
  const level = ([a, z]) => {
    let e = 0;
    const i0 = Math.floor(a * 16000), i1 = Math.min(x.length, Math.ceil(z * 16000));
    for (let i = i0; i < i1; i++) e += x[i] * x[i];
    return 10 * Math.log10(e / Math.max(1, i1 - i0) + 1e-12);
  };
  const lv = all.map(level);
  const ref = median(lv.filter((_, i) => all[i][1] - all[i][0] > 0.3)) ?? median(lv);
  const segments = all.filter((_, i) => lv[i] >= ref - breathDb);
  const breaths = all.filter((_, i) => lv[i] < ref - breathDb);
  return { duration: dur, segments, breaths };
}
const median = (v) => (v.length ? [...v].sort((p, q) => p - q)[v.length >> 1] : undefined);

// Lay phrases (with weights) over speech segments; returns [{ start, end }].
export function alignPhrases(segments, weights, { pauseBonus = 0.6, innerPause = 1.0 } = {}) {
  let segs = segments.map(([a, z]) => [a, z]);
  const m = weights.length;
  if (!m) return [];
  if (!segs.length) throw new Error('no speech found');
  // Fewer segments than phrases: split the longest ones (a boundary with no pause).
  while (segs.length < m) {
    let j = 0;
    segs.forEach(([a, z], i) => { if (z - a > segs[j][1] - segs[j][0]) j = i; });
    const [a, z] = segs[j], mid = (a + z) / 2;
    segs.splice(j, 1, [a, mid], [mid, z]);
  }
  const k = segs.length;
  const dur = segs.map(([a, z]) => z - a);
  const pre = [0];
  dur.forEach((d) => pre.push(pre[pre.length - 1] + d));
  const gap = segs.slice(0, -1).map(([, z], j) => segs[j + 1][0] - z);
  const gpre = [0];
  gap.forEach((g) => gpre.push(gpre[gpre.length - 1] + innerPause * Math.min(1, Math.max(0, g - 0.45) / 0.5)));
  const W = weights.reduce((a, b) => a + b, 0), D = pre[k];
  const cost = (i, s, e) => {
    const E = (D * weights[i]) / W, d = pre[e + 1] - pre[s];
    return ((d - E) / Math.max(E, 0.25)) ** 2 + (gpre[e] - gpre[s]);
  };
  const bonus = (e) => -pauseBonus * Math.min(1, gap[e] / 0.4); // boundary after segment e
  // f[i][e]: best cost with phrase i ending at segment e.
  const f = Array.from({ length: m }, () => new Float64Array(k).fill(Infinity));
  const from = Array.from({ length: m }, () => new Int32Array(k).fill(-1));
  for (let e = 0; e <= k - m; e++) f[0][e] = cost(0, 0, e);
  for (let i = 1; i < m; i++) {
    for (let e = i; e <= k - m + i; e++) {
      for (let p = i - 1; p < e; p++) {
        if (f[i - 1][p] === Infinity) continue;
        const c = f[i - 1][p] + bonus(p) + cost(i, p + 1, e);
        if (c < f[i][e]) { f[i][e] = c; from[i][e] = p; }
      }
    }
  }
  const ends = new Array(m);
  ends[m - 1] = k - 1;
  for (let i = m - 1; i > 0; i--) ends[i - 1] = from[i][ends[i]];
  return ends.map((e, i) => {
    const s = i ? ends[i - 1] + 1 : 0, z = e;
    return { start: segs[s][0], end: segs[z][1] };
  });
}

// Time every phrase of `lines` ([{ speaker?, text }]) over one recording.
export function alignRecording(file, lines, { at = 0, noise, minSilence } = {}) {
  const { duration, segments } = speechSegments(file, { noise, minSilence });
  const phrases = lines.flatMap((l, li) => splitPhrases(l.text).map((text) => ({ li, text })));
  const times = alignPhrases(segments, phrases.map((p) => weight(p.text)));
  const out = lines.map((l) => ({ speaker: l.speaker ?? 'narrator', text: l.text, phrases: [] }));
  phrases.forEach((p, i) => out[p.li].phrases.push({ text: p.text, start: r2(at + times[i].start), end: r2(at + times[i].end) }));
  for (const l of out) { l.start = l.phrases[0]?.start; l.end = l.phrases[l.phrases.length - 1]?.end; }
  return { at, duration: r2(duration), lines: out.map(({ speaker, text, start, end, phrases: ps }) => ({ speaker, text, start, end, phrases: ps })) };
}

export const r2 = (v) => Math.round(v * 100) / 100;
