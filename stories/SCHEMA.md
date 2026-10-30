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
`<buildDir>/voices/` (+ `manifest.json`, cached by text/voice) using the
`edge-tts` CLI (Microsoft Edge neural voices; needs network; found as
`$EDGE_TTS`, `edge-tts` on PATH, or `../.venv-tts/bin/edge-tts`).
`pnpm audio` then mixes them on a dialogue bus, ducking music ~9 dB under
speech, so the rendered mp4 carries the voices. `pnpm story:validate` checks
every speaker has a voice. Packs without spoken lines are unaffected.

## Recorded narration

Instead of (or as well as) TTS lines, a pack can bring its own audio: a story
read aloud by a person, an interview, a song. List it in a top-level
`recordings` array; `pnpm audio` decodes each file with ffmpeg and lays it on
the same dialogue bus, so the music ducks under it like under TTS lines.

```jsonc
"recordings": [
  { "file": "input-audio/narration.wav", "at": 3.0, "gain": 1, "pan": 0 }  // any format ffmpeg reads, relative to the pack
]
```

`at` places the recording on the film clock (here: 3 s of title first), so
everything else is timed from the recording: measure where each phrase starts
and ends (e.g. `ffmpeg -af silencedetect` on the file, or a speech-to-text
transcript with word timings) and use those seconds for scene starts, cues and
captions. Like page photos, the audio is source media: `input-audio/` is
git-ignored, and `pnpm story:validate` only warns when the file is missing or
runs past the end of the film. `stories/goodnight-little-fox` is built this way.

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
