// Ink-and-watercolour marks shared by every kit drawing: wobbly blobs, soft
// shapes and strokes whose outline "boils" (re-jitters 8x a second, like the
// sketchbook cut-outs), soft glows, a few geometry helpers and the camera.
import { W, H, INK } from '../engine.js';
import { hash, noise1, lerp, smooth, bezier } from '../../lib/util.js';

// The boil step: outlines re-jitter 8 times a second.
export const st8 = (t) => Math.floor(t * 8);

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

// Pop-in (overshoot) scale.
export function popK(t, t0, dur = 0.55) {
  if (t < t0) return 0;
  const u = (t - t0) / dur;
  if (u >= 1) return 1;
  return 1 - Math.exp(-6 * u) * Math.cos(2 * Math.PI * 1.35 * u) * (1 - u);
}
