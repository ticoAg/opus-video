// Every drawing used in the film, located on its sketchbook page.
// The data now lives in the active story pack (stories/<id>/story.json,
// "assets.sprites" and "assets.textures"); this module just exposes it.
//
// Sprites: boxes are [x, y, w, h] as fractions of the page (from build/segment overlays).
//   mode 'object': keep only ink blobs centred inside the box (isolates a
//                  character even when neighbours poke into the box)
//   mode 'scene' : keep everything inside the box (landscapes, washes)
//   exclude      : boxes whose blobs must be dropped (e.g. the pumpkin that
//                  sits inside the carrot's box)
//   grow / edgeRule / photoEdge / sticker / stickerClose: extraction tweaks (see export.js)
//
// Textures: close-up crops for the montage: at = [centreX, centreY, width] as
// page fractions; height follows the 1920x860 screen band aspect.
import { activeStory } from '../story/load.js';

export const ASSETS = activeStory().assets?.sprites ?? {};
export const TEXTURES = activeStory().assets?.textures ?? {};
