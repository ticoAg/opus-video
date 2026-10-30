// "晚安，小狐狸" (stories/goodnight-little-fox): a procedural watercolour-and-ink
// toolkit. No page photos: the fox, her room and the night outside are drawn
// with canvas paths, translucent washes and a boiling ink line (re-jittered 8x
// a second, like the sketchbook cut-outs). The paper grain is synthesised once
// at load. Also draws the narration captions and the scene fades.
//
// The fox is drawn in a local frame with her base at (0, 0), about 400 units
// tall (ears included) at s = 1.
import { W, H, INK, wash, star, sparkle, heart, createCanvas } from '../../../src/video/engine.js';
import { clamp, hash, noise1, invLerp, lerp, smooth, ease, rng, bezier } from '../../../src/lib/util.js';
import { activeStory } from '../../../src/story/load.js';

export { W, H, INK, wash, star, sparkle, heart, clamp, hash, noise1, invLerp, lerp, smooth, ease };

export const PAL = {
  night: '#121a3a', night2: '#22326a', horizon: '#3f5590', dream: '#1c1745', dream2: '#2f2c72',
  moon: '#fbf0c4', moon2: '#efd992', moonGlow: '255,238,185', star: '#ffe8a3', silver: '207,224,255',
  hillFar: '#3a5383', hillMid: '#2d5472', hillNear: '#284b5d', ground: '#213f4d', front: '#19333f',
  leaf: '#2e5c5a', leaf2: '#3f7870', leafLit: '#79ad9f', trunk: '#4d3d44', bark: '#6b5655',
  water: '#5b8fc2', water2: '#a6cdf0', stone: '#66748e', stone2: '#93a0b8',
  fox: '#ee8a43', foxShade: '#c9622a', cream: '#fff3e0', foxDark: '#4b2e24', earIn: '#f6c0a4',
  nose: '#2a1c18', blush: '#f2959a', mouth: '#7a2f35', tongue: '#f08a9a',
  wall: '#6a4630', wall2: '#4f3322', floor: '#3f281b', wood: '#8a5a36', wood2: '#a8774a',
  lampShade: '#f08a6e', lampLight: '255,200,125', sheet: '#efe4d2', pillow: '#fff7ea',
  lantern: '#ffc45e', lanternGlow: '255,186,92', firefly: '#f6ff9a',
};
const QUILT = ['#f2c14e', '#e9857a', '#7fb8b0', '#a58fd6', '#f4a7b9', '#9cc56b'];
const st8 = (t) => Math.floor(t * 8);

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------
function wobPath(ctx, cx, cy, rx, ry, seed, st, wob = 0.05, n = 26) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wob * noise1(a * 1.6, seed) + 0.014 * (hash(seed, i % n, st) - 0.5);
    const px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

// Wobbly ellipse: watercolour fill (lighter pooled centre) + boiling ink edge.
export function blob(ctx, cx, cy, rx, ry, fill, { t = 0, seed = 1, lw = 4, wob = 0.05, ink = INK, alpha = 1, hi = 0.2 } = {}) {
  const st = st8(t);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (fill) {
    wobPath(ctx, cx, cy, rx, ry, seed, st, wob);
    ctx.fillStyle = fill; ctx.fill();
    if (hi) {
      wobPath(ctx, cx - rx * 0.18, cy - ry * 0.22, rx * 0.55, ry * 0.5, seed + 5, 0, wob * 2);
      ctx.fillStyle = `rgba(255,255,255,${hi})`; ctx.fill();
    }
  }
  if (lw) {
    wobPath(ctx, cx, cy, rx, ry, seed + 1, st, wob);
    ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.stroke();
  }
  ctx.restore();
}

// Smooth path through control points (quadratic through midpoints), boiled.
function smoothPath(ctx, pts, closed, seed, st, jit = 1.4) {
  const p = pts.map(([x, y], i) => [x + (hash(seed, i, st) - 0.5) * jit, y + (hash(seed, i, st, 9) - 0.5) * jit]);
  ctx.beginPath();
  if (closed) {
    const n = p.length;
    const mid = (i) => [(p[i % n][0] + p[(i + 1) % n][0]) / 2, (p[i % n][1] + p[(i + 1) % n][1]) / 2];
    const m0 = mid(n - 1);
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const m = mid(i); ctx.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]); }
    ctx.closePath();
  } else {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      const m = [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
      ctx.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]);
    }
    const l = p[p.length - 1];
    ctx.lineTo(l[0], l[1]);
  }
}

function shapePath(ctx, pts, seed, st, sharp) {
  if (!sharp) return smoothPath(ctx, pts, true, seed, st);
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = x + (hash(seed, i, st) - 0.5) * 1.4, py = y + (hash(seed, i, st, 4) - 0.5) * 1.4;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.closePath();
}

// Filled closed shape (soft corners) + ink outline.
export function shape(ctx, pts, fill, { t = 0, seed = 1, lw = 4, ink = INK, sharp = false, alpha = 1 } = {}) {
  const st = st8(t);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';
  if (fill) { shapePath(ctx, pts, seed, st, sharp); ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { shapePath(ctx, pts, seed, st, sharp); ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.stroke(); }
  ctx.restore();
}

// Clip to the same (boiled) outline `shape` draws. Caller saves/restores.
export function clipShape(ctx, pts, { t = 0, seed = 1, sharp = false } = {}) {
  shapePath(ctx, pts, seed, st8(t), sharp);
  ctx.clip();
}

// Open ink stroke.
export function stroke(ctx, pts, { t = 0, seed = 1, lw = 4, color = INK, alpha = 1, jit = 1.2 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  smoothPath(ctx, pts, false, seed, st8(t), jit);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}

// Thick limb / branch: ink under-stroke then a coloured stroke.
export function limb(ctx, pts, w, color, { t = 0, seed = 1, ink = INK } = {}) {
  const st = st8(t);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  smoothPath(ctx, pts, false, seed, st);
  ctx.lineWidth = w + 7; ctx.strokeStyle = ink; ctx.stroke();
  smoothPath(ctx, pts, false, seed, st);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}

export function dot(ctx, x, y, r, color = INK) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}

// Soft light: a radial gradient, screened on by default.
export function glow(ctx, x, y, r, rgb, a = 1, comp = 'screen') {
  if (a <= 0.003 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = comp;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${0.6 * a})`);
  g.addColorStop(0.3, `rgba(${rgb},${0.25 * a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

// Look at world point (cx, cy) with zoom z.
export function camera(ctx, cx, cy, z = 1) {
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
}

// Camera that zooms from framing `from` ([cx, cy, z]) onto world point
// `target` (zoom zTo) as e goes 0..1, keeping the target on its way to the
// screen centre (zoom is interpolated geometrically). Returns [cx, cy, z].
export function zoomOnto(from, target, zTo, e) {
  const [cx0, cy0, z0] = from, [tx, ty] = target;
  const z = z0 * (zTo / z0) ** e;
  const sx = lerp((tx - cx0) * z0, 0, e), sy = lerp((ty - cy0) * z0, 0, e);
  return [tx - sx / z, ty - sy / z, z];
}

// n points along a cubic bezier.
export function bez(p0, p1, p2, p3, n = 12) {
  return Array.from({ length: n }, (_, i) => bezier(p0, p1, p2, p3, i / (n - 1)));
}

// Outline of a tapered body (a tail) around a centre line, width w(u), u 0..1.
export function taper(pts, w) {
  const n = pts.length, left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const h = w(i / (n - 1)) / 2;
    left.push([pts[i][0] - dy * h, pts[i][1] + dx * h]);
    right.push([pts[i][0] + dy * h, pts[i][1] - dx * h]);
  }
  return [...left, ...right.reverse()];
}

// Control points for a rounded rectangle (for shape / clipShape).
export function rrect(x0, y0, x1, y1, r = 16) {
  return [[x0 + r, y0], [x1 - r, y0], [x1, y0 + r], [x1, y1 - r], [x1 - r, y1], [x0 + r, y1], [x0, y1 - r], [x0, y0 + r]];
}

// Piecewise-linear keyframes: key(t, [[t0, v0], [t1, v1], ...]) with smooth easing.
export function key(t, frames) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [ta, va] = frames[i - 1], [tb, vb] = frames[i];
    if (t < tb) return lerp(va, vb, smooth((t - ta) / (tb - ta)));
  }
  return frames[frames.length - 1][1];
}

// ---------------------------------------------------------------------------
// Paper: synthesised cold-press grain (value noise + emboss + fibres)
// ---------------------------------------------------------------------------
let PAPER = null;
function paperTexture() {
  if (PAPER) return PAPER;
  const PW = 2400, PH = 1400;
  const c = createCanvas(PW, PH);
  const x = c.getContext('2d');
  const img = x.createImageData(PW, PH);
  const d = img.data;
  const R = rng(4242);
  const grid = (cell) => {
    const gw = Math.ceil(PW / cell) + 3, gh = Math.ceil(PH / cell) + 3;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = R() * 2 - 1;
    return { cell, gw, g };
  };
  const sample = ({ cell, gw, g }, px, py) => {
    const fx = px / cell + 1, fy = py / cell + 1, ix = fx | 0, iy = fy | 0;
    let u = fx - ix, v = fy - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const i0 = iy * gw + ix;
    const a = g[i0], b = g[i0 + 1], c2 = g[i0 + gw], e = g[i0 + gw + 1];
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + e) * u * v;
  };
  const oct = [grid(300), grid(80), grid(16), grid(5)];
  const amp = [0.03, 0.018, 0.016, 0.012];
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      let k = 1;
      for (let o = 0; o < 4; o++) k += amp[o] * sample(oct[o], px, py);
      // Tooth: a light-from-top-left emboss of the fine octaves.
      k += 0.05 * (sample(oct[3], px - 1.2, py - 1.2) - sample(oct[3], px + 1.2, py + 1.2));
      k += 0.025 * (sample(oct[2], px - 2, py - 2) - sample(oct[2], px + 2, py + 2));
      k += (R() - 0.5) * 0.03;
      const i = (py * PW + px) * 4;
      d[i] = 252 * k; d[i + 1] = 246 * k; d[i + 2] = 234 * k; d[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  // Fibres.
  x.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const fx = R() * PW, fy = R() * PH, a = R() * Math.PI, l = 6 + R() * 22;
    x.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,96,70,0.07)';
    x.lineWidth = 0.6 + R() * 0.9;
    x.beginPath();
    x.moveTo(fx, fy);
    x.quadraticCurveTo(fx + Math.cos(a) * l * 0.5 + (R() - 0.5) * 6, fy + Math.sin(a) * l * 0.5 + (R() - 0.5) * 6, fx + Math.cos(a) * l, fy + Math.sin(a) * l);
    x.stroke();
  }
  PAPER = c;
  return c;
}

