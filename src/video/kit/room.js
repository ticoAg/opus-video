// A cosy room inside a tree house (z = 1 frame): plank walls, a framed
// moon, a bed under a big round window, a bedside lamp. windowView draws the
// night outside the window (stars, lanterns, a rustling branch).
import { W, H, wash, star } from '../engine.js';
import { clamp, hash } from '../../lib/util.js';
import { PAL } from './palette.js';
import { st8, blob, shape, stroke, limb, dot, glow, rrect } from './ink.js';
import { moon, bigStar, starDust, ridge, hill } from './night.js';
import { lantern, note } from './props.js';

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
