// Procedural watercolour-and-ink toolkit for "The Emperor's New Clothes"
// (stories/emperors-new-clothes). No page photos needed: every character and
// prop is drawn with canvas paths, a translucent "wash" fill and a boiling ink
// outline (re-jittered 8x per second, like the sketchbook cut-outs).
//
// Characters are drawn in a local frame with the feet at (0, 0), ~400 units
// tall at s = 1, facing right when face = 1.
import { W, H, INK, wash, writeText, popText, sparkle, createCanvas } from '../engine.js';
import { clamp, hash, noise1, invLerp, lerp } from '../../lib/util.js';

export const PAL = {
  skin: '#f4c7a1', skin2: '#e9b48d', skin3: '#c98d63', blush: '#ef7d78',
  purple: '#7d55a8', gold: '#f2c14e', red: '#d4553f', ermine: '#fbf7ee',
  wood: '#a8774a', wall: '#f3dfc0', floor: '#d9b48a', curtain: '#b8433a',
  sky: '#bfe0f2', grass: '#a9c97a', shadow: 'rgba(70,45,25,0.18)',
};
const COATS = ['#5f8fc4', '#c4704f', '#6aa57c', '#a073b8', '#d9a441', '#d07a96', '#4f9e9a', '#8b6f5a'];
const step = (t) => Math.floor(t * 8);

// ---------------------------------------------------------------------------
// Primitive marks
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