// Lay the paper grain over the frame (multiply), drifting very slowly.
export function grain(ctx, t, alpha = 0.6) {
  const p = paperTexture();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.drawImage(p, -240 - Math.sin(t * 0.05) * 60, -160 - Math.cos(t * 0.04) * 40);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Sky, moon, stars
// ---------------------------------------------------------------------------
// Night sky in screen space with drifting watercolour blooms.
export function sky(ctx, t, { top = PAL.night, mid = PAL.night2, low = PAL.horizon, seed = 1, blooms = 1 } = {}) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 6 * blooms; i++) {
    const bx = hash(seed, i, 1) * W + Math.sin(t * 0.03 + i) * 40, by = hash(seed, i, 2) * H * 0.75;
    wash(ctx, bx, by, 260 + hash(seed, i, 3) * 260, 120 + hash(seed, i, 4) * 120, i % 2 ? '#5a6fb0' : '#0c1230',
      { seed: seed * 10 + i, alpha: 0.13, layers: 4, wobble: 0.22 });
  }
  ctx.restore();
}

// The moon: halo, disc with watercolour craters, optional sleepy face.
// face: 0 none .. 1 drawn; eyes 0 shut .. 1 open; smile 0..1.
export function moon(ctx, x, y, r, t, { glowA = 1, face = 0, eyes = 0, look = 0, seed = 70, rays = 0 } = {}) {
  glow(ctx, x, y, r * 5.5, PAL.moonGlow, 0.5 * glowA);
  glow(ctx, x, y, r * 2.2, PAL.moonGlow, 0.55 * glowA);
  if (rays > 0) {
    // Silver light spreading out: soft rings rippling away from the moon.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.3 + k / 3) % 1;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.15 + 3.2 * ph), 0, Math.PI * 2);
      ctx.lineWidth = r * 0.5 * (1 - ph);
      ctx.strokeStyle = `rgba(${PAL.silver},${0.16 * rays * (1 - ph) ** 1.5})`;
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, x, y, r * 3.2, PAL.silver, 0.35 * rays);
  }
  blob(ctx, x, y, r, r, PAL.moon, { t, seed, lw: Math.max(2.5, r * 0.04), wob: 0.025, hi: 0.25 });
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r * 0.97, 0, Math.PI * 2); ctx.clip();
  wash(ctx, x + r * 0.35, y + r * 0.3, r * 0.5, r * 0.4, PAL.moon2, { seed: seed + 2, alpha: 0.5, layers: 3 });
  wash(ctx, x - r * 0.4, y - r * 0.25, r * 0.22, r * 0.18, PAL.moon2, { seed: seed + 3, alpha: 0.55, layers: 3 });
  wash(ctx, x + r * 0.15, y - r * 0.5, r * 0.14, r * 0.12, PAL.moon2, { seed: seed + 4, alpha: 0.5, layers: 3 });
  ctx.restore();
  if (face > 0) {
    ctx.save();
    ctx.globalAlpha *= face;
    const fx = x - r * 0.12 + look * r * 0.1, fy = y + r * 0.05, lw = Math.max(2.5, r * 0.045);
    for (const s of [-1, 1]) {
      const ex = fx + s * r * 0.3, ey = fy - r * 0.08;
      if (eyes > 0.5) {
        dot(ctx, ex, ey, r * 0.06, INK);
        dot(ctx, ex + r * 0.02, ey - r * 0.025, r * 0.022, '#fff');
      } else stroke(ctx, [[ex - r * 0.13, ey - r * 0.02], [ex, ey + r * 0.08], [ex + r * 0.13, ey - r * 0.02]], { t, seed: seed + 10 + s, lw });
      wash(ctx, ex + s * r * 0.08, ey + r * 0.2, r * 0.11, r * 0.07, '#f4a7a0', { seed: seed + 12 + s, alpha: 0.5, layers: 3 });
    }
    stroke(ctx, [[fx - r * 0.12, fy + r * 0.22], [fx, fy + r * 0.3], [fx + r * 0.12, fy + r * 0.22]], { t, seed: seed + 14, lw });
    ctx.restore();
  }
}

// A hand-drawn star that pops on at t0 and twinkles; k (0..1) scales it.
export function bigStar(ctx, x, y, r, t, t0, { seed = 1, k = 1, glowA = 1 } = {}) {
  if (t < t0) return;
  const p = Math.min(1, popK(t, t0)) * k;
  if (p <= 0.01) return;
  const tw = 1 + 0.08 * Math.sin(t * 2.3 + seed * 1.7);
  glow(ctx, x, y, r * 4 * p, '255,236,170', 0.45 * glowA * p);
  star(ctx, x, y, r * p * tw, { fill: PAL.star, rot: Math.sin(t * 0.7 + seed) * 0.12, seed, t, lw: Math.max(2, r * 0.13) });
  // pop sparkle
  const u = t - t0;
  if (u < 0.6) sparkle(ctx, x + r * 0.9, y - r * 0.9, r * 0.9 * Math.sin(Math.PI * u / 0.6), { alpha: 1 - u / 0.6, rot: u * 3 });
}
// Pop-in (overshoot) scale.
export function popK(t, t0, dur = 0.55) {
  if (t < t0) return 0;
  const u = (t - t0) / dur;
  if (u >= 1) return 1;
  return 1 - Math.exp(-6 * u) * Math.cos(2 * Math.PI * 1.35 * u) * (1 - u);
}

