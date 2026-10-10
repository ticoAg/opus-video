// "The Emperor's New Clothes" — the street parade (scene "procession"), plus
// the shared street world that emperor-reveal.js keeps using for the child's
// shout and the ending, so the march is one continuous shot.
//
// Parade clock pt = t - (start of the "procession" scene). The procession
// marches on the beat (one stride per two beats of music.bpm) and freezes at
// FREEZE (the child's shout), resuming at RESUME. Override via the procession
// scene's params.beats.
import { W, H, sprite, img, grain, gull } from '../engine.js';
import { BEAT, smooth, hash } from '../../lib/util.js';
import { activeStory } from '../../story/load.js';
import {
  emperor, courtier, crowd, canopy, bunting, invisibleCloth, confetti, camera, drawCopy, withFade, invLerp, lerp, clamp, PAL,
} from './emperor-kit.js';

const DEFAULTS = { gust: 3.5, hooray: 6.5, freeze: 13.2, resume: 18.0 };
const GROUND = 900; // procession feet
const SPEED = 150, SLOW = 105;

export function paradeClock(t) {
  const proc = activeStory().scenes.find((s) => s.id === 'procession');
  const P = { ...DEFAULTS, ...proc?.params?.beats };
  return { pt: t - (proc?.start ?? 30), P };
}

// Distance marched (frozen between freeze and resume, slower after).
export function marchX(pt, P) {
  if (pt < P.freeze) return 300 + SPEED * pt;
  const xf = 300 + SPEED * P.freeze;
  if (pt < P.resume) return xf;
  return xf + SLOW * (pt - P.resume);
}
// Stride phase: legs swing once per two beats; frozen mid-step at the shout.
export function marchPhase(pt, P) {
  const per = Math.PI / BEAT; // half-cycle per beat
  if (pt < P.freeze) return pt * per;
  if (pt < P.resume) return P.freeze * per;
  return P.freeze * per + (pt - P.resume) * per * 0.8;
}
export const CHILD_X = (P) => marchX(P.freeze - 0.6, P) + 330;

const HOUSES = ['housesRow.sticker', 'houseBlue.sticker', 'houseStone.sticker', 'houseBlue.sticker', 'housesRow.sticker', 'houseStone.sticker'];
let row = null;
function houseRow() {
  if (row) return row;
  row = [];
  let x = -900;
  for (let i = 0; x < 6000; i++) {
    const key = HOUSES[i % HOUSES.length];
    const h = key.startsWith('houseStone') ? 300 : 430;
    const w = (img(key).width / img(key).height) * h;
    row.push({ key, x: x + w / 2, h, flip: i % 3 === 1 });
    x += w - 40;
  }
  return row;
}

