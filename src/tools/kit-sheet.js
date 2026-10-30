// A labelled contact sheet of the storybook kit (src/video/kit): the fox's
// poses and moods, sets and props, so an agent can see what it can draw
// with before planning shots.
//
//   pnpm kit:sheet   -> build/kit-sheet.jpg
//
// When you add something to the kit, add a cell here.
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { ROOT } from '../story/load.js';
import {
  W, H, PAL, sky, moon, bigStar, starDust, ridge, hill, roundTree, pine, treeHouse, brookPath, brook, stone,
  lantern, firefly, note, cloud, doodle, swirl, zzz, fox, quilt, room, inkText, titleText,
} from '../video/kit/index.js';

const t = 1.3;
const CW = 480, CH = 270, LABEL = 34, COLS = 4;
const night = (c) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, PAL.night); g.addColorStop(1, PAL.horizon); c.fillStyle = g; c.fillRect(0, 0, W, H); };
const cream = (c) => { c.fillStyle = '#f3ead9'; c.fillRect(0, 0, W, H); };

const CELLS = [
  ['fox · sit', (c) => { night(c); fox(c, { x: 960, y: 1000, s: 1.9, t, pose: 'sit', look: 0.3, up: 0.2 }); }],
  ['fox · look up (look, up)', (c) => { night(c); fox(c, { x: 960, y: 1000, s: 1.9, t, pose: 'sit', look: 0.75, up: 0.9, tilt: -0.05 }); }],
  ['fox · sleepy (lids 0.65)', (c) => { night(c); fox(c, { x: 960, y: 1000, s: 1.9, t, pose: 'sit', lids: 0.65, blush: 0.7, tilt: 0.08 }); }],
  ['fox · yawn', (c) => { night(c); fox(c, { x: 960, y: 1000, s: 1.9, t, pose: 'sit', yawn: 1 }); }],
  ['fox · curl, asleep + zzz', (c) => { night(c); fox(c, { x: 1000, y: 900, s: 1.9, t, pose: 'curl', sleep: true }); zzz(c, 700, 420, t, 0, { size: 120 }); }],
  ['moon · rays (silver light)', (c) => { night(c); moon(c, 960, 540, 190, t, { rays: 1 }); }],
  ['moon · face (eyes 0 / 1)', (c) => { night(c); moon(c, 620, 540, 190, t, { face: 1 }); moon(c, 1320, 540, 190, t, { face: 1, eyes: 1 }); }],
  ['bigStar · starDust', (c) => { night(c); starDust(c, t, 0, 0, W, H, { n: 160 }); [[480, 400, 70], [1000, 300, 100], [1500, 600, 60]].forEach(([x, y, r], i) => bigStar(c, x, y, r, t, -1, { seed: i + 1 })); }],
  ['lantern (lit / unlit)', (c) => { night(c); lantern(c, 700, 500, 3, t, { lit: 1, string: 40 }); lantern(c, 1250, 500, 3, t, { lit: 0, string: 40 }); }],
  ['firefly · note (kind 1 / 2)', (c) => { night(c); firefly(c, 520, 540, t); note(c, 1050, 700, 3.2, t, { kind: 1 }); note(c, 1450, 700, 3.2, t, { kind: 2 }); }],
  ['cloud · doodle (acorn leaf butterfly fish berry)', (c) => { night(c); cloud(c, 960, 380, 900, 420, t); ['acorn', 'leaf', 'butterfly', 'fish', 'berry'].forEach((k, i) => doodle(c, k, 380 + i * 290, 880, 2.6, t, i + 1)); }],
  ['swirl (wind) · progress', (c) => { night(c); [0.4, 0.7, 1].forEach((p, i) => swirl(c, 700 + i * 420, 400 + i * 170, 3, t, { progress: p })); }],
  ['roundTree · pine (sway, lit)', (c) => { night(c); roundTree(c, 650, 1020, 900, t, { seed: 3 }); pine(c, 1350, 1020, 900, t, { seed: 5 }); }],
  ['treeHouse (light 1 / 0)', (c) => { night(c); treeHouse(c, 640, 1060, 1.25, t, { light: 1 }); treeHouse(c, 1400, 1060, 1.25, t, { light: 0, seed: 520 }); }],
  ['brook · stone', (c) => { night(c); const line = brookPath([[1500, 120], [1100, 320], [1300, 560], [700, 820], [300, 1200]], 60); brook(c, line, t, { w0: 40, w1: 420 }); stone(c, 900, 700, 90, 50, t); stone(c, 520, 980, 110, 60, t, { seed: 4 }); }],
  ['ridge · hill (rim, front)', (c) => { night(c); hill(c, ridge(-100, W + 100, 520, 80, 11, 40, 0.004), H + 50, PAL.hillFar, t, { rim: 1 }); hill(c, ridge(-100, W + 100, 760, 90, 21, 40, 0.004), H + 50, PAL.hillMid, t, { rim: 1, front: 1100 }); }],
  ['room (lamp 1)', (c) => { room(c, t, { lamp: 1, view: { stars: 0.6 } }); }],
  ['room (lamp 0.25) · window: stars, lanterns', (c) => { room(c, t, { lamp: 0.25, view: { stars: 1, lanterns: 1, moonFace: 1 } }); }],
  ['sky · titleText · inkText', (c) => { sky(c, t); titleText(c, '晚安，小狐狸', W / 2, 420, t, 0, 0.5, { size: 150 }); inkText(c, [...'字幕逐字写出'], [0, 0.2, 0.4, 0.6, 1.2, 9], W / 2, 780, t, { size: 96 }); }],
  ['quilt (any outline)', (c) => { cream(c); quilt(c, [[300, 200], [1600, 160], [1700, 900], [260, 940]], t, 7); }],
];

const rows = Math.ceil(CELLS.length / COLS);
const sheet = createCanvas(COLS * CW, rows * (CH + LABEL));
const sx = sheet.getContext('2d');
sx.fillStyle = '#ffffff';
sx.fillRect(0, 0, sheet.width, sheet.height);
const frame = createCanvas(W, H);
for (const [i, [label, drawCell]] of CELLS.entries()) {
  const c = frame.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, W, H);
  c.save(); drawCell(c); c.restore();
  const x = (i % COLS) * CW, y = Math.floor(i / COLS) * (CH + LABEL);
  sx.drawImage(frame, x, y + LABEL, CW, CH);
  sx.fillStyle = '#222';
  sx.font = '20px Hand';
  sx.fillText(label, x + 10, y + 24);
}
const out = path.join(ROOT, 'build', 'kit-sheet.jpg');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, await sheet.encode('jpeg', 88));
console.log(path.relative(ROOT, out));