// Tiny twinkling pin-prick stars in a rect; `amount` 0..1 lights them in turn.
export function starDust(ctx, t, x0, y0, x1, y1, { n = 90, seed = 5, amount = 1 } = {}) {
  ctx.save();
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const on = clamp((amount * n - i) / 6);
    if (on <= 0) continue;
    const x = x0 + hash(seed, i, 1) * (x1 - x0), y = y0 + hash(seed, i, 2) * (y1 - y0);
    const tw = 0.55 + 0.45 * Math.sin(t * (1.2 + hash(seed, i, 3) * 2) + i);
    const r = 1.2 + hash(seed, i, 4) * 2.4;
    ctx.globalAlpha = a0 * on * tw;
    dot(ctx, x, y, r, '#fff6d8');
    if (r > 2.8) { ctx.globalAlpha = a0 * on * tw * 0.35; dot(ctx, x, y, r * 2.6, '#fff6d8'); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Land: ridges, trees, the tree house, the brook
// ---------------------------------------------------------------------------
// Ridge line points across [x0, x1].
export function ridge(x0, x1, base, amp, seed, step = 40, f = 0.004) {
  const pts = [];
  for (let x = x0; x <= x1; x += step) pts.push([x, base + amp * noise1(x * f, seed) + amp * 0.45 * noise1(x * f * 3.1, seed + 7)]);
  return pts;
}

// A hill band: fill under the ridge down to `bottom`, ink on the ridge, and a
// silver moonlit rim (rim 0..1) that can be revealed left-to-right up to `front`.
export function hill(ctx, pts, bottom, fill, t, { seed = 1, rim = 0, front = Infinity, lw = 3.5 } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], bottom);
  for (const [x, y] of pts) ctx.lineTo(x, y + (hash(seed, x, st8(t)) - 0.5) * 1.2);
  ctx.lineTo(pts[pts.length - 1][0], bottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const p = pts[Math.floor(hash(seed, i, 1) * pts.length)];
    wash(ctx, p[0], p[1] + 60, 220, 70, i % 2 ? '#0e1f2c' : '#4f7899', { seed: seed * 7 + i, alpha: 0.18, layers: 3 });
  }
  ctx.restore();
  stroke(ctx, pts, { t, seed, lw, color: INK, alpha: 0.85 });
  if (rim > 0) {
    const lit = pts.filter(([x]) => x <= front);
    if (lit.length > 1) stroke(ctx, lit.map(([x, y]) => [x, y + 4]), { t, seed: seed + 1, lw: 5, color: `rgba(${PAL.silver},${0.75 * rim})` });
  }
  ctx.restore();
}

// Round tree: trunk + clustered foliage. sway 0..1 shakes the leaves ("talking").
export function roundTree(ctx, x, y, h, t, { seed = 1, sway = 0, lit = 0.5, color = PAL.leaf } = {}) {
  const s = h / 300;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const bend = Math.sin(t * 1.3 + seed) * 4 * (0.3 + sway);
  limb(ctx, [[0, 0], [2, -70], [bend * 0.5, -150]], 26, PAL.trunk, { t, seed: seed + 1 });
  const lumps = [[0, -210, 95, 80], [-62, -175, 62, 52], [62, -172, 64, 54], [-30, -255, 58, 48], [36, -250, 60, 50]];
  lumps.forEach(([lx, ly, rx, ry], i) => {
    const jx = sway * (Math.sin(t * 9 + i * 2 + seed) * 3 + (hash(seed, i, st8(t)) - 0.5) * 3);
    const cx = lx + bend + jx, cy = ly + jx * 0.5;
    blob(ctx, cx, cy, rx, ry, i ? PAL.leaf2 : color, { t, seed: seed + 10 + i, lw: 0, wob: 0.09, hi: 0 });
    if (lit > 0) {
      // Moonlit top, kept inside the lump.
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.95, ry * 0.95, 0, 0, Math.PI * 2); ctx.clip();
      wash(ctx, cx - rx * 0.2, cy - ry * 0.5, rx * 0.6, ry * 0.32, PAL.leafLit, { seed: seed + 20 + i, alpha: 0.6 * lit, layers: 3 });
      ctx.restore();
    }
    blob(ctx, cx, cy, rx, ry, null, { t, seed: seed + 10 + i, lw: 3.5, wob: 0.09 });
  });
  ctx.restore();
}

// Pine: stacked soft triangles.
export function pine(ctx, x, y, h, t, { seed = 1, sway = 0, lit = 0.5 } = {}) {
  const s = h / 300;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  limb(ctx, [[0, 0], [0, -60]], 18, PAL.trunk, { t, seed: seed + 1 });
  for (let i = 0; i < 3; i++) {
    const w = 110 - i * 28, yb = -40 - i * 75, top = yb - 120;
    const jx = sway * Math.sin(t * 8 + i + seed) * 3;
    const tier = [[-w, yb], [-w * 0.35 + jx, yb - 50], [jx, top], [w * 0.35 + jx, yb - 50], [w, yb], [0, yb + 12]];
    shape(ctx, tier, PAL.leaf, { t, seed: seed + 5 + i, lw: 0 });
    if (lit > 0) {
      ctx.save();
      clipShape(ctx, tier, { t, seed: seed + 5 + i });
      wash(ctx, -w * 0.3 + jx, yb - 45, w * 0.45, 30, PAL.leafLit, { seed: seed + 9 + i, alpha: 0.45 * lit, layers: 3 });
      ctx.restore();
    }
    shape(ctx, tier, null, { t, seed: seed + 5 + i, lw: 3.5 });
  }
  ctx.restore();
}

// The fox's home: a big old tree with a round lit window and a little door.
export function treeHouse(ctx, x, y, s, t, { light = 1, seed = 500, sway = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Crown behind.
  const crown = [[0, -560, 230, 150], [-170, -470, 140, 110], [170, -470, 150, 115], [-90, -640, 130, 100], [110, -640, 140, 100], [0, -720, 120, 80]];
  crown.forEach(([cx, cy, rx, ry], i) => {
    const jx = sway * Math.sin(t * 8 + i) * 3;
    blob(ctx, cx + jx, cy, rx, ry, i % 2 ? PAL.leaf2 : PAL.leaf, { t, seed: seed + i, lw: 0, wob: 0.1, hi: 0 });
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx + jx, cy, rx * 0.95, ry * 0.95, 0, 0, Math.PI * 2); ctx.clip();
    wash(ctx, cx - rx * 0.25 + jx, cy - ry * 0.5, rx * 0.55, ry * 0.28, PAL.leafLit, { seed: seed + 10 + i, alpha: 0.4, layers: 3 });
    ctx.restore();
    blob(ctx, cx + jx, cy, rx, ry, null, { t, seed: seed + i, lw: 4, wob: 0.1 });
  });
  // Trunk with root flares.
  const trunk = [[-150, 0], [-110, -30], [-95, -200], [-105, -380], [-60, -440], [60, -440], [105, -380], [95, -200], [110, -30], [150, 0], [60, 10], [-60, 10]];
  shape(ctx, trunk, PAL.bark, { t, seed: seed + 20, lw: 4.5 });
  ctx.save();
  clipShape(ctx, trunk, { t, seed: seed + 20 });
  for (let i = 0; i < 7; i++) stroke(ctx, [[-80 + i * 26, -20], [-76 + i * 26 + Math.sin(i) * 8, -220], [-82 + i * 26, -430]], { t, seed: seed + 30 + i, lw: 2.5, color: 'rgba(40,26,30,0.45)' });
  wash(ctx, 60, -220, 50, 200, '#2c2230', { seed: seed + 21, alpha: 0.35, layers: 3 });
  ctx.restore();
  // Round window with warm light.
  const wy = -250;
  glow(ctx, 0, wy, 260, PAL.lampLight, 0.55 * light);
  blob(ctx, 0, wy, 58, 58, '#3a2a2a', { t, seed: seed + 40, lw: 0, hi: 0 });
  blob(ctx, 0, wy, 50, 50, light > 0.02 ? `rgba(255,214,140,${0.25 + 0.75 * light})` : '#2a2440', { t, seed: seed + 41, lw: 0, hi: 0 });
  glow(ctx, 0, wy, 70, '255,230,170', 0.6 * light);
  limb(ctx, [[0, wy - 50], [0, wy + 50]], 7, PAL.wood, { t, seed: seed + 42 });
  limb(ctx, [[-50, wy], [50, wy]], 7, PAL.wood, { t, seed: seed + 43 });
  blob(ctx, 0, wy, 58, 58, null, { t, seed: seed + 44, lw: 10, ink: PAL.wood });
  blob(ctx, 0, wy, 64, 64, null, { t, seed: seed + 45, lw: 3.5 });
  // Little arched door.
  shape(ctx, [[-62, 4], [-62, -70], [-40, -102], [-10, -112], [16, -100], [30, -70], [30, 4]], '#8a5a36', { t, seed: seed + 50, lw: 4 });
  dot(ctx, 16, -48, 5, '#f2c14e');
  // Door lamp.
  glow(ctx, 52, -110, 70, PAL.lampLight, 0.7 * light);
  blob(ctx, 52, -110, 9, 12, '#ffd98a', { t, seed: seed + 51, lw: 2.5 });
  ctx.restore();
}

