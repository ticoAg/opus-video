// "The Emperor's New Clothes" — palace scenes (title, weavers, inspect).
// One module, three beats chosen by scene.params.beat. All inner timings are
// offsets in seconds from scene.start (override any of them with
// scene.params.beats), so moving a scene in story.json moves its animation;
// keep the cues in story.json in step with these offsets.
import { W, H, grain } from '../engine.js';
import { spring, ease, smooth } from '../../lib/util.js';
import {
  emperor, courtier, weaver, loom, palace, invisibleCloth, blob, shape, stroke,
  camera, drawCopy, withFade, invLerp, lerp, clamp, PAL,
} from './emperor-kit.js';
import { sparkle } from '../engine.js';

const DEFAULTS = {
  title: { turn1: 2.5, turn2: 4.5, proud: 6.0 },
  weavers: { stop: 1.9, weave: 2.6, wink: 6.0, unwink: 7.3, peek: 7.5 },
  inspect: { arrive: 1.8, admire: 3.5, doubt: 5.0, zoom: 7.0, zoomOut: 9.3, clap: 9.5, strip: 10.6 },
};

export function draw(ctx, t, scene) {
  const beat = scene.params?.beat ?? scene.id;
  const B = { ...DEFAULTS[beat], ...scene.params?.beats };
  const u = t - scene.start;
  withFade(ctx, t, scene, (c) => {
    c.save();
    if (beat === 'title') title(c, t, u, B);
    else if (beat === 'weavers') weavers(c, t, u, B);
    else inspect(c, t, u, B);
    c.restore();
    if (scene.params?.grain !== false) grain(c, t, scene.params?.grainAlpha ?? 0.35);
    drawCopy(c, t, scene);
  });
}

