# The storybook kit (`src/video/kit/`)

Import everything from one place:

```js
import { frame, sky, moon, fox, room, camera, key, … } from '../../../src/video/kit/index.js';
```

Conventions: `t` is absolute film time (seconds); positions are in the
coordinates of the current transform (draw under `camera()`); `seed` picks a
stable variation (outlines boil 8×/s from it); `alpha`/`a` are 0..1. Colours
come from `PAL` (`palette.js`). See every item drawn in `build/kit-sheet.jpg`
(`pnpm kit:sheet`).

## Scene plumbing

| function | does |
| --- | --- |
| `frame(ctx, t, scene, body)` | Draws `body(ctx)` as one layer with the scene's `lead` fade-in / `tail` fade-out; the top scene then adds paper grain, the caption band, captions, and the open/close to night. Wrap every scene draw in it. |
| `camera(ctx, cx, cy, z)` | Look at world point (cx, cy) with zoom z. |
| `zoomOnto(from, target, zTo, e)` | `[cx, cy, z]` for a push from framing `from` onto `target` (e 0..1): zoom is geometric and the target travels smoothly to the centre, so it never leaves the frame. Spread into `camera(ctx, ...)`. |
| `key(t, [[t0, v0], [t1, v1], …])` | Smoothly eased keyframes. |
| `popK(t, t0, dur)` | 0 → springy overshoot → 1 (pop-ins). |
| `captions(ctx, t)` / `captionLines()` | Narration captions from every scene's `copy.lines[]` with `beats`; style from story.json `captions`. |
| `titleText(ctx, text, x, y, t, t0, dur, o)` | Text written in letter by letter over `dur`; `o`: `size`, `font`, `color`, `alpha`, `shadow`. |
| `inkText(ctx, chars, times, x, y, t, o)` | Same, with a time per character. |
| `grain(ctx, t, alpha)` | Synthesised paper over the frame (frame() already does it). |

## Marks (`ink.js`)

`blob(ctx, cx, cy, rx, ry, fill, { t, seed, lw, wob, ink, alpha, hi })` wobbly
watercolour ellipse with a boiling ink edge · `shape(ctx, pts, fill, { t, seed,
lw, ink, sharp, alpha })` soft closed shape through control points ·
`clipShape(ctx, pts, { t, seed })` clip to that same outline (to keep washes
inside) · `stroke(ctx, pts, { lw, color, alpha })` open ink line · `limb(ctx,
pts, w, color)` thick outlined stroke (branches, arms) · `dot` · `glow(ctx, x,
y, r, 'r,g,b', a, comp)` soft light (screen) · `taper(pts, w(u))` outline of a
body of varying width along a centre line (tails, brooks) · `bez(p0, p1, p2,
p3, n)` points on a curve · `rrect(x0, y0, x1, y1, r)` rounded-rectangle
control points (furniture: plain 4-point shapes come out lens-shaped).
`wash`, `star`, `sparkle`, `heart` come from `src/video/engine.js`.

## Night landscape (`night.js`)

| function | options |
| --- | --- |
| `sky(ctx, t, { top, mid, low, seed, blooms })` | screen-space gradient + drifting watercolour blooms (call before `camera`) |
| `moon(ctx, x, y, r, t, { glowA, rays, face, eyes, look })` | halo, craters; `rays` = silver light rippling out; `face` 0..1 with `eyes` 0 shut / 1 open |
| `bigStar(ctx, x, y, r, t, t0, { seed, k, glowA })` | hand-drawn star popping on at t0, twinkling (t0 = −1: already lit) |
| `starDust(ctx, t, x0, y0, x1, y1, { n, seed, amount })` | pin-prick stars; `amount` 0..1 lights them in turn |
| `ridge(x0, x1, base, amp, seed, step, f)` → pts | a noisy ridge line |
| `hill(ctx, pts, bottom, fill, t, { seed, rim, front })` | band under a ridge; silver rim lit up to x = `front` (light sweeping across) |
| `roundTree(ctx, x, y, h, t, { seed, sway, lit, color })` · `pine(…)` | `sway` 0..1 shakes the leaves; `lit` moonlit tops |
| `treeHouse(ctx, x, y, s, t, { light, sway })` | big tree with a lit round window (window at y − 250·s) and a door |
| `brookPath(ctrlPts, n)` → line · `brook(ctx, line, t, { w0, w1, flow, shine })` | a ribbon widening toward us, flowing ripples, a sheen at `shine` 0..1. Keep bends gentle: a bend tighter than half the width folds the ribbon. |
| `stone(ctx, x, y, rx, ry, t, { seed })` | stone with a water curl |

## Props (`props.js`)

`lantern(ctx, x, y, s, t, { lit, string })` hangs from (x, y − string·s) ·
`firefly(ctx, x, y, t, { alpha })` · `note(ctx, x, y, s, t, { kind: 1 | 2,
alpha, rot })` music note ♪ / ♫ · `cloud(ctx, x, y, w, h, t, { fill, alpha })` ·
`doodle(ctx, 'acorn' | 'leaf' | 'butterfly' | 'fish' | 'berry', x, y, s, t)` ·
`swirl(ctx, x, y, s, t, { progress, alpha })` wind curl · `zzz(ctx, x, y, t,
t0, { size, alpha })`.

## The fox (`fox.js`)

`fox(ctx, { x, y, s, t, pose, face, look, up, lids, sleep, yawn, breath,
breathAmp, tilt, blush, twitch, snug, droop })` — base at (x, y), ~400 px tall
at s = 1.

- `pose`: `'sit'` (wrapped in her patchwork quilt, paws holding it) or `'curl'`
  (asleep under it, tail round the front).
- Eyes: `look` −1..1 (left/right), `up` 0..1, `lids` 0 open … 1 shut,
  `sleep` (peaceful closed eyes and smile), `yawn` 0..1 (mouth opens, eyes
  squeeze).
- Body: `breath` (radians; e.g. `t * 2π / 3.8`), `breathAmp`, `tilt` (head,
  radians), `twitch` 0..1 (right ear), `snug` 0..1 (quilt pulled tight),
  `blush` 0..1, `face` −1 mirrors her.
- `quilt(ctx, pts, t, seed)` fills any outline with the patchwork.

## The room (`room.js`)

`room(ctx, t, { lamp, view })` — the tree-house room at z = 1 (wall planks, a
framed moon, a bed under a round window, a bedside lamp; `lamp` 0..1 dims it).
`ROOM` gives `win: [cx, cy, r]`, `bedY`, `lamp` positions. `view` goes to
`windowView(ctx, t, cx, cy, r, { stars, lanterns, rustle, moonFace, notes })`:
the night through the window, with a branch whose leaves shake with `rustle`.