// A brook ribbon along control points (far end first), widening toward us.
export function brookPath(pts, n = 60) {
  // Catmull-Rom through the points.
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * (pts.length - 1);
    const k = Math.min(pts.length - 2, Math.floor(u)), f = u - k;
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
    const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f * f * f);
    out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}
export function brook(ctx, line, t, { w0 = 10, w1 = 190, flow = 1, seed = 600, shine = 0 } = {}) {
  const width = (u) => lerp(w0, w1, u ** 1.4);
  const outline = taper(line, width);
  shape(ctx, outline, PAL.water, { t, seed, lw: 0 });
  ctx.save();
  clipShape(ctx, outline, { t, seed });
  // Darker deep middle, lighter shallows.
  for (let i = 0; i < 8; i++) {
    const p = line[Math.floor((i / 8) * line.length)];
    wash(ctx, p[0], p[1], width(i / 8) * 0.8, width(i / 8) * 0.3, i % 2 ? '#3d6fa3' : PAL.water2, { seed: seed + i, alpha: 0.25, layers: 3 });
  }
  // Moving ripples (flow away from us = toward the far end).
  ctx.lineCap = 'round';
  for (let k = 0; k < 26; k++) {
    let u = (hash(seed, k, 1) + 1 - ((t * 0.05 * flow) % 1)) % 1;
    const i = Math.floor(u * (line.length - 1));
    const p = line[i], q = line[Math.min(line.length - 1, i + 1)];
    const ww = width(u) * (hash(seed, k, 2) - 0.5) * 0.7;
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const cx = p[0] + nx * ww, cy = p[1] + ny * ww;
    const len = 8 + width(u) * 0.25;
    ctx.strokeStyle = `rgba(230,242,255,${0.55 * Math.sin(Math.PI * ((u * 7) % 1))})`;
    ctx.lineWidth = 1.5 + width(u) * 0.025;
    ctx.beginPath(); ctx.moveTo(cx - dx / l * len, cy - dy / l * len); ctx.lineTo(cx + dx / l * len, cy + dy / l * len); ctx.stroke();
  }
  // A sheen sweeping along the water (shine 0..1 = position).
  if (shine > 0 && shine < 1) {
    const i = Math.floor((1 - shine) * (line.length - 1));
    const p = line[i];
    glow(ctx, p[0], p[1], 40 + width(1 - shine), PAL.silver, 0.8);
  }
  ctx.restore();
  // Banks.
  const half = Math.floor(outline.length / 2);
  stroke(ctx, outline.slice(0, half), { t, seed: seed + 20, lw: 3.5 });
  stroke(ctx, outline.slice(half), { t, seed: seed + 21, lw: 3.5 });
}
export function stone(ctx, x, y, rx, ry, t, { seed = 1 } = {}) {
  blob(ctx, x, y, rx, ry, PAL.stone, { t, seed, lw: 3.5, wob: 0.12, hi: 0 });
  wash(ctx, x - rx * 0.2, y - ry * 0.4, rx * 0.55, ry * 0.3, PAL.stone2, { seed: seed + 3, alpha: 0.6, layers: 3 });
  // Little white water curl on the upstream side.
  stroke(ctx, [[x - rx * 0.9, y - ry * 0.7], [x - rx * 0.2, y - ry * 1.3], [x + rx * 0.7, y - ry * 0.8]], { t, seed: seed + 4, lw: 2.5, color: 'rgba(235,245,255,0.75)' });
}

// ---------------------------------------------------------------------------
// Little things: lanterns, fireflies, notes, clouds, wind, zzz
// ---------------------------------------------------------------------------
export function lantern(ctx, x, y, s, t, { lit = 1, seed = 1, string = 60 } = {}) {
  const sw = Math.sin(t * 1.4 + seed) * 0.08;
  ctx.save();
  ctx.translate(x, y - string * s);
  ctx.rotate(sw);
  stroke(ctx, [[0, 0], [0, string * s]], { t, seed, lw: 2, color: 'rgba(20,20,30,0.8)' });
  ctx.translate(0, string * s);
  ctx.scale(s, s);
  glow(ctx, 0, 22, 120, PAL.lanternGlow, lit);
  shape(ctx, [[-8, 0], [8, 0], [8, 6], [-8, 6]], '#5a3a2a', { t, seed: seed + 1, lw: 2.5, sharp: true });
  blob(ctx, 0, 24, 22, 20, lit > 0.05 ? PAL.lantern : '#8a7a62', { t, seed: seed + 2, lw: 3, hi: 0.35 });
  stroke(ctx, [[0, 5], [-8, 24], [0, 43]], { t, seed: seed + 3, lw: 1.6, color: 'rgba(120,60,20,0.6)' });
  stroke(ctx, [[0, 5], [8, 24], [0, 43]], { t, seed: seed + 4, lw: 1.6, color: 'rgba(120,60,20,0.6)' });
  shape(ctx, [[-6, 42], [6, 42], [6, 48], [-6, 48]], '#5a3a2a', { t, seed: seed + 5, lw: 2.5, sharp: true });
  stroke(ctx, [[0, 48], [0, 60]], { t, seed: seed + 6, lw: 2, color: '#d9534f' });
  glow(ctx, 0, 24, 34, '255,240,200', lit * 0.9);
  ctx.restore();
}

export function firefly(ctx, x, y, t, { alpha = 1, seed = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const pulse = 0.75 + 0.25 * Math.sin(t * 9 + seed);
  glow(ctx, x, y, 110 * pulse, '230,255,140', 1);
  const flap = Math.sin(t * 40 + seed) * 0.5;
  for (const s of [-1, 1]) blob(ctx, x + s * 12, y - 12, 12, 7 + flap * 3, 'rgba(220,235,255,0.75)', { t, seed: seed + s, lw: 2, hi: 0 });
  blob(ctx, x, y, 11, 9, PAL.firefly, { t, seed: seed + 3, lw: 2.5 });
  glow(ctx, x, y, 26, '255,255,210', 1);
  ctx.restore();
}

// A music note glyph (♪ or ♫), ink with a cream fill.
export function note(ctx, x, y, s, t, { kind = 1, alpha = 1, seed = 1, rot = 0, color = '#fff6dc' } = {}) {
  if (alpha <= 0.01 || s <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  glow(ctx, 0, -20, 60, '230,240,255', 0.35);
  const head = (hx, hy) => {
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.4);
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  };
  if (kind === 1) {
    stroke(ctx, [[9, -2], [9, -52]], { t, seed, lw: 3.5 });
    stroke(ctx, [[9, -52], [24, -38], [20, -22]], { t, seed: seed + 1, lw: 3.5 });
    head(0, 0);
  } else {
    stroke(ctx, [[0, 0], [0, -48]], { t, seed, lw: 3.5 });
    stroke(ctx, [[30, -8], [30, -56]], { t, seed: seed + 1, lw: 3.5 });
    limb(ctx, [[0, -48], [30, -56]], 4, color, { t, seed: seed + 2 });
    head(-9, 2); head(21, -6);
  }
  ctx.restore();
}

// A soft cloud puff (cluster of blobs).
export function cloud(ctx, x, y, w, h, t, { seed = 1, fill = '#f3f1ff', alpha = 1, lw = 3.5 } = {}) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const parts = [[0, 0, 0.5, 0.55], [-0.32, 0.12, 0.3, 0.38], [0.32, 0.1, 0.32, 0.4], [-0.12, -0.25, 0.3, 0.38], [0.18, -0.22, 0.28, 0.35]];
  for (const pass of [0, 1]) {
    parts.forEach(([px, py, rx, ry], i) => {
      const wb = Math.sin(t * 1.3 + i + seed) * 0.02;
      blob(ctx, x + px * w, y + py * h, rx * w * (1 + wb), ry * h * (1 - wb), pass ? fill : null,
        { t, seed: seed + i, lw: pass ? 0 : lw, wob: 0.06, hi: pass ? 0.25 : 0 });
    });
  }
  ctx.restore();
}

