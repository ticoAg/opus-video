# Story pack format

A story pack is one folder, `stories/<id>/`, with a `story.json`. The engine
(`src/extract`, `src/video`, `src/audio`) reads the active pack through
`src/story/load.js`; pick it with `STORY=<id>` or `--story <id>` (default
`sketchbook`). The machine-readable contract is
[`story.schema.json`](story.schema.json); `pnpm story:validate` checks it plus
cross-references (assets, sfx names, modules, chords, timing).

**All times are absolute seconds on the film clock**: scenes, cues, copy,
chords and music layers share one timeline, so picture and sound stay in sync.

```jsonc
{
  "$schema": "../story.schema.json",
  "meta": {
    "id": "my-story",              // = folder name
    "title": "…", "source": "H. C. Andersen, 1835 (public domain)",
    "duration": 60,                // optional; default = last scene end
    "fps": 30, "size": { "width": 1920, "height": 1080 },
    "background": "#fbf4e6",       // frame clear colour
    "buildDir": "build/my-story",  // optional defaults shown
    "output": "out/my-story.mp4",
    "soundtrack": "build/my-story/soundtrack.wav"
  },
  "assets": {
    "sources": { "inputDir": "stories/my-story/input-pictures", "sheets": ["page 1"] },  // page photos <sheet>.jpg
    "sprites":  { "tinSoldier": { "sheet": "page 1", "box": [x, y, w, h] } },           // cut out by pnpm extract
    "textures": { "paperBoat": { "sheet": "page 1", "at": [cx, cy, w] } },              // close-up crops (tex:<name>)
    "files":    { "castle": "art/castle.png" }                                           // ready-made images, path relative to the pack
  },
  "scenes": [
    {
      "id": "intro", "title": "…",
      "module": "card",            // draw module: built-in name (src/video/scenes/<name>.js) or "./scenes/intro.js" in the pack
      "start": 0, "end": 8,
      "lead": 0.5, "tail": 0,      // optional overlap with the previous / next scene
      "assets": ["paper", "tinSoldier.sticker", "tex:paperBoat", "castle"],  // preloaded before rendering
      "cues": [{ "t": 0.5, "sfx": "scribble", "dur": 1.2, "gain": 0.6, "pan": -0.5, "panTo": 0.5 }],
      "copy": { "lines": [{ "text": "once upon a time…", "at": 0.5, "dur": 1.2, "y": 300 }] },
      "params": { }                // module-specific
    }
  ],
  "music": {
    "bpm": 120, "key": "C major",
    "chordTones": { "C": ["C","E","G"] },   // optional; defaults: C G Am F Dm Em
    "chords": [[0, 2, "C"], [2, 4, "Am"]],  // [start, end, chord]
    "theme": [[["E5", 0, 1], ["G5", 1, 1]]],// bars of [note, start 8th, length in 8ths]
    "sections": [
      { "id": "intro", "start": 0, "end": 8, "note": "free text",
        "layers": [ { "op": "pads", "a": 0, "z": 8, "gain": 0.2, "cutoff": 1000 } ] }
    ]
  }
}
```

## Asset names

| name in a scene's `assets` | comes from |
| --- | --- |
| `paper` | seamless paper made by `pnpm extract` (or `assets.files.paper`) |
| `<sprite>` | colour-to-alpha cut-out of `assets.sprites.<sprite>` |
| `<sprite>.sticker` | the same drawing on a paper sticker (sprite `mode` "object", or `sticker: true`) |
| `tex:<texture>` | crop from `assets.textures.<texture>` |
| `<file>` | `assets.files.<file>` used as-is |

Sprite options (`mode`, `exclude`, `grow`, `edgeRule`, `photoEdge`, `sticker`,
`stickerClose`) are documented at the top of `src/extract/manifest.js`.

## Cues

`{ t, sfx, gain?, pan?, panTo?, panLfo?, pitch?, dur?, note? }`. `sfx` is a
key of `src/audio/sfx.js` (≈50 sounds: `pop`, `boing`, `tweet`, `scribble`,
`pageTurn`, `shimmer`, `harp`, `twinkle`, `musicbox`, `snore`, `ding`, and for
quiet nights `rustle`, `brook`, `breeze`, `yawn`, …;
`pnpm story:validate` lists unknown names). `note` (e.g. `"C6"`) is used by
pitched sfx such as `musicbox`, `twinkle`, `pluck`, `grow`, `popNote`.

## Copy

Free-form per module: custom modules read their own keys (the sketchbook uses
`copy.title1`, `copy.words[]`, …). The generic `card` module reads
`copy.lines[] = { text, at, dur?, x?, y?, size?, font? ("Brush"|"Hand"|"CJK"|"CJKHand"), color?, rot?, out? }`.
`CJKHand` is ZCOOL KuaiLe, a hand-lettered Chinese face shipped in `assets/fonts`.

## Spoken lines (narration / character voices)

Optional. A top-level `voices` cast maps speaker names to text-to-speech voices,
and lines are marked as spoken in two ways:

```jsonc
"voices": {
  "narrator": { "voice": "zh-CN-XiaoxiaoNeural", "rate": "-5%" },
  "emperor":  { "voice": "zh-CN-YunjianNeural", "pitch": "-8Hz", "rate": "-10%", "gain": 1, "pan": -0.15 }
},
"scenes": [{
  "copy": { "lines": [
    { "text": "「多么华丽啊！」", "at": 21.5, "speaker": "emperor" },          // speak this on-screen line
    { "text": "（其实什么也没有）", "at": 25, "speaker": "narrator", "say": "其实，什么也没有。" }  // spoken text override
  ] },
  "dialogue": [ { "at": 28.9, "speaker": "ministers", "text": "漂亮极了！" } ]  // spoken, no on-screen text
}]
```

