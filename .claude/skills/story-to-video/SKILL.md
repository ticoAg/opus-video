---
name: story-to-video
description: Turn a story (a text, or a recorded narration) into a narrated, animated short with this repo's engine — narration first (TTS or recording), phrase timing, storyboard, procedural watercolour scenes from the storybook kit, captions written in as they are spoken, music and sound, QA, render, delivery to Google Drive. Use whenever asked to make a video, animation or short film from a story, script, poem or audio file.
---

# Story → video

You produce a **story pack** (`stories/<id>/`: `story.json`, `narration.json`,
`scenes/*.js`) and render it to `out/<id>.mp4`. Everything you draw comes from
code; every sound is synthesised except the narration. The film is timed from
the narration, never the other way round.

Read first: `CLAUDE.md` (repo map and rules), `stories/SCHEMA.md` (story.json),
and look at `build/kit-sheet.jpg` (`pnpm kit:sheet`) to see what the kit can
draw. The worked example is `stories/goodnight-little-fox` (a 111 s bedtime
story on a recorded narration); copy its patterns.

## 0. Gather

- The story text, or the narration audio (+ its text if there is one).
- Language, target length, audience, mood; anything the user wants to see.
- The voice: a provider from `src/audio/tts.js` — `edge-tts` (default, needs
  network), `command` (`$TTS_COMMAND`) or `openai` (`$TTS_BASE_URL`,
  `$TTS_API_KEY`). Keys live in the environment, never in files or chat.
- Where the film goes: `pnpm drive` checks the Google Drive sign-in
  (`references/delivery.md`). Working on a pack whose media is not in this
  container (each session starts from a fresh clone)? `STORY=<id> pnpm drive pull`.

## 1. Start the pack

```bash
pnpm story:new <id> --title "<title>"
```

`<id>`: lowercase, digits, `-`. Recorded narration goes to
`stories/<id>/input-audio/` (git-ignored, like all source media).

## 2. Script → narration → timing

Write `stories/<id>/narration.json`: one line per sentence or beat,
`{ "at": 3, "gap": 0.7, "lines": [{ "speaker": "narrator", "text": "…", "gap": 1.2 }] }`.
`at` leaves room for a title; a longer `gap` after a line gives a scene change
room to breathe. Keep the author's words; fix only obvious typos.

- **TTS:** set the cast in `story.json` `voices` (`provider`, `voice`, `rate`),
  then `STORY=<id> pnpm narrate` → `input-audio/narration.wav` +
  `narration.timing.json`. Listen-check via the numbers: no line should run
  over ~12 s; re-split long sentences.
- **Recording:** no script? `python3 src/tools/transcribe.py <audio> --at 3 >
  stories/<id>/narration.json` (faster-whisper) and proofread every flagged
  word; when one makes no sense, cross-check with `--model large-v3`. Then
  `STORY=<id> pnpm align` → `narration.timing.json`.
- Either way, `recordings: [{ "file": "input-audio/narration.wav", "at": 3 }]`.

`narration.timing.json` now holds every line and phrase in film seconds. It is
the backbone: every scene start, camera move, pop and cue below is a number
taken from it.

## 3. Storyboard

From the timing, make a table: time | words | picture | sound. Rules:

- One scene per sentence or two; **cut only in pauses** (the gap between two
  lines, ≥ 0.6 s). Crossfade with `lead` 0.8–1.4 s on the incoming scene.
- One idea per shot, timed to its phrase: the moon starts rising on "月亮升上",
  stars pop on each "一颗接着一颗". Use the phrase `start` times.
- Vary the framing: wide establishing → closer on the character → a detail →
  back out. Push-ins with `zoomOnto`, pans with `key`, an iris for dreams.
- Title card in the first `at` seconds; hold 3–5 s after the last words, then
  close (the kit fades to night by itself at the end).
- Prefer what the kit already draws (see the sheet). If the story needs a new
  character or prop, plan it as a kit addition (step 5).