// Tiny doodles that live in the fox's thought clouds.
export function doodle(ctx, kind, x, y, s, t, seed = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (kind === 'acorn') {
    blob(ctx, 0, 8, 16, 20, '#c98a4b', { t, seed, lw: 3 });
    shape(ctx, [[-20, -6], [20, -6], [16, -18], [-16, -18]], '#7a5232', { t, seed: seed + 1, lw: 3 });
    stroke(ctx, [[0, -18], [4, -28]], { t, seed: seed + 2, lw: 3 });
  } else if (kind === 'leaf') {
    shape(ctx, [[-24, 14], [-10, -10], [20, -22], [12, 6]], '#8cc26b', { t, seed, lw: 3 });
    stroke(ctx, [[-24, 14], [14, -14]], { t, seed: seed + 1, lw: 2.5 });
  } else if (kind === 'butterfly') {
    const f = Math.abs(Math.sin(t * 6 + seed)) * 0.5 + 0.5;
    for (const sd of [-1, 1]) {
      blob(ctx, sd * 13 * f, -6, 13 * f, 12, '#f4a7b9', { t, seed: seed + sd, lw: 2.5 });
      blob(ctx, sd * 10 * f, 10, 9 * f, 8, '#a58fd6', { t, seed: seed + 3 + sd, lw: 2.5 });
    }
    stroke(ctx, [[0, -14], [0, 16]], { t, seed: seed + 5, lw: 3.5 });
  } else if (kind === 'fish') {
    shape(ctx, [[-22, 0], [-4, -14], [16, -6], [28, -14], [24, 0], [28, 14], [16, 6], [-4, 14]], '#7fb8e0', { t, seed, lw: 3 });
    dot(ctx, -10, -3, 3);
  } else if (kind === 'berry') {
    blob(ctx, -8, 6, 12, 12, '#e0505a', { t, seed, lw: 3 });
    blob(ctx, 9, 8, 11, 11, '#e0505a', { t, seed: seed + 1, lw: 3 });
    shape(ctx, [[-4, -8], [12, -18], [6, -4]], '#8cc26b', { t, seed: seed + 2, lw: 2.5 });
  }
  ctx.restore();
}

// A wind curl: a line with a spiral at its head, revealed by `progress`.
export function swirl(ctx, x, y, s, t, { progress = 1, alpha = 1, seed = 1, color = 'rgba(225,235,255,0.85)' } = {}) {
  if (alpha <= 0.01 || progress <= 0) return;
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    if (u < 0.6) pts.push([-200 + u / 0.6 * 200, Math.sin(u * 9 + seed) * 8]);
    else {
      const a = (u - 0.6) / 0.4 * Math.PI * 1.7, r = 34 * (1 - (u - 0.6) / 0.4 * 0.7);
      pts.push([Math.sin(a) * r, -r + Math.cos(a) * r]);
    }
  }
  const n = Math.max(2, Math.floor(pts.length * progress));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  stroke(ctx, pts.slice(0, n), { t, seed, lw: 4, color, alpha });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The little fox
// ---------------------------------------------------------------------------
const HEAD = [[0, -76], [46, -68], [76, -40], [86, -6], [102, 26], [72, 34], [58, 52], [30, 66], [0, 72], [-30, 66], [-58, 52], [-72, 34], [-102, 26], [-86, -6], [-76, -40], [-46, -68]];
const MASK = [[-100, 26], [-70, 8], [-42, 16], [-16, 6], [0, 14], [16, 6], [42, 16], [70, 8], [100, 26], [72, 34], [58, 52], [30, 66], [0, 72], [-30, 66], [-58, 52], [-72, 34]];
const EAR = [[-30, 12], [-16, -40], [-5, -86], [5, -86], [16, -40], [30, 12]];
const BLANKET = [[-52, -184], [-100, -158], [-128, -98], [-146, -26], [-152, 2], [-60, 8], [0, 6], [60, 8], [152, 2], [146, -26], [128, -98], [100, -158], [52, -184], [0, -192]];

// Patchwork quilt fill with stitches, clipped to pts, plus an ink outline.
export function quilt(ctx, pts, t, seed, { cell = 54, rot = -0.14, lw = 4.5 } = {}) {
  ctx.save();
  clipShape(ctx, pts, { t, seed });
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + cell;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const n = Math.ceil(R / cell);
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      ctx.fillStyle = QUILT[Math.floor(hash(seed, i, j) * QUILT.length)];
      ctx.fillRect(i * cell, j * cell, cell + 0.6, cell + 0.6);
    }
  }
  for (let k = 0; k < 5; k++) {
    wash(ctx, (hash(seed, k, 1) - 0.5) * R, (hash(seed, k, 2) - 0.5) * R, cell * 1.3, cell, '#ffffff', { seed: seed + k, alpha: 0.12, layers: 3 });
  }
  ctx.strokeStyle = 'rgba(255,248,232,0.85)';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([7, 6]);
  for (let i = -n; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, -R); ctx.lineTo(i * cell, R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R, i * cell); ctx.lineTo(R, i * cell); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.rotate(-rot);
  // Fold shadow on one side for volume.
  wash(ctx, R * 0.45, R * 0.1, R * 0.4, R * 0.9, '#3a2448', { seed: seed + 9, alpha: 0.2, layers: 4 });
  ctx.restore();
  shape(ctx, pts, null, { t, seed, lw });
}

function eye(ctx, x, y, o) {
  const { t, seed, lids = 0, sleep = false, yawn = 0, side } = o;
  if (sleep || lids >= 0.96) {
    stroke(ctx, [[x - 11, y - 2], [x, y + 6], [x + 11, y - 2]], { t, seed, lw: 3.6 });
    stroke(ctx, [[x + side * 10, y - 1], [x + side * 15, y - 5]], { t, seed: seed + 1, lw: 2.4 });
    return;
  }
  if (yawn > 0.35) {
    stroke(ctx, [[x - 11, y + 3], [x, y - 5], [x + 11, y + 3]], { t, seed, lw: 3.6 });
    return;
  }
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, 9, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = PAL.nose; ctx.fill();
  dot(ctx, x + 3, y - 4.5, 3.3, '#fff');
  dot(ctx, x - 2.5, y + 4.5, 1.5, 'rgba(255,255,255,0.65)');
  if (lids > 0.02) {
    ctx.beginPath(); ctx.ellipse(x, y, 11, 14, 0, 0, Math.PI * 2); ctx.clip();
    const ly = y - 14 + 28 * lids;
    ctx.fillStyle = PAL.fox;
    ctx.fillRect(x - 13, y - 16, 26, ly - (y - 16));
    ctx.restore();
    ctx.save();
    stroke(ctx, [[x - 11, ly - 1], [x, ly + 1.5], [x + 11, ly - 1]], { t, seed, lw: 3 });
  }
  ctx.restore();
}

