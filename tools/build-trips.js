// Builds the eight program pages from tools/trips-data.js into the repo root.
// Usage: node tools/build-trips.js
const fs = require('fs');
const path = require('path');
const data = require('./trips-data.js');
const pages = data.filter(p => p.slug);
const BOOK = data.BOOK, LIVE = data.LIVE, FB = data.FLYBOOK;
// Flybook's native "Book Now" button: its script reads these classes from the clicked element.
const fbClasses = (entity) => `flybook-book-now-button fb-widget-type-frontend fb-default-category-id-0 fb-account-id-${FB.account} fb-entity-config-id-${entity} fb-domain-${FB.domain} fb-protocol-https`;
const fbButton = (label, entity, cls = 'btn') => `<button type="button" class="${cls} ${fbClasses(entity)}">${label}</button>`;
const FLYBOOK_ASSETS = `<link rel="stylesheet" href="https://${FB.domain}/content/bootstrapper/flybookbootstrap.css">\n<script src="https://${FB.domain}/custom/bootstrapper/flybookbootstrap.js"></script>`;
const ROOT = path.join(__dirname, '..');
// Trip detail pages (tools/trip-details.json): "Full details" links go to the local page when one exists.
const DETAILS = require('./trip-details.json');
const DETAIL_SLUGS = new Set(DETAILS.trips.map(t => t.slug));
const detailSlug = (learn) => { const s = (learn || '').split('/').pop(); const c = DETAILS.redirects[s] || s; return DETAIL_SLUGS.has(c) ? c : null; };
const detailHref = (learn) => { const c = detailSlug(learn); return c ? `${c}.html` : learn; };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NAV_LINKS = pages.map(p => `<li><a href="${p.slug}.html">${esc(p.title)}</a></li>`).join('\n          ');

function nav(current, contact = '#inquire') {
  return `<header class="nav">
  <div class="wrap nav__inner">
    <a href="index.html" aria-label="Shasta Mountain Guides home">
      <img class="nav__logo" src="assets/logos/SMG-logo-white.png" alt="Shasta Mountain Guides">
    </a>
    <ul class="nav__links">
      <li class="has-menu"><a href="index.html#trips" aria-haspopup="true">Trips &amp; Courses</a>
        <ul class="menu">
          ${NAV_LINKS}
        </ul>
      </li>
      <li><a href="index.html#guides">Our Guides</a></li>
      <li><a href="index.html#learn">Learn</a></li>
      <li><a href="index.html#resources">Free Resources</a></li>
      <li><a href="${contact}">Contact</a></li>
      <li>${fbButton('Book Now', FB.catalog)}</li>
    </ul>
  </div>
</header>`;
}

// Footer links: the info pages (tools/info-pages.json) live on the same URLs as shastaguides.com.
const FOOTER_LINKS = [
  ['About Us', 'about.html'], ['About Mt. Shasta', 'aboutshasta.html'], ['Routes & Seasons', 'routesandseasons.html'],
  ['Trip Details', 'tripdetails.html'], ['Gear', 'gear.html'], ['Training', 'training.html'], ['FAQ', 'faq.html'],
  ['Articles', 'articles.html'], ['Policies', 'policies.html'], ['Essentials of Eligibility', 'assets/downloads/smg-essential-eligibility-criteria.pdf'],
  ['Privacy Policy', 'privacypolicy.html'], ['Terms of Use', 'terms-of-service.html'], ['Contact', 'contact.html'],
];

function footer() {
  return `<footer>
  <div class="wrap">
    <div class="foot">
      <img class="logo" src="assets/logos/SMG-logo-white.png" alt="Shasta Mountain Guides">
      <ul>
        ${FOOTER_LINKS.map(([t, h]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('\n        ')}
      </ul>
    </div>
    <p class="permit">This business operates under special use permit with the Shasta-Trinity National Forest. This institution is an equal opportunity provider.</p>
    <div class="foot__legal">
      <span>&copy; 2026 Shasta Mountain Guides</span>
      <span class="mock">Concept mockup, not a live site</span>
      <span class="clay">Site by <a href="https://theclaymedia.com">The Clay Media</a></span>
    </div>
  </div>
</footer>`;
}

