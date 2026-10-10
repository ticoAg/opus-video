// "The Emperor's New Clothes" — the child's shout (beat "child") and the
// ending (beat "ending"), continuing the parade street from emperor-parade.js.
// Inner times are offsets from scene.start (override with params.beats).
import { W, H, grain, popText, sparkle, writeText } from '../engine.js';
import { smooth, ease, spring, hash } from '../../lib/util.js';
import { child, shoutBubble, blob, stroke, drawCopy, withFade, invLerp, lerp, clamp, PAL } from './emperor-kit.js';
import { street, paradeClock, marchX, CHILD_X } from './emperor-parade.js';

const DEFAULTS = {
  child: { focus: 0.4, shout: 2.5, gasp: 2.7, freeze: 3.2, cover: 3.6, wide: 5.0 },
  ending: { sun: 0.4, laugh: 0.6, march: 1.2, seal: 5.0, fade: 6.2 },
};

export function draw(ctx, t, scene) {
  const beat = scene.params?.beat ?? scene.id;
  const B = { ...DEFAULTS[beat], ...scene.params?.beats };
  const u = t - scene.start;
  withFade(ctx, t, scene, (c) => {
    if (beat === 'child') shout(c, t, u, B, scene);
    else ending(c, t, u, B, scene);
  });
}

function shout(ctx, t, u, B, scene) {
  const { P } = paradeClock(t);
  const CX = CHILD_X(P);
  const Ef = marchX(P.freeze, P);
  // Camera: follow -> push to the child -> snap to the emperor -> wide freeze.
  const follow = [marchX(paradeClock(t).pt, P) + 140, 600, 1];
  const onChild = [CX - 60, 700, 1.35];
  const onEmp = [Ef + 20, 560, 1.7];
  const wide = [Ef + 150, 600, 0.92];
  let cam;
  if (u < B.freeze) cam = mix(follow, onChild, smooth(invLerp(B.focus, B.shout - 0.4, u)));
  else if (u < B.wide) cam = mix(onEmp, onEmp, 0).map((v, i) => v + (i === 2 ? 0.05 * Math.sin((u - B.freeze) * 1.5) : 0));
  else cam = mix(onEmp, wide, ease.inOutCubic(invLerp(B.wide, B.wide + 1.0, u)));
  // Tiny camera shake on the shout and on the ding.
  const shake = Math.exp(-Math.max(0, u - B.shout) * 6) * (u > B.shout ? 1 : 0) + Math.exp(-Math.max(0, u - B.freeze) * 6) * (u > B.freeze ? 1 : 0);
  cam = [cam[0] + Math.sin(t * 80) * 8 * shake, cam[1] + Math.cos(t * 70) * 6 * shake, cam[2]];

  const gasped = u >= B.gasp;
  const shouting = u >= B.shout;
  const frozen = u >= B.freeze;
  const blush = smooth(invLerp(B.freeze, B.freeze + 0.8, u));
  street(ctx, t, {
    cam,
    crowdMode: (i, x, rowName) => (gasped ? 'gasp' : rowName === 'back' && hash(i, 4) > 0.6 ? 'cheer' : 'watch'),
    look: (i, x) => (gasped ? clamp((CX - x) / 600, -1, 1) : -0.3),
    gray: smooth(invLerp(B.wide, B.wide + 1.2, u)) * 0.85,
    emperorPose: frozen
      ? { arms: u >= B.cover ? 'cover' : 'side', mood: 'shock', mouth: u >= B.cover ? 'wobble' : 'o', blush, sweat: 1, chin: 0.05,
          crowdMood: 'shock', crowdMouth: 'o' }
      : gasped ? { crowdMood: 'shock', crowdMouth: 'o' } : {},
    child: (c, x) => {
      // Child stands on a crate in the front row.
      blob(c, x, 1060, 90, 40, PAL.wood, { t, seed: 701, lw: 4, wob: 0.02 });
      const hop = shouting ? Math.abs(Math.sin((u - B.shout) * 9)) * 18 * Math.exp(-(u - B.shout) * 1.5) : 0;
      child(c, { x, y: 1040, s: 1.25, t, face: -1, pose: shouting ? 'point' : 'stand', mouth: shouting && u < B.shout + 1.6 ? 'shout' : 'smile', hop });
    },
  });
  // "!" marks over the frozen emperor (screen space, near centre).
  if (frozen && u < B.wide + 0.8) {
    const k = spring(u - B.freeze, 3, 5) * (1 - invLerp(B.wide, B.wide + 0.8, u));
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(960 + (i - 1) * 120, 150 - (i === 1 ? 30 : 0));
      ctx.rotate((i - 1) * 0.3);
      ctx.scale(k, k);
      writeText(ctx, '!', 0, 0, { size: 150, font: 'Brush', color: '#b33a2b' });
      ctx.restore();
    }
  }
  grain(ctx, t, scene.params?.grainAlpha ?? 0.3);
  // The shout: jagged bubble from the child's mouth, then the copy lines.
  const sk = shouting ? clamp(spring(u - B.shout, 2.6, 6)) * (1 - invLerp(B.freeze - 0.15, B.freeze, u)) : 0;
  shoutBubble(ctx, 1040, 330, 1260, 330, t, { k: sk });
  drawCopy(ctx, t, scene);
}

