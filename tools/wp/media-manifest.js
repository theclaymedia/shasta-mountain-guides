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

// Trip pages: hero, photo grid and gear list, plus every gear PDF the redirects point the live /s/ links at.
const details = require('../trip-details.json');
for (const t of details.trips) {
  for (const g of [t.hero, ...t.gallery]) { seen.add(g.src); if (!alts[g.src] && g.alt) alts[g.src] = g.alt; }
  if (t.gear) seen.add(t.gear.href);
}
for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'downloads'))) if (/\.pdf$/.test(f)) seen.add(`assets/downloads/${f}`);
// Info pages: heroes, About Mt. Shasta gallery, route map, guide photos
const info = require('../info-pages.json');
for (const p of Object.values(info)) {
  for (const g of [p.hero, p.map, ...(p.gallery || [])].filter(Boolean)) { seen.add(g.src); if (!alts[g.src] && g.alt) alts[g.src] = g.alt; }
  for (const m of p.team || []) if (m.photo) { seen.add(m.photo); if (!alts[m.photo]) alts[m.photo] = m.name; }
}
// Articles: hero and gallery photos
for (const a of require('../articles.json')) {
  for (const g of [a.hero, ...a.blocks.flatMap(b => b.gallery || [])]) { seen.add(g.src); if (!alts[g.src] && g.alt) alts[g.src] = g.alt; }
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