function programCard(pr, pageOption) {
  const meta = [pr.length && `<span><b>Length</b>${esc(pr.length)}</span>`, pr.route && `<span><b>Route</b>${esc(pr.route)}</span>`, pr.cost && `<span><b>Cost</b>${esc(pr.cost)}</span>`].filter(Boolean).join('');
  return `      <article class="program reveal" id="${slugify(pr.name)}">
        <div class="program__img"><img src="${pr.img}" alt="${esc(pr.alt || '')}" loading="lazy">${pr.tag ? `<span class="program__tag">${esc(pr.tag)}</span>` : ''}</div>
        <div class="program__body">
          <h3>${esc(pr.name)}</h3>
          <div class="program__meta">${meta}</div>
          <p>${esc(pr.blurb)}</p>
          <dl class="program__reqs">
            <div><dt>Experience</dt><dd>${esc(pr.experience)}</dd></div>
            <div><dt>Physical demand</dt><dd>${esc(pr.demand)}</dd></div>
          </dl>
          <div class="program__cta">
            ${pr.fb ? `${fbButton('Book Now', pr.fb, 'btn btn--sm')}
            <a class="btn btn--outline btn--sm" href="#inquire" data-trip="${esc(pr.name)}">Ask about this trip</a>` : `<a class="btn btn--sm" href="#inquire" data-trip="${esc(pr.name)}">Request this trip</a>`}
            ${pr.learn ? `<a class="more" href="${detailHref(pr.learn)}">Full details &rsaquo;</a>` : ''}
          </div>
        </div>
      </article>`;
}