// Wobbly ellipse: watercolour fill (with a lighter pooled centre) + ink edge.
export function blob(ctx, cx, cy, rx, ry, fill, { t = 0, seed = 1, lw = 4, wob = 0.05, ink = INK, alpha = 1 } = {}) {
  const st = step(t);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (fill) {
    wobPath(ctx, cx, cy, rx, ry, seed, st, wob);
    ctx.fillStyle = fill; ctx.fill();
    wobPath(ctx, cx - rx * 0.18, cy - ry * 0.22, rx * 0.55, ry * 0.5, seed + 5, 0, wob * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
  }
  if (lw) {
    wobPath(ctx, cx, cy, rx, ry, seed + 1, st, wob);
    ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.stroke();
  }
  ctx.restore();
}

// Smooth path through points (quadratic through midpoints), with boil jitter.
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

// Filled closed shape (soft corners) + ink outline.
export function shape(ctx, pts, fill, { t = 0, seed = 1, lw = 4, sharp = false, alpha = 1 } = {}) {
  const st = step(t);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';
  const path = () => {
    if (!sharp) return smoothPath(ctx, pts, true, seed, st);
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = x + (hash(seed, i, st) - 0.5) * 1.4, py = y + (hash(seed, i, st, 4) - 0.5) * 1.4;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.closePath();
  };
  if (fill) { path(); ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { path(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.restore();
}

// Thick limb (arm/leg/pole): ink under-stroke then coloured stroke.
export function limb(ctx, pts, w, color, { t = 0, seed = 1, cap = 'round' } = {}) {
  const st = step(t);
  ctx.save();
  ctx.lineCap = cap; ctx.lineJoin = 'round';
  smoothPath(ctx, pts, false, seed, st);
  ctx.lineWidth = w + 7; ctx.strokeStyle = INK; ctx.stroke();
  smoothPath(ctx, pts, false, seed, st);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}

// Thin ink stroke (open).
export function stroke(ctx, pts, { t = 0, seed = 1, lw = 4, color = INK, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  smoothPath(ctx, pts, false, seed, step(t), 1.2);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
  ctx.restore();
}

function dot(ctx, x, y, r, color = INK) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}

function groundShadow(ctx, w) {
  ctx.save();
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath(); ctx.ellipse(0, 4, w, w * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Legs that walk: hips at hipY, feet on the ground (0). phase in radians.
function legs(ctx, { hipX = 30, hipY = -150, walk, color, shoe, t, seed, w = 26, stride = 34 }) {
  for (const side of [-1, 1]) {
    const ph = walk == null ? 0 : walk + (side > 0 ? Math.PI : 0);
    const sw = walk == null ? 0 : Math.sin(ph) * stride;
    const lift = walk == null ? 0 : Math.max(0, Math.cos(ph)) * 16;
    const fx = side * hipX * 0.9 + sw, fy = -lift;
    limb(ctx, [[side * hipX, hipY], [side * hipX + sw * 0.55, (hipY + fy) / 2 - 4], [fx, fy - 8]], w, color, { t, seed: seed + side });
    blob(ctx, fx + 14, fy - 6, 26, 12, shoe, { t, seed: seed + 3 + side, lw: 3.5 });
  }
}

function hand(ctx, x, y, r, t, seed, color = PAL.skin) { blob(ctx, x, y, r, r * 0.9, color, { t, seed, lw: 3 }); }

// Arm from shoulder to hand with a bend outward.
function arm(ctx, sh, hd, bend, w, color, t, seed, handR = 14) {
  const mx = (sh[0] + hd[0]) / 2 + bend[0], my = (sh[1] + hd[1]) / 2 + bend[1];
  limb(ctx, [sh, [mx, my], hd], w, color, { t, seed });
  hand(ctx, hd[0], hd[1], handR, t, seed + 7);
}

// Simple face parts in head-local coordinates (head centre at 0,0, radius r).
function eyes(ctx, r, { mood = 'open', look = 0, t, seed }) {
  const ex = r * 0.36, ey = -r * 0.08;
  for (const s of [-1, 1]) {
    const x = s * ex + look * r * 0.12;
    if (mood === 'smug' || mood === 'laugh') {
      stroke(ctx, [[x - r * 0.16, ey + 2], [x, ey - r * 0.1], [x + r * 0.16, ey + 2]], { t, seed: seed + s, lw: 3.5 });
    } else if (mood === 'shock') {
      blob(ctx, x, ey, r * 0.17, r * 0.2, '#fff', { t, seed: seed + s, lw: 3 });
      dot(ctx, x + look * 3, ey, r * 0.07);
    } else if (mood === 'wink' && s > 0) {
      stroke(ctx, [[x - r * 0.15, ey], [x + r * 0.15, ey]], { t, seed, lw: 4 });
    } else {
      // blink every ~3 s
      const blink = ((t + hash(seed) * 3) % 3.1) < 0.12;
      if (blink) stroke(ctx, [[x - r * 0.12, ey], [x + r * 0.12, ey]], { t, seed, lw: 3.5 });
      else dot(ctx, x, ey, r * 0.085);
    }
  }
}

function mouthMark(ctx, r, kind, t, seed, y = r * 0.42) {
  if (kind === 'o' || kind === 'shout') {
    const big = kind === 'shout' ? 1.6 : 1;
    blob(ctx, 0, y, r * 0.13 * big, r * 0.17 * big, '#7a2c2c', { t, seed, lw: 3 });
  } else if (kind === 'laugh') {
    shape(ctx, [[-r * 0.3, y - r * 0.08], [r * 0.3, y - r * 0.08], [r * 0.12, y + r * 0.22], [-r * 0.12, y + r * 0.22]], '#7a2c2c', { t, seed, lw: 3 });
  } else if (kind === 'flat') {
    stroke(ctx, [[-r * 0.2, y], [r * 0.2, y + 2]], { t, seed, lw: 3.5 });
  } else if (kind === 'wobble') {
    stroke(ctx, [[-r * 0.24, y], [-r * 0.12, y - 5], [0, y + 3], [r * 0.12, y - 5], [r * 0.24, y]], { t, seed, lw: 3.5 });
  } else if (kind === 'grin') {
    stroke(ctx, [[-r * 0.3, y - r * 0.12], [-r * 0.05, y + r * 0.12], [r * 0.32, y - r * 0.2]], { t, seed, lw: 4 });
  } else { // smile
    stroke(ctx, [[-r * 0.24, y - 4], [0, y + r * 0.12], [r * 0.24, y - 4]], { t, seed, lw: 3.5 });
  }
}

// ---------------------------------------------------------------------------
// The Emperor
// ---------------------------------------------------------------------------
// o: { x, y, s, t, face, walk (radians|null), robe (1 on .. 0 flown away),
//      arms: side|spread|hip|cover|proud|admire, mood, mouth, blush 0..1,
//      chin (head tilt), sweat 0..1, train (draw a shimmer train behind, 0..1) }
export function emperor(ctx, o) {
  const { x, y, s = 1, t = 0, face = 1, walk = null, robe = 0, arms = 'side', mood = 'open', mouth = 'smile',
    blush = 0, chin = 0, sweat = 0, seed = 11, look = 0, squash = 0 } = o;
  const bob = walk == null ? Math.sin(t * 1.7) * 3 : -Math.abs(Math.sin(walk)) * 12;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);
  groundShadow(ctx, 120);
  ctx.scale(1 + squash * 0.08, 1 - squash * 0.08);

  legs(ctx, { hipX: 36, hipY: -150 + bob, walk, color: PAL.skin, shoe: PAL.red, t, seed: seed + 20, w: 30, stride: 30 });
  ctx.translate(0, bob);

  const swing = walk == null ? 0 : Math.sin(walk) * 40;
  const handPose = {
    side: [[-118 - swing * 0.3, -165 + Math.abs(swing) * 0.1], [118 + swing * 0.3, -165]],
    spread: [[-200, -350], [200, -350]],
    admire: [[-60, -255], [175, -330]],
    hip: [[-98, -190], [98, -190]],
    cover: [[-36, -165], [40, -170]],
    proud: [[-180, -390], [100, -192]],
  }[arms];
  const bends = { side: [[-14, 0], [14, 0]], spread: [[0, 28], [0, 28]], admire: [[-30, 20], [10, 30]],
    hip: [[-60, -10], [60, -10]], cover: [[-50, 20], [50, 20]], proud: [[10, 20], [60, -10]] }[arms];
  const armColor = robe > 0.5 ? PAL.purple : PAL.skin;
  const shL = [-82, -272], shR = [82, -272];

  // Back arm (left in local frame) first.
  arm(ctx, shL, handPose[0], bends[0], 30, armColor, t, seed + 30, 17);

  // Belly + royal undershorts.
  blob(ctx, 0, -228, 104, 108, PAL.skin, { t, seed: seed + 1, lw: 4.5 });
  wash(ctx, 30, -205, 50, 45, PAL.skin2, { seed: seed + 2, alpha: 0.35, layers: 3 });
  dot(ctx, 12, -205, 3.5);
  shape(ctx, [[-100, -192], [100, -192], [104, -126], [10, -118], [0, -138], [-10, -118], [-104, -126]],
    '#fffaf0', { t, seed: seed + 4, lw: 4.5, sharp: true });
  for (let i = 0; i < 7; i++) {
    const hx = -78 + i * 26, hy = -160 + (i % 2) * 14;
    ctx.save(); ctx.fillStyle = '#e0505a'; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  stroke(ctx, [[-100, -186], [100, -186]], { t, seed: seed + 5, lw: 3, color: '#e0505a' });

  // The robe (title / inspect): flies off upward when robe -> 0.
  if (robe > 0.01) {
    const u = 1 - robe;
    ctx.save();
    ctx.translate(-u * 120, -u * 760);
    ctx.rotate(-u * 1.4);
    ctx.globalAlpha *= clamp(robe * 1.6);
    const sway = Math.sin(t * 2.2) * 6;
    shape(ctx, [[-96, -292], [96, -292], [150 + sway, -40], [175 + sway, 0], [-300 + sway, 0], [-170 + sway, -30]],
      PAL.purple, { t, seed: seed + 6, lw: 4.5 });
    wash(ctx, -40, -150, 120, 90, '#9a72c4', { seed: seed + 7, alpha: 0.4, layers: 3 });
    stroke(ctx, [[-300 + sway, -8], [-80, -12], [175 + sway, -8]], { t, seed: seed + 8, lw: 14, color: PAL.gold });
    for (let i = 0; i < 5; i++) dot(ctx, -150 + i * 60 + sway * 0.5, -120 + (i % 2) * 40, 7, PAL.gold);
    blob(ctx, 0, -288, 112, 34, PAL.ermine, { t, seed: seed + 9, lw: 4 });
    for (let i = 0; i < 6; i++) dot(ctx, -80 + i * 32, -288 + (i % 2) * 8, 4);
    ctx.restore();
  }

  // Head.
  ctx.save();
  ctx.translate(0, -345);
  ctx.rotate(chin);
  blob(ctx, -60, 4, 13, 18, PAL.skin, { t, seed: seed + 40, lw: 3 });
  blob(ctx, 0, 0, 64, 66, PAL.skin, { t, seed: seed + 41, lw: 4.5 });
  // Rosy cheeks, then the whole face reddens with blush.
  wash(ctx, -34, 18, 16, 11, PAL.blush, { seed: seed + 42, alpha: 0.45 + blush * 0.4, layers: 3 });
  wash(ctx, 36, 18, 16, 11, PAL.blush, { seed: seed + 43, alpha: 0.45 + blush * 0.4, layers: 3 });
  if (blush > 0) wash(ctx, 0, 0, 62, 62, '#e8423a', { seed: seed + 44, alpha: blush * 0.45, layers: 4, wobble: 0.08 });
  // White beard + moustache.
  blob(ctx, 4, 46, 52, 34, '#f1ece2', { t, seed: seed + 45, lw: 3.5, wob: 0.12 });
  eyes(ctx, 64, { mood, look, t, seed: seed + 46 });
  blob(ctx, 10, 6, 13, 11, PAL.skin2, { t, seed: seed + 47, lw: 3 });
  mouthMark(ctx, 64, mouth, t, seed + 48, 36);
  stroke(ctx, [[-36, 26], [-14, 20], [10, 24]], { t, seed: seed + 49, lw: 5 });
  stroke(ctx, [[12, 24], [34, 18], [52, 26], [56, 16]], { t, seed: seed + 50, lw: 5 });
  // Crown.
  ctx.save();
  ctx.translate(0, -56);
  ctx.rotate(-0.08);
  shape(ctx, [[-46, 6], [-52, -48], [-26, -22], [0, -60], [26, -22], [52, -48], [46, 6]], PAL.gold, { t, seed: seed + 51, lw: 4, sharp: true });
  dot(ctx, 0, -14, 7, PAL.red); dot(ctx, -28, -6, 5, '#4f86c6'); dot(ctx, 28, -6, 5, '#4f86c6');
  for (const [cx, cy] of [[-52, -48], [0, -60], [52, -48]]) dot(ctx, cx, cy, 5, '#fff3c4');
  ctx.restore();
  // Sweat drops.
  if (sweat > 0) {
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.9 + i * 0.5) % 1);
      ctx.save();
      ctx.globalAlpha *= sweat * (1 - k);
      shape(ctx, [[-72 - i * 16, -40 + k * 40 - 14], [-62 - i * 16, -40 + k * 40], [-82 - i * 16, -40 + k * 40]], '#9fd0ee', { t, seed: seed + 52 + i, lw: 2.5 });
      ctx.restore();
    }
  }
  ctx.restore();

  // Front arm last.
  arm(ctx, shR, handPose[1], bends[1], 30, armColor, t, seed + 31, 17);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Courtiers, weavers, the child
// ---------------------------------------------------------------------------
// pose: side | hold (presenting, both hands forward) | clap | pole (holding a
// canopy pole up) | train (pinching an invisible train, low) | bow | drum
export function courtier(ctx, o) {
  const { x, y, s = 1, t = 0, face = 1, walk = null, pose = 'side', color = '#5f8fc4', mouth = 'smile', mood = 'open',
    seed = 3, look = 0, wig = true, beat = 0 } = o;
  const bob = walk == null ? Math.sin(t * 1.5 + seed) * 2 : -Math.abs(Math.sin(walk)) * 9;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);
  groundShadow(ctx, 70);
  legs(ctx, { hipX: 20, hipY: -120 + bob, walk, color: '#efe9de', shoe: '#3a2f2a', t, seed: seed + 20, w: 15, stride: 28 });
  ctx.translate(0, bob);
  if (pose === 'bow') { ctx.translate(0, -120); ctx.rotate(0.35); ctx.translate(0, 120); }
  const clapK = Math.abs(Math.sin(t * 9 + seed));
  const hands = {
    side: [[-52, -160], [52, -160]],
    hold: [[70, -240], [110, -228]],
    clap: [[40 + clapK * 18, -230], [62 - clapK * 18, -232]],
    pole: [[48, -350], [52, -260]],
    train: [[78, -196], [96, -206]],
    bow: [[30, -170], [50, -165]],
    drum: [[60 + Math.sin(beat) * 10, -200 - Math.max(0, Math.sin(beat)) * 40], [90 - Math.sin(beat) * 10, -200 - Math.max(0, -Math.sin(beat)) * 40]],
    cheer: [[-60, -380], [60, -380]],
  }[pose];
  arm(ctx, [-34, -282], hands[0], [-16, 16], 18, color, t, seed + 30, 11);
  // Coat.
  shape(ctx, [[-38, -296], [38, -296], [62, -112], [0, -104], [-62, -112]], color, { t, seed: seed + 1, lw: 4 });
  wash(ctx, -12, -210, 30, 70, '#ffffff', { seed: seed + 2, alpha: 0.18, layers: 3 });
  for (let i = 0; i < 4; i++) dot(ctx, 6, -270 + i * 38, 4.5, PAL.gold);
  blob(ctx, 4, -296, 24, 10, '#fffaf0', { t, seed: seed + 3, lw: 3 }); // jabot
  // Head + wig.
  ctx.save();
  ctx.translate(2, -338);
  if (wig) for (const s2 of [-1, 1]) for (let k = 0; k < 3; k++) blob(ctx, s2 * 38, -14 + k * 20, 15, 12, '#f2efe8', { t, seed: seed + 40 + k + s2, lw: 3 });
  blob(ctx, 0, 0, 40, 44, PAL.skin, { t, seed: seed + 41, lw: 4 });
  if (wig) blob(ctx, 0, -36, 40, 18, '#f2efe8', { t, seed: seed + 42, lw: 3 });
  eyes(ctx, 40, { mood, look, t, seed: seed + 43 });
  blob(ctx, 16, 4, 14, 8, PAL.skin2, { t, seed: seed + 44, lw: 3 }); // long nose
  mouthMark(ctx, 40, mouth, t, seed + 45, 20);
  wash(ctx, -20, 12, 9, 6, PAL.blush, { seed: seed + 46, alpha: 0.4, layers: 2 });
  ctx.restore();
  arm(ctx, [34, -282], hands[1], [16, 16], 18, color, t, seed + 31, 11);
  if (pose === 'drum') {
    blob(ctx, 80, -150, 52, 40, '#e05a4a', { t, seed: seed + 60, lw: 4 });
    stroke(ctx, [[30, -160], [130, -160]], { t, seed: seed + 61, lw: 3, color: '#f2c14e' });
  }
  ctx.restore();
}

// pose: walk | weave (phase) | present | lean (wink at camera)
export function weaver(ctx, o) {
  const { x, y, s = 1, t = 0, face = 1, walk = null, pose = 'walk', color = '#8f7a5c', hat = '#6b4d8f', seed = 7,
    mouth = 'grin', mood = 'open', phase = 0, lean = 0 } = o;
  const bob = walk == null ? Math.sin(t * 2 + seed) * 2 : -Math.abs(Math.sin(walk)) * 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);
  groundShadow(ctx, 70);
  legs(ctx, { hipX: 22, hipY: -115 + bob, walk, color: '#6e5a48', shoe: '#3a2f2a', t, seed: seed + 20, w: 16, stride: 30 });
  ctx.translate(0, bob - 110);
  ctx.rotate(0.12 + lean * 0.35); // hunched, sneaky
  ctx.translate(0, 110);
  const hands = {
    walk: [[-46, -150], [56, -150]],
    weave: [[50 + Math.sin(phase) * 46, -205 + Math.cos(phase * 2) * 6], [90 + Math.sin(phase + 1.7) * 30, -230]],
    present: [[60, -330], [80, -300]],
    lean: [[50, -220], [70, -300]],
  }[pose];
  arm(ctx, [-30, -268], hands[0], [-14, 14], 17, color, t, seed + 30, 11);
  shape(ctx, [[-34, -282], [36, -282], [58, -110], [-56, -112]], color, { t, seed: seed + 1, lw: 4 });
  shape(ctx, [[-30, -200], [-6, -204], [-8, -176], [-30, -178]], '#c9a26b', { t, seed: seed + 2, lw: 3 }); // patch
  stroke(ctx, [[-50, -130], [54, -128]], { t, seed: seed + 3, lw: 6, color: '#5a4636' });
  ctx.save();
  ctx.translate(4, -322);
  blob(ctx, 0, 0, 38, 40, PAL.skin, { t, seed: seed + 41, lw: 4 });
  eyes(ctx, 38, { mood, t, seed: seed + 43, look: 0.6 });
  blob(ctx, 24, 8, 16, 12, PAL.skin2, { t, seed: seed + 44, lw: 3 });
  mouthMark(ctx, 38, mouth, t, seed + 45, 20);
  stroke(ctx, [[-14, -18], [0, -24], [12, -20]], { t, seed: seed + 46, lw: 3 }); // sly brow
  // Floppy pointed hat.
  const flop = Math.sin(t * 3 + seed) * 6;
  shape(ctx, [[-42, -22], [44, -24], [10, -70], [-40 + flop, -96], [-58 + flop, -78]], hat, { t, seed: seed + 47, lw: 4 });
  blob(ctx, -60 + flop, -80, 9, 9, PAL.gold, { t, seed: seed + 48, lw: 3 });
  ctx.restore();
  arm(ctx, [30, -268], hands[1], [14, 14], 17, color, t, seed + 31, 11);
  ctx.restore();
}

// pose: stand | point (arm thrust up-forward); mouth: smile|shout|o
export function child(ctx, o) {
  const { x, y, s = 1, t = 0, face = 1, pose = 'stand', mouth = 'smile', mood = 'open', seed = 5, hop = 0 } = o;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);
  groundShadow(ctx, 50);
  ctx.translate(0, -hop);
  legs(ctx, { hipX: 16, hipY: -80, walk: null, color: PAL.skin, shoe: '#6b4d8f', t, seed: seed + 20, w: 14 });
  const point = pose === 'point';
  arm(ctx, [-26, -150], point ? [-50, -100] : [-44, -95], [-10, 0], 14, '#f2c94c', t, seed + 30, 10);
  shape(ctx, [[-30, -160], [30, -160], [44, -76], [-44, -76]], '#f2c94c', { t, seed: seed + 1, lw: 4 });
  ctx.save();
  ctx.translate(2, -200);
  blob(ctx, 0, 0, 40, 40, PAL.skin, { t, seed: seed + 41, lw: 4 });
  // Messy hair.
  for (let k = 0; k < 5; k++) blob(ctx, -30 + k * 15, -32 - (k % 2) * 6, 13, 11, '#7a4a2a', { t, seed: seed + 50 + k, lw: 2.5 });
  eyes(ctx, 40, { mood, t, seed: seed + 43, look: 0.4 });
  mouthMark(ctx, 40, mouth, t, seed + 45, 18);
  wash(ctx, -20, 10, 8, 6, PAL.blush, { seed: seed + 46, alpha: 0.5, layers: 2 });
  wash(ctx, 22, 10, 8, 6, PAL.blush, { seed: seed + 47, alpha: 0.5, layers: 2 });
  ctx.restore();
  if (point) {
    arm(ctx, [26, -150], [96, -232], [10, 6], 14, '#f2c94c', t, seed + 31, 10);
    limb(ctx, [[100, -236], [116, -252]], 6, PAL.skin, { t, seed: seed + 60 }); // pointing finger
  } else arm(ctx, [26, -150], [44, -95], [10, 0], 14, '#f2c94c', t, seed + 31, 10);
  ctx.restore();
}

// A row of townsfolk (head + shoulders, some with flags). mode(i) returns one
// of watch | cheer | gasp | laugh for person i; look is -1..1 gaze.
export function crowd(ctx, o) {
  const { x0, x1, y, gap = 120, s = 1, t = 0, seed = 100, mode = () => 'watch', look = () => 0, beat = 0.6, skip = null } = o;
  let i = 0;
  for (let x = x0; x < x1; x += gap, i++) {
    if (skip && skip(x)) continue;
    const r = rngish(seed, i);
    const m = mode(i, x);
    const px = x + (r[0] - 0.5) * gap * 0.4;
    const sc = s * (0.85 + r[1] * 0.3);
    let by = 0;
    if (m === 'cheer') by = -Math.abs(Math.sin((t / beat) * Math.PI + r[2] * 3)) * 18;
    if (m === 'laugh') by = -Math.abs(Math.sin(t * 14 + i)) * 7;
    ctx.save();
    ctx.translate(px, y + by);
    ctx.scale(sc, sc);
    const coat = COATS[Math.floor(r[3] * COATS.length)];
    const skin = [PAL.skin, PAL.skin2, PAL.skin3][Math.floor(r[4] * 3)];
    if (m === 'cheer' || (m === 'watch' && r[5] > 0.7)) {
      const up = m === 'cheer' ? 1 : 0.6;
      const wav = Math.sin(t * 6 + i) * 10;
      arm(ctx, [-40, -90], [-70 + wav, -90 - 120 * up], [-12, 0], 16, coat, t, seed + i * 7, 11);
      if (r[6] > 0.5) { // little flag
        stroke(ctx, [[-70 + wav, -90 - 120 * up], [-70 + wav, -90 - 120 * up - 70]], { t, seed: seed + i, lw: 4, color: '#6b4d3a' });
        const fy = -90 - 120 * up - 70, fl = Math.sin(t * 8 + i) * 8;
        shape(ctx, [[-70 + wav, fy], [-20 + wav, fy + 10 + fl], [-70 + wav, fy + 30]], ['#e0505a', '#f2c14e', '#5f8fc4'][i % 3], { t, seed: seed + i + 3, lw: 3, sharp: true });
      }
    }
    blob(ctx, 0, -20, 66, 70, coat, { t, seed: seed + i * 3, lw: 4 });
    ctx.save();
    ctx.translate(0, -118);
    if (m === 'laugh') ctx.rotate(Math.sin(t * 9 + i) * 0.12);
    blob(ctx, 0, 0, 44, 46, skin, { t, seed: seed + i * 3 + 1, lw: 4 });
    const hair = ['#3d2a1e', '#7a4a2a', '#c9a26b', '#2b2b2b', '#a64b2a'][Math.floor(r[7] * 5)];
    blob(ctx, 0, -30, 44, 20, hair, { t, seed: seed + i * 3 + 2, lw: 3 });
    if (r[8] > 0.6) shape(ctx, [[-48, -34], [48, -34], [30, -66], [-30, -66]], ['#6b4d8f', '#c4704f', '#4f9e9a'][i % 3], { t, seed: seed + i, lw: 3 }); // hat
    const mood = m === 'gasp' ? 'shock' : m === 'laugh' ? 'laugh' : 'open';
    eyes(ctx, 44, { mood, look: look(i, x), t, seed: seed + i * 5 });
    mouthMark(ctx, 44, m === 'gasp' ? 'o' : m === 'laugh' ? 'laugh' : m === 'cheer' ? 'o' : 'smile', t, seed + i * 5 + 1, 20);
    ctx.restore();
    ctx.restore();
  }
}
function rngish(seed, i) { return Array.from({ length: 9 }, (_, k) => hash(seed, i, k + 1)); }

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
// The "cloth": nothing at all, just a dashed shimmering outline + glints.
export function invisibleCloth(ctx, x, y, w, h, t, { alpha = 1, seed = 9, wave = 1 } = {}) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.setLineDash([14, 16]);
  ctx.lineDashOffset = -t * 40;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(107,77,143,0.55)';
  ctx.beginPath();
  const n = 20;
  for (let i = 0; i <= n; i++) { const k = i / n; ctx.lineTo(x + w * k, y + Math.sin(t * 2 + k * 6) * 8 * wave); }
  for (let i = 0; i <= n; i++) { const k = i / n; ctx.lineTo(x + w * (1 - k), y + h + Math.sin(t * 2 + (1 - k) * 6 + 1) * 10 * wave); }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 9; i++) {
    const ph = (t * 0.7 + hash(seed, i)) % 1;
    const a = Math.sin(Math.PI * ph);
    sparkle(ctx, x + w * hash(seed, i, 2), y + h * hash(seed, i, 3), 10 + 14 * a, { alpha: a * 0.9, rot: t + i, color: i % 2 ? '#fff4c2' : '#e7d8ff' });
  }
  ctx.restore();
}

