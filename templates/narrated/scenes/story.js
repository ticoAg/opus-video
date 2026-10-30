// "{{title}}": scene module. One module, beats chosen by scene.params.beat;
// each draws in world coordinates under camera(), wrapped in frame() (fades,
// paper grain, captions). Key moments come from scene.params.at in absolute
// seconds, the clock the narration, captions and cues share, so retiming a
// beat in story.json moves its animation. Kit catalog: src/video/kit/index.js.
import { W, PAL, frame, sky, moon, ridge, hill, roundTree, pine, fox, titleText, camera, lerp, smooth, invLerp } from '../../../src/video/kit/index.js';

const BEATS = { opening };

export function draw(ctx, t, scene) {
  const beat = scene.params?.beat ?? scene.id;
  frame(ctx, t, scene, (c) => BEATS[beat](c, t, scene.params?.at ?? {}, scene));
}

const FAR = ridge(-400, 2400, 640, 40, 11);
const NEAR = ridge(-400, 2400, 800, 50, 21);

// A quiet night on the hills: the title writes itself; the fox sits by a tree.
function opening(ctx, t, at, scene) {
  const A = { title: 0.5, ...at };
  sky(ctx, t);
  camera(ctx, 960, 540, lerp(1, 1.06, smooth(invLerp(scene.start, scene.end, t))));
  moon(ctx, 1420, 260, 90, t, { face: 1 });
  hill(ctx, FAR, 1300, PAL.hillFar, t, { seed: 12, rim: 0.7 });
  hill(ctx, NEAR, 1300, PAL.hillMid, t, { seed: 22, rim: 0.6 });
  roundTree(ctx, 520, 860, 380, t, { seed: 7 });
  pine(ctx, 1580, 880, 320, t, { seed: 9 });
  fox(ctx, { x: 960, y: 900, s: 0.7, t, pose: 'sit', look: 0.3, up: 0.4, breath: t * 1.7 });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  titleText(ctx, '{{title}}', W / 2, 220, t, A.title, 1.6, { size: 120, alpha: 1 - smooth(invLerp(A.title + 3.5, A.title + 4.3, t)) });
}
