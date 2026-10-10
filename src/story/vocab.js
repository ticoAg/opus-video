// The fixed vocabulary every story pack can use. Kept free of engine imports
// so the validator can load it without loading a pack.

// Music layer ops implemented by src/audio/music.js.
export const LAYER_OPS = ['pads', 'arp', 'melody', 'strum', 'bassline', 'drums', 'hit', 'pulse', 'clapRoll', 'oompah',
  'halftime', 'fingerpick', 'rootBass', 'finalChord', 'phrase'];

// Named grid steps accepted wherever a layer takes `step`.
export const STEP_NAMES = ['bar', 'halfbar', 'beat', '8th', '16th'];

// Fonts registered by src/video/engine.js.
export const FONTS = ['Brush', 'Hand', 'CJK'];

// Note names like C5, F#4, Bb3.
export const NOTE_RE = /^[A-G](#|b)?-?\d$/;
