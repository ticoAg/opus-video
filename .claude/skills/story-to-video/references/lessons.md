# Lessons (what went wrong once, and the fix)

Collected while making `goodnight-little-fox`. Add to this list whenever a
film teaches you something.

## Narration and timing

- **Homophones in transcripts.** Whisper heard 月亮升上了安静的山丘 as
  “月亮身上蓝紧的山丘” (了安 → 蓝). `transcribe.py` lists low-probability
  words: re-read each in context and cross-check doubtful spots with a second
  model (`--model large-v3`). Never animate a sentence you have not understood.
- **Breaths look like words.** A 0.2 s inhale matched the one-character phrase
  “风”, and every later phrase shifted by one. `speechSegments` drops blips
  more than 10 dB below the typical speech level; keep that when changing it.
- **Time the film to the voice, not the voice to the film.** Squeezing TTS
  into fixed slots sounds rushed. Narrate first, then place every cut,
  camera move and cue on the measured phrase times.
- **Cut in pauses.** Scene changes land between lines (≥ 0.6 s of silence);
  `pnpm qa` warns when a crossfade lands inside a phrase.

## Drawing

- **Ribbons fold on tight bends.** A tapered shape (`taper`, `brook`) whose
  bend radius is smaller than half its width folds over itself into a dark
  zig-zag. Keep bends gentle near the wide end; check the outline numerically
  (the edge must move the same way as the centre line).
- **Washes spill out of shapes.** A highlight wash drawn after all the parts
  overlapped its neighbours as ghostly rings. Draw each part's wash right
  after the part, clipped to it (`clipShape` or an ellipse clip), then its ink.
- **The moon looked like the sun.** Hard rays read as daylight. Moonlight =
  soft halos and slow silver ripples (`moon({ rays })`).
- **Seams where a band ends.** A ground band stopping mid-frame leaves a
  vertical edge. Extend ridges past the frame, or slope them below it.
- **Lens-shaped furniture.** Four control points through the smooth path make
  a lens, and a very flat ellipse has pointed ends. Use `rrect`.
- **Things must stand on something.** A treeline against bare sky floats: put
  a hill behind it. Lanterns need a twig to hang from, drawn after the trees.
- **Small things vanish at 1080p.** A firefly needs a ≥ 100 px glow and a
  trail; notes and doodles need ~60 px or more.

## Camera and transitions

- **Push-ins lose their target** when the centre moves linearly while the zoom
  grows fast. Use `zoomOnto(from, target, z, e)`.
- **An iris opens from where the subject is on screen** at that moment
  (apply the camera of the outgoing scene), not from its world position.
- **Cross-scene continuity.** Outdoor beats share one world layout (moon,
  house, brook positions), so pans and cuts agree with each other.

## Text

- One caption line at a time, ≤ 14 CJK characters, written in as spoken
  (`beats`); captions on a soft dark band over night scenes.
- Check titles against what is behind them at that time (the moon rose into
  the title once).

## Sound

- Narration at gain 1; music pads ≈ 0.1, melodies ≈ 0.1–0.15; effects
  0.1–0.5. The mixer ducks music under speech. Aim for −16 LUFS (`pnpm qa`).
- Effects follow the picture: a twinkle per star (notes in key), a rustle
  when leaves shake, a yawn in the gap after "eyelids grew heavy".

## Pipeline and environment

- Refactoring the kit: render the same stills before and after and `cmp`
  them. Moving code should change nothing.
- Render speed: ~5–6 frames/s at 1080p (x264 slow); the share copy takes a
  few more minutes.
- In the cloud sandbox, Python tools that bundle their own CA list (edge-tts
  via certifi) fail TLS through the proxy; point that venv's certifi file at
  `/root/.ccr/ca-bundle.crt`. Agent sessions cannot push tags (403): the user
  makes releases.
- Watching a process with `pgrep -f <pattern>` matches the watcher's own
  command line; watch a PID or a marker file instead.
