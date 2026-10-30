// The little fox: sits wrapped in her patchwork quilt, or sleeps curled up
// under it. Drawn in a local frame with her base at (0, 0), about 400 units
// tall (ears included) at s = 1; expressions via look/up/lids/sleep/yawn.
import { wash } from '../engine.js';
import { hash } from '../../lib/util.js';
import { PAL } from './palette.js';
import { blob, shape, clipShape, stroke, dot, bez, taper } from './ink.js';

const QUILT = ['#f2c14e', '#e9857a', '#7fb8b0', '#a58fd6', '#f4a7b9', '#9cc56b'];
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
