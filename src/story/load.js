// Story packs: everything that makes one short *this* short (timeline, sound
// cues, on-screen copy, music plan, which drawings to cut out) lives in
// stories/<id>/story.json. The engine (src/video, src/audio, src/extract)
// reads the active pack through this module and stays the same for every story.
//
// The active pack is chosen with STORY=<id> (or --story <id> on any script);
// it defaults to "sketchbook".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const STORIES_DIR = path.join(ROOT, 'stories');
export const DEFAULT_STORY = 'sketchbook';

function storyIdFromArgs() {
  const i = process.argv.indexOf('--story');
  if (i >= 0 && process.argv[i + 1]) {
    const id = process.argv[i + 1];
    process.argv.splice(i, 2); // keep positional args of the host script intact
    return id;
  }
  return null;
}

export const storyId = () => storyIdFromArgs() ?? process.env.STORY ?? DEFAULT_STORY;

// Read and normalise a pack (no validation here: see src/story/validate.js).
export function loadStory(id = DEFAULT_STORY) {
  const dir = path.join(STORIES_DIR, id);
  const file = path.join(dir, 'story.json');
  if (!fs.existsSync(file)) throw new Error(`story pack not found: ${file}`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const meta = raw.meta ?? {};
  const rel = (p, fallback) => path.resolve(ROOT, p ?? fallback);
  const scenes = (raw.scenes ?? []).map((s) => ({
    lead: 0, tail: 0, assets: [], cues: [], copy: {}, params: {}, module: s.id, ...s,
  }));
  return {
    ...raw,
    id: meta.id ?? id,
    dir,
    file,
    scenes,
    paths: {
      build: rel(meta.buildDir, `build/${id}`),
      input: rel(raw.assets?.sources?.inputDir, path.relative(ROOT, path.join(dir, 'input-pictures'))),
      video: rel(meta.output, `out/${id}.mp4`),
      soundtrack: rel(meta.soundtrack, path.relative(ROOT, path.join(rel(meta.buildDir, `build/${id}`), 'soundtrack.wav'))),
    },
    duration: meta.duration ?? Math.max(0, ...scenes.map((s) => s.end)),
  };
}

let active = null;
export function activeStory() {
  if (!active) active = loadStory(storyId());
  return active;
}

// Data for one scene of the active pack (used by the draw modules).
export function sceneData(id) {
  const s = activeStory().scenes.find((x) => x.id === id);
  if (!s) throw new Error(`scene "${id}" is not in story "${activeStory().id}"`);
  return s;
}

// Resolve a scene's draw module: "./x.js" style paths are relative to the
// pack folder (story-specific code), bare names are built-in modules in
// src/video/scenes/<name>.js.
export function sceneModulePath(story, scene) {
  const m = scene.module;
  if (m.startsWith('.') || m.startsWith('/')) return path.resolve(story.dir, m);
  return path.join(ROOT, 'src', 'video', 'scenes', `${m}.js`);
}
