// The storybook kit: everything a kit-based scene module needs, in one import.
//
//   import { frame, sky, moon, fox, room, titleText, camera, key } from '../../../src/video/kit/index.js';
//
// ink.js      marks (blob, shape, stroke, limb, glow), geometry, keyframes, camera
// paper.js    synthesised paper grain
// night.js    sky, moon, stars, hills, trees, tree house, brook, stones
// props.js    lanterns, fireflies, notes, clouds, doodles, wind curls, z z z
// fox.js      the little fox (sit / curl, expressions) and her quilt
// room.js     the cosy tree-house room and the night through its round window
// captions.js narration captions (copy.lines[].beats), inkText, titleText
// frame.js    scene fades + the paper / caption overlay (wrap every draw in it)
export { W, H, INK, wash, star, sparkle, heart } from '../engine.js';
export { clamp, hash, noise1, invLerp, lerp, smooth, ease } from '../../lib/util.js';
export { PAL } from './palette.js';
export { st8, blob, shape, clipShape, stroke, limb, dot, glow, camera, zoomOnto, bez, taper, rrect, key, popK } from './ink.js';
export { grain } from './paper.js';
export { sky, moon, bigStar, starDust, ridge, hill, roundTree, pine, treeHouse, brookPath, brook, stone } from './night.js';
export { lantern, firefly, note, cloud, doodle, swirl, zzz } from './props.js';
export { fox, quilt } from './fox.js';
export { ROOM, room, windowView } from './room.js';
export { captionLines, captions, inkText, titleText } from './captions.js';
export { frame } from './frame.js';
