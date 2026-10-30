// "晚安，小狐狸": the night outside. One module, five beats chosen by
// scene.params.beat: moonrise | brook | stars | hush | goodnight. Key moments
// are absolute seconds in scene.params.at (the clock the narration, captions
// and cues share), so retiming a beat in story.json moves its animation; keep
// the cues in step with them.
import {
  W, H, PAL, frame, sky, moon, bigStar, starDust, ridge, hill, roundTree, pine, treeHouse, brookPath, brook, stone,
  lantern, firefly, note, swirl, glow, camera, key, titleText, wash, sparkle, star, clamp, lerp, invLerp, smooth,
  ease, hash, popK, stroke, shape, clipShape, blob, dot, bez, taper, limb, zoomOnto,
} from '../../../src/video/kit/index.js';

// World layout shared by the moonrise, brook, hush and goodnight beats.
const MOON = [560, 250];
const HOUSE = [1300, 662];
const HOUSE_S = 0.62;
const WINDOW = [HOUSE[0], HOUSE[1] - 250 * HOUSE_S];
const BROOK = brookPath([[330, 690], [220, 722], [210, 785], [80, 858], [-170, 940], [-300, 1050], [-470, 1200], [-640, 1440]], 90);
const BROOK_W = [10, 230];
// Stones sit in the water: [u along the brook, side (-1..1 of the half-width), rx, ry].
const STONES = [[0.4, 0.45, 20, 12], [0.5, -0.4, 28, 16], [0.6, 0.35, 36, 20], [0.7, -0.3, 46, 26], [0.8, 0.4, 54, 30]];
// Forest: [x, y, h, kind (0 round, 1 pine), seed], back to front.
const TREES = [
  [-1260, 742, 150, 1], [-1150, 735, 130, 0], [-1030, 748, 160, 1], [-900, 738, 140, 0], [-770, 750, 150, 1], [-640, 740, 130, 0],
  [-520, 752, 160, 1], [-400, 742, 140, 0], [-280, 754, 150, 1], [-150, 744, 130, 0], [-30, 756, 150, 1], [380, 744, 140, 0],
  [500, 752, 150, 1], [620, 760, 130, 0],
  [-1100, 850, 240, 0], [-880, 862, 250, 1], [-640, 846, 230, 0], [-420, 868, 260, 1], [470, 842, 240, 1], [640, 856, 220, 0],
  [-1180, 1062, 400, 1], [-900, 1074, 380, 0], [250, 1068, 360, 0], [470, 1078, 420, 1],
].map(([x, y, h, kind], i) => ({ x, y, h, kind, seed: 700 + i * 13 }));
const FAR = ridge(-1700, 2900, 612, 36, 11, 40, 0.004);
const MID = ridge(-1700, 2900, 702, 46, 21, 40, 0.0035);
const NEAR = [];
for (let x = 420; x <= 2600; x += 40) NEAR.push([x, hillY(x) + 8 * Math.sin(x * 0.01)]);
// The forest floor, dipping away behind the house hill on its right.
const FLOOR = [...ridge(-1700, 700, 776, 22, 31, 40, 0.006), [790, 800], [880, 860], [960, 950], [1020, 1090], [1060, 1500]];
// Bushes and grass on the house hill: [x, y, size].
const BUSHES = [[1010, 790, 44], [1105, 740, 30], [1630, 770, 40], [1780, 845, 52], [1500, 900, 34]];
const TUFTS = Array.from({ length: 26 }, (_, i) => [760 + hash(i, 11) * 1500, 0, 0.6 + hash(i, 12) * 0.6]).map(([x, , k], i) => [x, hillY(x) + 30 + hash(i, 13) * 380, k]);
function hillY(x) { return HOUSE[1] - 8 + ((x - HOUSE[0]) / 720) ** 2 * 270; }

// A point on the brook (u: 0 far end .. 1 near end), its half-width and normal.
function onBrook(u) {
  const f = clamp(u) * (BROOK.length - 1), i = Math.min(BROOK.length - 2, Math.floor(f)), k = f - i;
  const p = BROOK[i], q = BROOK[i + 1];
  const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
  return [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(BROOK_W[0], BROOK_W[1], clamp(u) ** 1.4) / 2, -dy / l, dx / l];
}

