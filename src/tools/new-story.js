// Start a story pack from a template.
//
//   pnpm story:new <id> [--title "…"] [--template narrated]
//
// Copies templates/<template>/ to stories/<id>/ and fills in {{id}} and
// {{title}}. The "narrated" template is a narration-first film: write the
// script in narration.json, then pnpm narrate -> pnpm captions --write ->
// edit scenes -> pnpm audio / pnpm video (see .claude/skills/story-to-video).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, STORIES_DIR } from '../story/load.js';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : d; };
const title = opt('--title', null), template = opt('--template', 'narrated');
const id = args[0];
if (!id || !/^[a-z0-9][a-zA-Z0-9_-]*$/.test(id)) throw new Error('usage: pnpm story:new <id> [--title "…"] [--template narrated]  (id: lowercase letters, digits, - and _)');
const src = path.join(ROOT, 'templates', template), dst = path.join(STORIES_DIR, id);
if (!fs.existsSync(src)) throw new Error(`no template ${path.relative(ROOT, src)}`);
if (fs.existsSync(dst)) throw new Error(`${path.relative(ROOT, dst)} already exists`);

const copy = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copy(a, b);
    else if (/\.(json|js|md|txt)$/.test(e.name)) fs.writeFileSync(b, fs.readFileSync(a, 'utf8').replaceAll('{{id}}', id).replaceAll('{{title}}', title ?? id));
    else fs.copyFileSync(a, b);
  }
};
copy(src, dst);
console.log(`${path.relative(ROOT, dst)}/ from templates/${template}`);
console.log(`next: write the script in ${path.relative(ROOT, dst)}/narration.json, then STORY=${id} pnpm narrate`);
