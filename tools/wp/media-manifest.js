// Builds the media manifest from the mockup HTML: every asset the pages reference,
// with the first alt text found for it. Usage: node tools/wp/media-manifest.js <out.json>
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGES = ['index.html', 'climb-shasta.html', 'ski-shasta.html', 'mountaineering-courses.html', 'custom-trips.html',
  'avalanche-courses.html', 'backpacking.html', 'rock-climbing.html', 'day-trips.html'];

const alts = {};
const seen = new Set();
for (const page of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) seen.add(m[1]);
  for (const m of html.matchAll(/<img[^>]*src="(assets\/[^"]+)"[^>]*alt="([^"]*)"/g)) {
    if (m[2] && !alts[m[1]]) alts[m[1]] = m[2].replace(/&amp;/g, '&').replace(/&#39;/g, "'");
  }
}

// Data-file images (trip cards, heroes, strips) carry their own alt text.
const trips = require('../trips-data.js');
for (const t of trips.filter(x => x.slug)) {
  seen.add(t.hero.src); if (!alts[t.hero.src]) alts[t.hero.src] = t.hero.alt;
  for (const p of t.programs || []) { seen.add(p.img); if (!alts[p.img] && p.alt) alts[p.img] = p.alt; }
  for (const s of t.strip || []) seen.add(s);
}

const manifest = [...seen]
  .filter(p => !/\.(css|js)$/.test(p))
  .sort()
  .map(p => ({
    path: p,
    alt: /\.pdf$/i.test(p) ? '' : (alts[p] || ''),
    title: path.basename(p).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
  }));

fs.writeFileSync(process.argv[2], JSON.stringify(manifest, null, 2));
console.log(`manifest: ${manifest.length} files, ${manifest.filter(m => m.alt).length} with alt text`);
