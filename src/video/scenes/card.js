// Generic, data-only scene ("module": "card") so a new story pack can block
// out its whole timeline before writing any custom animation code.
//
//   params.background  flat colour (default: meta.background)
//   params.paper       true to lay the extracted paper texture under it (needs the 'paper' asset)
//   params.fade        seconds of fade-in at scene start (default: lead || 0.4)
//   params.layers      [{ asset, x, y, h, at, out?, rot?, ax?, ay?, flip? }]  sprites that pop in at `at`
//                      (absolute seconds) and pop out at `out`; x/y are the anchor (default bottom centre)
//   copy.lines         [{ text, at, dur?, x?, y?, size?, font?, color?, rot?, out? }]  handwritten text
//
// Times are absolute seconds on the film clock, like the cues.
import { W, H, INK, sprite, paper, writeText, pop } from '../engine.js';
import { invLerp } from '../../lib/util.js';
import { activeStory } from '../../story/load.js';

const DEFAULT_BG = activeStory().meta?.background ?? '#fbf4e6';

export function draw(ctx, t, scene) {
  const { params = {}, copy = {}, start, end } = scene;
  const fade = params.fade ?? (scene.lead || 0.4);
  ctx.globalAlpha = invLerp(start - (scene.lead || 0), start - (scene.lead || 0) + fade, t);
  ctx.fillStyle = params.background ?? DEFAULT_BG;
  ctx.fillRect(0, 0, W, H);
  if (params.paper) paper(ctx, t);

  (params.layers ?? []).forEach((L, i) => {
    let s = pop(t, L.at ?? start);
    if (L.out != null) s *= 1 - invLerp(L.out, L.out + 0.3, t);
    if (s <= 0.01) return;
    sprite(ctx, L.asset, {
      x: L.x ?? W / 2, y: L.y ?? H - 80, h: L.h ?? 400, ax: L.ax ?? 0.5, ay: L.ay ?? 1,
      rot: L.rot ?? 0, flip: !!L.flip, sx: s, sy: s, seed: i + 1, t,
    });
  });

  for (const line of copy.lines ?? []) {
    const at = line.at ?? start;
    if (t < at) continue;
    const alpha = line.out != null ? 1 - invLerp(line.out, line.out + 0.4, t) : 1;
    writeText(ctx, line.text, line.x ?? W / 2, line.y ?? H * 0.25, {
      size: line.size ?? 110, font: line.font ?? 'Brush', color: line.color ?? INK,
      progress: invLerp(at, at + (line.dur ?? 1.0), t), rot: line.rot ?? 0, alpha,
    });
  }
  // Fade to the next scene over the last `tail` seconds, if any.
  if (scene.tail) ctx.globalAlpha = 1 - invLerp(end, end + scene.tail, t);
}
