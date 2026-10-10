# Reusing the engine for another short (e.g. an Andersen fairy tale)

The sketchbook film is now a **story pack**: `stories/sketchbook/story.json`
holds everything specific to it (timeline, sound cues, on-screen text, which
drawings to cut out, the score plan). The engine code is shared:

```
src/story/load.js       picks the active pack (STORY=<id> or --story <id>, default sketchbook)
src/story/validate.js   pnpm story:validate [id…] [--strict]
src/extract/*           page photos -> cut-outs / stickers / textures / paper   (reads assets.*)
src/video/render.js     frames -> mp4                                            (reads meta, scenes)
src/video/scenes/*.js   draw modules, chosen per scene by "module"
src/audio/*             score (music.sections) + cues (+ TTS dialogue) -> soundtrack.wav
src/audio/voices.js     pnpm voices: spoken lines (voices cast + speaker) -> <buildDir>/voices/*.wav via edge-tts
```

Format reference: [stories/SCHEMA.md](stories/SCHEMA.md) and
[stories/story.schema.json](stories/story.schema.json).

## A new pack = new folder + assets + story.json (engine unchanged)

1. **Start from the starter pack.**
   ```sh
   cp -r stories/princess-and-the-pea stories/the-tinderbox
   ```
   Set `meta.id` to the folder name, `title`, `source` ("H. C. Andersen, 1835"),
   `duration`. `stories/princess-and-the-pea` is a working text-only animatic
   (four `card` scenes, cues and music) you can render immediately.

2. **Block out the story with `card` scenes.** One scene per beat of the tale
   (`start`/`end` in seconds), its lines in `copy.lines`, sound effects in
   `cues`, a `music.sections` entry per scene with a few layers
   (`pads`, `arp`, `strum`, `bassline`, `drums`, `melody`, `phrase` …) and a
   `chords` chart covering the film. Validate and preview often:
   ```sh
   pnpm story:validate the-tinderbox
   STORY=the-tinderbox pnpm audio                      # build/the-tinderbox/soundtrack.wav
   node src/video/render.js --story the-tinderbox --still 4.5
   node src/video/render.js --story the-tinderbox --sheet 0 20 0.5
   node src/video/render.js --story the-tinderbox --clip 0 8
   ```

3. **Add the drawings.** Either
   - photograph the illustrated pages into `stories/the-tinderbox/input-pictures/<sheet>.jpg`,
     list them in `assets.sources.sheets`, run `STORY=the-tinderbox pnpm segment`
     to get numbered overlays in `build/the-tinderbox/segment/`, then name each
     drawing in `assets.sprites` (`box` as page fractions) and run
     `STORY=the-tinderbox pnpm extract` (cut-outs, `.sticker` versions, `paper`,
     `tex:` crops into `build/the-tinderbox/`); or
   - drop ready-made PNGs in the pack and map them in `assets.files`
     (`"soldier": "art/soldier.png"`), no extraction needed.

   Then list them in each scene's `assets` and place them with
   `params.layers` (`card`), e.g.
   `{ "asset": "soldier.sticker", "x": 700, "y": 980, "h": 420, "at": 3.0 }`.

4. **Upgrade the important scenes to custom animation** when `card` is not
   enough: write `stories/the-tinderbox/scenes/dogs.js` exporting
   `draw(ctx, t, scene)` (use the toolkit in `src/video/engine.js`: `sprite`,
   `paper`, `writeText`, `popText`, `wash`, `inkLine`, `star`, `heart`, …) and
   set `"module": "./scenes/dogs.js"` (from there the toolkit is
   `import { sprite, writeText } from '../../../src/video/engine.js'`). Read `scene.start`, `scene.copy` and
   `scene.params` instead of hard-coding them (see how
   `src/video/scenes/dusk.js` uses `sceneData('dusk')`).

5. **Build the film.**
   ```sh
   STORY=the-tinderbox pnpm build   # extract -> voices -> audio -> out/the-tinderbox.mp4
   ```
   If the pack only uses `assets.files` (no page photos), skip extraction:
   `STORY=the-tinderbox pnpm voices && STORY=the-tinderbox pnpm audio && STORY=the-tinderbox pnpm video`.
   Narration/character voices are optional: add a `voices` cast and `speaker`
   on copy lines (see "Spoken lines" in stories/SCHEMA.md).
   (`pnpm build` without `STORY` still builds the sketchbook exactly as before.)

## What is data and what is still code

| data in story.json | still code |
| --- | --- |
| scene order, start/end/lead/tail | per-scene animation inside the sketchbook `draw()` modules |
| every sound cue (297 for the sketchbook) | the sound-effect synths (`src/audio/sfx.js`) |
| on-screen text | instrument synths, mixer, mastering |
| asset manifest (page boxes, texture crops) | how each `op` plays (`src/audio/music.js`) |
| tempo, chords, theme, per-section score layers | fonts (`Brush`, `Hand`, registered in engine.js) |
| fps, size, background, output paths | |

## Limitations / gotchas

- **Sketchbook internals are still hard-coded.** Its eight `draw()` modules read
  `start`/`end`/`copy` from the pack, but their *inner* beat times (e.g. the
  finale's `JUMP = 74.0`, montage cut grid, character positions) are JS
  constants. The cues in story.json were **baked** from those constants, so
  moving a sketchbook scene in JSON does not move its animation; retime the
  module and its cues together. New packs that use `card` or modules reading
  `scene.*` don't have this problem.
- Cues that mirror text (the letter-pop cues of "good morning!" / the title)
  were baked too: editing that copy does not regenerate those cues.
- `music.js` ops like `oompah`, `halftime`, `fingerpick`, `finalChord` are the
  sketchbook's arrangements made generic; their internal voicings/levels are
  fixed. Add new ops for a different style (see SCHEMA.md).
- The tempo grid is global (`music.bpm`), one key per pack (chords may use any
  names you define in `chordTones`).
- Only one pack is active per process (`STORY` / `--story`).
