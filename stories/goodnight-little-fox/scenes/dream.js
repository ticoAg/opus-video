// "晚安，小狐狸": the dream. Eyes shut, she imagines lying among the stars,
// curled up in a crescent-moon cradle that rocks slowly in the quiet sky.
// The scene opens as an iris from her head over the room (params.iris is the
// screen point, during the scene's lead). Key moments are absolute seconds in
// scene.params.at.
import {
  W, H, PAL, frame, sky, fox, cloud, bigStar, starDust, glow, camera, wash, star, stroke,
  lerp, invLerp, smooth, ease, hash,
} from '../../../src/video/kit/index.js';

export function draw(ctx, t, scene) {
  const A = { iris: [71.0, 72.9], ring: 74.6, wide: [75.4, 79.4], rock: 79.2, ...scene.params?.at };
  const [ix, iy] = scene.params?.iris ?? [W / 2, H / 2];
  const r = lerp(0, 1250, ease.inOutCubic(invLerp(A.iris[0], A.iris[1], t)));
  if (r <= 0) return;
  frame(ctx, t, scene, (c) => {
    if (t < A.iris[1]) {
      c.beginPath(); c.arc(ix, iy, r, 0, Math.PI * 2); c.clip();
    }
    dream(c, t, A);
  });
  // Soft rim of the iris.
  if (t < A.iris[1]) {
    ctx.save();
    ctx.globalAlpha = 1 - invLerp(A.iris[1] - 0.5, A.iris[1], t);
    ctx.beginPath(); ctx.arc(ix, iy, r, 0, Math.PI * 2);
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.stroke();
    ctx.restore();
  }
}

const RING = [[-330, -120, 20], [-250, -300, 16], [-60, -360, 22], [170, -330, 17], [330, -190, 21], [380, 40, 15], [-390, 60, 14], [0, -250, 12]];
function dream(ctx, t, A) {
  sky(ctx, t, { top: PAL.dream, mid: PAL.dream2, low: '#4a4f9a', seed: 11 });
  const wide = ease.inOutSine(invLerp(A.wide[0], A.wide[1], t));
  camera(ctx, 960, lerp(600, 560, wide), lerp(1.3, 0.82, wide) + 0.02 * Math.sin(t * 0.4));
  starDust(ctx, t, -400, -400, W + 400, H + 300, { n: 260, seed: 31, amount: 1 });
  // Far big stars, slowly turning.
  for (let i = 0; i < 12; i++) {
    const x = -250 + hash(i, 61) * (W + 500), y = -250 + hash(i, 62) * 1050;
    if (Math.abs(x - 960) < 380 && Math.abs(y - 520) < 300) continue;
    bigStar(ctx, x, y, 12 + hash(i, 63) * 16, t, -1, { seed: 300 + i, glowA: 0.7 });
  }
  // Clouds drifting low.
  for (let i = 0; i < 5; i++) {
    const x = ((-300 + i * 520 + t * 12) % (W + 900)) - 200, y = 930 + Math.sin(i * 2.1) * 60;
    cloud(ctx, x, y, 360, 120, t, { seed: 400 + i * 7, fill: '#b9b6ea', alpha: 0.75, lw: 3 });
  }
  // The crescent cradle, rocking about a point above it.
  const amp = lerp(0.09, 0.15, smooth(invLerp(A.rock - 0.5, A.rock + 0.6, t)));
  const rock = amp * Math.sin(((t - 72.4) * Math.PI * 2) / 5.2);
  ctx.save();
  ctx.translate(960, 330);
  ctx.rotate(rock);
  ctx.translate(-960, -330);
  const cx = 960, cy = 520;
  glow(ctx, cx, cy + 60, 520, PAL.moonGlow, 0.55);
  crescent(ctx, cx, cy, t);
  // A little star dangling from the tip on a thread.
  const tip = [cx + 205, cy - 120];
  const sw = Math.sin(t * 1.7) * 0.25 - rock;
  const sx = tip[0] + Math.sin(sw) * 110, sy = tip[1] + Math.cos(sw) * 110;
  stroke(ctx, [tip, [sx, sy - 14]], { t, seed: 5, lw: 2, color: 'rgba(255,240,210,0.8)' });
  glow(ctx, sx, sy, 60, '255,236,170', 0.6);
  star(ctx, sx, sy, 20, { fill: PAL.star, rot: sw, seed: 6, t, lw: 2.5 });
  // The fox, curled up in the hollow.
  fox(ctx, { x: cx + 6, y: cy + 128, s: 0.62, t, pose: 'curl', sleep: true, breath: (t * Math.PI * 2) / 4.6, blush: 0.6 });
  ctx.restore();
  // "躺在星星之间": a ring of little stars pops in around her.
  RING.forEach(([dx, dy, r], i) => bigStar(ctx, cx + dx * 1.15, cy + dy * 0.9 + 60, r, t, A.ring + i * 0.14, { seed: 320 + i }));
}

function crescent(ctx, cx, cy, t) {
  // The lower arc of the outer circle, back along the lower arc of the inner
  // (offset) circle: a crescent opening upward, with clean tips.
  const tips = crossings(cx, cy, 245, cx, cy - 84, 218);
  const [o0, o1] = lowerArc(cx, cy, tips), [i0, i1] = lowerArc(cx, cy - 84, tips);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 245, o0, o1, false);
  ctx.arc(cx, cy - 84, 218, i1, i0, true);
  ctx.closePath();
  ctx.fillStyle = PAL.moon;
  ctx.fill();
  ctx.clip();
  wash(ctx, cx + 60, cy + 190, 140, 50, PAL.moon2, { seed: 7, alpha: 0.6, layers: 4 });
  wash(ctx, cx - 160, cy + 120, 60, 40, PAL.moon2, { seed: 8, alpha: 0.6, layers: 3 });
  wash(ctx, cx + 190, cy + 40, 40, 30, PAL.moon2, { seed: 9, alpha: 0.5, layers: 3 });
  ctx.restore();
  arcStroke(ctx, cx, cy, 245, tips, t, 0);
  arcStroke(ctx, cx, cy - 84, 218, tips, t, 1);
}

// The two points where circles (x1,y1,r1) and (x2,y2,r2) cross.
function crossings(x1, y1, r1, x2, y2, r2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = x1 + (a * (x2 - x1)) / d, my = y1 + (a * (y2 - y1)) / d;
  return [[mx + (h * (y2 - y1)) / d, my - (h * (x2 - x1)) / d], [mx - (h * (y2 - y1)) / d, my + (h * (x2 - x1)) / d]];
}

// Start/end angles (increasing) of a circle's lower arc between the tips.
function lowerArc(cx, cy, tips) {
  const angs = tips.map(([x, y]) => Math.atan2(y - cy, x - cx));
  const [a, b] = angs[0] < angs[1] ? angs : [angs[1], angs[0]];
  return Math.PI / 2 > a && Math.PI / 2 < b ? [a, b] : [b, a + Math.PI * 2];
}

// Ink the lower arc of a circle between the two tip points.
function arcStroke(ctx, cx, cy, r, tips, t, seed) {
  const [a, b] = lowerArc(cx, cy, tips);
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const u = lerp(a, b, i / 48);
    pts.push([cx + Math.cos(u) * r, cy + Math.sin(u) * r]);
  }
  stroke(ctx, pts, { t, seed: 20 + seed, lw: 5 });
}