// Head in local coords (centre 0,0, ~80 radius).
function foxHead(ctx, o) {
  const { t, seed = 31, look = 0, up = 0, lids = 0, sleep = false, yawn = 0, blush = 0.4, twitch = 0, droop = 0 } = o;
  const lx = look * 12, ly = -up * 7;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 46, -50);
    ctx.rotate(s * (0.32 + droop * 0.4) - (s > 0 ? twitch * 0.35 : 0));
    shape(ctx, EAR, PAL.fox, { t, seed: seed + 2 + s, lw: 0 });
    ctx.save();
    clipShape(ctx, EAR, { t, seed: seed + 2 + s });
    ctx.fillStyle = PAL.foxDark;
    ctx.fillRect(-40, -100, 80, 50);
    ctx.restore();
    shape(ctx, [[-15, 8], [-6, -42], [6, -42], [15, 8]], PAL.earIn, { t, seed: seed + 5 + s, lw: 0 });
    shape(ctx, EAR, null, { t, seed: seed + 2 + s, lw: 4 });
    ctx.restore();
  }
  shape(ctx, HEAD, PAL.fox, { t, seed, lw: 0 });
  ctx.save();
  clipShape(ctx, HEAD, { t, seed });
  wash(ctx, -24, -52, 64, 30, PAL.foxShade, { seed: seed + 7, alpha: 0.3, layers: 3 });
  ctx.translate(lx * 0.5, 0);
  shape(ctx, MASK, PAL.cream, { t, seed: seed + 8, lw: 0 });
  ctx.restore();
  shape(ctx, HEAD, null, { t, seed, lw: 4.5 });
  for (const s of [-1, 1]) wash(ctx, s * 50 + lx * 0.6, 30, 16, 10, PAL.blush, { seed: seed + 10 + s, alpha: blush, layers: 3 });
  for (const s of [-1, 1]) eye(ctx, s * 32 + lx, -8 + ly, { t, seed: seed + 12 + s, lids, sleep, yawn, side: s });
  const nx = lx * 1.15, ny = 36 + ly * 0.4;
  shape(ctx, [[nx - 11, ny - 5], [nx + 11, ny - 5], [nx, ny + 7]], PAL.nose, { t, seed: seed + 15, lw: 2.5 });
  dot(ctx, nx - 3, ny - 3, 2.3, 'rgba(255,255,255,0.7)');
  if (yawn > 0.05) {
    const k = yawn;
    blob(ctx, nx, ny + 21 + 7 * k, 8 + 7 * k, 4 + 15 * k, PAL.mouth, { t, seed: seed + 16, lw: 3, hi: 0 });
    blob(ctx, nx, ny + 27 + 13 * k, 5 + 4 * k, 2 + 5 * k, PAL.tongue, { t, seed: seed + 17, lw: 0, hi: 0 });
  } else if (sleep) {
    stroke(ctx, [[nx - 12, ny + 13], [nx, ny + 19], [nx + 12, ny + 13]], { t, seed: seed + 18, lw: 3 });
  } else {
    stroke(ctx, [[nx, ny + 6], [nx, ny + 11]], { t, seed: seed + 19, lw: 2.6 });
    stroke(ctx, [[nx - 13, ny + 12], [nx - 6, ny + 17], [nx, ny + 11]], { t, seed: seed + 20, lw: 2.8 });
    stroke(ctx, [[nx, ny + 11], [nx + 6, ny + 17], [nx + 13, ny + 12]], { t, seed: seed + 21, lw: 2.8 });
  }
}

function tail(ctx, centre, width, t, seed, tipU = 0.78) {
  const outline = taper(centre, width);
  shape(ctx, outline, PAL.fox, { t, seed, lw: 0 });
  ctx.save();
  clipShape(ctx, outline, { t, seed });
  const tip = centre[centre.length - 1], before = centre[Math.floor(centre.length * tipU)];
  const r = Math.hypot(tip[0] - before[0], tip[1] - before[1]) + 18;
  blob(ctx, tip[0], tip[1], r, r, PAL.cream, { t, seed: seed + 1, lw: 0, hi: 0 });
  const mid = centre[Math.floor(centre.length * 0.35)];
  wash(ctx, mid[0], mid[1] + 10, 50, 22, PAL.foxShade, { seed: seed + 2, alpha: 0.3, layers: 3 });
  ctx.restore();
  shape(ctx, outline, null, { t, seed, lw: 4.5 });
}

// o: { x, y, s, t, pose: 'sit' | 'curl', look (-1..1), up (0..1), lids (0..1),
//      sleep, yawn (0..1), breath (radians), breathAmp, tilt, blush,
//      twitch (0..1), snug (0..1, blanket pulled tight), face (1 / -1 mirror) }
export function fox(ctx, o) {
  const { x, y, s = 1, face = 1, pose = 'sit' } = o;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);
  ctx.save();
  ctx.fillStyle = 'rgba(20,10,10,0.18)';
  ctx.beginPath(); ctx.ellipse(10, 4, pose === 'sit' ? 170 : 220, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (pose === 'curl') foxCurl(ctx, o);
  else foxSit(ctx, o);
  ctx.restore();
}

function foxSit(ctx, o) {
  const { t, seed = 31, breath = 0, breathAmp = 1, snug = 0, tilt = 0 } = o;
  const b = Math.sin(breath) * breathAmp;
  // Tail behind, sweeping round to the front.
  ctx.save();
  ctx.translate(80, -24);
  ctx.rotate(Math.sin(t * 0.9) * 0.04);
  tail(ctx, bez([0, 0], [90, 40], [190, 20], [196, -112], 16),
    (u) => 74 * Math.pow(Math.sin(Math.PI * (0.12 + 0.86 * u)), 0.55) + 6, t, seed + 40);
  ctx.restore();
  // Blanket body (breathing; pulled snug when cosy).
  ctx.save();
  ctx.scale((1 - 0.006 * b) * (1 - 0.05 * snug), 1 + 0.022 * b);
  quilt(ctx, BLANKET, t, seed + 50);
  blob(ctx, 0, -182, 62, 17, '#fbe3b0', { t, seed: seed + 51, lw: 4 });
  for (const sd of [-1, 1]) {
    const py = -112 + (sd > 0 ? 4 : 0) - snug * 18;
    blob(ctx, sd * (30 - snug * 8), py, 19, 15, PAL.fox, { t, seed: seed + 52 + sd, lw: 3.5 });
    stroke(ctx, [[sd * (30 - snug * 8) - 5, py + 5], [sd * (30 - snug * 8) - 4, py + 12]], { t, seed: seed + 55 + sd, lw: 2.2 });
    stroke(ctx, [[sd * (30 - snug * 8) + 5, py + 5], [sd * (30 - snug * 8) + 6, py + 12]], { t, seed: seed + 57 + sd, lw: 2.2 });
  }
  ctx.restore();
  ctx.save();
  ctx.translate(0, -258 - 5.5 * b);
  ctx.rotate(tilt);
  foxHead(ctx, o);
  ctx.restore();
}

function foxCurl(ctx, o) {
  const { t, seed = 31, breath = 0, breathAmp = 1, tilt = 0 } = o;
  const b = Math.sin(breath) * breathAmp;
  ctx.save();
  ctx.scale(1 + 0.008 * b, 1 + 0.03 * b);
  blob(ctx, 105, -76, 72, 60, PAL.fox, { t, seed: seed + 61, lw: 4, wob: 0.04 });
  blob(ctx, 10, -66, 160, 70, PAL.fox, { t, seed: seed + 60, lw: 4.5, wob: 0.04 });
  quilt(ctx, [[-96, -104], [-50, -146], [30, -158], [118, -146], [182, -100], [204, -36], [190, -10], [140, -26], [70, -50], [0, -64], [-70, -74]], t, seed + 62);
  tail(ctx, bez([168, -24], [120, 24], [-40, 30], [-196, -14], 16),
    (u) => 62 * Math.pow(Math.sin(Math.PI * (0.08 + 0.9 * u)), 0.5) + 8, t, seed + 64);
  blob(ctx, -150, -22, 22, 14, PAL.fox, { t, seed: seed + 66, lw: 3.5 });
  blob(ctx, -112, -16, 21, 13, PAL.fox, { t, seed: seed + 67, lw: 3.5 });
  ctx.restore();
  ctx.save();
  ctx.translate(-128, -84 - 3.5 * b);
  ctx.rotate(-0.3 + tilt);
  ctx.scale(0.9, 0.9);
  foxHead(ctx, { ...o, sleep: o.sleep ?? true, droop: o.droop ?? 0.7, look: 0, up: 0 });
  ctx.restore();
}