function ending(ctx, t, u, B, scene) {
  const { pt, P } = paradeClock(t);
  const E = marchX(pt, P);
  const CX = CHILD_X(P);
  const sun = smooth(invLerp(B.sun, B.sun + 1.5, u));
  const cam = [lerp(marchX(P.freeze, P) + 150, E + 160, smooth(invLerp(0, 2.5, u))), 600, lerp(0.92, 0.95, sun)];
  const laughing = u >= B.laugh;
  street(ctx, t, {
    cam,
    crowdMode: () => (laughing ? 'laugh' : 'gasp'),
    look: (i, x) => clamp((E - x) / 700, -1, 1),
    gray: 0.85 * (1 - sun),
    emperorPose: { arms: 'hip', mood: 'smug', mouth: 'flat', chin: -0.2, blush: 0.75, sweat: 0.6, crowdMood: 'smug', crowdMouth: 'flat' },
    child: (c, x) => {
      blob(c, x, 1060, 90, 40, PAL.wood, { t, seed: 701, lw: 4, wob: 0.02 });
      child(c, { x, y: 1040, s: 1.25, t, face: -1, pose: 'stand', mouth: laughing ? 'shout' : 'smile', mood: laughing ? 'laugh' : 'open',
        hop: laughing ? Math.abs(Math.sin(t * 8)) * 14 : 0 });
    },
  });
  // Warm sunlight: glow + slowly turning rays from the top right.
  if (sun > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const gx = 1650, gy = -60;
    const g = ctx.createRadialGradient(gx, gy, 30, gx, gy, 1300);
    g.addColorStop(0, `rgba(255,236,170,${0.8 * sun})`); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.22 * sun;
    ctx.fillStyle = '#fff2c0';
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.5 + (i / 12) * Math.PI * 0.75 + u * 0.05;
      ctx.beginPath(); ctx.moveTo(gx, gy);
      ctx.lineTo(gx + Math.cos(a - 0.04) * 2400, gy + Math.sin(a - 0.04) * 2400);
      ctx.lineTo(gx + Math.cos(a + 0.04) * 2400, gy + Math.sin(a + 0.04) * 2400);
      ctx.fill();
    }
    ctx.restore();
  }
  // "哈哈" bursts from the crowd.
  if (laughing) {
    const spots = [[260, 860], [700, 900], [1240, 880], [1700, 860], [520, 640], [1480, 640]];
    spots.forEach(([x, y], i) => {
      const t0 = scene.start + B.laugh + i * 0.35;
      const cyc = (t - t0) % 2.4;
      if (t < t0) return;
      ctx.save(); ctx.globalAlpha = clamp(1 - (cyc - 1.6) / 0.5);
      popText(ctx, '哈哈', x, y - cyc * 30, t, t - cyc, { size: 64, font: 'CJK', color: '#c45c26', stagger: 0.1, seed: 30 + i });
      ctx.restore();
    });
  }
  grain(ctx, t, scene.params?.grainAlpha ?? 0.3);
  drawCopy(ctx, t, { ...scene, copy: { lines: (scene.copy?.lines ?? []).filter((l) => !l.seal) } });
  // Red seal stamp for the final character.
  for (const l of (scene.copy?.lines ?? []).filter((x) => x.seal)) {
    if (t < l.at) continue;
    const k = ease.outBack(invLerp(l.at, l.at + 0.35, t), 1.4);
    const s = lerp(2.2, 1, k);
    ctx.save();
    ctx.translate(l.x ?? W / 2, l.y ?? H / 2);
    ctx.rotate(-0.06);
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(k * 1.5);
    blob(ctx, 0, 0, (l.size ?? 140) * 0.75, (l.size ?? 140) * 0.75, '#b33a2b', { t, seed: 808, lw: 0, wob: 0.03 });
    ctx.fillStyle = '#b33a2b';
    ctx.fillRect(-(l.size ?? 140) * 0.7, -(l.size ?? 140) * 0.7, (l.size ?? 140) * 1.4, (l.size ?? 140) * 1.4);
    writeText(ctx, l.text, 0, 4, { size: l.size ?? 140, font: 'CJK', color: '#fff6e8' });
    ctx.restore();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = 150 + (t - l.at) * 160;
      sparkle(ctx, (l.x ?? W / 2) + Math.cos(a) * r, (l.y ?? H / 2) + Math.sin(a) * r, 16, { alpha: clamp(1 - (t - l.at) / 1.2), rot: t });
    }
  }
  // Final fade to paper.
  const f = invLerp(scene.start + B.fade, scene.end, t);
  if (f > 0) { ctx.fillStyle = `rgba(247,239,226,${f})`; ctx.fillRect(0, 0, W, H); }
}

const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