// --- Title: the emperor preens in his finest robe before a mirror ----------
function title(ctx, t, u, B) {
  const z = lerp(1.0, 1.08, smooth(u / 8));
  camera(ctx, 960, 560, z);
  palace(ctx, t);
  // Mirror (gold oval) with his reflection.
  const mx = 1380, my = 520;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(mx, my, 190, 290, 0, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = '#dcebf0'; ctx.fill();
  ctx.clip();
  const face = facing(u, B);
  ctx.globalAlpha = 0.75;
  emperor(ctx, { x: mx - 20, y: 900, s: 0.9, t, robe: 1, face: -face, arms: pose(u, B), mood: 'smug', chin: -0.06 });
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(mx - 150, my - 200); ctx.lineTo(mx - 60, my - 260); ctx.lineTo(mx + 120, my + 120); ctx.lineTo(mx + 30, my + 200); ctx.fill();
  ctx.restore();
  blob(ctx, mx, my, 190, 290, null, { t, seed: 5, lw: 22, ink: PAL.gold, wob: 0.015 });
  blob(ctx, mx, my, 204, 304, null, { t, seed: 6, lw: 4, wob: 0.015 });
  stroke(ctx, [[mx - 60, my + 290], [mx - 90, 820]], { t, seed: 7, lw: 12, color: PAL.wood });
  stroke(ctx, [[mx + 60, my + 290], [mx + 90, 820]], { t, seed: 8, lw: 12, color: PAL.wood });

  // The emperor: twirls (squash on each turn), then strikes a proud pose.
  const sq = Math.max(turnSquash(u, B.turn1), turnSquash(u, B.turn2));
  emperor(ctx, { x: 820, y: 860, s: 1.05, t, robe: 1, face, arms: pose(u, B), mood: u > B.proud ? 'smug' : 'open',
    mouth: u > B.proud ? 'grin' : 'smile', chin: u > B.proud ? -0.12 : 0, squash: sq });
  // Sparkles around the robe.
  for (let i = 0; i < 7; i++) {
    const ph = (u * 0.6 + i / 7) % 1;
    sparkle(ctx, 820 + Math.cos(i * 2.4) * 230, 620 + Math.sin(i * 1.7) * 200 - ph * 60, 10 + 18 * Math.sin(Math.PI * ph),
      { alpha: Math.sin(Math.PI * ph), rot: u + i });
  }
}
const facing = (u, B) => (u < B.turn1 ? 1 : u < B.turn2 ? -1 : 1);
const pose = (u, B) => (u < B.turn1 ? 'admire' : u < B.turn2 ? 'hip' : u < B.proud ? 'admire' : 'proud');
const turnSquash = (u, at) => (u > at && u < at + 0.6 ? Math.exp(-(u - at) * 6) * Math.sin((u - at) * 24) : 0);

// --- Weavers: two swindlers arrive and "weave" at an empty loom ------------
function weavers(ctx, t, u, B) {
  // Camera: wide, then a springy push-in on the winking weaver, then back.
  const push = clamp(spring(Math.max(0, u - B.wink), 3, 6)) * (1 - smooth(invLerp(B.unwink, B.unwink + 0.5, u)));
  camera(ctx, lerp(960, 1230, push), lerp(560, 520, push), lerp(1, 1.45, push));
  palace(ctx, t, { tint: 0.06 });
  loom(ctx, 1000, 830, 1.1, t);
  // The cloth "grows" while they weave.
  const grow = smooth(invLerp(B.weave, B.weave + 4, u));
  invisibleCloth(ctx, 840, 520, 320, 220 * grow + 10, t, { alpha: 0.4 + 0.6 * grow, wave: 0.4 });

  // Walk-in from the right, then take places either side of the loom.
  const k = smooth(invLerp(0, B.stop, u));
  const ax = lerp(2150, 720, k), bx = lerp(2400, 1290, k);
  const walking = u < B.stop;
  const wph = u * 9;
  const weaving = u >= B.weave;
  const winking = u >= B.wink && u < B.unwink + 0.3;
  weaver(ctx, { x: ax, y: 860, s: 1.05, t, face: u < B.stop + 0.3 ? -1 : 1, walk: walking ? wph : null,
    pose: weaving ? 'weave' : 'walk', phase: t * 7, hat: '#6b4d8f', seed: 7, mouth: 'grin' });
  weaver(ctx, { x: bx, y: 860, s: 1.05, t, face: -1, walk: walking ? wph + 1 : null,
    pose: winking ? 'lean' : weaving ? 'weave' : 'walk', phase: t * 7 + 2, hat: '#4f9e9a', color: '#7c6a54', seed: 17,
    mouth: winking ? 'grin' : 'smile', mood: winking ? 'wink' : 'open', lean: winking ? 0.5 : 0 });
  // Shuttle zipping across the warp.
  if (weaving) {
    const sx = 860 + (Math.sin(t * 3.5) * 0.5 + 0.5) * 280;
    shape(ctx, [[sx - 34, 700], [sx + 34, 700], [sx + 20, 714], [sx - 20, 714]], PAL.wood, { t, seed: 33, lw: 3 });
  }
  // A worried courtier peeks in from the left.
  if (u > B.peek - 0.4) {
    const p = clamp(spring(u - B.peek + 0.4, 3, 5));
    courtier(ctx, { x: lerp(-160, 170, p), y: 880, s: 1.0, t, pose: 'side', mood: 'shock', mouth: 'o', color: '#5f8fc4', seed: 41, look: 1 });
  }
}

// --- Inspect: the emperor admires nothing; the robe comes off --------------
function inspect(ctx, t, u, B) {
  const zin = smooth(invLerp(B.zoom - 0.3, B.zoom + 0.4, u)) * (1 - smooth(invLerp(B.zoomOut, B.zoomOut + 0.5, u)));
  camera(ctx, lerp(960, 1180, zin), lerp(560, 520, zin), lerp(1, 1.9, zin));
  palace(ctx, t);
  loom(ctx, 1180, 830, 1.0, t);

  // Weavers hold up the "cloth" between them.
  weaver(ctx, { x: 950, y: 860, s: 1, t, face: 1, pose: 'present', seed: 7, hat: '#6b4d8f', mouth: 'grin' });
  weaver(ctx, { x: 1420, y: 860, s: 1, t, face: -1, pose: 'present', seed: 17, hat: '#4f9e9a', color: '#7c6a54', mouth: 'grin' });
  invisibleCloth(ctx, 1020, 400, 330, 300, t, { wave: 1 });
  // A fly buzzes straight through the "fabric" during the close-up.
  if (zin > 0.05) {
    const fu = invLerp(B.zoom, B.zoomOut, u);
    const fx = lerp(1000, 1380, fu), fy = 540 + Math.sin(fu * 18) * 50;
    ctx.save(); ctx.globalAlpha = zin;
    blob(ctx, fx, fy, 7, 6, '#333', { t, seed: 77, lw: 0 });
    blob(ctx, fx - 4, fy - 8, 6, 4, 'rgba(200,230,255,0.8)', { t, seed: 78, lw: 1.5 });
    blob(ctx, fx + 4, fy - 8, 6, 4, 'rgba(200,230,255,0.8)', { t, seed: 79, lw: 1.5 });
    for (let i = 0; i < 2; i++) stroke(ctx, [[fx - 20 - i * 18, fy], [fx - 30 - i * 18, fy + 4]], { t, seed: 80 + i, lw: 2, alpha: 0.5 });
    ctx.restore();
  }

  // Entrance from the left (robe on), courtiers behind.
  const k = smooth(invLerp(0, B.arrive, u));
  const ex = lerp(-320, 600, k);
  const walking = u < B.arrive;
  const wph = u * 8;
  const clapping = u >= B.clap;
  courtier(ctx, { x: lerp(-620, 300, k), y: 870, s: 0.95, t, walk: walking ? wph + 1 : null, pose: clapping ? 'clap' : 'side',
    color: '#5f8fc4', seed: 41, mouth: clapping ? 'o' : 'smile', mood: clapping ? 'smug' : 'open' });
  courtier(ctx, { x: lerp(-820, 120, k), y: 880, s: 0.92, t, walk: walking ? wph + 2 : null, pose: clapping ? 'clap' : 'side',
    color: '#6aa57c', seed: 51, mouth: clapping ? 'o' : 'smile', mood: clapping ? 'smug' : 'open', wig: false });

  // Emperor: admires, sweats in doubt, forces a smile, then is "dressed".
  const robe = 1 - ease.inQuad(invLerp(B.strip, B.strip + 0.7, u));
  let arms = 'side', mood = 'open', mouth = 'smile', sweat = 0;
  if (u >= B.admire) { arms = 'spread'; mouth = 'o'; }
  if (u >= B.doubt) { mood = u < B.doubt + 0.8 ? 'shock' : 'open'; mouth = 'wobble'; sweat = 1; arms = 'admire'; }
  if (u >= B.clap) { mouth = 'wobble'; arms = 'hip'; }
  if (u >= B.strip + 0.4) { mood = 'smug'; mouth = 'grin'; sweat = 0.5; arms = 'proud'; }
  const blush = smooth(invLerp(B.strip + 0.3, B.strip + 0.9, u)) * 0.6;
  emperor(ctx, { x: ex, y: 860, s: 1.02, t, walk: walking ? wph : null, robe, arms, mood, mouth, sweat, blush,
    chin: u >= B.strip + 0.4 ? -0.12 : 0 });
  // "Swoosh" lines as the robe flies away.
  if (u > B.strip && u < B.strip + 0.9) {
    const a = 1 - invLerp(B.strip, B.strip + 0.9, u);
    for (let i = 0; i < 4; i++) stroke(ctx, [[ex - 120 + i * 60, 420 - i * 10], [ex - 160 + i * 60, 240 - i * 20]], { t, seed: 90 + i, lw: 5, alpha: a });
  }
}