// "z z z" drifting up from a sleeper.
export function zzz(ctx, x, y, t, t0, { alpha = 1, size = 64 } = {}) {
  if (t < t0 || alpha <= 0) return;
  ctx.save();
  const a0 = ctx.globalAlpha;
  ctx.font = `${size}px Brush`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const u = ((t - t0) / 3.6 + i / 3) % 1;
    const born = t0 + i * 1.2;
    if (t < born) continue;
    ctx.globalAlpha = a0 * Math.sin(Math.PI * u) * alpha;
    ctx.fillStyle = '#fff3d6';
    ctx.save();
    ctx.translate(x + u * 70 + Math.sin(u * 6 + i) * 12, y - u * 150);
    ctx.rotate(-0.2 + Math.sin(u * 4) * 0.15);
    ctx.scale(0.6 + u * 0.7, 0.6 + u * 0.7);
    ctx.fillText('z', 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The room inside the tree house (z = 1 frame), with its round window
// ---------------------------------------------------------------------------
export const ROOM = { win: [1250, 395, 250], bedY: 772, lamp: [318, 585] };

// o: { lamp 0..1, view: windowView options }
export function room(ctx, t, o = {}) {
  const lamp = o.lamp ?? 1;
  const g = ctx.createLinearGradient(0, -200, 0, H);
  g.addColorStop(0, '#3e281b'); g.addColorStop(0.5, PAL.wall); g.addColorStop(0.9, PAL.wall2);
  ctx.fillStyle = g;
  ctx.fillRect(-600, -400, W + 1200, H + 800);
  // Planks and knots.
  for (let i = 0; i < 14; i++) {
    const px = -380 + i * 190 + hash(i, 3) * 30;
    stroke(ctx, [[px, -300], [px + 6, 300], [px - 4, 905]], { t, seed: 300 + i, lw: 3, color: 'rgba(30,18,10,0.5)' });
    wash(ctx, px + 95, 200 + hash(i, 5) * 500, 60, 260, i % 2 ? '#7c5538' : '#4a2f1f', { seed: 320 + i, alpha: 0.18, layers: 3 });
    if (hash(i, 7) > 0.5) blob(ctx, px + 60 + hash(i, 8) * 70, 160 + hash(i, 9) * 520, 9, 14, '#4a2f1f', { t, seed: 340 + i, lw: 2.5, hi: 0 });
  }
  // A little framed moon picture.
  shape(ctx, [[560, 170], [740, 170], [740, 330], [560, 330]], '#e9dcc2', { t, seed: 360, lw: 4, sharp: true });
  blob(ctx, 650, 250, 54, 54, null, { t, seed: 361, lw: 12, ink: PAL.wood2 });
  blob(ctx, 650, 250, 34, 34, PAL.moon, { t, seed: 362, lw: 2.5 });
  star(ctx, 700, 205, 12, { fill: PAL.star, seed: 363, t, lw: 2 });
  shape(ctx, [[548, 158], [752, 158], [752, 342], [548, 342]], null, { t, seed: 364, lw: 14, sharp: true, ink: PAL.wood });
  // Window: the night outside, then the wooden ring and cross.
  const [wx, wy, wr] = ROOM.win;
  ctx.save();
  ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI * 2); ctx.clip();
  windowView(ctx, t, wx, wy, wr, o.view ?? {});
  ctx.restore();
  limb(ctx, [[wx, wy - wr], [wx, wy + wr]], 16, PAL.wood, { t, seed: 370 });
  limb(ctx, [[wx - wr, wy], [wx + wr, wy]], 16, PAL.wood, { t, seed: 371 });
  blob(ctx, wx, wy, wr + 16, wr + 16, null, { t, seed: 372, lw: 34, ink: PAL.wood, wob: 0.015 });
  blob(ctx, wx, wy, wr + 34, wr + 34, null, { t, seed: 373, lw: 4, wob: 0.015 });
  blob(ctx, wx, wy, wr - 2, wr - 2, null, { t, seed: 374, lw: 4, wob: 0.015 });
  // Sill.
  shape(ctx, [[wx - 250, wy + wr + 22], [wx + 250, wy + wr + 22], [wx + 270, wy + wr + 50], [wx - 270, wy + wr + 50]], PAL.wood2, { t, seed: 375, lw: 4, sharp: true });
  // Floor and rug.
  shape(ctx, [[-600, 900], [W + 600, 900], [W + 600, H + 400], [-600, H + 400]], PAL.floor, { t, seed: 380, lw: 4, sharp: true });
  for (let i = 0; i < 6; i++) stroke(ctx, [[-600, 930 + i * 34], [W + 600, 928 + i * 36]], { t, seed: 381 + i, lw: 2, color: 'rgba(20,10,5,0.45)' });
  shape(ctx, rrect(330, 948, 1070, 1036, 30), '#b65d58', { t, seed: 390, lw: 4 });
  shape(ctx, rrect(372, 964, 1028, 1020, 18), null, { t, seed: 391, lw: 3, ink: '#f2c14e' });
  // Bed under the window: headboard, mattress, sheet, pillow, frame.
  const by = ROOM.bedY;
  shape(ctx, [[1640, by + 20], [1640, 560], [1700, 520], [1790, 515], [1850, 560], [1850, by + 20]], PAL.wood, { t, seed: 400, lw: 4.5 });
  shape(ctx, rrect(554, by - 8, 1846, by + 46, 22), PAL.sheet, { t, seed: 401, lw: 4.5 });
  for (let i = 0; i < 9; i++) stroke(ctx, [[600 + i * 140, by + 2], [596 + i * 140, by + 40]], { t, seed: 402 + i, lw: 3, color: 'rgba(110,150,200,0.45)' });
  shape(ctx, rrect(1545, by - 72, 1775, by + 2, 36), PAL.pillow, { t, seed: 412, lw: 4 });
  stroke(ctx, [[1600, by - 40], [1660, by - 30], [1720, by - 42]], { t, seed: 411, lw: 2.5, color: 'rgba(120,110,100,0.5)' });
  shape(ctx, rrect(540, by + 40, 1860, by + 128, 10), PAL.wood2, { t, seed: 413, lw: 4.5 });
  wash(ctx, 1200, by + 90, 600, 30, '#6a4329', { seed: 414, alpha: 0.35, layers: 3 });
  for (const lx of [560, 1840]) shape(ctx, [[lx - 16, by + 120], [lx + 16, by + 120], [lx + 14, by + 160], [lx - 14, by + 160]], PAL.wood, { t, seed: 415 + lx, lw: 4, sharp: true });
  // Bedside table and lamp.
  const [lx, ly] = ROOM.lamp;
  shape(ctx, [[200, 712], [440, 712], [430, 740], [210, 740]], PAL.wood2, { t, seed: 420, lw: 4, sharp: true });
  shape(ctx, [[220, 740], [420, 740], [420, 900], [220, 900]], PAL.wood, { t, seed: 421, lw: 4, sharp: true });
  dot(ctx, 320, 812, 7, '#f2c14e');
  blob(ctx, lx, 700, 38, 14, '#d9a441', { t, seed: 422, lw: 3.5 });
  limb(ctx, [[lx, 698], [lx, 640]], 8, '#d9a441', { t, seed: 423 });
  glow(ctx, lx, ly + 20, 760, PAL.lampLight, 0.75 * lamp);
  shape(ctx, [[lx - 52, 640], [lx + 52, 640], [lx + 34, 560], [lx - 34, 560]], lamp > 0.3 ? '#f7a58c' : PAL.lampShade, { t, seed: 424, lw: 4 });
  glow(ctx, lx, 610, 120, '255,225,170', lamp);
  // Darken the room as the lamp goes down.
  if (lamp < 1) {
    ctx.save();
    ctx.globalAlpha = (1 - lamp) * 0.45;
    ctx.fillStyle = '#0d0a1c';
    ctx.fillRect(-600, -400, W + 1200, H + 800);
    ctx.restore();
  }
}

// The night outside the round window. o: { stars 0..1, lanterns 0..1, rustle 0..1,
// glowA, notes: [{ x, y, s, a }] }
export function windowView(ctx, t, cx, cy, r, o = {}) {
  const { stars = 0, lanterns = 0, rustle = 0 } = o;
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, PAL.night); g.addColorStop(0.6, PAL.night2); g.addColorStop(1, PAL.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  starDust(ctx, t, cx - r, cy - r, cx + r, cy + r * 0.4, { n: 40, seed: 77, amount: stars });
  const big = [[-0.55, -0.35, 15], [-0.15, -0.62, 11], [0.05, -0.2, 13], [-0.42, 0.05, 10], [0.55, 0.12, 12], [0.3, -0.7, 9]];
  big.forEach(([bx, by2, br], i) => {
    const on = clamp(stars * big.length - i);
    if (on > 0) bigStar(ctx, cx + bx * r, cy + by2 * r, br, t, -1, { seed: 80 + i, k: on, glowA: 0.8 });
  });
  moon(ctx, cx + r * 0.45, cy - r * 0.42, r * 0.2, t, { glowA: 0.9, face: o.moonFace ?? 0, eyes: 0, seed: 71 });
  // Far hills.
  const hp = ridge(cx - r - 40, cx + r + 40, cy + r * 0.55, 26, 91, 30, 0.01);
  hill(ctx, hp, cy + r + 10, PAL.hillMid, t, { seed: 92, rim: 0.6 });
  const hp2 = ridge(cx - r - 40, cx + r + 40, cy + r * 0.78, 18, 93, 30, 0.012);
  hill(ctx, hp2, cy + r + 10, PAL.hillNear, t, { seed: 94, rim: 0.4 });
  // The branch with leaves (top-left), shaking when the leaves rustle.
  const shake = (i) => rustle * (Math.sin(t * 13 + i * 1.7) * 6 + (hash(i, st8(t)) - 0.5) * 5);
  limb(ctx, [[cx - r - 30, cy - r * 0.55], [cx - r * 0.45, cy - r * 0.62 + shake(0) * 0.3], [cx + r * 0.1, cy - r * 0.85]], 14, PAL.trunk, { t, seed: 95 });
  const leaves = [[-0.85, -0.4], [-0.72, -0.72], [-0.55, -0.48], [-0.4, -0.8], [-0.25, -0.62], [-0.08, -0.92], [0.02, -0.72], [-0.62, -0.92]];
  leaves.forEach(([lx, ly], i) => {
    const px = cx + lx * r + shake(i), py = cy + ly * r + shake(i + 3) * 0.6;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.6 + i * 0.4 + rustle * Math.sin(t * 15 + i) * 0.25 + Math.sin(t * 1.1 + i) * 0.05);
    shape(ctx, [[-30, 0], [-10, -16], [26, -8], [34, 0], [26, 8], [-10, 16]], i % 2 ? PAL.leaf2 : PAL.leaf, { t, seed: 100 + i, lw: 3 });
    stroke(ctx, [[-28, 0], [28, 0]], { t, seed: 110 + i, lw: 1.8, color: 'rgba(20,30,30,0.6)' });
    ctx.restore();
  });
  // Lanterns hanging from the branch.
  [[-0.5, -0.5, 0], [-0.18, -0.66, 1], [0.08, -0.8, 2]].forEach(([lx, ly, i]) => {
    const on = clamp(lanterns * 3 - i);
    if (on > 0) lantern(ctx, cx + lx * r, cy + ly * r + 70, 0.75, t, { lit: on, seed: 120 + i, string: 60 });
  });
  for (const n of o.notes ?? []) note(ctx, n.x, n.y, n.s, t, { alpha: n.a, kind: n.kind ?? 1, seed: n.seed ?? 1 });
}

