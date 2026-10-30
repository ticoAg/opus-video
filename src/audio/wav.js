// Minimal PCM16 mono WAV read/write.
import fs from 'node:fs';

export function readWavMono(file) {
  const b = fs.readFileSync(file);
  let o = 12, fmt = null;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4), len = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') {
      if (!fmt || fmt.bits !== 16) throw new Error(`${file}: expected 16-bit PCM`);
      const n = Math.floor(len / 2 / fmt.ch), x = new Float32Array(n);
      for (let i = 0; i < n; i++) x[i] = b.readInt16LE(o + 8 + i * 2 * fmt.ch) / 32768;
      return { sr: fmt.sr, data: x };
    }
    o += 8 + len + (len & 1);
  }
  throw new Error(`${file}: no data chunk`);
}

export function writeWavMono(file, data, sr) {
  const pcm = Buffer.alloc(data.length * 2);
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}