export function loom(ctx, x, y, s, t, { seed = 21 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const C = PAL.wood;
  limb(ctx, [[-170, 0], [-170, -330]], 20, C, { t, seed });
  limb(ctx, [[170, 0], [170, -330]], 20, C, { t, seed: seed + 1 });
  limb(ctx, [[-200, -330], [200, -330]], 22, C, { t, seed: seed + 2 });
  limb(ctx, [[-180, -90], [180, -90]], 18, C, { t, seed: seed + 3 });
  limb(ctx, [[-190, -250], [190, -250]], 14, C, { t, seed: seed + 4 });
  for (let i = 0; i < 13; i++) {
    const xx = -150 + i * 25;
    stroke(ctx, [[xx, -320], [xx, -100]], { t, seed: seed + 10 + i, lw: 1.6, color: 'rgba(60,40,30,0.55)' });
  }
  ctx.restore();
}

// Palace interior: warm wall, floor, columns, red curtain swags, window light.
export function palace(ctx, t, { tint = 0 } = {}) {
  ctx.fillStyle = PAL.wall; ctx.fillRect(-400, -400, W + 800, H + 800);
  wash(ctx, W * 0.5, H * 0.35, W * 0.7, H * 0.5, '#f8e7c9', { seed: 2, alpha: 0.5, layers: 4 });
  // Floor.
  ctx.fillStyle = PAL.floor; ctx.fillRect(-400, 820, W + 800, H);
  for (let i = -4; i < 20; i++) stroke(ctx, [[i * 140, 820], [i * 140 - 80 + (i - 7) * 40, H + 40]], { t: 0, seed: 70 + i, lw: 2, color: 'rgba(120,80,50,0.35)' });
  stroke(ctx, [[-400, 822], [W + 400, 818]], { t, seed: 80, lw: 4 });
  // Tall window with light beam.
  shape(ctx, [[820, 140], [1100, 140], [1100, 600], [820, 600]], '#cfe6f2', { t, seed: 81, lw: 5, sharp: true });
  stroke(ctx, [[960, 140], [960, 600]], { t, seed: 82, lw: 4 });
  stroke(ctx, [[820, 370], [1100, 370]], { t, seed: 83, lw: 4 });
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.04 * Math.sin(t * 0.8);
  ctx.fillStyle = '#fff6d0';
  ctx.beginPath(); ctx.moveTo(820, 600); ctx.lineTo(1100, 600); ctx.lineTo(1400, 1080); ctx.lineTo(700, 1080); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Columns.
  for (const cx of [180, 1740]) {
    shape(ctx, [[cx - 55, 60], [cx + 55, 60], [cx + 55, 820], [cx - 55, 820]], '#efe6d6', { t, seed: 90 + cx, lw: 4, sharp: true });
    for (let k = -1; k <= 1; k++) stroke(ctx, [[cx + k * 26, 90], [cx + k * 26, 790]], { t, seed: 91 + cx + k, lw: 2, color: 'rgba(90,70,50,0.4)' });
    shape(ctx, [[cx - 80, 40], [cx + 80, 40], [cx + 70, 80], [cx - 70, 80]], '#e6d7bd', { t, seed: 95 + cx, lw: 4, sharp: true });
  }
  // Curtain swags along the top.
  const sway = Math.sin(t * 0.9) * 4;
  for (let i = 0; i < 5; i++) {
    const a = i * 420 - 60, b = a + 460;
    shape(ctx, [[a, -10], [b, -10], [b - 30, 30], [(a + b) / 2, 110 + sway], [a + 30, 30]], PAL.curtain, { t, seed: 100 + i, lw: 4 });
    stroke(ctx, [[a + 40, 40], [(a + b) / 2, 100 + sway], [b - 40, 40]], { t, seed: 110 + i, lw: 6, color: PAL.gold });
  }
  if (tint) { ctx.fillStyle = `rgba(80,60,90,${tint})`; ctx.fillRect(-400, -400, W + 800, H + 800); }
}

// Fringed canopy carried on two poles.
export function canopy(ctx, xa, xb, y, t, { seed = 61 } = {}) {
  const sag = 16 + Math.sin(t * 4) * 4;
  shape(ctx, [[xa - 30, y], [xb + 30, y], [xb + 10, y + 40], [(xa + xb) / 2, y + 40 + sag], [xa - 10, y + 40]], PAL.red, { t, seed, lw: 4 });
  wash(ctx, (xa + xb) / 2, y + 18, (xb - xa) * 0.35, 14, '#f6a08a', { seed: seed + 1, alpha: 0.4, layers: 2 });
  for (let i = 0; i <= 12; i++) {
    const k = i / 12, fx = xa - 10 + (xb - xa + 20) * k;
    const fy = y + 40 + Math.sin(Math.PI * k) * sag;
    stroke(ctx, [[fx, fy], [fx + Math.sin(t * 6 + i) * 4, fy + 20]], { t, seed: seed + 10 + i, lw: 4, color: PAL.gold });
  }
  star(ctx, (xa + xb) / 2, y - 18, 20, t, seed);
}
function star(ctx, x, y, r, t, seed) {
  shape(ctx, Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
  }), PAL.gold, { t, seed, lw: 3, sharp: true });
}