// Draw the whole street in world space. o: { cam: [x, y, z], crowdMode(i,x),
// look(i,x), child: fn(ctx) drawn in the front row, emperorPose: {...},
// gray 0..1, sun 0..1, gust 0..1, confettiAt }
export function street(ctx, t, o) {
  const { pt, P } = paradeClock(t);
  const [cx, cy, z] = o.cam;
  ctx.save();
  // Sky (screen space, behind everything).
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#a9d4ee'); g.addColorStop(0.6, '#e9f3f4'); g.addColorStop(1, '#f6ecd9');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  camera(ctx, cx, cy, z);
  const layer = (p, fn) => { ctx.save(); ctx.translate(cx * (1 - p), cy * (1 - p) * 0.3); fn(); ctx.restore(); };

  // Clouds and gulls far away.
  layer(0.15, () => {
    for (let i = 0; i < 6; i++) {
      const key = i % 2 ? 'cloud1.sticker' : 'cloud1.sticker';
      sprite(ctx, key, { x: i * 520 - 300 + ((t * 12) % 520), y: 170 + (i % 3) * 50, h: 110 + (i % 2) * 30, t, seed: 200 + i, boil: 0.6 });
    }
    for (let i = 0; i < 4; i++) gull(ctx, 200 + i * 340 + t * 40, 230 + Math.sin(t + i) * 30, 22, t * 7 + i);
  });
  // Houses + bunting (mid layer).
  layer(0.5, () => {
    for (const hs of houseRow()) sprite(ctx, hs.key, { x: hs.x, y: 712, h: hs.h, flip: hs.flip, t, seed: Math.round(hs.x), boil: 0.5 });
    const gustK = o.gust ?? 0;
    for (let i = -1; i < 6; i++) bunting(ctx, i * 900 - 100, i * 900 + 800, 140 + (i % 2) * 30, 90 + gustK * 30, t * (1 + gustK * 1.5), { seed: 140 + i * 3 });
  });
  // Street.
  ctx.fillStyle = '#ead8b8'; ctx.fillRect(-2000, 700, 9000, 800);
  ctx.save(); ctx.globalAlpha = 0.35;
  for (let i = -10; i < 60; i++) { ctx.fillStyle = i % 2 ? '#dcc7a2' : '#e3cfac'; ctx.fillRect(i * 140, 740 + (i % 3) * 40, 120, 26); }
  ctx.restore();

  // Back crowd row (behind the procession).
  layer(0.85, () => crowd(ctx, { x0: -800, x1: 6000, y: 790, gap: 105, s: 0.62, t, seed: 500,
    mode: (i, x) => o.crowdMode(i, x, 'back'), look: o.look ?? (() => 0), beat: BEAT }));

  // The procession, right to left: drummer, front bearer, emperor, back bearer, chamberlains.
  const E = marchX(pt, P), ph = marchPhase(pt, P);
  const moving = pt < P.freeze || pt >= P.resume;
  const walk = (k) => (moving ? ph + k : null);
  const ep = o.emperorPose ?? {};
  // Invisible train carried by the chamberlains.
  invisibleCloth(ctx, E - 470, GROUND - 230, 420, 80, t, { alpha: 0.9, wave: 0.6, seed: 31 });
  courtier(ctx, { x: E - 520, y: GROUND + 10, s: 0.82, t, walk: walk(2.4), pose: 'train', color: '#a073b8', seed: 61, mood: ep.crowdMood ?? 'open', mouth: ep.crowdMouth ?? 'smile' });
  courtier(ctx, { x: E - 380, y: GROUND, s: 0.82, t, walk: walk(1.2), pose: 'train', color: '#4f9e9a', seed: 71, mood: ep.crowdMood ?? 'open', mouth: ep.crowdMouth ?? 'smile', wig: false });
  const bearerY = GROUND - 10;
  courtier(ctx, { x: E - 200, y: bearerY, s: 0.86, t, walk: walk(Math.PI), pose: 'pole', color: '#5f8fc4', seed: 41, mood: ep.crowdMood ?? 'open', mouth: ep.crowdMouth ?? 'smile' });
  courtier(ctx, { x: E + 230, y: bearerY, s: 0.86, t, walk: walk(0.3), pose: 'pole', color: '#6aa57c', seed: 51, mood: ep.crowdMood ?? 'open', mouth: ep.crowdMouth ?? 'smile' });
  // Poles + canopy.
  for (const px of [E - 200 + 44, E + 230 + 44]) {
    ctx.save(); ctx.lineWidth = 9; ctx.strokeStyle = PAL.wood; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, bearerY - 160); ctx.lineTo(px, bearerY - 560); ctx.stroke(); ctx.restore();
  }
  canopy(ctx, E - 156, E + 274, bearerY - 580 + (moving ? Math.abs(Math.sin(ph)) * -6 : 0), t);
  emperor(ctx, { x: E, y: GROUND, s: 0.95, t, walk: walk(0), arms: 'proud', mood: 'smug', mouth: 'grin', chin: -0.1, ...ep });
  courtier(ctx, { x: E + 470, y: GROUND, s: 0.82, t, walk: walk(0.6), pose: 'drum', beat: moving ? (pt * Math.PI) / BEAT : 0, color: '#d07a96', seed: 81, wig: false });

  // Front crowd (closest to camera), with the child.
  const fx0 = cx - W / (2 * z) - 200, fx1 = cx + W / (2 * z) + 200;
  const CX = CHILD_X(P);
  crowd(ctx, { x0: Math.floor(fx0 / 125) * 125, x1: fx1, y: 1150, gap: 125, s: 1.0, t, seed: 900,
    mode: (i, x) => o.crowdMode(i, x, 'front'), look: o.look ?? (() => 0), beat: BEAT, skip: o.child ? (x) => Math.abs(x - CX) < 110 : null });
  if (o.child) o.child(ctx, CX);
  if (o.confettiAt != null) {
    ctx.save(); ctx.translate(cx - W / 2, 0);
    confetti(ctx, t, o.confettiAt, { n: 120 });
    ctx.restore();
  }
  ctx.restore();

  // Screen-space light/mood.
  if (o.gray > 0) { ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = o.gray * 0.75; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.fillStyle = `rgba(40,40,70,${o.gray * 0.15})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  return { E, pt, P };
}

// Follow-cam that keeps the emperor a little left of centre.
export const followCam = (E) => [E + 140, 600, 1];

export function draw(ctx, t, scene) {
  const { pt, P } = paradeClock(t);
  const E = marchX(pt, P);
  // Opening: start a bit wider and settle onto the follow-cam.
  const k = smooth(invLerp(0, 2.5, pt));
  const cam = [E + 140, lerp(560, 600, k), lerp(0.9, 1, k)];
  const hooray = pt >= P.hooray;
  const gust = clamp(Math.sin(Math.PI * invLerp(P.gust, P.gust + 2, pt)));
  withFade(ctx, t, scene, (c) => {
    street(c, t, {
      cam, gust,
      crowdMode: (i) => (hooray ? (hash(i, 4) > 0.15 ? 'cheer' : 'watch') : hash(i, 5) > 0.75 ? 'cheer' : 'watch'),
      look: () => -0.3,
      confettiAt: P.hooray + 0.3,
      emperorPose: hooray ? { arms: 'proud' } : { arms: Math.floor(pt / (BEAT * 4)) % 2 ? 'proud' : 'hip' },
    });
    grain(c, t, scene.params?.grainAlpha ?? 0.3);
    drawCopy(c, t, scene);
  });
}
