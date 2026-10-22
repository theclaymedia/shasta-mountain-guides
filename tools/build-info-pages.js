// Builds the info pages (about.html, gear.html, faq.html, ...) from tools/info-pages.json.
// File names match the live shastaguides.com URLs so the WordPress build can keep them for SEO.
// Usage: node tools/build-info-pages.js
const fs = require('fs');
const path = require('path');
const B = require('./build-trips.js');
const { esc, docShell, ROOT, LIVE } = B;
const INFO = require('./info-pages.json');
const DETAILS = require('./trip-details.json');

// Live-site links inside the copy → the page that replaces them here
const OLD_SLUG = { climbmtshasta: 'climb-shasta', skishasta: 'ski-shasta', mountaineeering: 'mountaineering-courses', custom: 'custom-trips', avicourses: 'avalanche-courses', backpack: 'backpacking', rockclimb: 'rock-climbing', daytrips: 'day-trips' };
const LOCAL = new Set([...Object.keys(INFO), ...DETAILS.trips.map(t => t.slug)]);
const localize = (html) => html.replace(/href="(?:https?:\/\/(?:www\.)?shastaguides\.com)?\/([a-z0-9-]+)\/?"/g, (m, slug) => {
  const s = DETAILS.redirects[slug] || slug;
  if (OLD_SLUG[s]) return `href="${OLD_SLUG[s]}.html"`;
  return LOCAL.has(s) ? `href="${s}.html"` : `href="${LIVE}/${slug}"`;
});
const prose = (blocks) => blocks.map(h => `<p>${localize(h)}</p>`).join('\n        ');
const initials = (name) => name.split(/\s+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).slice(0, 2).join('');

function hero(p, { short = true, cta = true } = {}) {
  const plain = !p.hero;
  return `<section class="page-hero ${plain ? 'page-hero--plain' : short ? 'page-hero--short' : ''}">
  ${plain ? '' : `<div class="page-hero__bg" aria-hidden="true"><img src="${p.hero.src}" alt=""></div>`}
  <div class="wrap page-hero__content">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> <span>/</span> <span aria-current="page">${esc(p.title)}</span></nav>
    <span class="elev">${esc(p.eyebrow)}</span>
    <h1>${esc(p.h1)}</h1>
    ${p.lede ? `<p class="lede">${esc(p.lede)}</p>` : ''}
    ${cta ? `<div class="hero__cta">
      <a class="btn" href="index.html#trips">See Trips &amp; Courses</a>
      <a class="btn btn--ghost" href="contact.html">Plan My Trip</a>
    </div>` : ''}
  </div>
</section>`;
}

const ctaBand = (title, text) => `
<section class="surest">
  <div class="wrap">
    <span class="label" style="color:var(--ice);">${esc(text)}</span>
    <h2 class="reveal" style="font-size:clamp(1.6rem,3.4vw,2.4rem);margin-top:.6rem;">${esc(title)}</h2>
    <div class="hero__cta" style="justify-content:center;margin-top:1.6rem;">
      <a class="btn" href="contact.html">Plan My Trip</a>
      <a class="btn btn--ghost" href="index.html#trips">See Trips &amp; Courses</a>
    </div>
  </div>
</section>`;

// Long-form page: sticky contents list + sections
function doc(p, before = '') {
  return `
<section class="programs">
  <div class="wrap doc">
    <nav class="toc" aria-label="On this page">
      <span class="label">On this page</span>
      ${p.sections.map(s => `<a href="#${s.id}">${esc(s.h)}</a>`).join('\n      ')}
    </nav>
    <div class="doc__body">
      ${p.intro.length || before ? `<div class="doc__sec prose">${prose(p.intro)}${before}</div>` : ''}
      ${p.sections.map(s => `<div class="doc__sec prose" id="${s.id}">
        <h2>${esc(s.h)}</h2>
        ${prose(s.blocks)}
      </div>`).join('\n      ')}
    </div>
  </div>
</section>`;
}