// The path from the door, bushes and grass tufts on the house hill.
function hillDetails(ctx, t, rim) {
  const path = bez([HOUSE[0] - 20, HOUSE[1] + 2], [HOUSE[0] - 60, HOUSE[1] + 140], [HOUSE[0] + 260, HOUSE[1] + 220], [HOUSE[0] - 40, HOUSE[1] + 520], 18);
  const outline = taper(path, (u) => 16 + 120 * u * u);
  shape(ctx, outline, '#4f6476', { t, seed: 560, lw: 0 });
  ctx.save();
  clipShape(ctx, outline, { t, seed: 560 });
  for (let i = 0; i < 9; i++) {
    const p = path[1 + i * 2];
    blob(ctx, p[0] + (hash(i, 3) - 0.5) * 30, p[1], 9 + i * 2.2, 5 + i * 1.2, '#6f8296', { t, seed: 570 + i, lw: 2, hi: 0 });
  }
  ctx.restore();
  const half = Math.floor(outline.length / 2);
  stroke(ctx, outline.slice(0, half), { t, seed: 561, lw: 3, alpha: 0.7 });
  stroke(ctx, outline.slice(half), { t, seed: 562, lw: 3, alpha: 0.7 });
  for (const [x, y, k] of TUFTS) {
    for (let j = -1; j <= 1; j++) stroke(ctx, [[x + j * 6 * k, y], [x + j * 11 * k, y - 18 * k - (j ? 0 : 8 * k)]], { t, seed: Math.round(x) + j, lw: 2.5, color: 'rgba(20,40,45,0.8)' });
  }
  BUSHES.forEach(([x, y, r], i) => {
    blob(ctx, x - r * 0.6, y, r * 0.8, r * 0.6, PAL.leaf, { t, seed: 580 + i, lw: 0, hi: 0 });
    blob(ctx, x + r * 0.5, y + 4, r * 0.75, r * 0.55, PAL.leaf2, { t, seed: 590 + i, lw: 0, hi: 0 });
    blob(ctx, x, y - r * 0.3, r, r * 0.7, PAL.leaf, { t, seed: 600 + i, lw: 3.5, hi: 0 });
    wash(ctx, x - r * 0.2, y - r * 0.6, r * 0.5, r * 0.22, PAL.leafLit, { seed: 610 + i, alpha: 0.45 * (0.4 + rim * 0.6), layers: 3 });
    dot(ctx, x + r * 0.3, y - r * 0.2, 4, '#f4a7b9');
    dot(ctx, x - r * 0.4, y - r * 0.05, 3.5, '#fff3c4');
  });
}

// The whole landscape under the current camera.
function world(ctx, t, o = {}) {
  const {
    moonY = MOON[1], moonGlow = 1, rays = 0, face = 0, eyes = 0, stars = 0, rim = 0.8, front = Infinity,
    houseLight = 1, sway = 0, shine = 0, flow = 1,
  } = o;
  starDust(ctx, t, -1500, -900, 2700, 560, { n: 220, seed: 9, amount: stars });
  moon(ctx, MOON[0], moonY, 92, t, { glowA: moonGlow, rays, face, eyes, seed: 72 });
  hill(ctx, FAR, 1400, PAL.hillFar, t, { seed: 12, rim: rim * 0.8, front });
  hill(ctx, MID, 1400, PAL.hillMid, t, { seed: 22, rim: rim * 0.7, front });
  hill(ctx, NEAR, 1400, PAL.hillNear, t, { seed: 32, rim, front });
  hillDetails(ctx, t, rim);
  treeHouse(ctx, HOUSE[0], HOUSE[1], HOUSE_S, t, { light: houseLight, sway });
  hill(ctx, FLOOR, 1600, PAL.ground, t, { seed: 42, rim: rim * 0.5, front });
  const lit = 0.25 + 0.5 * rim;
  for (const tr of TREES.slice(0, 14)) (tr.kind ? pine : roundTree)(ctx, tr.x, tr.y, tr.h, t, { seed: tr.seed, sway, lit });
  brook(ctx, BROOK, t, { flow, shine, w0: BROOK_W[0], w1: BROOK_W[1] });
  STONES.forEach(([u, side, rx, ry], i) => {
    const [x, y, hw, nx, ny] = onBrook(u);
    stone(ctx, x + nx * hw * side, y + ny * hw * side, rx, ry, t, { seed: 650 + i * 7 });
  });
  for (const tr of TREES.slice(14)) (tr.kind ? pine : roundTree)(ctx, tr.x, tr.y, tr.h, t, { seed: tr.seed, sway, lit });
}