function slugify(s) { return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function pricingTable(t) {
  const head = t.head ? `<thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : '';
  const rows = t.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `      <div class="pricing reveal">
        <h3>${esc(t.title)}</h3>
        <table>${head}<tbody>${rows}</tbody></table>
        ${t.note ? `<p class="fine">${esc(t.note)}</p>` : ''}
      </div>`;
}

const TRIP_OPTIONS = ['Climb Shasta', 'Ski Shasta', 'Mountaineering Course', 'Custom / Private Trip', 'Avalanche Course', 'Backpacking', 'Rock Climbing', 'Day Trip', 'Not sure yet'];

function inquire(p) {
  const opts = TRIP_OPTIONS.map(o => `<option${o === p.formOption ? ' selected' : ''}>${esc(o)}</option>`).join('');
  return `<section class="contact" id="inquire">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Plan Your Trip</span>
      <h2>Ask us about ${esc(p.title.toLowerCase())}.</h2>
      <p>Send a few details and a guide will reply within one business day with a recommendation, dates and next steps. No phone tag.</p>
    </div>
    <div class="cols">
      <form class="contact-form reveal" name="plan-my-climb" method="POST" data-netlify="true" netlify-honeypot="company">
        <input type="hidden" name="form-name" value="plan-my-climb">
        <input type="hidden" name="page" value="${esc(p.title)}">
        <input type="hidden" name="specific-trip" id="specific-trip" value="">
        <p class="hp"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></p>
        <h3>Plan my trip</h3>
        <p class="asking" id="asking" hidden>Asking about: <b id="asking-name"></b></p>
        <div class="row2">
          <div class="field"><label for="c-name">Name</label><input id="c-name" name="name" required autocomplete="name" placeholder="Your name"></div>
          <div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" required autocomplete="email" placeholder="you@email.com"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="c-trip">I'm interested in</label><select id="c-trip" name="trip" required>${opts}</select></div>
          <div class="field"><label for="c-dates">Ideal dates</label><input id="c-dates" name="dates" placeholder="e.g. late June 2027"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="c-exp">Experience level</label>
            <select id="c-exp" name="experience"><option>First big mountain</option><option>Some snow &amp; crampon experience</option><option>Experienced mountaineer / skier</option></select></div>
          <div class="field"><label for="c-group">Group size</label><input id="c-group" name="group" type="number" min="1" max="30" placeholder="1"></div>
        </div>
        <div class="field"><label for="c-msg">Anything else?</label><textarea id="c-msg" name="message" placeholder="Goals, questions, fitness, gear you already own..."></textarea></div>
        <button class="btn" type="submit">Send my request</button>
        <span class="fine">We reply by email within one business day. Prefer a call? Leave your number in the message and we'll ring you.</span>
        <div class="thanks" hidden><b>Thanks, we've got it.</b>A guide will reply within one business day. Keep an eye on your inbox.</div>
      </form>
      <div class="reveal">
        <span class="label">Before You Go</span>
        <h2 style="font-size:clamp(1.5rem,3vw,2.1rem);">Show up ready.</h2>
        <div class="lines">
          <a class="cl" href="${p.gear.href}" target="_blank" rel="noopener">
            <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
            <div><b>Gear list (PDF)</b><span>${esc(p.gear.label)}</span></div>
          </a>
          ${p.gear.alt ? `<a class="cl" href="${p.gear.alt.href}" target="_blank" rel="noopener">
            <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
            <div><b>${esc(p.gear.alt.label)} (PDF)</b><span>For single-day programs</span></div>
          </a>` : ''}
          <a class="cl" href="assets/downloads/smg-training-for-mount-shasta.pdf" target="_blank" rel="noopener">
            <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 20V10M12 20V4M18 20v-7"/><path d="M3 20h18"/></svg></span>
            <div><b>Training for Mt. Shasta (PDF)</b><span>Our 24-page fitness guide</span></div>
          </a>
          <a class="cl" href="${p.article.href}.html">
            <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h8"/></svg></span>
            <div><b>${esc(p.article.title)}</b><span>Read the article</span></div>
          </a>
          <a class="cl" href="tripdetails.html">
            <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></span>
            <div><b>Trip details</b><span>Meeting times, lodging, food, weather and tipping</span></div>
          </a>
        </div>
        <p class="phone-note">Already booked and need us right now? Call <a href="tel:+15309263117">530.926.3117</a>.</p>
      </div>
    </div>
  </div>
</section>`;
}

function page(p) {
  const glance = p.glance.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('');
  const programs = p.programs ? `
<section class="programs" id="programs">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Choose Your Trip</span>
      <h2>${p.programs.length} ways to do it</h2>
      <p>Every trip below is led by our certified local guides. Not sure which fits? Scroll down and ask, or take the one-minute <a href="index.html#resources">route quiz</a>.</p>
    </div>
    <div class="program-list">
${p.programs.map(pr => programCard(pr, p.formOption)).join('\n')}
    </div>
  </div>
</section>` : '';

  const pricing = p.pricing ? `
<section class="programs" id="pricing">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Private Pricing</span>
      <h2>Simple, per-person pricing</h2>
      <p>Pick a length, bring your crew. Everything else works like our scheduled trips.</p>
    </div>
    <div class="pricing-grid">
${p.pricing.map(pricingTable).join('\n')}
    </div>
    <div class="program__cta reveal" style="margin-top:1.6rem;">
      <a class="btn" href="#inquire">Request a custom trip</a>
    </div>
  </div>
</section>` : '';

  const includes = p.includes ? `
<section class="includes">
  <div class="wrap cols">
    <div class="reveal">
      <span class="label" style="color:var(--ice);">What's Included</span>
      <h2>We carry the mountain stuff. You carry you.</h2>
      <ul class="checks">${p.includes.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      ${p.notIncluded ? `<p class="fine" style="color:var(--ice);margin-top:1rem;">${esc(p.notIncluded)}</p>` : ''}
    </div>
    ${p.dates ? `<div class="dates reveal">
      <h3>${esc(p.dates.title)}</h3>
      <ul>${p.dates.rows.map(r => `<li>${esc(r[0])}</li>`).join('')}</ul>
      ${p.dates.note ? `<p class="fine" style="color:var(--ice);">${esc(p.dates.note)}</p>` : ''}
      ${fbButton('Check availability', p.programs[0].fb)}
    </div>` : `<div class="dates reveal">
      <h3>Dates and availability</h3>
      <p style="color:var(--ice);">Scheduled departures run through the season and private dates are available on request. Tell us your window and we will match you to a trip.</p>
      <a class="btn" href="#inquire">Ask about dates</a>
    </div>`}
  </div>
</section>` : '';

  const extra = p.extra ? `
<section class="surest">
  <div class="wrap">
    <span class="label" style="color:var(--ice);">${esc(p.extra.title)}</span>
    <h2 class="reveal" style="font-size:clamp(1.4rem,2.8vw,2rem);max-width:40ch;margin-top:.6rem;">${esc(p.extra.text)}</h2>
    <a class="btn reveal" href="#inquire">Get in touch</a>
  </div>
</section>` : '';

  const strip = `
<div class="strip">
  <div class="grid">
    ${p.strip.map(s => `<figure><img src="${s}" alt="" loading="lazy"></figure>`).join('\n    ')}
  </div>
</div>`;

  return docShell({ title: p.h1, description: `${p.lede} Guided by Shasta Mountain Guides, the original guide service on Mt. Shasta.`, current: p.slug, body: `
<section class="page-hero">
  <div class="page-hero__bg" aria-hidden="true"><img src="${p.hero.src}" alt=""></div>
  <div class="wrap page-hero__content">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> <span>/</span> <a href="index.html#trips">Trips &amp; Courses</a> <span>/</span> <span aria-current="page">${esc(p.title)}</span></nav>
    <span class="elev">${esc(p.eyebrow)}</span>
    <h1>${esc(p.h1)}</h1>
    <p class="lede">${esc(p.lede)}</p>
    <div class="hero__cta">
      ${fbButton('Book Now', FB.catalog)}
      <a class="btn btn--ghost" href="#inquire">Plan My Trip</a>
    </div>
    ${p.heroNote ? `<p class="hero-note">${esc(p.heroNote)}</p>` : ''}
  </div>
</section>

<section class="overview">
  <div class="wrap cols">
    <div class="reveal">
      <span class="label">Overview</span>
      ${p.intro.map(t => `<p>${esc(t)}</p>`).join('\n      ')}
      ${p.status ? `<p class="status"><b>Current status:</b> ${esc(p.status)}</p>` : ''}
    </div>
    <ul class="glance reveal">${glance}</ul>
  </div>
</section>
${programs}${pricing}${includes}${extra}${strip}

${inquire(p)}` });
}

// Full HTML document: head, sitewide header and footer, shared scripts, Flybook.
function docShell({ title, description, current, body, contact, head = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${head}<title>${esc(title)} | Shasta Mountain Guides</title>
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/site.css">
</head>
<body id="top">

${nav(current, contact)}

${body}

${footer()}

<script src="assets/js/site.js"></script>
${FLYBOOK_ASSETS}
<script>
  /* "Ask about this trip" / "Request this trip" buttons preload the form with the specific program. */
  document.querySelectorAll('[data-trip]').forEach(function(a){
    a.addEventListener('click', function(){
      var name = a.getAttribute('data-trip');
      document.getElementById('specific-trip').value = name;
      document.getElementById('asking-name').textContent = name;
      document.getElementById('asking').hidden = false;
      var msg = document.getElementById('c-msg');
      if(msg && !msg.value){ msg.value = 'I\\'m interested in the ' + name + '. '; }
    });
  });
</script>
</body>
</html>
`;
}

module.exports = { pages, esc, nav, footer, FOOTER_LINKS, inquire, fbButton, FB, LIVE, ROOT, docShell, detailHref, detailSlug };

if (require.main === module) {
  let n = 0;
  for (const p of pages) {
    fs.writeFileSync(path.join(ROOT, p.slug + '.html'), page(p));
    n++;
  }
  console.log('built', n, 'pages:', pages.map(p => p.slug + '.html').join(', '));
}
