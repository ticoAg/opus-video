// Small props: lanterns, fireflies, music notes, cloud puffs, thought
// doodles, wind curls and the sleeper's "z z z".
import { INK } from '../engine.js';
import { PAL } from './palette.js';
import { blob, shape, stroke, limb, dot, glow } from './ink.js';

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
