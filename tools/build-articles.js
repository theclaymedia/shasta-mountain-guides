// Builds articles.html and articles/<slug>.html from tools/articles.json.
// Same paths as shastaguides.com (/articles, /articles/<slug>) so the WordPress build keeps them for SEO.
// Article pages sit one folder down; <base href="../"> keeps every shared link and asset path working.
// Usage: node tools/build-articles.js
const fs = require('fs');
const path = require('path');
const B = require('./build-trips.js');
const { esc, docShell, ROOT, LIVE } = B;
const ARTICLES = require('./articles.json');
const INFO = require('./info-pages.json');
const DETAILS = require('./trip-details.json');

// Live-site links inside the copy → the local page
const OLD_SLUG = { climbmtshasta: 'climb-shasta', skishasta: 'ski-shasta', mountaineeering: 'mountaineering-courses', custom: 'custom-trips', avicourses: 'avalanche-courses', backpack: 'backpacking', rockclimb: 'rock-climbing', daytrips: 'day-trips' };
const LOCAL = new Set([...Object.keys(INFO), ...DETAILS.trips.map(t => t.slug)]);
const ART = new Set(ARTICLES.map(a => a.slug));
const localize = (html) => html.replace(/href="(?:https?:\/\/(?:www\.)?shastaguides\.com)?\/([a-z0-9-]+(?:\/[a-z0-9-]+)?)\/?"/g, (m, p) => {
  const [first, second] = p.split('/');
  if (first === 'articles' && (!second || ART.has(second))) return `href="${second ? `articles/${second}` : 'articles'}.html"`;
  if (second) return `href="${LIVE}/${p}"`;
  const s = DETAILS.redirects[first] || first;
  if (OLD_SLUG[s]) return `href="${OLD_SLUG[s]}.html"`;
  return LOCAL.has(s) ? `href="${s}.html"` : `href="${LIVE}/${p}"`;
}).replace(/<a href="http/g, '<a target="_blank" rel="noopener" href="http');

const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const meta = (a) => [fmtDate(a.date), a.author && `By ${a.author}`].filter(Boolean).join(' · ');

const card = (a, feature) => `<a class="article${feature ? ' article--feature' : ''} reveal" href="articles/${a.slug}.html">
        <div class="img"><img src="${a.hero.src}" alt="${esc(a.hero.alt)}" loading="lazy"></div>
        <div class="body">
          <span class="tag">${esc(a.categories[0] || 'Mt. Shasta')} &middot; ${esc(fmtDate(a.date))}</span>
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.excerpt.length > 190 ? `${a.excerpt.slice(0, 187).replace(/\s+\S*$/, '')}...` : a.excerpt)}</p>
          <span class="go">Read &rsaquo;</span>
        </div>
      </a>`;

const ctaBand = `
<section class="surest">
  <div class="wrap">
    <span class="label" style="color:var(--ice);">Plan your climb</span>
    <h2 class="reveal" style="font-size:clamp(1.6rem,3.4vw,2.4rem);margin-top:.6rem;">Ready to put it into practice?</h2>
    <div class="hero__cta" style="justify-content:center;margin-top:1.6rem;">
      <a class="btn" href="contact.html">Plan My Trip</a>
      <a class="btn btn--ghost" href="index.html#trips">See Trips &amp; Courses</a>
    </div>
  </div>
</section>`;

function hero(title, crumbs, eyebrow, h1, lede, img) {
  return `<section class="page-hero page-hero--short">
  <div class="page-hero__bg" aria-hidden="true"><img src="${img}" alt=""></div>
  <div class="wrap page-hero__content">
    <nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>
    <span class="elev">${esc(eyebrow)}</span>
    <h1>${esc(h1)}</h1>
    ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
  </div>
</section>`;
}

function articlePage(a) {
  const body = a.blocks.map(b => {
    if (b.gallery) return `<div class="post-gallery">${b.gallery.map(g => `<figure><img src="${g.src}" alt="${esc(g.alt)}" loading="lazy"></figure>`).join('')}</div>`;
    if (b.button) return `<p><a class="btn btn--outline" href="${localize(`href="${b.button.href}"`).slice(6, -1)}">${esc(b.button.label)}</a></p>`;
    if (b.hr) return '<hr>';
    return localize(b.html);
  }).join('\n      ');
  const more = ARTICLES.filter(x => x.slug !== a.slug).slice(0, 3);
  return `${hero(a.title, `<a href="index.html">Home</a> <span>/</span> <a href="articles.html">Articles</a> <span>/</span> <span aria-current="page">${esc(a.title)}</span>`,
    meta(a), a.title, '', a.hero.src)}

<article class="overview">
  <div class="wrap">
    <div class="post prose">
      ${body}
    </div>
  </div>
</article>

<section class="programs">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="label">Keep Reading</span>
      <h2>More from our guides.</h2>
    </div>
    <div class="article-grid">
      ${more.map(x => card(x)).join('\n      ')}
    </div>
  </div>
</section>
${ctaBand}`;
}

function indexPage() {
  return `${hero('Articles', '<a href="index.html">Home</a> <span>/</span> <span aria-current="page">Articles</span>', 'Learn before you climb', 'Articles',
    'Route advice, training, gear and conditions, written by the guides who climb Mt. Shasta every week.', ARTICLES[0].hero.src)}

<section class="programs">
  <div class="wrap">
    <div class="article-grid">
      ${ARTICLES.map(a => card(a)).join('\n      ')}
    </div>
  </div>
</section>
${ctaBand}`;
}

fs.mkdirSync(path.join(ROOT, 'articles'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'articles.html'), docShell({ title: 'Articles', description: 'Mt. Shasta route advice, training, gear and conditions from Shasta Mountain Guides.', current: 'articles', body: indexPage(), contact: 'contact.html' }));
for (const a of ARTICLES) {
  const page = docShell({ title: a.title, description: a.excerpt.slice(0, 155), current: 'articles', body: articlePage(a), contact: 'contact.html', head: '<base href="../">\n' });
  fs.writeFileSync(path.join(ROOT, 'articles', `${a.slug}.html`), page);
}
console.log(`built articles.html + ${ARTICLES.length} articles`);