Put the scenes in `story.json` (`start`/`end`/`lead`, `module`,
`params.beat`, `params.at` = the key moments in absolute seconds), set
`meta.duration`, then:

```bash
STORY=<id> pnpm captions --write     # lines of ≤14 CJK chars, written in as spoken
pnpm story:validate <id>
```

## 4. Scenes

Write `stories/<id>/scenes/*.js` from the template's `story.js`: one module per
place (outside / inside / dream …), one function per beat, every draw wrapped
in `frame(ctx, t, scene, body)` (fades + paper + captions). Inside a beat:

```js
const A = { rise: [4.0, 7.4], ...at };              // defaults, overridden by params.at
camera(ctx, ...zoomOnto([760, 560, 1], WINDOW, 6.5, ease.inCubic(invLerp(14.8, 16.6, t))));
const y = lerp(780, 250, ease.outCubic(invLerp(A.rise[0], A.rise[1], t)));
moon(ctx, 560, y, 92, t, { glowA: 1 });
fox(ctx, { x, y, t, pose: 'sit', look: key(t, [[49, 0.2], [50, 0.8]]), lids, yawn, breath: t * 1.7 });
```

- Time is absolute seconds; ease everything (`smooth`, `ease.*`, `key`,
  `popK` for pops). Everything breathes or boils a little; nothing freezes.
- Deterministic only: no `Math.random`, use `hash(seed, …)`.
- Story-specific drawing stays in the pack. Anything another film could use
  (a character, a prop, a set, a transition) goes into `src/video/kit/`, gets
  a cell in `src/tools/kit-sheet.js`, and must not change existing output.

## 5. Sound

- Cues in each scene: soft sfx on visual events (`twinkle` with notes in key
  for stars, `rustle`, `brook`, `breeze`, `harp` for magic, `yawn`, `pageTurn`
  + `scribble` for the title). Gains 0.1–0.5; speech must stay on top.
- Music: `music.sections` of layers (`pads`, `melody`, `arp`, `phrase`,
  `fingerpick` …) on a chord chart over the whole film; slow tempo, sparse
  for quiet stories. Music ducks under the narration automatically.
- `STORY=<id> pnpm audio` → aim for about −16 LUFS (QA reports it).

## 6. QA (do not skip, do not skim)

```bash
STORY=<id> pnpm qa
```

Fix every ✗ and read every ⚠. Then **open every image** in
`build/<id>/qa/` (a still per scene, a sheet across every cut) and look for:
shapes folding over themselves, highlights spilling outside their shape,
seams where a ground band ends, things cut off at the frame edge, a camera
push that loses its target, captions over a busy or bright area, transitions
that flash. `references/lessons.md` lists what went wrong before and the fix.
Re-check the cuts with `node src/video/render.js --sheet a z 0.25`.

## 7. Render and deliver

```bash
STORY=<id> pnpm video        # out/<id>.mp4, ~5–6 frames/s at 1080p (a 2-minute film ≈ 10 min)
STORY=<id> pnpm share        # out/<id>-share.mp4 + out/<id>-release.md (notes, with the pack's commit)
STORY=<id> pnpm drive push   # both films, the notes and the source media -> Drive: opus-video/<id>/
```

Films and media never go into git; the pack and everything reusable do.

- Commit first, then `pnpm share`, so the notes name a commit that has the
  pack. Commit the pack (text only) on your task branch and open the PR:
  packs stay in the repo, as examples for the next film and as test material
  for the kit. Kit / tool / doc improvements go in their own commits; add
  what you learned to `references/lessons.md`.
- Send the user the share copy and the Drive links that `push` prints. If
  Drive is not set up, send both films with the file tool and point the user
  at `references/delivery.md`.
- A public GitHub Release is optional and made by the user (agent sessions
  cannot push tags).

## References

- `references/kit.md` — every kit function and its options.
- `references/lessons.md` — mistakes already made once, and their fixes.
- `references/delivery.md` — what goes to Drive and what stays in the repo; the one-time Drive setup.
- `stories/goodnight-little-fox/` — the full worked example.
