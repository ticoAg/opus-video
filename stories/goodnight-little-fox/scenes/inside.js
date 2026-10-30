// "晚安，小狐狸": inside the tree house. One module, three beats chosen by
// scene.params.beat: den | drowsy | asleep. Key moments are absolute seconds in
// scene.params.at (the clock the narration, captions and cues share).
import {
  ROOM, frame, room, fox, cloud, doodle, zzz, glow, heart, sparkle, camera, key,
  clamp, lerp, invLerp, smooth, ease, popK, inkText,
} from './kit.js';

const BEATS = { den, drowsy, asleep };

export function draw(ctx, t, scene) {
  const beat = scene.params?.beat ?? scene.id;
  frame(ctx, t, scene, (c) => BEATS[beat](c, t, scene.params?.at ?? {}));
}

const SIT = [900, ROOM.bedY];
const breath = (t, period = 3.6) => (t * Math.PI * 2) / period;
const pulse = (t, at, w = 0.25) => Math.exp(-(((t - at) / w) ** 2));

// --- Den: the little fox, wrapped in her warm quilt, listens to the leaves
// rustling outside the window. -------------------------------------------
function den(ctx, t, at) {
  const A = { settle: [15.6, 17.8], wrap: [16.9, 17.9], rustle: [19.9, 22.6], twitch: [20.3, 21.5], ...at };
  const s = ease.outCubic(invLerp(A.settle[0], A.settle[1], t));
  camera(ctx, lerp(1150, 1000, s), lerp(440, 560, s), lerp(1.5, 1.12, s));
  const rustle = smooth(invLerp(A.rustle[0], A.rustle[0] + 0.4, t)) * (1 - smooth(invLerp(A.rustle[1] - 0.6, A.rustle[1], t)));
  room(ctx, t, { lamp: 1, view: { stars: 0.1, rustle } });
  const wrap = popK(t, A.wrap[0], A.wrap[1] - A.wrap[0]);
  const twitch = Math.max(...A.twitch.map((a) => pulse(t, a, 0.18)));
  fox(ctx, {
    x: SIT[0], y: SIT[1], s: 1, t, pose: 'sit', look: lerp(0.2, 0.55, smooth(invLerp(18.8, 19.8, t))), up: 0.25,
    snug: 0.5 * wrap, breath: breath(t), twitch, tilt: 0.06 * twitch + 0.04 * Math.sin(t * 0.8),
  });
  // "沙沙" — the leaves' whisper, hand-lettered by the window.
  [[A.rustle[0] + 0.3, 1060, 215, -0.12], [A.rustle[0] + 1.3, 1170, 140, 0.1]].forEach(([t0, x, y, rot]) => {
    const a = clamp((t - t0) / 0.3) * (1 - smooth(invLerp(t0 + 1.4, t0 + 2.1, t)));
    if (a <= 0) return;
    ctx.save();
    ctx.translate(x + Math.sin(t * 9) * 3, y - (t - t0) * 12);
    ctx.rotate(rot + Math.sin(t * 7) * 0.05);
    inkText(ctx, ['沙', '沙'], [t0, t0 + 0.18], 0, 0, t, { size: 46, color: '#e8f3e0', alpha: a });
    ctx.restore();
  });
}

