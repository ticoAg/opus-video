// Validates story packs: JSON shape (stories/story.schema.json, checked by a
// small built-in JSON-Schema subset so there are no extra dependencies) plus
// the cross-references a schema cannot express (assets, sfx, modules, chords,
// timing).
//
//   node src/story/validate.js              every pack in stories/
//   node src/story/validate.js andersen-x   just these packs
//   ... --strict                            treat warnings as errors
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { STORIES_DIR, ROOT, loadStory, sceneModulePath } from './load.js';
import { LAYER_OPS, STEP_NAMES, FONTS, NOTE_RE } from './vocab.js';

const SCHEMA = JSON.parse(fs.readFileSync(path.join(STORIES_DIR, 'story.schema.json'), 'utf8'));

// --- tiny JSON Schema (2020-12 subset) ------------------------------------
function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}
function resolveRef(ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref ${ref}`);
  return ref.slice(2).split('/').reduce((o, k) => o[k], SCHEMA);
}
function check(schema, v, at, errs) {
  if (schema.$ref) return check(resolveRef(schema.$ref), v, at, errs);
  const n0 = errs.length;
  if (schema.anyOf) {
    if (!schema.anyOf.some((s) => { const e = []; check(s, v, at, e); return !e.length; })) errs.push(`${at}: does not match any allowed form`);
    return errs.length === n0;
  }
  if (schema.enum && !schema.enum.includes(v)) errs.push(`${at}: ${JSON.stringify(v)} is not one of ${schema.enum.join(', ')}`);
  if (schema.type) {
    const t = typeOf(v);
    const ok = [].concat(schema.type).some((x) => x === t || (x === 'number' && t === 'integer'));
    if (!ok) { errs.push(`${at}: expected ${schema.type}, got ${t}`); return false; }
  }
  if (typeof v === 'number') {
    if (schema.minimum !== undefined && v < schema.minimum) errs.push(`${at}: ${v} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && v > schema.maximum) errs.push(`${at}: ${v} > maximum ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && v <= schema.exclusiveMinimum) errs.push(`${at}: ${v} must be > ${schema.exclusiveMinimum}`);
  }
  if (typeof v === 'string') {
    if (schema.minLength !== undefined && v.length < schema.minLength) errs.push(`${at}: too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) errs.push(`${at}: "${v}" does not match ${schema.pattern}`);
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && v.length > schema.maxItems) errs.push(`${at}: at most ${schema.maxItems} items`);
    const pre = schema.prefixItems ?? [];
    v.forEach((x, i) => {
      const s = i < pre.length ? pre[i] : schema.items;
      if (s) check(s, x, `${at}[${i}]`, errs);
    });
  }
  if (typeOf(v) === 'object') {
    for (const k of schema.required ?? []) if (!(k in v)) errs.push(`${at}: missing "${k}"`);
    for (const [k, x] of Object.entries(v)) {
      const p = schema.properties?.[k];
      if (p) check(p, x, `${at}.${k}`, errs);
      else if (schema.additionalProperties === false) errs.push(`${at}: unknown property "${k}"`);
      else if (typeof schema.additionalProperties === 'object') check(schema.additionalProperties, x, `${at}.${k}`, errs);
    }
  }
  return errs.length === n0;
}

// --- semantic checks ------------------------------------------------------
let SFX_NAMES = null;
async function sfxNames() {
  if (SFX_NAMES) return SFX_NAMES;
  try {
    const { SFX } = await import('../audio/sfx.js');
    SFX_NAMES = new Set(Object.keys(SFX));
  } catch (e) {
    SFX_NAMES = new Set();
    SFX_NAMES.failed = e.message;
  }
  return SFX_NAMES;
}

const DEFAULT_CHORDS = ['C', 'G', 'Am', 'F', 'Dm', 'Em'];

