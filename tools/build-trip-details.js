// Builds the individual trip pages (expedition-style.html, glacier1.html, ...) from tools/trip-details.json.
// File names match the live shastaguides.com URLs so the WordPress build can keep them for SEO.
// Usage: node tools/build-trip-details.js
const fs = require('fs');
const path = require('path');
const B = require('./build-trips.js');
const { esc, inquire, fbButton, docShell, ROOT } = B;
const DETAILS = require('./trip-details.json');
const programs = Object.fromEntries(B.pages.map(p => [p.slug, p]));

const ul = (items, cls = '') => `<ul${cls ? ` class="${cls}"` : ''}>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bMt\b/g, 'Mt').replace(/\b(Ii|Iii)\b/g, x => x.toUpperCase());

function tripPage(t) {
  const prog = programs[t.program];
  const book = t.fb ? fbButton('Book Now', t.fb) : `<a class="btn" href="#inquire" data-trip="${esc(t.name)}">Request this trip</a>`;
  const glance = [['Length', t.length], ['Route', t.route], ['Cost', t.card_cost], ['Program', t.programTitle]].filter(([, v]) => v);
  const gear = t.gear || prog.gear;
  const overview = t.overview.map(b => (b.ul ? ul(b.ul, 'ticks') : `<p>${esc(b.p)}</p>`)).join('\n      ');
  const lede = t.route_line || [t.length, t.route].filter(Boolean).join(' · ');

  const gallery = t.gallery.length ? `
<section class="trip-gallery" aria-label="Photos">
  <div class="grid">
    ${t.gallery.map(g => `<figure><img src="${g.src}" alt="${esc(g.alt)}" loading="lazy"></figure>`).join('\n    ')}
  </div>
</section>` : '';

  const reqDates = `
<section class="programs">
  <div class="wrap trip-cols">
    <div class="trip-card reveal">
      <span class="label">Experience &amp; Fitness</span>
      <h3>Is this trip right for you?</h3>
      ${ul(t.requirements, 'ticks')}
      <p class="fine"><a href="assets/downloads/smg-training-for-mount-shasta.pdf" target="_blank" rel="noopener">Training for Mt. Shasta (PDF)</a> &middot; our 24-page fitness guide.</p>
    </div>
    <div class="trip-card reveal">
      <span class="label">${esc(t.dates_title)}</span>
      <h3>Dates</h3>
      <ul class="date-list">${t.dates.map(d => `<li${/^(\d{4}|[A-Za-z ]+\d{4}|Clear Creek)$/.test(d.trim()) ? ' class="sub"' : ''}>${esc(d)}</li>`).join('')}</ul>
      <div class="program__cta">${t.fb ? fbButton('Check availability', t.fb, 'btn btn--sm') : `<a class="btn btn--sm" href="#inquire" data-trip="${esc(t.name)}">Ask about dates</a>`}</div>
    </div>
  </div>
</section>`;

  const cost = `
<section class="includes">
  <div class="wrap cols">
    <div class="reveal">
      <span class="label" style="color:var(--ice);">Cost &amp; What's Included</span>
      <h2>${esc(t.cost[0] || t.card_cost)}</h2>
      ${t.cost.slice(1).map(c => `<p class="cost-line">${esc(c)}</p>`).join('')}
      ${t.includes.length ? ul(t.includes, 'checks') : ''}
      ${t.cost_notes.map(n => `<p class="fine" style="color:var(--ice);margin-top:1rem;">${esc(n)}</p>`).join('')}
      <div class="hero__cta" style="margin-top:1.6rem;">${book}${gear ? `<a class="btn btn--ghost" href="${gear.href}" target="_blank" rel="noopener">Gear list (PDF)</a>` : ''}</div>
    </div>
    <div class="dates reveal">
      <h3>${esc(t.guides_title)}</h3>
      ${t.guides.slice(0, 2).map(g => `<p style="color:var(--ice);">${esc(g)}</p>`).join('')}
      <a class="btn btn--ghost" href="index.html#guides">Meet your guides</a>
    </div>
  </div>
</section>`;

  const itinerary = t.itinerary.length ? `
<section class="programs itinerary">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Day by Day</span>
      <h2>${esc(titleCase(t.itinerary_title || 'Itinerary'))}</h2>
    </div>
    <div class="itin">
      ${t.itinerary.map(d => `<div class="itin__day reveal">
        <h3>${esc(d.day || 'The day')}</h3>
        <ol>${d.items.map(i => `<li>${i.time ? `<span class="t">${esc(i.time)}</span>` : ''}<span>${esc(i.text)}</span></li>`).join('')}</ol>
        ${d.note ? `<p class="fine">${esc(d.note)}</p>` : ''}
      </div>`).join('\n      ')}
    </div>
    ${t.notes.map(n => `<p class="fine" style="margin-top:1.4rem;">${esc(n)}</p>`).join('')}
  </div>
</section>` : (t.notes.length ? `<section class="programs" style="padding-block:2rem;"><div class="wrap">${t.notes.map(n => `<p class="fine">${esc(n)}</p>`).join('')}</div></section>` : '');

  const body = `<section class="page-hero">
  <div class="page-hero__bg" aria-hidden="true"><img src="${t.hero.src}" alt=""></div>
  <div class="wrap page-hero__content">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> <span>/</span> <a href="index.html#trips">Trips &amp; Courses</a> <span>/</span> <a href="${prog.slug}.html">${esc(prog.title)}</a> <span>/</span> <span aria-current="page">${esc(t.name)}</span></nav>
    <span class="elev">${esc(t.eyebrow)}</span>
    <h1>${esc(t.name)}</h1>
    ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
    <div class="hero__cta">
      ${book}
      <a class="btn btn--ghost" href="#inquire">Plan My Trip</a>
    </div>
  </div>
</section>

<section class="overview">
  <div class="wrap cols">
    <div class="reveal">
      <span class="label">Overview</span>
      ${overview}
    </div>
    <div class="reveal">
      <ul class="glance">${glance.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>
      <div class="program__cta" style="margin-top:1rem;">${t.fb ? fbButton('Book Now', t.fb, 'btn btn--sm') : `<a class="btn btn--sm" href="#inquire" data-trip="${esc(t.name)}">Request this trip</a>`}${gear ? `<a class="more" href="${gear.href}" target="_blank" rel="noopener">Gear list (PDF) &rsaquo;</a>` : ''}</div>
    </div>
  </div>
</section>
${gallery}${reqDates}${cost}${itinerary}

${inquire({ title: t.name, formOption: t.formOption, gear, article: prog.article })}`;

  return docShell({ title: t.name, description: `${t.name} with Shasta Mountain Guides: ${lede}. Dates, cost, what's included and itinerary.`.replace(/\.\./g, '.'), current: prog.slug, body });
}

let n = 0;
for (const t of DETAILS.trips) {
  fs.writeFileSync(path.join(ROOT, `${t.slug}.html`), tripPage(t));
  n++;
}
console.log(`built ${n} trip pages`);
