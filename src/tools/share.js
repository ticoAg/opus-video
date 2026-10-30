// Package a finished film for sharing.
//
//   STORY=<id> pnpm share [--crf 23]
//
// out/<id>.mp4 (the master from `pnpm video`) -> out/<id>-share.mp4, a
// lighter copy for phones and chats, and out/<id>-release.md, notes on the
// film (title, description, scenes, files, the commit of its pack). Films are
// sent to the user in the chat, never committed (see
// .claude/skills/story-to-video/references/delivery.md).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { activeStory, ROOT } from '../story/load.js';

const story = activeStory();
const i = process.argv.indexOf('--crf');
const crf = i >= 0 ? process.argv[i + 1] : '23';
const master = story.paths.video;
if (!fs.existsSync(master)) throw new Error(`no film yet: STORY=${story.id} pnpm video`);
const share = master.replace(/\.mp4$/, '-share.mp4');
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-tune', 'animation',
  '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', share], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);

const mb = (f) => `${(fs.statSync(f).size / 1048576).toFixed(1)} MB`;
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,r_frame_rate', '-of', 'json', master], { encoding: 'utf8' });
const info = JSON.parse(probe.stdout);
const v = info.streams.find((s) => s.width) ?? {};
const secs = Number(info.format.duration).toFixed(0);
// The commit holding the pack, so the film can be rebuilt from its source.
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() ?? '';
const rev = git('rev-parse', '--short', 'HEAD');
const dirty = rev && git('status', '--porcelain', '--', path.relative(ROOT, story.dir), 'src');
const notes = [
  `## ${story.meta.title}`,
  '',
  story.meta.description || '',
  '',
  `${secs} s · ${v.width}×${v.height} · ${fps(v.r_frame_rate)} fps · made with the story pack \`stories/${story.id}\`${rev ? ` at ${rev}${dirty ? ' (with uncommitted changes)' : ''}` : ''}`,
  '',
  '| Time | Scene |',
  '| --- | --- |',
  ...story.scenes.map((s) => `| ${fmt(s.start)}–${fmt(s.end)} | ${s.title ?? s.id} |`),
  '',
  `- \`${path.basename(master)}\`: full quality (${mb(master)})`,
  `- \`${path.basename(share)}\`: share copy, CRF ${crf} (${mb(share)})`,
  '',
].join('\n');
const notesFile = master.replace(/\.mp4$/, '-release.md');
fs.writeFileSync(notesFile, notes);
console.log(`${path.relative(ROOT, share)}  ${mb(share)}\n${path.relative(ROOT, notesFile)}`);

function fps(r = '30/1') { const [n, d] = r.split('/').map(Number); return Math.round((n / (d || 1)) * 100) / 100; }
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return m ? `${m}:${s.toFixed(0).padStart(2, '0')}` : `${s.toFixed(0)} s`; }