// Triangular bunting on a sagging string, fluttering.
export function bunting(ctx, x0, x1, y, sag, t, { seed = 140, n = 14 } = {}) {
  const pts = [];
  for (let i = 0; i <= 30; i++) { const k = i / 30; pts.push([x0 + (x1 - x0) * k, y + Math.sin(Math.PI * k) * sag]); }
  stroke(ctx, pts, { t, seed, lw: 3 });
  const cols = ['#e0505a', '#f2c14e', '#5f8fc4', '#6aa57c', '#a073b8'];
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, fx = x0 + (x1 - x0) * k, fy = y + Math.sin(Math.PI * k) * sag;
    const fl = Math.sin(t * 5 + i * 0.9) * 10;
    shape(ctx, [[fx - 22, fy], [fx + 22, fy], [fx + fl * 0.6, fy + 54]], cols[(i + seed) % cols.length], { t, seed: seed + i, lw: 3, sharp: true });
  }
}

export function confetti(ctx, t, t0, { n = 90, seed = 300, dur = 3.5, x0 = 0, x1 = W } = {}) {
  if (t < t0) return;
  const cols = ['#e0505a', '#f2c14e', '#5f8fc4', '#6aa57c', '#a073b8', '#f4a7b9'];
  for (let i = 0; i < n; i++) {
    const born = t0 + hash(seed, i) * 1.2;
    const u = t - born;
    if (u < 0 || u > dur) continue;
    const x = x0 + (x1 - x0) * hash(seed, i, 2) + Math.sin(u * 3 + i) * 40;
    const y = -40 + u * (220 + 160 * hash(seed, i, 3)) + 30 * u * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(u * (4 + 6 * hash(seed, i, 4)));
    ctx.scale(1, Math.cos(u * 8 + i));
    ctx.fillStyle = cols[i % cols.length];
    ctx.globalAlpha *= clamp(dur - u);
    ctx.fillRect(-9, -5, 18, 10);
    ctx.restore();
  }
}

