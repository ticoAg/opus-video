// JSON for hand-edited files: objects and arrays stay on one line while short
// and flat (a cue, a beat list, a layer), and break onto indented lines
// otherwise, the way the story packs are written.
export function formatJson(v, ind = 0) {
  const pad = ' '.repeat(ind);
  const flat = JSON.stringify(v);
  if (Array.isArray(v)) {
    if (flat.length < 110 && !v.some((x) => x && typeof x === 'object' && !Array.isArray(x))) return inline(v);
    return `[\n${v.map((x) => `${pad}  ${formatJson(x, ind + 2)}`).join(',\n')}\n${pad}]`;
  }
  if (v && typeof v === 'object') {
    const simple = Object.values(v).every((x) => !x || typeof x !== 'object' || (Array.isArray(x) && x.every((y) => !y || typeof y !== 'object' || (Array.isArray(y) && y.every((z) => !z || typeof z !== 'object')))));
    if (simple && flat.length < 150) return inline(v);
    return `{\n${Object.entries(v).map(([k, x]) => `${pad}  ${JSON.stringify(k)}: ${formatJson(x, ind + 2)}`).join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(v);
}

// One line, with a space after commas and colons.
function inline(v) {
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')}}`;
  return JSON.stringify(v);
}