// Silver moonlight over the land: a wash revealed left to right up to `front`
// and, as the "invisible blanket", a quilted shimmer (quiltA 0..1).
function moonlight(ctx, t, front, amount, quiltA) {
  if (amount <= 0 && quiltA <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(FAR[0][0], 1500);
  for (const [x, y] of FAR) ctx.lineTo(x, y);
  ctx.lineTo(FAR[FAR.length - 1][0], 1500);
  ctx.closePath();
  ctx.clip();
  if (amount > 0) {
    const g = ctx.createLinearGradient(front - 520, 0, front, 0);
    g.addColorStop(0, `rgba(${PAL.silver},${0.2 * amount})`);
    g.addColorStop(1, `rgba(${PAL.silver},0)`);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(-1700, 500, front + 1700, 1000);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (quiltA > 0) {
    ctx.translate(900, 820);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = `rgba(${PAL.silver},${0.34 * quiltA})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 9]);
    for (let i = -24; i <= 24; i++) {
      ctx.beginPath(); ctx.moveTo(i * 90, -2400); ctx.lineTo(i * 90, 2400); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2400, i * 90); ctx.lineTo(2400, i * 90); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 40; i++) {
      const gx = (Math.floor(hash(i, 1) * 30) - 15) * 90, gy = (Math.floor(hash(i, 2) * 14) - 4) * 90;
      const tw = Math.sin(t * 3 + i * 1.3);
      if (tw > 0) sparkle(ctx, gx, gy, 14 * tw * quiltA, { alpha: quiltA * tw, rot: t + i });
    }
  }
  ctx.restore();
}

const BEATS = { moonrise, brook: brookBeat, stars: starsBeat, hush, goodnight };

export function draw(ctx, t, scene) {
  const beat = scene.params?.beat ?? scene.id;
  frame(ctx, t, scene, (c) => BEATS[beat](c, t, scene.params?.at ?? {}));
}

// --- Moonrise: the moon climbs over the quiet hills; silver light spreads
// over the land like an invisible quilt; we drift into the lit window. -----
function moonrise(ctx, t, at) {
  const A = { title: 0.5, titleOut: 4.0, rise: [4.0, 7.4], silver: 7.4, sweep: [9.2, 12.6], quilt: [13.3, 16.0], push: [14.8, 16.6], ...at };
  sky(ctx, t, { seed: 3 });
  const push = ease.inCubic(invLerp(A.push[0], A.push[1], t));
  const drift = smooth(invLerp(0, A.push[0], t));
  camera(ctx, ...zoomOnto([lerp(760, 790, drift), lerp(560, 548, drift), 1], WINDOW, 6.5, push));
  const moonY = lerp(780, MOON[1], ease.outCubic(invLerp(A.rise[0], A.rise[1], t)));
  const silver = smooth(invLerp(A.silver - 0.2, A.silver + 1.2, t));
  const front = lerp(-300, 2700, ease.inOutSine(invLerp(A.sweep[0], A.sweep[1], t)));
  const quiltA = Math.sin(Math.PI * clamp(invLerp(A.quilt[0], A.quilt[1], t)));
  world(ctx, t, { moonY, moonGlow: 0.55 + 0.6 * silver, rays: silver * (1 - push), rim: 0.85, front, stars: 0.12 });
  moonlight(ctx, t, front, 1, quiltA);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const titleA = 1 - smooth(invLerp(A.titleOut, A.titleOut + 0.8, t));
  if (titleA > 0) {
    titleText(ctx, '晚安，小狐狸', W / 2, 250, t, A.title, 1.8, { size: 128, alpha: titleA });
    titleText(ctx, 'Goodnight, Little Fox', W / 2, 360, t, A.title + 1.9, 0.9, { size: 46, font: 'Hand', color: '#d9e2ff', alpha: titleA, fadeIn: 0.25 });
  }
}

// --- Brook: from the tree house, over to the brook humming through the
// forest; its song (notes) winds round the stones and flows far away. -----
function brookBeat(ctx, t, at) {
  const A = { pan: [24.9, 28.6], shine: [27.0, 29.4], notes: 29.8, around: 32.0, away: [34.0, 36.4], ...at };
  sky(ctx, t, { seed: 3 });
  const p = ease.inOutCubic(invLerp(A.pan[0], A.pan[1], t));
  const d = smooth(invLerp(A.pan[1], A.away[1], t));
  camera(ctx, lerp(WINDOW[0], lerp(-70, -10, d), p), lerp(WINDOW[1] + 40, lerp(840, 800, d), p), lerp(1.6, lerp(1.25, 1.15, d), p));
  world(ctx, t, { rim: 0.8, stars: 0.12, moonGlow: 1, sway: 0.1, shine: invLerp(A.shine[0], A.shine[1], t), flow: 1.4 });
  // The song: five notes pop out of the water, weave round the stones, then
  // drift upstream into the distance.
  for (let i = 0; i < 5; i++) {
    const tb = A.notes + i * 0.32;
    if (t < tb) continue;
    const u0 = 0.86 - i * 0.07;
    const u = key(t, [[tb, u0], [A.around, u0 - 0.02], [A.away[0], u0 - 0.16], [A.away[1], 0.05 + i * 0.025]]);
    const [bx, by, hw, nx, ny] = onBrook(u);
    // Weave from side to side, around the stones.
    const weave = Math.sin((t - tb) * 2.2 + i * 1.9) * hw * 1.15;
    const scale = lerp(0.4, 1.7, clamp(u) ** 1.3);
    const lift = (60 * popK(t, tb, 0.7) + Math.sin(t * 2 + i) * 8) * scale;
    const a = clamp((t - tb) / 0.3) * (1 - smooth(invLerp(A.away[1] - 0.9, A.away[1], t)));
    note(ctx, bx + nx * weave, by + ny * weave - lift, scale, t, { kind: i % 2 ? 2 : 1, alpha: a, seed: 40 + i, rot: Math.sin(t * 2 + i) * 0.2 });
    if (t - tb < 0.6) sparkle(ctx, bx + nx * weave, by + ny * weave - 10, 22 * scale * Math.sin(Math.PI * (t - tb) / 0.6), { alpha: 1 - (t - tb) / 0.6 });
  }
}

// --- Stars: they light up one by one, the low ones become little lanterns on
// the treetops, and a firefly quietly lights goodnight lamps. ------------
const SKY_STARS = [[1180, 190, 30], [820, 120, 20], [1520, 300, 22], [980, 330, 18], [1720, 140, 20], [640, 300, 16], [1380, 110, 16], [500, 130, 18], [1830, 420, 15]];
const TOPS = [[180, 1040, 330, 0], [420, 1060, 380, 1], [660, 1040, 340, 0], [900, 1065, 400, 1], [1140, 1045, 330, 0], [1380, 1062, 380, 1], [1620, 1040, 350, 0], [1860, 1060, 390, 1]];
const BACK_TOPS = [[60, 1000, 250, 1], [300, 990, 230, 0], [540, 1005, 260, 1], [780, 995, 240, 0], [1020, 1008, 250, 1], [1260, 992, 230, 0], [1500, 1004, 260, 1], [1740, 996, 240, 0], [1960, 1004, 250, 1]];
// Lanterns hang from twigs reaching out of the round crowns: [twig root x, y, tip x, y, index].
const LANTERNS = [[300, 760, 372, 728, 0], [778, 754, 852, 722, 1], [1258, 762, 1330, 730, 2], [1738, 756, 1808, 724, 3]];
const LAMPS = [[420, 520], [700, 455], [960, 520], [1240, 445], [1480, 520], [1690, 450]];
function starsBeat(ctx, t, at) {
  const A = { first: 36.62, each: [38.45, 0.37], lanterns: [42.45, 0.5], fly: [45.3, 48.6], ...at };
  sky(ctx, t, { seed: 5 });
  const tilt = ease.inOutCubic(invLerp(35.4, 37.6, t));
  camera(ctx, 960, lerp(800, 540, tilt), 1);
  starDust(ctx, t, -100, -300, W + 100, 640, { n: 160, seed: 21, amount: smooth(invLerp(A.first, A.each[0] + 3.4, t)) });
  moon(ctx, 330, 290, 78, t, { glowA: 1, seed: 74 });
  SKY_STARS.forEach(([x, y, r], i) => bigStar(ctx, x, y, r, t, i ? A.each[0] + (i - 1) * A.each[1] : A.first, { seed: 90 + i }));
  // Low stars over the treetops (they turn into the lanterns, below).
  LANTERNS.forEach(([, , x, y, i]) => {
    const tl = A.lanterns[0] + i * A.lanterns[1];
    const born = A.each[0] + 1.2 + i * 0.25;
    const sk = clamp(popK(t, born)) * (1 - smooth(invLerp(tl, tl + 0.35, t)));
    if (sk > 0.01) bigStar(ctx, x, y - 70, 14, t, born, { seed: 120 + i, k: sk });
  });
  // Goodnight lamps: tiny lights that come on as the firefly passes.
  const fu = invLerp(A.fly[0], A.fly[1], t);
  const fx = lerp(120, 1850, fu), fy = 500 + Math.sin(fu * 14) * 60 - Math.sin(fu * Math.PI) * 60;
  LAMPS.forEach(([x, y], i) => {
    if (fx < x || t < A.fly[0]) return;
    const tOn = A.fly[0] + ((x - 120) / 1730) * (A.fly[1] - A.fly[0]);
    const k = popK(t, tOn, 0.5);
    glow(ctx, x, y, 70 * k, '255,226,150', 0.8);
    star(ctx, x, y, 11 * k, { fill: '#fff2b8', seed: 140 + i, t, lw: 2 });
  });
  if (t > A.fly[0] && t < A.fly[1] + 0.5) {
    for (let k = 1; k <= 14; k++) {
      const pu = fu - k * 0.01;
      if (pu < 0) break;
      ctx.save();
      ctx.globalAlpha = 0.8 * (1 - k / 15);
      glow(ctx, lerp(120, 1850, pu), 500 + Math.sin(pu * 14) * 60 - Math.sin(pu * Math.PI) * 60, 22, '235,255,160', 1);
      ctx.restore();
    }
    firefly(ctx, fx, fy, t, { alpha: clamp((t - A.fly[0]) / 0.3) * (1 - clamp((t - A.fly[1]) / 0.5)), seed: 3 });
  }
  // The wooded hill and its treetops along the bottom.
  hill(ctx, ridge(-200, W + 200, 860, 30, 51, 40, 0.004), 1300, PAL.hillMid, t, { seed: 52, rim: 0.5 });
  BACK_TOPS.forEach(([x, y, h, kind], i) => (kind ? pine : roundTree)(ctx, x, y, h, t, { seed: 860 + i * 11, lit: 0.4, color: PAL.leaf2 }));
  hill(ctx, ridge(-200, W + 200, 990, 18, 53, 40, 0.005), 1300, PAL.ground, t, { seed: 54, rim: 0.3 });
  TOPS.forEach(([x, y, h, kind], i) => (kind ? pine : roundTree)(ctx, x, y, h, t, { seed: 800 + i * 11, lit: 0.55 }));
  // Twigs, and the lanterns hanging from them.
  LANTERNS.forEach(([rx, ry, x, y, i]) => {
    const tl = A.lanterns[0] + i * A.lanterns[1];
    const grow = smooth(invLerp(tl - 0.4, tl, t));
    if (grow <= 0) return;
    limb(ctx, [[rx, ry], [lerp(rx, x, 0.5 * grow), lerp(ry, y, 0.5 * grow) - 6], [lerp(rx, x, grow), lerp(ry, y, grow)]], 6, PAL.trunk, { t, seed: 140 + i });
    if (t >= tl) lantern(ctx, x, y + 64, popK(t, tl, 0.6) * 0.95, t, { lit: smooth(invLerp(tl, tl + 0.5, t)), seed: 130 + i, string: 64 });
  });
}

// --- Hush: the wind tiptoes off, the leaves stop talking, the brook hides its
// song in the moonlight, and everything grows quieter. --------------------
function hush(ctx, t, at) {
  const A = { wind: 81.8, leaves: [84.9, 86.4], song: 86.9, quiet: [90.8, 94.0], push: [92.6, 94.8], ...at };
  sky(ctx, t, { seed: 3 });
  const push = ease.inOutCubic(invLerp(A.push[0], A.push[1], t));
  camera(ctx, ...zoomOnto([lerp(260, 330, smooth(invLerp(80.6, A.push[0], t))), 650, 0.95], WINDOW, 5.5, push));
  const quiet = smooth(invLerp(A.quiet[0], A.quiet[1], t));
  const sway = 0.9 * (1 - smooth(invLerp(A.leaves[0] - 0.8, A.leaves[1], t)));
  world(ctx, t, { stars: 1, rim: 0.8 - 0.3 * quiet, moonGlow: 1 - 0.3 * quiet, sway, houseLight: 1 - 0.35 * quiet, flow: 1 - 0.6 * quiet });
  // Moonbeam from the moon down to the brook.
  const beamA = smooth(invLerp(A.song - 0.6, A.song + 0.6, t)) * (1 - 0.6 * quiet);
  if (beamA > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createLinearGradient(MOON[0], MOON[1], -60, 880);
    g.addColorStop(0, `rgba(${PAL.moonGlow},${0.32 * beamA})`);
    g.addColorStop(1, `rgba(${PAL.moonGlow},${0.06 * beamA})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(MOON[0] - 70, MOON[1]); ctx.lineTo(MOON[0] + 70, MOON[1]); ctx.lineTo(120, 900); ctx.lineTo(-240, 900);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Wind curls that slow to a tiptoe and fade.
  for (let i = 0; i < 3; i++) {
    const t0 = A.wind + i * 0.55;
    if (t < t0) continue;
    const u = t - t0;
    const x = -500 + i * 160 + 900 * (1 - Math.exp(-u / 1.1));
    const y = 560 + i * 90 + Math.sin(u * 2 + i) * 12;
    swirl(ctx, x, y, 1.7 - i * 0.25, t, { progress: clamp(u / 0.8), alpha: 1 - smooth(invLerp(1.6, 3.4, u)), seed: 60 + i });
  }
  // The brook's song rises into the moonbeam and melts into light.
  for (let i = 0; i < 4; i++) {
    const tb = A.song + i * 0.45;
    if (t < tb) continue;
    const u = clamp((t - tb) / 2.6);
    const [bx, by] = onBrook(0.62 + i * 0.05);
    const x = lerp(bx, lerp(-60, MOON[0], 0.55) + i * 30, ease.inOutSine(u)), y = lerp(by - 40, 420 - i * 30, ease.inOutSine(u));
    const a = clamp((t - tb) / 0.3) * (1 - smooth(invLerp(0.6, 1, u)));
    note(ctx, x, y, 0.8 - 0.3 * u, t, { kind: i % 2 ? 2 : 1, alpha: a, seed: 50 + i });
    if (u > 0.55 && u < 1) sparkle(ctx, x + 10, y - 20, 18 * Math.sin(Math.PI * (u - 0.55) / 0.45), { alpha: 1 - u, rot: t });
  }
  // Everything grows quieter: a deeper night settles.
  if (quiet > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45 * quiet;
    ctx.fillStyle = '#4a4f8a';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// --- Goodnight: up to the stars (they twinkle back), then back to the whole
// hill; the moon peeks at the listener, the window goes dark. --------------
function goodnight(ctx, t, at) {
  const A = { stars: 102.24, pull: [103.8, 106.6], peek: [105.5, 106.9], lightsOut: 107.0, title: 107.4, ...at };
  sky(ctx, t, { seed: 3 });
  const pull = ease.inOutCubic(invLerp(A.pull[0], A.pull[1], t));
  camera(ctx, lerp(760, 780, pull), lerp(-40, 560, pull), lerp(1.05, 0.95, pull));
  const eyes = t > A.peek[0] && t < A.peek[1] ? 1 : 0;
  world(ctx, t, { stars: 1, rim: 0.6, moonGlow: 0.9, face: 1, eyes, houseLight: 1 - smooth(invLerp(A.lightsOut, A.lightsOut + 0.6, t)) });
  // The stars answer: a wave of twinkles across the sky.
  const STARS = [[180, -260, 32], [420, -120, 25], [760, -330, 36], [1000, -150, 28], [1250, -300, 31], [1500, -110, 25], [1700, -260, 28], [60, -40, 22], [1880, 40, 22]];
  STARS.forEach(([x, y, r], i) => {
    const tw = Math.exp(-(((t - (A.stars + i * 0.16)) / 0.4) ** 2));
    bigStar(ctx, x, y, r * (1 + 0.7 * tw), t, -1, { seed: 150 + i, glowA: 0.8 + 1.5 * tw });
    if (tw > 0.05) sparkle(ctx, x + r, y - r, r * 1.6 * tw, { alpha: tw, rot: t * 2 });
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  titleText(ctx, '晚安', 1030, 360, t, A.title, 0.7, { size: 150 });
  titleText(ctx, 'goodnight', 1030, 470, t, A.title + 0.9, 0.6, { size: 50, font: 'Hand', color: '#d9e2ff', fadeIn: 0.3 });
}