// Jagged shout bubble with text in it.
export function shoutBubble(ctx, x, y, w, h, t, { k = 1, seed = 400, tailTo = null } = {}) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const n = 22, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = i % 2 ? 0.86 : 1.06 + 0.06 * hash(seed, i);
    pts.push([Math.cos(a) * w / 2 * rr, Math.sin(a) * h / 2 * rr]);
  }
  if (tailTo) ctx.save();
  shape(ctx, pts, '#fffdf5', { t, seed, lw: 6, sharp: true });
  if (tailTo) {
    ctx.restore();
    shape(ctx, [[-30, h * 0.35], [30, h * 0.4], [tailTo[0] - x, tailTo[1] - y]].map(([a, b]) => [a / k, b / k]), '#fffdf5', { t, seed: seed + 1, lw: 6, sharp: true });
    ctx.fillStyle = '#fffdf5';
    ctx.beginPath(); ctx.ellipse(0, h * 0.3, 50, 30, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Camera, copy and scene fades
// ---------------------------------------------------------------------------
// Look at world point (cx, cy) with zoom z.
export function camera(ctx, cx, cy, z = 1) {
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
}

// Draws scene.copy.lines in screen space. Each line: { text, at, dur, x, y,
// size, font, color, rot, out, pop, band } (absolute times). `pop: true` pops
// the glyphs in; `band: true` lays a soft paper wash behind it for legibility.
export function drawCopy(ctx, t, scene) {
  for (const line of scene.copy?.lines ?? []) {
    const at = line.at ?? scene.start;
    if (t < at) continue;
    const alpha = line.out != null ? 1 - invLerp(line.out, line.out + 0.4, t) : 1;
    if (alpha <= 0) continue;
    const x = line.x ?? W / 2, y = line.y ?? 130, size = line.size ?? 96;
    const font = line.font ?? 'CJK', color = line.color ?? INK;
    if (line.band) {
      ctx.save();
      ctx.globalAlpha *= alpha * clamp((t - at) / 0.3);
      wash(ctx, x, y, Math.min(W * 0.46, size * line.text.length * 0.55 + 80), size * 0.75, '#fffaf0', { seed: Math.round(at * 10), alpha: 0.85, layers: 4, wobble: 0.08 });
      ctx.restore();
    }
    if (line.pop) {
      ctx.save(); ctx.globalAlpha *= alpha;
      popText(ctx, line.text, x, y, t, at, { size, font, color, stagger: line.stagger ?? 0.07 });
      ctx.restore();
    } else {
      writeText(ctx, line.text, x, y, { size, font, color, progress: invLerp(at, at + (line.dur ?? 1), t), rot: line.rot ?? 0, alpha });
    }
  }
}

// Render `body(ctx)` and composite it with the scene's lead fade-in / tail
// fade-out as ONE layer (so overlapping shapes don't ghost through each other).
let off = null;
export function withFade(ctx, t, scene, body) {
  const lead = scene.lead || 0, tail = scene.tail || 0;
  const fadeIn = lead > 0 ? invLerp(scene.start - lead, scene.start - lead + (scene.params?.fade ?? lead), t) : 1;
  const fadeOut = tail > 0 ? 1 - invLerp(scene.end, scene.end + tail, t) : 1;
  const a = fadeIn * fadeOut;
  if (a >= 0.999) { body(ctx); return; }
  if (!off) off = createCanvas(W, H);
  const o = off.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, W, H);
  o.save(); body(o); o.restore();
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(off, 0, 0); ctx.restore();
}

export { lerp, invLerp, clamp, hash };
