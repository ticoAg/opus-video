# opus-video: guide for agents

This repo turns stories into short animated films with code: every picture is
drawn procedurally (or cut out of photographed drawings), every sound is
synthesised, and narration comes from TTS or a recording. It is also where we
keep what we learn: the reusable drawing kit, the tools, and the method.

**To make a film from a story, follow the `story-to-video` skill**
(`.claude/skills/story-to-video/SKILL.md`).

## Map

| path | what |
| --- | --- |
| `stories/<id>/` | a story pack: `story.json` (timeline, captions, cues, music), `narration.json` (script), `narration.timing.json` (measured), `scenes/*.js` (draw modules), `input-audio/` (git-ignored) |
| `stories/goodnight-little-fox/` | the worked example: a bedtime story on a recorded narration |
| `stories/sketchbook/` …         | the original films (photographed drawings, TTS dialogue, card animatic) |
| `templates/narrated/` | starting point for `pnpm story:new` |
| `src/video/kit/` | the storybook kit: ink marks, paper, night landscape, props, the fox, the room, captions, scene frame |
| `src/video/engine.js`, `src/video/scenes/` | the sketchbook toolkit and built-in scene modules |
| `src/audio/` | synth, sfx, score, mixer; `tts.js` (TTS providers), `align.js` (phrase timing), `voices.js` (TTS lines in slots) |
| `src/tools/` | `narrate`, `align`, `captions`, `qa`, `share`, `drive`, `kit-sheet`, `new-story`, `transcribe.py` |
| `src/story/` | pack loader, validator, schema vocabulary; `stories/story.schema.json`, `stories/SCHEMA.md` |
| `build/`, `out/` | generated (git-ignored) |

## Commands

```bash
pnpm story:new <id> --title "…"   # new pack from the template
STORY=<id> pnpm narrate           # TTS the script -> input-audio/narration.wav + narration.timing.json
STORY=<id> pnpm align             # time a recording against narration.json
STORY=<id> pnpm captions --write  # caption lines with beats, into story.json
pnpm story:validate [id]          # schema + cross-reference checks
STORY=<id> pnpm audio             # soundtrack
STORY=<id> pnpm qa                # checks + stills/sheets in build/<id>/qa/ (look at them)
node src/video/render.js --story <id> --still 12.5 | --sheet 10 20 0.5 | --clip 10 20
STORY=<id> pnpm video             # out/<id>.mp4
STORY=<id> pnpm share             # out/<id>-share.mp4 + release notes
STORY=<id> pnpm drive push        # films + source media -> Google Drive (pull: media back; no args: check)
pnpm kit:sheet                    # build/kit-sheet.jpg: everything the kit draws
```

Requirements: Node 20+, pnpm, ffmpeg. TTS: edge-tts, or `TTS_COMMAND`, or an
OpenAI-compatible endpoint (`TTS_BASE_URL`, `TTS_API_KEY`) — see
`src/audio/tts.js`. Transcription: `pip install faster-whisper`. Delivery: Google
Drive credentials (`GDRIVE_*`) in the environment, see
`.claude/skills/story-to-video/references/delivery.md`.

## Rules

- **Never commit media**: source audio/pictures and rendered films stay out of
  git (`input-audio/`, `input-pictures/`, `build/`, `out/`). Films and source
  media go to Google Drive (`pnpm drive push`); packs are text and stay in
  the repo.
- **One clock**: scenes, cues, captions, camera keys and music share absolute
  film seconds, all taken from `narration.timing.json`.
- **Deterministic**: no `Math.random` or wall-clock time in drawing or sound;
  seeds and `hash()` only. Same inputs, same frames.
- **Look before you render**: stills and sheets (`pnpm qa`) at every cut and
  key moment; read the images, do not assume.
- **Grow the kit carefully**: reusable drawing goes in `src/video/kit/` with a
  cell in `src/tools/kit-sheet.js`; story-specific choreography stays in the
  pack. Changing the kit must not change existing films unless intended:
  render the same stills before and after and compare (`cmp`).
- **Write down what you learn**: add pitfalls and fixes to
  `.claude/skills/story-to-video/references/lessons.md`.
- Match the surrounding code style (ES modules, small helpers, comments that
  say why); `pnpm story:validate` must pass for packs you touch.
