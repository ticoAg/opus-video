// The film, in order, as described by the active story pack
// (stories/<id>/story.json). Each pack scene gives start/end (seconds),
// optional lead/tail overlap, the assets to preload, its sound cues and
// on-screen copy; the drawing itself is a JS module selected by the scene's
// "module" field (built-in: src/video/scenes/<name>.js, or a "./path.js"
// relative to the pack folder) that exports draw(ctx, t) with absolute time.
import { pathToFileURL } from 'node:url';
import { activeStory, sceneModulePath } from '../../story/load.js';

const STORY = activeStory();

export const SCENES = await Promise.all(STORY.scenes.map(async (s) => {
  const mod = await import(pathToFileURL(sceneModulePath(STORY, s)).href);
  if (typeof mod.draw !== 'function') throw new Error(`scene "${s.id}": module ${s.module} has no draw(ctx, t)`);
  return { ...s, draw: mod.draw };
}));
export const DURATION = STORY.duration;
export const CUES = SCENES.flatMap((s) => s.cues).sort((p, q) => p.t - q.t);
