// Scene 6 — "Dusk": we surface into the sunset and drift across the evening
// sketches while the paper blushes from gold to pink. Two birds on a wire
// chat in the foreground.
import { W, H, sprite, paper, grain, vignette, writeText, gull } from '../engine.js';
import { clamp, ease, invLerp, lerp, spring } from '../../lib/util.js';
import { sceneData } from '../../story/load.js';

// Timing, assets, cues and copy come from the story pack (scene "dusk").
const { start, end, copy } = sceneData('dusk');

const STRIP = [
  { name: 'beach', x: 420, h: 780 },
  { name: 'sunsetBoat', x: 1260, h: 820 },
  { name: 'sunsetSea', x: 2330, h: 760 },
];
const TWEETS = [55.5, 55.75, 56.5];

// Preloaded assets and sound cues: stories/<id>/story.json (scenes[].assets, scenes[].cues).

export function draw(ctx, t) {
  const u = invLerp(start, end, t);
  paper(ctx, t);
  // Sunset light: golden -> peach -> pink, multiplied into the paper.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, lerpColor([250, 196, 120], [214, 150, 200], u));
  g.addColorStop(1, lerpColor([255, 232, 190], [248, 184, 170], u));
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Camera drifts from the sea back toward the beach.
  const camX = lerp(2330, 700, ease.inOutSine(u));
  ctx.save();
  ctx.translate(W / 2 - camX, 0);
  STRIP.forEach((s, i) => {
    sprite(ctx, s.name, { x: s.x, y: 560 + Math.sin(t * 0.6 + i) * 6, h: s.h, ay: 0.5, seed: 150 + i, t });
  });
  ctx.restore();

  for (let i = 0; i < 4; i++) {
    const x = ((t - start) * 120 + i * 260) % (W + 300) - 150;
    gull(ctx, x, 220 + i * 30 + Math.sin(t * 2 + i) * 12, 18 - i * 2, t * 8 + i);
  }

  // Foreground: two birds on a wire, swaying.
  const sway = Math.sin(t * 1.6) * 0.03;
  let sy = 1;
  for (const tw of TWEETS) if (t > tw && t < tw + 0.4) sy = 1 + 0.08 * Math.sin((t - tw) * 40) * (1 - (t - tw) / 0.4);
  sprite(ctx, 'birdsOnWire', { x: 1480, y: 330, h: 380, ay: 0.5, rot: sway - 0.06, sy, seed: 160, t });

  const wu = invLerp(54.8, 56.2, t);
  const fade = 1 - invLerp(57.2, 57.7, t);
  writeText(ctx, copy.line, 700, 140, { size: 84, font: 'Hand', progress: wu, alpha: fade, rot: -0.02 });
  grain(ctx, t, 0.2);
  vignette(ctx, 0.3, '80,30,40');

  // Surfacing flash from the water.
  const f = clamp(1 - (t - start) / 0.35);
  if (f > 0) {
    ctx.fillStyle = `rgba(255,236,200,${f})`;
    ctx.fillRect(0, 0, W, H);
  }
  void spring;
}

function lerpColor(a, c, u) {
  return `rgb(${a.map((v, i) => Math.round(v + (c[i] - v) * u)).join(',')})`;
}
