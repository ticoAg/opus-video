// Night landscape: sky, moon, stars, hills, trees, the tree house, a brook
// and its stones. World coordinates are the caller's (draw under camera()).
import { W, H, INK, wash, star, sparkle } from '../engine.js';
import { clamp, hash, noise1, lerp } from '../../lib/util.js';
import { PAL } from './palette.js';
import { st8, blob, shape, clipShape, stroke, limb, dot, glow, taper, popK } from './ink.js';

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
