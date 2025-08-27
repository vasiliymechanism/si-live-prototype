// Loads JSON-with-comments (.jsonc): strips // and /* */ then JSON.parse
export async function loadJSONC(path) {
  const txt = await fetch(path).then(r => {
    if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
    return r.text();
  });
  const stripped = txt
    .replace(/\/\*[\s\S]*?\*\//g, '')      // /* ... */
    .replace(/(^|\s)\/\/.*$/gm, '');        // // ...
  return JSON.parse(stripped);
}