const PDF_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';
function gearLists() {
  const seen = new Map();
  for (const p of B.pages) if (p.gear) seen.set(p.gear.href, p.gear.label);
  for (const t of DETAILS.trips) if (t.gear) seen.set(t.gear.href, t.gear.label);
  return `<div class="gear-lists">${[...seen].sort((a, b) => a[1].localeCompare(b[1])).map(([href, label]) => `<a href="${href}" target="_blank" rel="noopener">${PDF_ICON}<span>${esc(label)} (PDF)</span></a>`).join('')}</div>`;
}

const pages = {
  about(p) {
    const member = (m) => `<article class="member reveal">
        <div class="avatar">${m.photo ? `<img src="${m.photo}" alt="${esc(m.name)}" loading="lazy">` : `<span aria-hidden="true">${initials(m.name)}</span>`}</div>
        <h3>${esc(m.name)}</h3>
        <span class="role">${esc(m.role)}</span>
        ${m.certs ? `<span class="certs">${esc(m.certs)}</span>` : ''}
        ${m.local ? '<span class="local">Lives in Mt. Shasta</span>' : ''}
        <div class="bio prose">${prose(m.bio)}</div>
      </article>`;
    return `${hero(p, { short: false })}

<section class="overview">
  <div class="wrap cols">
    <div class="reveal prose">
      <span class="label">Our Story</span>
      ${prose(p.intro)}
    </div>
    <div class="photo reveal" style="border-radius:var(--radius);overflow:hidden;aspect-ratio:4/3;"><img src="assets/images/team-summit-group.jpg" alt="A Shasta Mountain Guides team celebrates together on the summit of Mt. Shasta" loading="lazy"></div>
  </div>
</section>

<section class="programs" id="team">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Our Team</span>
      <h2>Meet your guides.</h2>
    </div>
    <div class="team">
      ${p.team.map(member).join('\n      ')}
    </div>
  </div>
</section>
${ctaBand(p.closing, 'Climb with the locals')}`;
  },

  aboutshasta(p) {
    return `${hero(p, { short: false })}

<section class="overview">
  <div class="wrap cols">
    <div class="reveal prose">
      <span class="label">The Mountain</span>
      ${prose(p.intro.slice(0, 2))}
    </div>
    <div class="reveal prose">
      <ul class="glance" style="margin-bottom:1.4rem;"><li><span>Summit</span><b>14,179 ft</b></li><li><span>Base</span><b>17+ miles across</b></li><li><span>Glaciers</span><b>8, California's largest</b></li><li><span>Vertical</span><b>7,000+ ft of climbing</b></li></ul>
      ${prose(p.intro.slice(2))}
    </div>
  </div>
</section>

<section class="trip-gallery" aria-label="Photos of Mt. Shasta">
  <div class="grid">
    ${p.gallery.map(g => `<figure><img src="${g.src}" alt="${esc(g.alt)}" loading="lazy"></figure>`).join('\n    ')}
  </div>
</section>
${ctaBand('Ready to climb it?', 'Routes, seasons and trips')}`;
  },

  routesandseasons(p) {
    const links = (pairs) => `<div class="route-links">${pairs.map(([t, h]) => `<a href="${h}">${esc(t)}</a>`).join('')}</div>`;
    return `${hero(p)}

<section class="programs">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Routes</span>
      <h2>The routes we guide.</h2>
    </div>
    <figure class="route-map reveal"><img src="${p.map.src}" alt="${esc(p.map.alt)}" loading="lazy"></figure>
  </div>
</section>

<section class="overview">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Seasons</span>
      <h2>When we climb where.</h2>
    </div>
    <div class="trip-cols">
      <div class="season reveal">
        <span class="when">Late April to early June</span>
        <h3>South &amp; Southwest Side</h3>
        <div class="prose">${prose([p.seasons[0]])}</div>
        ${links([['Avalanche Gulch, 3-day', 'expedition-style.html'], ['Avalanche Gulch, 2-day', 'aplinestyleclimb.html'], ['West Face', 'westfaceclimb.html'], ['Casaval Ridge', 'cacavalridgeclimb.html']])}
      </div>
      <div class="season reveal">
        <span class="when">June to early September</span>
        <h3>North &amp; East Side</h3>
        <div class="prose">${prose([p.seasons[1]])}</div>
        ${links([['North Side climbs', 'northsideclimb.html'], ['Glacier I Seminar', 'glacier1.html'], ['Clear Creek', 'clearcreekclimb.html']])}
      </div>
    </div>
    <p class="fine" style="margin-top:1.4rem;">Not sure which fits? Take the one-minute <a href="index.html#route-quiz" style="color:var(--glacier);text-decoration:underline;">route quiz</a>.</p>
  </div>
</section>
${ctaBand('Pick your route. We will handle the rest.', 'Plan your climb')}`;
  },

  tripdetails: (p) => `${hero(p)}${doc(p)}${ctaBand('Questions before your trip?', 'We are here to help')}`,
  gear: (p) => `${hero(p)}${doc(p, `<h2 style="margin-top:1.8rem;font-size:clamp(1.5rem,2.6vw,1.9rem);">Gear lists by trip</h2>${gearLists()}`)}${ctaBand('Not sure about a piece of gear? Ask us.', 'Gear questions')}`,
  policies: (p) => `${hero(p, { cta: false })}${doc(p)}`,

  training(p) {
    const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>';
    return `${hero(p)}

<section class="overview">
  <div class="wrap cols">
    <div class="reveal prose">
      <span class="label">Why Train Before Your Climb?</span>
      ${prose(p.intro)}
    </div>
    <figure class="quote reveal">
      <p>&ldquo;${esc(p.quote.text)}&rdquo;</p>
      <figcaption>${esc(p.quote.by)}</figcaption>
    </figure>
  </div>
</section>

<section class="resources">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Resources</span>
      <h2>Training plans and coaches we recommend.</h2>
    </div>
    <div class="res-grid">
      ${p.links.map(l => `<a class="res reveal" href="${l.href}" target="_blank" rel="noopener">
        <span class="ic">${ICON}</span>
        <span class="fmt">${esc(l.note)}</span>
        <h3>${esc(l.label)}</h3>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>
${ctaBand('Train hard. Climb well.', 'Ready when you are')}`;
  },

  faq(p) {
    return `${hero(p)}

<section class="programs">
  <div class="wrap">
    <div class="qa-list">
      ${p.qa.map((q, i) => `<details class="qa reveal" id="${q.id}"${i === 0 ? ' open' : ''}>
        <summary>${esc(q.q)}</summary>
        <div class="prose">${prose(q.a)}</div>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>
${ctaBand('Still have a question?', 'Ask a guide')}`;
  },

  privacypolicy: (p) => legal(p),
  'terms-of-service': (p) => legal(p),

  contact(p) {
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    let section = index.slice(index.indexOf('<section class="contact"'), index.indexOf('</section>', index.indexOf('<section class="contact"')) + 10);
    const phone = `<a class="cl" href="tel:+15309263117">
            <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg></span>
            <div><b>${p.phone}</b><span>Call the shop</span></div>
          </a>
          `;
    section = section.replace('<a class="cl" href="mailto:', phone + '<a class="cl" href="mailto:');
    return `${hero(p, { cta: false })}\n\n${section}`;
  },
};

function legal(p) {
  const body = p.blocks.map((b, i) => {
    if (b.t === 'li') return `${p.blocks[i - 1]?.t === 'li' ? '' : '<ul>'}<li>${b.html}</li>${p.blocks[i + 1]?.t === 'li' ? '' : '</ul>'}`;
    return `<${b.t}${b.id ? ` id="${b.id}"` : ''}>${b.html}</${b.t}>`;
  }).join('\n    ');
  return `${hero(p, { cta: false })}

<section class="overview">
  <div class="wrap">
    <div class="legal">
    <p class="updated">${esc(p.updated)}</p>
    ${body}
    </div>
  </div>
</section>`;
}

const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
let n = 0;
for (const [slug, p] of Object.entries(INFO)) {
  const head = slug === 'faq' ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: p.qa.map(q => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a.map(strip).join(' ') } })),
  })}</script>\n` : '';
  const description = p.lede || `${p.h1} | Shasta Mountain Guides, the original guide service on Mt. Shasta.`;
  fs.writeFileSync(path.join(ROOT, `${slug}.html`), docShell({ title: p.h1, description, current: slug, body: pages[slug](p), contact: 'contact.html', head }));
  n++;
}
console.log(`built ${n} info pages`);