async function semantic(story, errs, warns) {
  const { meta, scenes, music } = story;
  const sprites = story.assets?.sprites ?? {};
  const textures = story.assets?.textures ?? {};
  const files = story.assets?.files ?? {};
  const sheets = new Set(story.assets?.sources?.sheets ?? []);
  const dur = story.duration;

  if (meta.id !== path.basename(story.dir)) warns.push(`meta.id "${meta.id}" differs from folder name "${path.basename(story.dir)}"`);
  for (const [n, a] of [...Object.entries(sprites), ...Object.entries(textures)]) {
    if (!sheets.has(a.sheet)) errs.push(`asset "${n}": sheet "${a.sheet}" is not listed in assets.sources.sheets`);
  }
  for (const [n, f] of Object.entries(files)) {
    if (!fs.existsSync(path.resolve(story.dir, f))) errs.push(`assets.files.${n}: file not found (${f})`);
  }

  // Scenes: unique ids, ordered, inside the film, module present.
  const ids = new Set();
  let prevEnd = 0;
  const lastEnd = Math.max(...scenes.map((s) => s.end));
  if (meta.duration !== undefined && meta.duration < lastEnd) errs.push(`meta.duration ${meta.duration} < last scene end ${lastEnd}`);
  const sfx = await sfxNames();
  if (sfx.failed) warns.push(`could not load the sfx library to check cue names (${sfx.failed})`);
  const built = fs.existsSync(path.join(story.paths.build, 'assets'));
  const missingBuilt = new Set();
  scenes.forEach((s, i) => {
    const at = `scenes[${i}] "${s.id}"`;
    if (ids.has(s.id)) errs.push(`${at}: duplicate scene id`);
    ids.add(s.id);
    if (!(s.end > s.start)) errs.push(`${at}: end (${s.end}) must be after start (${s.start})`);
    if (s.start < prevEnd - 1e-9) errs.push(`${at}: starts at ${s.start}, before the previous scene ends (${prevEnd}); use "lead" for overlaps`);
    else if (s.start > prevEnd + 1e-9) warns.push(`${at}: gap of ${(s.start - prevEnd).toFixed(2)}s before this scene (background only)`);
    prevEnd = s.end;
    if (s.start - s.lead < 0) errs.push(`${at}: lead reaches before 0s`);
    const modFile = sceneModulePath(story, s);
    if (!fs.existsSync(modFile)) errs.push(`${at}: draw module not found: ${path.relative(ROOT, modFile)}`);

    for (const a of s.assets) {
      if (files[a]) continue;
      if (a === 'paper') { if (!Object.keys(sprites).length && !files.paper) warns.push(`${at}: 'paper' is made by pnpm extract from the page photos; this pack has no sprites/photos (add assets.files.paper or drop it)`); }
      else if (a.startsWith('tex:')) { if (!textures[a.slice(4)]) errs.push(`${at}: asset "${a}" has no entry in assets.textures`); }
      else {
        const name = a.replace(/\.sticker$/, '');
        const sp = sprites[name];
        if (!sp) errs.push(`${at}: asset "${a}" has no entry in assets.sprites or assets.files`);
        else if (a.endsWith('.sticker') && (sp.mode === 'scene' && !sp.sticker)) errs.push(`${at}: "${a}" needs sprite "${name}" to be mode "object" or have sticker: true`);
      }
      if (built && !files[a]) {
        const f = a === 'paper' ? path.join(story.paths.build, 'paper.png')
          : a.startsWith('tex:') ? path.join(story.paths.build, 'textures', `${a.slice(4)}.jpg`)
          : path.join(story.paths.build, 'assets', `${a}.png`);
        if (!fs.existsSync(f)) missingBuilt.add(a);
      }
    }
    s.cues.forEach((c, k) => {
      const cat = `${at} cues[${k}]`;
      if (sfx.size && !sfx.has(c.sfx)) errs.push(`${cat}: unknown sfx "${c.sfx}" (see src/audio/sfx.js)`);
      if (c.t > dur) errs.push(`${cat}: t=${c.t} is after the end of the film (${dur})`);
      else if (c.t < s.start - s.lead - 1e-9 || c.t > s.end + s.tail + 1e-9) warns.push(`${cat}: t=${c.t} lies outside the scene window`);
    });
    if (s.module === 'card') {
      (s.copy.lines ?? []).forEach((l, k) => {
        if (typeof l.text !== 'string') errs.push(`${at} copy.lines[${k}]: needs "text"`);
        if (l.font && !FONTS.includes(l.font)) errs.push(`${at} copy.lines[${k}]: font must be one of ${FONTS.join(', ')}`);
      });
      (s.params.layers ?? []).forEach((l, k) => {
        if (!s.assets.includes(l.asset)) errs.push(`${at} params.layers[${k}]: asset "${l.asset}" must also be listed in the scene's assets`);
      });
    }
  });
  if (missingBuilt.size) warns.push(`${missingBuilt.size} scene asset(s) not built yet in ${path.relative(ROOT, story.paths.build)} (run pnpm extract): ${[...missingBuilt].slice(0, 8).join(', ')}${missingBuilt.size > 8 ? ', …' : ''}`);

  // Spoken lines: every speaker needs a voice in the cast, times inside the film.
  const cast = story.voices ?? {};
  scenes.forEach((s, i) => {
    const at = `scenes[${i}] "${s.id}"`;
    const spoken = [
      ...(Array.isArray(s.copy.lines) ? s.copy.lines : []).map((l, k) => [`copy.lines[${k}]`, l, l.voiceAt ?? l.at]).filter(([, l]) => l.speaker !== undefined),
      ...(s.dialogue ?? []).map((d, k) => [`dialogue[${k}]`, d, d.at]),
    ];
    for (const [where, l, t] of spoken) {
      if (typeof l.speaker !== 'string' || !cast[l.speaker]) errs.push(`${at} ${where}: speaker "${l.speaker}" has no entry in "voices"`);
      if (typeof t !== 'number') errs.push(`${at} ${where}: spoken line needs a numeric "at"`);
      else if (t > dur) errs.push(`${at} ${where}: spoken at ${t}, after the end of the film`);
    }
  });

  // Recordings: source media like the page photos (may be kept out of git), so
  // a missing file only warns; it has to start, and should end, inside the film.
  (story.recordings ?? []).forEach((r, i) => {
    const at = `recordings[${i}]`, t = r.at ?? 0;
    const file = path.resolve(story.dir, r.file);
    if (t > dur) errs.push(`${at}: starts at ${t}, after the end of the film`);
    if (!fs.existsSync(file)) { warns.push(`${at}: ${path.relative(ROOT, file)} not found (pnpm audio needs it)`); return; }
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    const len = Number(probe.stdout);
    if (probe.status === 0 && len && t + len > dur + 1e-6) warns.push(`${at}: runs ${(t + len - dur).toFixed(2)}s past the end of the film`);
  });

  // Music: chord chart, theme, layers.
  const chordNames = new Set(Object.keys(music.chordTones ?? {}).length ? Object.keys(music.chordTones) : DEFAULT_CHORDS);
  let pz = 0;
  music.chords.forEach(([a, z, c], i) => {
    if (!chordNames.has(c)) errs.push(`music.chords[${i}]: chord "${c}" is not defined in music.chordTones`);
    if (!(z > a)) errs.push(`music.chords[${i}]: end must be after start`);
    if (a < pz - 1e-9) errs.push(`music.chords[${i}]: overlaps the previous chord`);
    pz = z;
  });
  const bars = (music.theme ?? []).length;
  for (const sec of music.sections) {
    if (sec.end < sec.start) errs.push(`music section "${sec.id}": end before start`);
    if (sec.end > dur + 1e-9) warns.push(`music section "${sec.id}" runs past the end of the film`);
    sec.layers.forEach((L, i) => {
      const at = `music section "${sec.id}" layers[${i}] (${L.op})`;
      if (!LAYER_OPS.includes(L.op)) return; // already reported by the schema
      if ('a' in L && 'z' in L && !(L.z > L.a)) errs.push(`${at}: z must be after a`);
      if (typeof L.step === 'string' && !STEP_NAMES.includes(L.step)) errs.push(`${at}: unknown step "${L.step}"`);
      const need = {
        pads: ['a', 'z', 'gain'], arp: ['a', 'z', 'inst', 'gain'], melody: ['bars', 'at', 'inst', 'gain'],
        strum: ['a', 'z', 'gain'], bassline: ['a', 'z', 'gain'], drums: ['a', 'z'], hit: ['inst', 'at'],
        pulse: ['inst', 'a', 'z', 'step'], clapRoll: ['a', 'z', 'step', 'amp', 'ampSlope', 'gain'],
        oompah: ['a', 'z', 'tuba', 'chord', 'woodblock'], halftime: ['a', 'z', 'bass', 'kick', 'shaker'],
        fingerpick: ['a', 'z', 'gain'], rootBass: ['a', 'z', 'step', 'dur', 'drive', 'gain'],
        finalChord: ['at', 'chord'], phrase: ['at', 'notes', 'step', 'inst'],
      }[L.op];
      for (const k of need) if (L[k] === undefined) errs.push(`${at}: missing "${k}"`);
      if (L.op === 'melody') {
        if (!bars) errs.push(`${at}: needs music.theme`);
        for (const b of L.bars ?? []) if (!(b >= 0 && b < bars)) errs.push(`${at}: theme bar ${b} does not exist (theme has ${bars})`);
      }
      if (L.op === 'finalChord' && !chordNames.has(L.chord)) errs.push(`${at}: unknown chord "${L.chord}"`);
      for (const n of [...(L.notes ?? []), ...(L.extra ?? []), ...(L.note ? [L.note] : [])]) if (!NOTE_RE.test(n)) errs.push(`${at}: bad note "${n}"`);
      if (['arp', 'melody', 'phrase'].includes(L.op) && !['musicbox', 'marimba', 'glock', 'pluck'].includes(L.inst)) errs.push(`${at}: inst must be musicbox, marimba, glock or pluck`);
      if (['hit', 'pulse'].includes(L.op) && !['kick', 'clap', 'shaker', 'cymbal', 'woodblock', 'pluck', 'glock', 'musicbox', 'marimba', 'bass', 'tuba'].includes(L.inst)) errs.push(`${at}: unknown inst "${L.inst}"`);
      if (L.op === 'pulse' && !['kick', 'clap', 'shaker', 'cymbal', 'woodblock'].includes(L.inst)) errs.push(`${at}: pulse needs a percussion inst`);
    });
  }
  // The schema's op enum must match what music.js implements.
  const schemaOps = SCHEMA.$defs.layer.properties.op.enum;
  if (schemaOps.join() !== LAYER_OPS.join()) errs.push('story.schema.json layer op enum is out of sync with src/story/vocab.js');
}

export async function validatePack(id) {
  const errs = [], warns = [];
  const file = path.join(STORIES_DIR, id, 'story.json');
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { errs: [`cannot read ${file}: ${e.message}`], warns }; }
  check(SCHEMA, raw, 'story', errs);
  if (!errs.length) await semantic(loadStory(id), errs, warns);
  return { errs, warns };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  let ids = args.filter((a) => !a.startsWith('--'));
  if (!ids.length) ids = fs.readdirSync(STORIES_DIR).filter((d) => fs.existsSync(path.join(STORIES_DIR, d, 'story.json')));
  let failed = 0;
  for (const id of ids) {
    const { errs, warns } = await validatePack(id);
    const bad = errs.length || (strict && warns.length);
    if (bad) failed++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${id}${errs.length ? `  ${errs.length} error(s)` : ''}${warns.length ? `  ${warns.length} warning(s)` : ''}`);
    for (const e of errs) console.log(`  error: ${e}`);
    for (const w of warns) console.log(`  warn:  ${w}`);
  }
  process.exit(failed ? 1 : 0);
}