// --- Drowsy: she gazes at the stars, feels safe and warm, grows sleepy;
// each breath sends her thoughts drifting off like clouds; her eyes close. --
const THOUGHTS = [['acorn', -60, 0], ['butterfly', 60, 1], ['fish', -20, 2], ['leaf', 90, 3]];
function drowsy(ctx, t, at) {
  const A = {
    gaze: [49.2, 52.4], cosy: [53.0, 55.7], warm: 54.95, heavy: [56.9, 59.1], yawn: [59.2, 60.7],
    breathe: 61.8, thoughts: [64.2, 0.65], away: [67.2, 69.2], close: [70.4, 71.2], ...at,
  };
  const push = smooth(invLerp(48.0, A.close[1], t));
  camera(ctx, lerp(1010, 905, push), lerp(500, 520, push), lerp(1.28, 1.6, push));
  room(ctx, t, { lamp: lerp(1, 0.8, push), view: { stars: 1, lanterns: 1, rustle: 0.08 } });
  // Warmth around her when she feels safe.
  const cosy = smooth(invLerp(A.cosy[0], A.cosy[0] + 0.8, t));
  glow(ctx, SIT[0], SIT[1] - 200, 420, '255,190,120', 0.35 * cosy * (0.85 + 0.15 * Math.sin(t * 1.8)));
  const gaze = smooth(invLerp(A.gaze[0], A.gaze[0] + 0.6, t)) * (1 - smooth(invLerp(A.gaze[1], A.gaze[1] + 0.8, t)));
  const yawnK = Math.sin(Math.PI * clamp(invLerp(A.yawn[0], A.yawn[1], t))) ** 0.7;
  let lids = key(t, [[48, 0], [A.heavy[0], 0.08], [A.heavy[1], 0.6], [A.yawn[1] + 0.3, 0.62], [A.close[0], 0.72], [A.close[1], 1]]);
  const amp = lerp(1, 1.9, smooth(invLerp(A.breathe - 0.5, A.breathe + 0.5, t)));
  fox(ctx, {
    x: SIT[0], y: SIT[1], s: 1, t, pose: 'sit', look: lerp(0.25, 0.75, gaze), up: lerp(0.1, 0.9, gaze), lids,
    yawn: yawnK, sleep: t >= A.close[1], snug: lerp(0.3, 1, cosy), blush: 0.4 + 0.3 * cosy,
    breath: breath(t, 3.8), breathAmp: amp, tilt: -0.05 * gaze + 0.1 * smooth(invLerp(A.heavy[0], A.close[1], t)) + 0.03 * yawnK,
  });
  // A little heart floats up: "又暖和".
  const hu = (t - A.warm) / 1.8;
  if (hu > 0 && hu < 1) heart(ctx, SIT[0] - 40, SIT[1] - 330 - hu * 120, 34 * popK(t, A.warm, 0.5), { alpha: 1 - hu * hu, rot: Math.sin(t * 3) * 0.15 });
  // Thought clouds with tiny doodles, then off they drift through the window.
  THOUGHTS.forEach(([kind, dx, i]) => {
    const tb = A.thoughts[0] + i * A.thoughts[1];
    if (t < tb) return;
    const k = popK(t, tb, 0.6);
    const off = ease.inOutSine(invLerp(A.away[0] + i * 0.15, A.away[1] + i * 0.15, t));
    const x0 = SIT[0] + dx + Math.sin(t * 0.9 + i) * 10, y0 = SIT[1] - 410 - (t - tb) * 16 - i * 18;
    const x = lerp(x0, 1180 + i * 70, off), y = lerp(y0, 210 + i * 25, off);
    const sc = k * (1 - 0.65 * off);
    const a = 1 - smooth(invLerp(0.75, 1, off));
    cloud(ctx, x, y, 120 * sc, 82 * sc, t, { seed: 200 + i * 9, alpha: a });
    if (sc > 0.05) {
      ctx.save(); ctx.globalAlpha *= a;
      doodle(ctx, kind, x, y, 0.95 * sc, t, 210 + i);
      ctx.restore();
    }
    if (t - tb < 0.5) sparkle(ctx, x - 50 * sc, y - 30 * sc, 16 * (1 - (t - tb) / 0.5), { alpha: 1 - (t - tb) / 0.5 });
  });
}

// --- Asleep: lamp low, curled up under her quilt, smiling in her sleep. ---
function asleep(ctx, t, at) {
  const A = { zzz: 95.4, night: 99.9, ...at };
  const push = smooth(invLerp(93.7, 101.9, t));
  camera(ctx, lerp(1010, 930, push), lerp(600, 660, push), lerp(1.2, 1.7, push));
  room(ctx, t, { lamp: lerp(0.35, 0.22, push), view: { stars: 1, lanterns: 0.66, moonFace: 1 } });
  fox(ctx, { x: 1050, y: ROOM.bedY, s: 1, t, pose: 'curl', sleep: true, breath: breath(t, 4.4), blush: 0.55 });
  zzz(ctx, 960, 560, t, A.zzz, { alpha: 1 - smooth(invLerp(101.0, 101.9, t)) });
  // "晚安，小狐狸": a small twinkle by her ear.
  const u = t - A.night;
  if (u > 0 && u < 1.2) sparkle(ctx, 985, 560, 26 * Math.sin(Math.PI * u / 1.2), { alpha: 1, rot: u * 2 });
}
