// Captions for narrated films: each line of copy that has `beats`
// ([[start, end], ...], one per phrase, text split after ，。！？ etc.) is
// written in character by character as it is spoken; inkText / titleText draw
// any text that way. Lines come from every scene of the active story.
import { W, H, createCanvas } from '../engine.js';
import { clamp, ease } from '../../lib/util.js';
import { activeStory } from '../../story/load.js';

// Caption style: story.json "captions" over these defaults (cream letters with
// a dark glow and a soft dark band, for night scenes).
export const CAP = { size: 56, y: H - 84, font: 'CJKHand', color: '#fff4dc', shadow: 'rgba(6,8,26,0.9)', band: 'rgba(6,8,26,0.42)', ...activeStory().captions };
const PUNCT = /[，。！？、；：,.!?]/;

// Every caption line of the active story with a reveal time per character and
// its fade-out time `out` (default: 1.1 s after the last phrase, or just before
// the next line). Built once, on first use.
let LINES = null;
export function captionLines() {
  if (LINES) return LINES;
  LINES = activeStory().scenes.flatMap((s) => (s.copy?.lines ?? []).filter((l) => l.beats).map((l) => ({ ...l, scene: s.id })))
    .sort((a, b) => a.beats[0][0] - b.beats[0][0]);
  LINES.forEach((l, i) => {
    const chars = [...l.text];
    const phrases = [];
    let cur = [];
    chars.forEach((ch) => { cur.push(ch); if (PUNCT.test(ch)) { phrases.push(cur); cur = []; } });
    if (cur.length) phrases.push(cur);
    if (phrases.length !== l.beats.length) throw new Error(`caption "${l.text}": ${phrases.length} phrases but ${l.beats.length} beats`);
    l.times = [];
    phrases.forEach((ph, k) => {
      const [a, z] = l.beats[k];
      const letters = ph.filter((ch) => !PUNCT.test(ch)).length;
      let j = 0;
      for (const ch of ph) l.times.push(PUNCT.test(ch) ? z : a + ((z - a) * j++) / Math.max(1, letters));
    });
    l.chars = chars;
    const end = l.beats[l.beats.length - 1][1];
    const next = LINES[i + 1]?.beats[0][0] ?? Infinity;
    l.out = l.out ?? Math.min(end + 1.1, next - 0.35);
  });
  return LINES;
}

const glyphCache = new Map();
function glyph(ch, size, font, color, shadow = CAP.shadow) {
  const k = `${ch}|${size}|${font}|${color}|${shadow}`;
  if (glyphCache.has(k)) return glyphCache.get(k);
  const pad = Math.ceil(size * 0.45);
  const m = createCanvas(4, 4).getContext('2d');
  m.font = `${size}px ${font}`;
  const w = Math.ceil(m.measureText(ch).width) + pad * 2, h = Math.ceil(size * 1.4) + pad * 2;
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.font = `${size}px ${font}`;
  x.textBaseline = 'middle';
  x.fillStyle = color;
  if (shadow !== 'none') {
    x.shadowColor = shadow;
    x.shadowBlur = size * 0.22;
    x.fillText(ch, pad, h / 2);
    x.fillText(ch, pad, h / 2);
    x.shadowBlur = 0;
  }
  x.fillText(ch, pad, h / 2);
  const g = { c, pad, adv: m.measureText(ch).width };
  glyphCache.set(k, g);
  return g;
}

// Text whose characters fade/rise in at times[i] (absolute seconds).
export function inkText(ctx, chars, times, x, y, t, { size = 56, font = 'CJKHand', color = '#fff4dc', shadow, alpha = 1, rise = 10, fadeIn = 0.28 } = {}) {
  if (alpha <= 0.01) return;
  const gl = chars.map((ch) => glyph(ch, size, font, color, shadow));
  const total = gl.reduce((a, g) => a + g.adv, 0);
  let cx = x - total / 2;
  ctx.save();
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < chars.length; i++) {
    const u = clamp((t - times[i]) / fadeIn);
    if (u > 0 && chars[i] !== ' ') {
      const g = gl[i];
      ctx.globalAlpha = a0 * alpha * u;
      ctx.drawImage(g.c, cx - g.pad, y - g.c.height / 2 + (1 - ease.outCubic(u)) * rise);
    }
    cx += gl[i].adv;
  }
  ctx.restore();
}

// Title text written over [t0, t0 + dur] (characters appear evenly).
export function titleText(ctx, text, x, y, t, t0, dur, o = {}) {
  const chars = [...text];
  const times = chars.map((_, i) => t0 + (dur * i) / Math.max(1, chars.length - 1));
  inkText(ctx, chars, times, x, y, t, { fadeIn: 0.45, rise: 14, ...o });
}

// Draw the caption lines visible at time t (bottom centre).
export function captions(ctx, t) {
  for (const l of captionLines()) {
    if (t < l.times[0] - 0.05 || t > l.out + 0.4) continue;
    inkText(ctx, l.chars, l.times, W / 2, CAP.y, t, { size: CAP.size, font: CAP.font, color: CAP.color, shadow: CAP.shadow, alpha: 1 - clamp((t - l.out) / 0.4) });
  }
}
