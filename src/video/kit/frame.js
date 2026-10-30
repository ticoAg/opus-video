// Scene compositing for kit-based scene modules: the scene body is drawn as
// one layer with its lead fade-in / tail fade-out, then the topmost scene
// lays the paper grain, a soft caption band and the captions over the frame,
// and opens from / closes to night at the ends of the film.
import { W, H, createCanvas } from '../engine.js';
import { clamp, invLerp, smooth } from '../../lib/util.js';
import { activeStory } from '../../story/load.js';
import { grain } from './paper.js';
import { CAP, captionLines, captions } from './captions.js';

const STORY = activeStory();
// Caption band colour as ['r,g,b', alpha] (an rgb()/rgba() colour), or null.
const BAND = (() => {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(CAP.band);
  return m ? [`${m[1]},${m[2]},${m[3]}`, m[4] === undefined ? 1 : Number(m[4])] : null;
})();

// Is `scene` the last one the renderer draws at time t (story order)?
function isTop(scene, t) {
  for (let i = STORY.scenes.length - 1; i >= 0; i--) {
    const s = STORY.scenes[i];
    if (t >= s.start - (s.lead || 0) && t < s.end + (s.tail || 0)) return s.id === scene.id;
  }
  return false;
}

// Draw a scene: `body` is composited as one layer with the scene's lead
// fade-in / tail fade-out; the topmost scene then lays the paper grain, a soft
// band and the captions over the whole frame.
let off = null;
export function frame(ctx, t, scene, body) {
  const lead = scene.lead || 0, tail = scene.tail || 0;
  const fadeIn = lead > 0 ? smooth(invLerp(scene.start - lead, scene.start, t)) : 1;
  const fadeOut = tail > 0 ? 1 - smooth(invLerp(scene.end, scene.end + tail, t)) : 1;
  const a = fadeIn * fadeOut;
  if (a >= 0.999) {
    ctx.save(); body(ctx); ctx.restore();
  } else if (a > 0.001) {
    if (!off) off = createCanvas(W, H);
    const o = off.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, W, H);
    o.save(); body(o); o.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(off, 0, 0); ctx.restore();
  }
  if (!isTop(scene, t)) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  grain(ctx, t, 0.55);
  const vis = Math.max(0, ...captionLines().map((l) => clamp((t - l.times[0] + 0.5) / 0.5) * (1 - clamp((t - l.out) / 0.6))));
  if (vis > 0 && BAND) {
    const band = ctx.createLinearGradient(0, H - 210, 0, H);
    band.addColorStop(0, `rgba(${BAND[0]},0)`);
    band.addColorStop(1, `rgba(${BAND[0]},${BAND[1] * vis})`);
    ctx.fillStyle = band;
    ctx.fillRect(0, H - 210, W, 210);
  }
  captions(ctx, t);
  // Open from (and close to) night.
  const open = 1 - smooth(invLerp(0, 0.9, t));
  const close = smooth(invLerp(STORY.duration - 1.8, STORY.duration - 0.15, t));
  const dark = Math.max(open, close);
  if (dark > 0) { ctx.globalAlpha = dark; ctx.fillStyle = '#070a1a'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