Line options: `say`, `voiceAt` (start time if not `at`), `rate`, `pitch`, `gain`,
`pan`, `maxDur`. Brackets 「」（） are stripped before speaking. Each line is
fitted into its slot (until the next spoken line) by raising the TTS rate.

`pnpm voices` (`src/audio/voices.js`) synthesises one wav per line into
`<buildDir>/voices/` (+ `manifest.json`, cached by text/voice) with the voice's
TTS `provider` (`src/audio/tts.js`): `edge-tts` (default; Microsoft Edge
neural voices, needs network; found as `$EDGE_TTS`, `edge-tts` on PATH, or
`../.venv-tts/bin/edge-tts`), `command` (any local TTS through the
`$TTS_COMMAND` template) or `openai` (an OpenAI-compatible
`$TTS_BASE_URL/v1/audio/speech`, with `$TTS_API_KEY` and the voice's `model`).
`pnpm audio` then mixes them on a dialogue bus, ducking music ~9 dB under
speech, so the rendered mp4 carries the voices. `pnpm story:validate` checks
every speaker has a voice. Packs without spoken lines are unaffected.

## Narration first (TTS or a recording)

For a told story the narration leads and the film follows it: scenes, cues,
captions and camera moves are placed on its measured phrases. The script is
`<pack>/narration.json`:

```jsonc
{ "at": 3.0,     // film time where the narration starts (a title before it)
  "gap": 0.7,    // pause after each line, seconds (TTS only)
  "lines": [ { "speaker": "narrator", "text": "月亮升上了安静的山丘，……", "gap": 1.2, "rate": "-5%" } ] }
```

- `pnpm narrate` speaks each line with its speaker's voice from `voices`
  (any provider), joins the clips and pauses into
  `input-audio/narration.wav`, and writes `narration.timing.json`.
- `pnpm align` does the same timing for a recording (the lines are its
  transcript; `python3 src/tools/transcribe.py <audio>` drafts one).
- `narration.timing.json`: `{ audio, at, duration, lines: [{ speaker, text,
  start, end, phrases: [{ text, start, end }] }] }`, in film seconds. Phrases
  split after ，。！？； and , . ! ? ; — speech is found with silencedetect,
  breaths are dropped, and phrases are laid over the speech by length.
- `pnpm captions --write` turns it into caption lines (below).

The audio is mixed from a top-level `recordings` array; `pnpm audio` decodes
each file with ffmpeg and lays it on the dialogue bus, so the music ducks
under it like under TTS lines:

```jsonc
"recordings": [
  { "file": "input-audio/narration.wav", "at": 3.0, "gain": 1, "pan": 0 }  // any format ffmpeg reads, relative to the pack
]
```

Like page photos, the audio is source media: `input-audio/` is git-ignored,
and `pnpm story:validate` only warns when the file is missing or runs past
the end of the film. `stories/goodnight-little-fox` is built this way.

## Captions (narrated films)

Kit-based modules (`src/video/kit`, drawn through `frame()`) write the
narration in at the bottom of the frame as it is spoken: every scene's
`copy.lines[]` entry with `beats` is a caption line, one `[start, end]` per
phrase of its `text` (split after ，。！？…), and the line fades just before
the next one (or set `out`). `pnpm captions --write` makes them from the
timing. Style, all optional, in a top-level `captions` object:

```jsonc
"captions": { "font": "CJKHand", "size": 56, "y": 996, "color": "#fff4dc",
              "shadow": "rgba(6,8,26,0.9)", "band": "rgba(6,8,26,0.42)" }   // "none" turns shadow / band off
```

## Built-in `card` module params

`background`, `paper` (bool), `fade`, and
`layers[] = { asset, x, y, h, at, out?, rot?, ax?, ay?, flip? }` (sprites that
pop in at `at`). See the header of `src/video/scenes/card.js`.

## Music layer ops

Each section's `layers` are mixed in order. Steps accept seconds or
`"bar" | "halfbar" | "beat" | "8th" | "16th"`.

| op | fields |
| --- | --- |
| `pads` | `a, z, gain, cutoff?` — sustained chord pads following `chords` |
| `arp` | `a, z, inst, gain, step?, oct?, pan?` — chord arpeggio (`musicbox`/`glock`/`marimba`) |
| `melody` | `bars[], at, inst, gain, pan?, oct?` — bars of `theme` starting at `at` |
| `strum` | `a, z, gain, pattern?` — ukulele strums (beats in the bar) |
| `bassline` | `a, z, gain, pattern?` — root + octave bass |
| `drums` | `a, z, kicks?, claps?, shake?, gain?` |
| `hit` | `bus ("music"/"perc"), inst, opts?, note?, at, gain?, pan?` — one sound |
| `pulse` | `inst, opts?, a, z, step, gain?` — repeated percussion |
| `clapRoll` | `a, z, step, amp, ampSlope, gain` — rising clap roll |
| `oompah` | `a, z, tuba, chord, woodblock` — march |
| `halftime` | `a, z, bass, kick, shaker` — dreamy half-time groove |
| `fingerpick` | `a, z, gain` — picked uke on eighths |
| `rootBass` | `a, z, step, dur, drive, gain` — chord roots on a grid |
| `finalChord` | `at, chord, extra?` — big ending hit |
| `phrase` | `at, inst, notes[], step, gain?, pan?` — literal notes |

New ops go in `src/audio/music.js` (`OPS`) and must be added to
`src/story/vocab.js` and the `layer.op` enum in `story.schema.json`
(the validator checks they agree).