// ---------------------------------------------------------------------------
// Captions (the narration, written in as it is spoken) and scene fades
// ---------------------------------------------------------------------------
const STORY = activeStory();
const CAP = { size: 56, y: H - 84, font: 'CJKHand', color: '#fff4dc' };
const PUNCT = /[，。！？、；：,.!?]/;

// Every caption line of the pack, with a reveal time per character: each line
// lists `beats` [[start, end], ...], one per phrase (text split after ，。！？).
const LINES = STORY.scenes.flatMap((s) => (s.copy?.lines ?? []).filter((l) => l.beats).map((l) => ({ ...l, scene: s.id })))
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

const glyphCache = new Map();
function glyph(ch, size, font, color) {
  const k = `${ch}|${size}|${font}|${color}`;
  if (glyphCache.has(k)) return glyphCache.get(k);
  const pad = Math.ceil(size * 0.45);
  const m = createCanvas(4, 4).getContext('2d');
  m.font = `${size}px ${font}`;
  const w = Math.ceil(m.measureText(ch).width) + pad * 2, h = Math.ceil(size * 1.4) + pad * 2;
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.font = `${size}px ${font}`;
  x.textBaseline = 'middle';
  x.shadowColor = 'rgba(6,8,26,0.9)';
  x.shadowBlur = size * 0.22;
  x.fillStyle = color;
  x.fillText(ch, pad, h / 2);
  x.fillText(ch, pad, h / 2);
  x.shadowBlur = 0;
  x.fillText(ch, pad, h / 2);
  const g = { c, pad, adv: m.measureText(ch).width };
  glyphCache.set(k, g);
  return g;
}

// Text whose characters fade/rise in at times[i] (absolute seconds).
export function inkText(ctx, chars, times, x, y, t, { size = 56, font = 'CJKHand', color = '#fff4dc', alpha = 1, rise = 10, fadeIn = 0.28 } = {}) {
  if (alpha <= 0.01) return;
  const gl = chars.map((ch) => glyph(ch, size, font, color));
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

function captions(ctx, t) {
  for (const l of LINES) {
    if (t < l.times[0] - 0.05 || t > l.out + 0.4) continue;
    inkText(ctx, l.chars, l.times, W / 2, CAP.y, t, { size: CAP.size, font: CAP.font, color: CAP.color, alpha: 1 - clamp((t - l.out) / 0.4) });
  }
}

// Is `scene` the last one the renderer draws at time t (story order)?
function isTop(scene, t) {
  for (let i = STORY.scenes.length - 1; i >= 0; i--) {
    const s = STORY.scenes[i];
    if (t >= s.start - (s.lead || 0) && t < s.end + (s.tail || 0)) return s.id === scene.id;
  }
  return false;
}

// Draw a scene: `body` is composited as one layer with the scene's lead
// fade-in / tail fade-out; the topmost scene then lays the paper grain, a soft
// band and the captions over the whole frame.
let off = null;
export function frame(ctx, t, scene, body) {
  const lead = scene.lead || 0, tail = scene.tail || 0;
  const fadeIn = lead > 0 ? smooth(invLerp(scene.start - lead, scene.start, t)) : 1;
  const fadeOut = tail > 0 ? 1 - smooth(invLerp(scene.end, scene.end + tail, t)) : 1;
  const a = fadeIn * fadeOut;
  if (a >= 0.999) {
    ctx.save(); body(ctx); ctx.restore();
  } else if (a > 0.001) {
    if (!off) off = createCanvas(W, H);
    const o = off.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, W, H);
    o.save(); body(o); o.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(off, 0, 0); ctx.restore();
  }
  if (!isTop(scene, t)) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  grain(ctx, t, 0.55);
  const vis = Math.max(0, ...LINES.map((l) => clamp((t - l.times[0] + 0.5) / 0.5) * (1 - clamp((t - l.out) / 0.6))));
  if (vis > 0) {
    const band = ctx.createLinearGradient(0, H - 210, 0, H);
    band.addColorStop(0, 'rgba(6,8,26,0)');
    band.addColorStop(1, `rgba(6,8,26,${0.42 * vis})`);
    ctx.fillStyle = band;
    ctx.fillRect(0, H - 210, W, 210);
  }
  captions(ctx, t);
  // Open from (and close to) night.
  const open = 1 - smooth(invLerp(0, 0.9, t));
  const close = smooth(invLerp(STORY.duration - 1.8, STORY.duration - 0.15, t));
  const dark = Math.max(open, close);
  if (dark > 0) { ctx.globalAlpha = dark; ctx.fillStyle = '#070a1a'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
