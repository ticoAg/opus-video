// Text-to-speech providers, shared by `pnpm voices` (TTS lines fitted into
// slots of the timeline) and `pnpm narrate` (narration first, the timeline is
// built on it). A voice in story.json's "voices" cast picks one with
// "provider" (default "edge-tts"):
//
//   edge-tts  Microsoft Edge neural voices through the edge-tts CLI (needs
//             network). Found as $EDGE_TTS, `edge-tts` on PATH, or
//             ../.venv-tts/bin/edge-tts (python3 -m venv ../.venv-tts &&
//             ../.venv-tts/bin/pip install edge-tts).
//   command   Any local TTS. $TTS_COMMAND is a shell command template with
//             {text} {voice} {model} {rate} {speed} {pitch} {out} placeholders
//             (values are shell-quoted for you), e.g.
//               TTS_COMMAND='my-tts --voice {voice} --speed {speed} -o {out} {text}'
//   openai    An OpenAI-compatible speech endpoint (many self-hosted TTS servers
//             offer one): POST $TTS_BASE_URL/v1/audio/speech with
//             { model, input, voice, speed, response_format: "wav" }, plus
//             "Authorization: Bearer $TTS_API_KEY" when that is set.
//             model = the voice's "model" ?? $TTS_MODEL ?? "tts-1".
//
// rate is a percentage (+10 = 10% faster), as in edge-tts; command / openai
// also get it as a speed factor (1.1).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../story/load.js';
import { SR } from './dsp.js';
import { readWavMono } from './wav.js';

export const fmtPct = (n) => { const r = Math.round(n) || 0; return `${r >= 0 ? '+' : ''}${r}%`; };
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function run(bin, args, what, opts = {}) {
  let r;
  for (let k = 0; k < 3; k++) { // services occasionally drop a request
    r = spawnSync(bin, args, { encoding: 'utf8', ...opts });
    if (r.status === 0) return r;
  }
  throw new Error(`${what} failed: ${String(r.stderr || r.error || '').trim()}`);
}

function edgeTTS() {
  const cands = [process.env.EDGE_TTS, 'edge-tts', path.resolve(ROOT, '../.venv-tts/bin/edge-tts')].filter(Boolean);
  for (const c of cands) {
    const r = spawnSync(c, ['--help'], { stdio: 'ignore' });
    if (!r.error && r.status === 0) return c;
  }
  throw new Error('edge-tts not found: set EDGE_TTS or `pip install edge-tts` (see src/audio/tts.js)');
}

export const PROVIDERS = {
  'edge-tts': (l, out) => run(edgeTTS(), ['--voice', l.voice, `--rate=${fmtPct(l.rate)}`, `--pitch=${l.pitch ?? '+0Hz'}`,
    '--text', l.text, '--write-media', out], 'edge-tts'),
  command: (l, out) => {
    const tpl = process.env.TTS_COMMAND;
    if (!tpl) throw new Error('TTS provider "command": set TTS_COMMAND (see src/audio/tts.js)');
    const vars = { text: l.text, voice: l.voice ?? '', model: l.model ?? '', rate: Math.round(l.rate), speed: (1 + l.rate / 100).toFixed(3), pitch: l.pitch ?? '+0Hz', out };
    run('sh', ['-c', tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? shq(vars[k]) : m))], 'TTS_COMMAND');
  },
  openai: (l, out) => {
    const base = process.env.TTS_BASE_URL;
    if (!base) throw new Error('TTS provider "openai": set TTS_BASE_URL (see src/audio/tts.js)');
    const body = JSON.stringify({ model: l.model ?? process.env.TTS_MODEL ?? 'tts-1', input: l.text, voice: l.voice, speed: 1 + l.rate / 100, response_format: 'wav' });
    // Headers go through curl's stdin config, so the key never shows in `ps`.
    const config = ['header = "Content-Type: application/json"', ...(process.env.TTS_API_KEY ? [`header = "Authorization: Bearer ${process.env.TTS_API_KEY}"`] : [])].join('\n');
    const bodyFile = path.join(os.tmpdir(), `tts-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(bodyFile, body);
    try {
      const r = run('curl', ['-sS', '-X', 'POST', `${base.replace(/\/$/, '')}/v1/audio/speech`, '--config', '-', '--data-binary', `@${bodyFile}`,
        '-o', out, '-w', '%{http_code}'], 'TTS endpoint', { input: config });
      if (Number(r.stdout) >= 400) throw new Error(`TTS endpoint returned ${r.stdout}: ${fs.existsSync(out) ? fs.readFileSync(out, 'utf8').slice(0, 300) : ''}`);
    } finally { fs.rmSync(bodyFile, { force: true }); }
  },
};

// Speak one line { text, voice, provider?, model?, rate? (percent), pitch? }
// into `file`: mono PCM16 wav at SR, silence trimmed from both ends, with a
// short fade-in. Returns its length in seconds.
export function speak(l, file) {
  const provider = PROVIDERS[l.provider ?? 'edge-tts'];
  if (!provider) throw new Error(`unknown TTS provider "${l.provider}" (one of: ${Object.keys(PROVIDERS).join(', ')})`);
  const raw = `${file}.raw`;
  provider({ ...l, rate: l.rate ?? 0 }, raw);
  const f = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-ac', '1', '-ar', String(SR),
    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,afade=t=in:d=0.03,areverse',
    '-c:a', 'pcm_s16le', file], { encoding: 'utf8' });
  fs.rmSync(raw, { force: true });
  if (f.status !== 0) throw new Error(`ffmpeg could not read the TTS output for "${l.text}": ${f.stderr}`);
  return readWavMono(file).data.length / SR;
}
