// Synthesised watercolour paper (no page photos needed): cold-press grain made
// of value noise, a light emboss and fibres, laid over a frame with multiply.
import { createCanvas } from '../engine.js';
import { rng } from '../../lib/util.js';

let PAPER = null;
function paperTexture() {
  if (PAPER) return PAPER;
  const PW = 2400, PH = 1400;
  const c = createCanvas(PW, PH);
  const x = c.getContext('2d');
  const img = x.createImageData(PW, PH);
  const d = img.data;
  const R = rng(4242);
  const grid = (cell) => {
    const gw = Math.ceil(PW / cell) + 3, gh = Math.ceil(PH / cell) + 3;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = R() * 2 - 1;
    return { cell, gw, g };
  };
  const sample = ({ cell, gw, g }, px, py) => {
    const fx = px / cell + 1, fy = py / cell + 1, ix = fx | 0, iy = fy | 0;
    let u = fx - ix, v = fy - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const i0 = iy * gw + ix;
    const a = g[i0], b = g[i0 + 1], c2 = g[i0 + gw], e = g[i0 + gw + 1];
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + e) * u * v;
  };
  const oct = [grid(300), grid(80), grid(16), grid(5)];
  const amp = [0.03, 0.018, 0.016, 0.012];
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      let k = 1;
      for (let o = 0; o < 4; o++) k += amp[o] * sample(oct[o], px, py);
      // Tooth: a light-from-top-left emboss of the fine octaves.
      k += 0.05 * (sample(oct[3], px - 1.2, py - 1.2) - sample(oct[3], px + 1.2, py + 1.2));
      k += 0.025 * (sample(oct[2], px - 2, py - 2) - sample(oct[2], px + 2, py + 2));
      k += (R() - 0.5) * 0.03;
      const i = (py * PW + px) * 4;
      d[i] = 252 * k; d[i + 1] = 246 * k; d[i + 2] = 234 * k; d[i + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  // Fibres.
  x.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const fx = R() * PW, fy = R() * PH, a = R() * Math.PI, l = 6 + R() * 22;
    x.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,96,70,0.07)';
    x.lineWidth = 0.6 + R() * 0.9;
    x.beginPath();
    x.moveTo(fx, fy);
    x.quadraticCurveTo(fx + Math.cos(a) * l * 0.5 + (R() - 0.5) * 6, fy + Math.sin(a) * l * 0.5 + (R() - 0.5) * 6, fx + Math.cos(a) * l, fy + Math.sin(a) * l);
    x.stroke();
  }
  PAPER = c;
  return c;
}

// Lay the paper grain over the frame (multiply), drifting very slowly.
export function grain(ctx, t, alpha = 0.6) {
  const p = paperTexture();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.drawImage(p, -240 - Math.sin(t * 0.05) * 60, -160 - Math.cos(t * 0.04) * 40);
  ctx.restore();
}
