// Builds the Elementor site bundle (kit, menus, header/footer, homepage, 8 program pages)
// from the static mockup. The mockup stays the source of truth: copy is read from index.html
// and tools/trips-data.js, images are resolved through media-map.json (see import-media.php).
//
// Usage: NODE_PATH=<dir with node-html-parser> node tools/wp/build-site.js <out-bundle.json>
const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');
const E = require('./el.js');
const { px, box, gap, gap2, C, T, res, type, merge, container, section, heading, text, html, button, image, widget } = E;

const ROOT = path.join(__dirname, '..', '..');
const MEDIA = require('./media-map.json');
const TRIPS = require('../trips-data.js').filter(t => t.slug);
const HOME = '{{HOME}}';
const BOOK = require('../trips-data.js').BOOK; // live booking page until Flybook links arrive
const FORM_EMAIL = 'team@theclaymedia.com';   // staging: leads come to us; switch to info@shastaguides.com at launch

const media = (p) => {
  const m = MEDIA[p];
  if (!m) throw new Error(`Not in media-map: ${p}`);
  return m;
};
const pageUrl = (slug) => `${HOME}/${slug}/`;
// Mockup links → WordPress links
const link = (href) => {
  if (!href) return '';
  const trip = TRIPS.find(t => href === `${t.slug}.html`);
  if (trip) return pageUrl(trip.slug);
  if (href.startsWith('assets/')) return media(href).url;
  if (href.startsWith('#')) return href;
  return href;
};
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

// ---------------- Design tokens (from assets/css/site.css) ----------------
const COL = {
  night: '#0B1C2B', deep: '#123049', glacier: '#1F5D8C', glacierLt: '#3E86BC', ice: '#BFDDF2', frost: '#E9F3FA',
  paper: '#F7FAFC', ink: '#12222F', gray: '#54697A', line: '#DCE7EF', lineDk: '#1E3D57', sun: '#E8A33D', sunHover: '#F4B95C',
  sunInk: '#2A1C05', body: '#33475A', white: '#FFFFFF', bodyOnDark: '#CFE2F0',
};
const DISPLAY = { family: 'Anton', weight: '400', transform: 'uppercase' };
const LABEL = { family: 'Inter', weight: '700', size: px(11.5), transform: 'uppercase', spacing: px(3.4) };

const KIT = {
  system_colors: [
    { _id: 'primary', title: 'Glacier', color: COL.glacier },
    { _id: 'secondary', title: 'Deep', color: COL.deep },
    { _id: 'text', title: 'Body text', color: COL.body },
    { _id: 'accent', title: 'Sun', color: COL.sun },
  ],
  custom_colors: [
    { _id: 'smgnight', title: 'Night', color: COL.night },
    { _id: 'smgink', title: 'Ink (headings)', color: COL.ink },
    { _id: 'smggray', title: 'Gray (muted)', color: COL.gray },
    { _id: 'smgice', title: 'Ice (text on dark)', color: COL.ice },
    { _id: 'smgfrost', title: 'Frost', color: COL.frost },
    { _id: 'smgpaper', title: 'Paper', color: COL.paper },
    { _id: 'smgline', title: 'Line', color: COL.line },
    { _id: 'smgglacierlt', title: 'Glacier light', color: COL.glacierLt },
    { _id: 'smgsunink', title: 'Sun ink (button text)', color: COL.sunInk },
    { _id: 'smgwhite', title: 'White', color: COL.white },
  ],
  system_typography: [
    { _id: 'primary', title: 'Display (headings)', ...type('typography', { ...DISPLAY, line: px(1.06, 'em') }) },
    { _id: 'secondary', title: 'Label (eyebrows)', ...type('typography', LABEL) },
    { _id: 'text', title: 'Body', ...type('typography', { family: 'Inter', weight: '400', size: px(16.3), line: px(1.7, 'em') }) },
    { _id: 'accent', title: 'Button', ...type('typography', { family: 'Anton', weight: '400', size: px(16), transform: 'uppercase', spacing: px(1.3) }) },
  ],
  body_color: COL.body,
  ...type('body_typography', { family: 'Inter', weight: '400', size: px(16.3), line: px(1.7, 'em') }),
  link_normal_color: COL.glacier,
  link_hover_color: COL.deep,
  ...Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].flatMap(h => Object.entries({
    [`${h}_color`]: COL.ink, ...type(`${h}_typography`, { ...DISPLAY, line: px(1.06, 'em') }),
  }))),
  button_text_color: COL.sunInk,
  button_background_background: 'classic', button_background_color: COL.sun,
  button_hover_text_color: COL.sunInk,
  button_hover_background_background: 'classic', button_hover_background_color: COL.sunHover,
  button_border_radius: box(6), button_padding: box(15, 35),
  ...type('button_typography', { family: 'Anton', weight: '400', size: px(16), transform: 'uppercase', spacing: px(1.3) }),
  form_label_color: COL.ink,
  ...type('form_label_typography', { family: 'Inter', weight: '700', size: px(12), transform: 'uppercase', spacing: px(1.9) }),
  form_field_text_color: COL.ink, form_field_background_color: COL.white,
  form_field_border_border: 'solid', form_field_border_width: box(1), form_field_border_color: COL.line,
  form_field_border_radius: box(6), form_field_padding: box(12, 14),
  container_width: px(1280),
  site_name: 'Shasta Mountain Guides',
  site_description: 'The Original Guide Service on Mt. Shasta',
  // Only what widgets cannot express: smooth anchor jumps under the sticky header, card lift on hover.
  custom_css: [
    'html{scroll-behavior:smooth}',
    '[id]{scroll-margin-top:90px}',
    '.smg-lift{transition:transform .25s ease,box-shadow .25s ease}',
    '.smg-lift:hover{transform:translateY(-6px);box-shadow:0 22px 48px rgba(18,34,47,.22)}',
    '.smg-chips span{display:inline-block;background:#E9F3FA;border-radius:4px;padding:.3rem .65rem;margin:0 .4rem .4rem 0;font-size:.84rem;color:#12222F}',
    '.smg-chips b{font-size:.66rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1F5D8C;margin-right:.35rem}',
    '@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.smg-lift{transition:none}.smg-lift:hover{transform:none}}',
  ].join('\n'),
};

// ---------------- Shared building blocks ----------------
const label = (t, color, extra) => heading(t, 'span', merge({ __globals__: { typography_typography: T('secondary') }, title_color: color || COL.glacier }, extra));
const h2 = (t, color, extra) => heading(t, 'h2', merge(type('typography', { ...DISPLAY, size: px(48), sizeT: px(38), sizeM: px(30), line: px(1.06, 'em') }), { title_color: color || COL.ink }, extra));
const h3 = (t, color, size = 21, extra) => heading(t, 'h3', merge(type('typography', { ...DISPLAY, size: px(size), line: px(1.1, 'em'), spacing: px(0.5) }), { title_color: color || COL.ink }, extra));
const para = (t, color, extra) => text(t.startsWith('<') ? t : `<p>${t}</p>`, merge({ text_color: color || COL.body }, extra));
const small = (t, color) => text(`<p>${t}</p>`, merge({ text_color: color || COL.gray }, type('typography', { family: 'Inter', size: px(12.5), line: px(1.5, 'em') })));

const BTN = {
  sun: {},
  ghost: { background_background: 'classic', background_color: 'rgba(0,0,0,0)', button_text_color: COL.white, border_border: 'solid', border_width: box(2), border_color: 'rgba(255,255,255,0.6)', hover_color: COL.deep, button_background_hover_background: 'classic', button_background_hover_color: COL.white, button_hover_border_color: COL.white },
  glacier: { background_background: 'classic', background_color: COL.glacier, button_text_color: COL.white, hover_color: COL.white, button_background_hover_background: 'classic', button_background_hover_color: COL.deep },
  outline: { background_background: 'classic', background_color: 'rgba(0,0,0,0)', button_text_color: COL.glacier, border_border: 'solid', border_width: box(2), border_color: COL.glacier, hover_color: COL.white, button_background_hover_background: 'classic', button_background_hover_color: COL.glacier, button_hover_border_color: COL.glacier },
};
const btn = (t, url, variant = 'sun', extra) => button(t, url, merge(BTN[variant], extra));
const btnSm = (t, url, variant = 'sun', extra) => btn(t, url, variant, merge({ text_padding: box(10, 22), ...type('typography', { family: 'Anton', weight: '400', size: px(14.5), transform: 'uppercase', spacing: px(1.2) }) }, extra));

const row = (children, extra) => container(merge({ flex_direction: 'row', flex_wrap: 'wrap', flex_gap: gap(16), flex_align_items: 'center' }, extra), children);
const col = (children, extra) => container(merge({ flex_direction: 'column', flex_gap: gap(14) }, extra), children);
const sectionHead = (lbl, title, intro, centered = true, dark = false) => col([
  label(lbl, dark ? COL.ice : COL.glacier),
  h2(title, dark ? COL.white : COL.ink),
  intro ? para(intro, dark ? COL.ice : COL.gray, centered ? { align: 'center' } : {}) : null,
], merge({ flex_gap: gap(10), padding: box(0, 0, 36, 0) }, centered ? { flex_align_items: 'center', text_align: 'center' } : {}));
const centerText = (w) => merge(w, { settings: merge(w.settings, { align: 'center' }) });

// Background image + gradient overlay (used by trip cards, heroes, community band)
const bgImage = (src, overlay = 'up', position = 'center center') => merge({
  background_background: 'classic', background_image: { id: media(src).id, url: media(src).url },
  background_position: position, background_size: 'cover', background_repeat: 'no-repeat',
}, overlay ? {
  background_overlay_background: 'gradient',
  background_overlay_color: overlay === 'side' ? 'rgba(11,28,43,0.95)' : 'rgba(11,28,43,0.92)', background_overlay_color_stop: px(0, '%'),
  background_overlay_color_b: overlay === 'card' ? 'rgba(11,28,43,0.05)' : overlay === 'side' ? 'rgba(11,28,43,0.35)' : 'rgba(11,28,43,0.18)',
  background_overlay_color_b_stop: px(overlay === 'card' ? 60 : 100, '%'),
  background_overlay_gradient_type: 'linear', background_overlay_gradient_angle: px(overlay === 'side' ? 90 : 0, 'deg'),
} : {});

const card = (children, extra) => col(children, merge({
  background_background: 'classic', background_color: COL.white, border_border: 'solid', border_width: box(1), border_color: COL.line,
  border_radius: box(8), padding: box(26, 24), flex_gap: gap(10),
}, extra));

// Photo strip: six square background tiles, full width.
const strip = (srcs) => container({
  container_type: 'grid', content_width: 'full', ...res('grid_columns_grid', px(6, 'fr'), px(3, 'fr'), px(2, 'fr')),
  grid_rows_grid: { unit: 'custom', size: 'auto', sizes: [] }, grid_gaps: gap(0), background_background: 'classic', background_color: COL.night,
}, srcs.map(s => container(merge(bgImage(s, null), res('min_height', px(16.66, 'vw'), px(33.33, 'vw'), px(50, 'vw'))))), false);

// The standard "Plan my climb" form (homepage + every program page).
function planForm(preselect, extra = {}) {
  const trips = ['Climb Shasta', 'Ski Shasta', 'Mountaineering Course', 'Custom / Private Trip', 'Avalanche Course', 'Backpacking', 'Rock Climbing', 'Day Trip', 'Not sure yet'];
  return widget('form', merge({
    form_name: extra.name || 'Plan my climb',
    form_fields: [
      { _id: 'f1', custom_id: 'name', field_type: 'text', field_label: 'Name', placeholder: 'Your name', required: 'true', width: '50' },
      { _id: 'f2', custom_id: 'email', field_type: 'email', field_label: 'Email', placeholder: 'you@email.com', required: 'true', width: '50' },
      { _id: 'f3', custom_id: 'trip', field_type: 'select', field_label: "I'm interested in", required: 'true', width: '50', field_options: ["Choose one|", ...trips].join("\n"), field_value: preselect || "",},
      { _id: 'f4', custom_id: 'dates', field_type: 'text', field_label: 'Ideal dates', placeholder: 'e.g. late June 2027', width: '50' },
      { _id: 'f5', custom_id: 'experience', field_type: 'select', field_label: 'Experience level', width: '50', field_options: 'First big mountain\nSome snow & crampon experience\nExperienced mountaineer / skier' },
      { _id: 'f6', custom_id: 'group', field_type: 'number', field_label: 'Group size', placeholder: '1', width: '50', field_min: 1, field_max: 30 },
      { _id: 'f7', custom_id: 'message', field_type: 'textarea', field_label: 'Anything else?', placeholder: 'Goals, questions, fitness, gear you already own...', rows: 4, width: '100' },
    ],
    show_labels: 'yes', input_size: 'md', column_gap: px(14), row_gap: px(14),
    button_text: 'Send my request', button_size: 'md', button_width: '100', button_align: 'start',
    submit_actions: ['save-to-database', 'email'],
    email_to: FORM_EMAIL, email_subject: `New trip inquiry from the website${extra.page ? ` (${extra.page})` : ''}`,
    email_content: '[all-fields]', email_from_name: 'Shasta Mountain Guides website',
    success_message: "Thanks, we've got it. A guide will reply within one business day with a recommended trip and dates. Keep an eye on your inbox.",
    button_background_color: COL.sun, button_text_color: COL.sunInk, button_background_hover_color: COL.sunHover, button_hover_color: COL.sunInk,
    __globals__: { button_typography_typography: T('accent') },
  }));
}
const formCard = (title, form, note) => card([h3(title, COL.ink, 24), form, note ? small(note) : null], { padding: box(32, 30), box_shadow_box_shadow_type: 'yes', box_shadow_box_shadow: { horizontal: 0, vertical: 18, blur: 44, spread: 0, color: 'rgba(18,34,47,0.10)' } });

// Quiz: self-contained HTML (Elementor has no quiz widget). Buttons claim :hover/:focus/:focus-visible
// explicitly because Hello Elementor's reset.css turns focused buttons magenta otherwise.
function quizHtml() {
  const routes = {
    gulch: ['Avalanche Gulch', 'The classic. Non-technical, well travelled and the route most first-time Shasta climbers summit on. Best April through June on a two-day guided climb.', pageUrl('climb-shasta'), 'See the Climb Shasta trip'],
    clear: ['Clear Creek', 'The late-season choice once the Gulch melts out. Long, non-technical and quiet, with a huge view east. Best late July into September.', pageUrl('climb-shasta'), 'See the Climb Shasta trip'],
    north: ['Hotlum-Bolam Ridge', 'The wild side. Real glaciers, far fewer people and a stronger sense of expedition. For climbers with some crampon and ice-axe experience, or on a glacier seminar. Best June and July.', pageUrl('custom-trips'), 'Ask about a north side climb'],
    casaval: ['Casaval Ridge', 'Shasta’s most aesthetic line. Exposed ridge climbing on steep snow that rewards fit, experienced mountaineers. Prime in April and May.', pageUrl('custom-trips'), 'Ask about Casaval Ridge'],
    ski: ['Ski Mountaineering Descent', 'Climb it, then ride it. Avalanche Gulch, the West Face or Green Butte depending on the snow. We match the line to your turns. Best April through June.', pageUrl('ski-shasta'), 'See the Ski Shasta trip'],
    course: ['Mountaineering Course first', 'For a late-season first climb we recommend a short skills course or a Clear Creek climb so you learn crampons and self-arrest before committing to a summit push.', pageUrl('mountaineering-courses'), 'See mountaineering courses'],
  };
  const q = (n, legend, name, opts) => `<fieldset><legend>${n}. ${legend}</legend>${opts.map(([v, l]) => `<label class="opt"><input type="radio" name="${name}" value="${v}" required> ${l}</label>`).join('')}</fieldset>`;
  return `<style>
#smg-quiz{display:grid;gap:.9rem;font-family:Inter,sans-serif}
#smg-quiz fieldset{border:0;margin:0;padding:0;display:grid;gap:.4rem}
#smg-quiz legend{font-size:.76rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#12222F;margin-bottom:.35rem}
#smg-quiz .opt{display:flex;align-items:center;gap:.6rem;font-size:.93rem;font-family:Inter,sans-serif;font-weight:400;text-transform:none;letter-spacing:normal;line-height:1.4;padding:.55rem .75rem;border:1px solid #DCE7EF;border-radius:6px;cursor:pointer;background:#fff;color:#33475A}
#smg-quiz .opt:hover{border-color:#3E86BC}
#smg-quiz .opt input{accent-color:#1F5D8C;margin:0}
#smg-quiz .go,#smg-quiz .go:hover,#smg-quiz .go:focus,#smg-quiz .go:focus-visible{font-family:Anton,sans-serif;text-transform:uppercase;letter-spacing:.08em;font-size:.9rem;padding:.65rem 1.4rem;border-radius:6px;border:0;cursor:pointer;color:#fff}
#smg-quiz .go{background:#1F5D8C}
#smg-quiz .go:hover,#smg-quiz .go:focus{background:#123049}
#smg-quiz .go:focus-visible{background:#123049;outline:3px solid #3E86BC;outline-offset:3px}
#smg-quiz .result{background:#123049;color:#BFDDF2;border-radius:6px;padding:1.1rem 1.2rem}
#smg-quiz .result b{display:block;font-family:Anton,sans-serif;font-weight:400;text-transform:uppercase;font-size:1.4rem;color:#E8A33D;letter-spacing:.03em;margin-bottom:.25rem}
#smg-quiz .result p{margin:0;font-size:.92rem;color:#BFDDF2}
#smg-quiz .result a{display:inline-block;margin-top:.7rem;font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#E8A33D}
#smg-quiz .fine{font-size:.78rem;color:#54697A}
</style>
<form id="smg-quiz" novalidate>
${q(1, 'Your experience', 'experience', [['first', 'First big mountain'], ['some', 'Some snow &amp; crampon experience'], ['expert', 'Experienced mountaineer or skier']])}
${q(2, 'When do you want to climb?', 'season', [['spring', 'April &ndash; June'], ['summer', 'July &ndash; August'], ['late', 'September or later']])}
${q(3, 'What matters most?', 'goal', [['summit', 'The surest path to the summit'], ['quiet', 'Fewer people, more wild'], ['ski', 'Skiing or riding back down'], ['technical', 'A technical challenge']])}
<div class="result" id="smg-quiz-result" role="status" hidden></div>
<div><button class="go" type="submit" id="smg-quiz-btn">Show my route</button></div>
<span class="fine" id="smg-quiz-fine">Takes about a minute.</span>
</form>
<script>
(function(){
  var R=${JSON.stringify(routes)};
  function pick(a){
    if(a.goal==='ski')return 'ski';
    if(a.goal==='technical')return a.experience==='expert'&&a.season!=='late'?'casaval':'north';
    if(a.goal==='quiet')return a.experience==='first'?(a.season==='late'?'clear':'gulch'):'north';
    if(a.season==='late')return a.experience==='first'?'course':'clear';
    return 'gulch';
  }
  var f=document.getElementById('smg-quiz'); if(!f)return;
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var a={experience:(f.experience||{}).value,season:(f.season||{}).value,goal:(f.goal||{}).value};
    if(!a.experience||!a.season||!a.goal){document.getElementById('smg-quiz-fine').textContent='Pick one answer for each question.';return;}
    var r=R[pick(a)],box=document.getElementById('smg-quiz-result');
    box.innerHTML='<b>'+r[0]+'</b><p>'+r[1]+'</p><a href="'+r[2]+'">'+r[3]+' &rsaquo;</a> &nbsp; <a href="#contact">Plan this climb &rsaquo;</a>';
    box.hidden=false; f.querySelectorAll('fieldset').forEach(function(x){x.hidden=true;});
    document.getElementById('smg-quiz-btn').parentNode.hidden=true;
    document.getElementById('smg-quiz-fine').textContent='';
    var msg=document.querySelector('#contact textarea'); if(msg&&!msg.value){msg.value='The route quiz suggested '+r[0]+'. ';}
  });
})();
</script>`;
}

// ---------------- Header & footer (Theme Builder) ----------------
function headerTemplate() {
  return [container({
    content_width: 'full', background_background: 'classic', background_color: 'rgba(11,28,43,0.94)',
    border_border: 'solid', border_width: box(0, 0, 1, 0), border_color: 'rgba(255,255,255,0.08)',
    sticky: 'top', sticky_on: ['desktop', 'tablet', 'mobile'], z_index: 60,
  }, [
    container({ content_width: 'boxed', boxed_width: px(1280), flex_direction: 'row', flex_justify_content: 'space-between', flex_align_items: 'center', flex_gap: gap(20), ...res('padding', box(12, 64), box(12, 32), box(10, 18)), flex_wrap: 'nowrap' }, [
      image(media('assets/logos/SMG-logo-white.png'), { link_to: 'custom', link: { url: `${HOME}/` }, width: px(86), ...res('width', px(86), px(80), px(72)), _element_width: 'auto', _flex_size: 'none', __dynamic__: {} }),
      container({ flex_direction: 'row', flex_align_items: 'center', flex_justify_content: 'flex-end', flex_gap: gap(18), width: { unit: 'custom', size: 'auto', sizes: [] }, flex_wrap: 'nowrap', _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 }, [
        widget('nav-menu', {
          menu: 'main', layout: 'horizontal', align_items: 'end', pointer: 'none', submenu_icon: { value: 'fas fa-chevron-down', library: 'fa-solid' },
          dropdown: 'tablet', full_width: 'stretch', toggle_align: 'right',
          color_menu_item: COL.ice, color_menu_item_hover: COL.white, color_menu_item_active: COL.white,
          ...type('menu_typography', { family: 'Inter', weight: '600', size: px(13.5), transform: 'uppercase', spacing: px(1) }),
          padding_horizontal_menu_item: px(11), menu_space_between: px(4),
          background_color_dropdown_item: COL.deep, color_dropdown_item: COL.ice, color_dropdown_item_hover: COL.white, background_color_dropdown_item_hover: COL.lineDk,
          color_dropdown_item_active: COL.white, background_color_dropdown_item_active: COL.lineDk,
          ...type('dropdown_typography', { family: 'Inter', weight: '500', size: px(14.5) }),
          dropdown_border_radius: box(8), dropdown_top_distance: px(10),
          toggle_color: COL.white, toggle_background_color: 'rgba(0,0,0,0)', toggle_size: px(24),
        }),
        btnSm('Book Now', BOOK, 'sun', { text_padding: box(9, 20) }),
      ]),
    ]),
  ], false)];
}

function footerTemplate() {
  return [container({ content_width: 'full', background_background: 'classic', background_color: COL.night, ...res('padding', box(44, 0, 36, 0), box(40, 0, 32, 0), box(36, 0, 28, 0)) }, [
    container({ content_width: 'boxed', boxed_width: px(1280), flex_direction: 'column', flex_gap: gap(22), ...res('padding', box(0, 64), box(0, 32), box(0, 18)) }, [
      row([
        image(media('assets/logos/SMG-logo-white.png'), { link_to: 'custom', link: { url: `${HOME}/` }, width: px(66), _element_width: 'auto', _flex_size: 'none' }),
        widget('nav-menu', {
          menu: 'footer', layout: 'horizontal', align_items: 'end', pointer: 'none', dropdown: 'none',
          color_menu_item: '#8FA6B8', color_menu_item_hover: COL.ice,
          ...type('menu_typography', { family: 'Inter', weight: '400', size: px(13.6) }),
          padding_horizontal_menu_item: px(10), padding_vertical_menu_item: px(4),
        }),
      ], { flex_justify_content: 'space-between', flex_align_items: 'flex-start', padding: box(0, 0, 22, 0), border_border: 'solid', border_width: box(0, 0, 1, 0), border_color: COL.lineDk }),
      small('This business operates under special use permit with the Shasta-Trinity National Forest. This institution is an equal opportunity provider.', '#7C94A8'),
      row([
        small('&copy; 2026 Shasta Mountain Guides', '#8FA6B8'),
        text('<p><span style="background:#123049;color:#BFDDF2;border-radius:5px;padding:.35rem .85rem;font-weight:600;letter-spacing:.04em">Concept staging site, not live</span></p>', type('typography', { family: 'Inter', size: px(12.5) })),
        text('<p>Site by <a href="https://theclaymedia.com" style="color:#fff;font-weight:700">The Clay Media</a></p>', merge({ text_color: '#8FA6B8' }, type('typography', { family: 'Inter', size: px(12.5) }))),
      ], { flex_justify_content: 'space-between' }),
    ]),
  ], false)];
}

// ---------------- Homepage (from index.html) ----------------
function homePage() {
  const doc = parse(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  const q = (sel, ctx = doc) => ctx.querySelector(sel);
  const qa = (sel, ctx = doc) => ctx.querySelectorAll(sel);
  const txt = (el) => clean(el ? el.text : '');
  const sections = [];

  // Hero: background slideshow with Ken Burns zoom (Elementor's native equivalent of the mockup's panning crossfade).
  const hero = q('.hero');
  const slides = qa('.hero__slide img', hero).map(i => media(i.getAttribute('src')));
  sections.push(container(merge({
    content_width: 'full', ...res('min_height', px(92, 'vh'), px(80, 'vh'), px(88, 'vh')), flex_direction: 'column', flex_justify_content: 'flex-end',
    background_background: 'slideshow', background_slideshow_gallery: slides.map(m => ({ id: m.id, url: m.url })),
    background_slideshow_loop: 'yes', background_slideshow_slide_duration: 8000, background_slideshow_slide_transition: 'fade',
    background_slideshow_transition_duration: 1500, background_slideshow_ken_burns: 'yes', background_slideshow_ken_burns_zoom_direction: 'in',
    background_slideshow_background_size: 'cover', background_slideshow_background_position: 'center center', background_slideshow_lazyload: '',
    background_overlay_background: 'gradient', background_overlay_color: 'rgba(11,28,43,0.92)', background_overlay_color_stop: px(0, '%'),
    background_overlay_color_b: 'rgba(11,28,43,0.18)', background_overlay_color_b_stop: px(100, '%'), background_overlay_gradient_type: 'linear', background_overlay_gradient_angle: px(0, 'deg'),
  }), [
    container({ content_width: 'boxed', boxed_width: px(1280), flex_direction: 'column', flex_gap: gap(12), ...res('padding', box(86, 64), box(70, 32), box(56, 18)) }, [
      label(txt(q('.elev', hero)), COL.ice),
      heading(txt(q('h1', hero)), 'h1', merge(type('typography', { ...DISPLAY, size: px(70), sizeT: px(52), sizeM: px(36), line: px(1.06, 'em') }), { title_color: COL.white, _element_width: 'initial', _element_custom_width: px(900) }, res('_element_custom_width', px(900), px(640), px(100, '%')))),
      para(`<p><em>${txt(q('.native', hero))}</em></p>`, COL.ice, type('typography', { family: 'Inter', weight: '500', size: px(19), sizeM: px(16) })),
      row(qa('.hero__cta a', hero).map((a, i) => btn(txt(a), link(a.getAttribute('href')), i === 0 ? 'sun' : 'ghost')), { padding: box(10, 0, 0, 0) }),
    ]),
  ], false));

  // Trips & courses grid
  const trips = q('#trips');
  const sh = q('.section-head', trips);
  sections.push(section({ background_background: 'classic', background_color: COL.paper, _element_id: 'trips' }, {}, [
    sectionHead(txt(q('.label', sh)), txt(q('h2', sh)), txt(q('p', sh))),
    container({ container_type: 'grid', ...res('grid_columns_grid', px(4, 'fr'), px(2, 'fr'), px(1, 'fr')), grid_rows_grid: { unit: 'custom', size: 'auto', sizes: [] }, grid_gaps: gap(16) },
      qa('.trip', trips).map(a => {
        const img = q('img', a);
        return container(merge(bgImage(img.getAttribute('src'), 'card'), {
          html_tag: 'a', link: { url: link(a.getAttribute('href')) }, ...res('min_height', px(400), px(380), px(280)),
          flex_direction: 'column', flex_justify_content: 'flex-end', flex_gap: gap(4), padding: box(20, 20, 22, 20), border_radius: box(8), css_classes: 'smg-lift',
        }), [
          h3(txt(q('h3', a)), COL.white, 22),
          text('<p>Explore &rsaquo;</p>', merge({ text_color: COL.sun }, type('typography', { family: 'Inter', weight: '700', size: px(12.8), transform: 'uppercase', spacing: px(1.3) }))),
        ]);
      })),
  ]));

  // Why SMG
  const why = q('.why');
  const whyLeft = qa('.cols > div', why)[0];
  sections.push(section({ background_background: 'classic', background_color: COL.deep }, { flex_direction: 'row', flex_gap: gap(64), flex_align_items: 'center', ...res('flex_direction', 'row', 'column', 'column'), ...res('flex_gap', gap(64), gap(40), gap(32)) }, [
    col([
      label(txt(q('.label', whyLeft)), COL.ice),
      h2(txt(q('h2', whyLeft)), COL.white),
      para(txt(q('p:not(.season)', whyLeft)), COL.bodyOnDark),
      para(`<p><strong>${txt(q('.season', whyLeft))}</strong></p>`, COL.white),
      row([btn(txt(q('.btn', whyLeft)), link(q('.btn', whyLeft).getAttribute('href')))], { padding: box(10, 0, 0, 0) }),
    ], { ...res('width', px(50, '%'), px(100, '%'), px(100, '%')), flex_gap: gap(14) }),
    col([
      image(media(q('.why__photo img', why).getAttribute('src')), { height: px(380), ...res('height', px(380), px(340), px(240)), 'object-fit': 'cover', width: px(100, '%'), image_border_radius: box(8) }),
      ...qa('.stats li', why).map(li => col([
        heading(txt(q('b', li)), 'p', merge(type('typography', { family: 'Anton', weight: '400', size: px(30), line: px(1.1, 'em') }), { title_color: COL.sun })),
        text(`<p>${txt(q('span', li))}</p>`, merge({ text_color: COL.ice }, type('typography', { family: 'Inter', size: px(14.5) }))),
      ], { background_background: 'classic', background_color: 'rgba(11,28,43,0.55)', border_border: 'solid', border_width: box(1), border_color: COL.lineDk, border_radius: box(8), padding: box(20, 24), flex_gap: gap(2) })),
    ], { ...res('width', px(50, '%'), px(100, '%'), px(100, '%')), flex_gap: gap(14) }),
  ]));

  // Meet your guides
  const g = q('#guides');
  const lead = q('.lead', g);
  sections.push(section({ background_background: 'classic', background_color: COL.white, _element_id: 'guides' }, { flex_gap: gap(44) }, [
    row([
      col([label(txt(q('.label', lead))), h2(txt(q('h2', lead))), ...qa('div > p', lead).map(p => para(txt(p), COL.gray))], { ...res('width', px(52, '%'), px(100, '%'), px(100, '%')) }),
      col([image(media(q('.photo img', lead).getAttribute('src')), { height: px(380), ...res('height', px(380), px(340), px(240)), 'object-fit': 'cover', width: px(100, '%'), image_border_radius: box(8) })], { ...res('width', px(44, '%'), px(100, '%'), px(100, '%')) }),
    ], { flex_gap: gap(48), flex_justify_content: 'space-between', flex_wrap: 'wrap' }),
    container({ container_type: 'grid', ...res('grid_columns_grid', px(3, 'fr'), px(2, 'fr'), px(1, 'fr')), grid_rows_grid: { unit: 'custom', size: 'auto', sizes: [] }, grid_gaps: gap(18) },
      qa('.guide', g).map(gEl => {
        const img = q('.avatar img', gEl);
        const initials = txt(q('.avatar', gEl));
        const badge = q('.local', gEl);
        const blurb = clean((q('p', gEl).childNodes.filter(n => n.nodeType === 3).map(n => n.text).join(' ')));
        const avatar = img
          ? image(media(img.getAttribute('src')), { width: px(74), height: px(74), 'object-fit': 'cover', image_border_radius: box(50, 50, 50, 50, '%'), _element_width: 'auto', _flex_size: 'none' })
          : container({ width: px(74), min_height: px(74), _flex_size: 'none', flex_justify_content: 'center', flex_align_items: 'center', background_background: 'classic', background_color: COL.deep, border_radius: box(50, 50, 50, 50, '%') }, [
            heading(initials, 'span', merge(type('typography', { family: 'Anton', weight: '400', size: px(24) }), { title_color: COL.sun })),
          ]);
        return container({ flex_direction: 'row', flex_gap: gap(18), flex_align_items: 'flex-start', flex_wrap: 'nowrap', background_background: 'classic', background_color: COL.paper, border_border: 'solid', border_width: box(1), border_color: COL.line, border_radius: box(8), padding: box(24), css_classes: 'smg-lift' }, [
          avatar,
          col([
            h3(txt(q('h3', gEl)), COL.ink, 20),
            label(txt(q('.role', gEl)), COL.glacier, type('typography', { family: 'Inter', weight: '700', size: px(11), transform: 'uppercase', spacing: px(2) })),
            para(blurb, COL.gray, type('typography', { family: 'Inter', size: px(14.8), line: px(1.6, 'em') })),
            badge ? text(`<p><span style="display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#2A1C05;background:#E8A33D;border-radius:4px;padding:.15rem .55rem">${txt(badge)}</span></p>`) : null,
          ], { flex_gap: gap(6), _flex_size: 'custom', _flex_grow: 1, _flex_shrink: 1 }),
        ]);
      })),
    row([btn(txt(q('.more a', g)), q('.more a', g).getAttribute('href'), 'outline')], { flex_justify_content: 'center' }),
  ]));

  // Rooted in Mt. Shasta
  const hm = q('#community');
  sections.push(section(merge(bgImage(q('.hometown__bg img', hm).getAttribute('src'), 'side'), { _element_id: 'community', ...res('padding', box(110, 0), box(80, 0), box(64, 0)) }), { flex_gap: gap(16) }, [
    label(txt(q('.label', hm)), COL.ice),
    h2(txt(q('h2', hm)), COL.white, { _element_width: 'initial', _element_custom_width: px(620), ...res('_element_custom_width', px(620), px(560), px(100, '%')) }),
    para(txt(q('.intro', hm)), COL.ice, { _element_width: 'initial', _element_custom_width: px(640), ...res('_element_custom_width', px(640), px(100, '%'), px(100, '%')) }),
    container({ container_type: 'grid', ...res('grid_columns_grid', px(3, 'fr'), px(1, 'fr'), px(1, 'fr')), grid_rows_grid: { unit: 'custom', size: 'auto', sizes: [] }, grid_gaps: gap(16), padding: box(20, 0, 0, 0), width: px(980), ...res('width', px(980), px(100, '%'), px(100, '%')) },
      qa('ul li', hm).map(li => col([
        heading(txt(q('b', li)), 'h3', merge(type('typography', { family: 'Anton', weight: '400', size: px(21), spacing: px(0.5) }), { title_color: COL.sun })),
        text(`<p>${txt(q('span', li))}</p>`, merge({ text_color: COL.ice }, type('typography', { family: 'Inter', size: px(14.7), line: px(1.6, 'em') }))),
      ], { background_background: 'classic', background_color: 'rgba(255,255,255,0.06)', border_border: 'solid', border_width: box(1), border_color: 'rgba(255,255,255,0.14)', border_radius: box(8), padding: box(22, 22), flex_gap: gap(6) }))),
  ]));

  // CTA band
  const surest = q('.surest');
  sections.push(section({ background_background: 'classic', background_color: COL.glacier }, { flex_align_items: 'center', flex_gap: gap(26) }, [
    h2(txt(q('h2', surest)), COL.white, { align: 'center', _element_width: 'initial', _element_custom_width: px(860), ...res('_element_custom_width', px(860), px(100, '%'), px(100, '%')) }),
    btn(txt(q('a', surest)), link(q('a', surest).getAttribute('href'))),
  ]));

  // Learn before you climb
  const learn = q('#learn');
  const lsh = q('.section-head', learn);
  const articles = qa('.article', learn);
  sections.push(section({ background_background: 'classic', background_color: COL.paper, _element_id: 'learn' }, {}, [
    sectionHead(txt(q('.label', lsh)), txt(q('h2', lsh)), txt(q('p', lsh))),
    container({ container_type: 'grid', ...res('grid_columns_grid', { unit: 'custom', size: '1.4fr 1fr 1fr', sizes: [] }, px(2, 'fr'), px(1, 'fr')), grid_rows_grid: { unit: 'custom', size: 'auto', sizes: [] }, grid_gaps: gap(18) },
      articles.map((a, i) => {
        const feature = i === 0;
        const img = q('img', a);
        return container(merge({
          html_tag: 'a', link: { url: a.getAttribute('href') }, flex_direction: 'column', flex_gap: gap(0), background_background: 'classic', background_color: COL.white,
          border_border: 'solid', border_width: box(1), border_color: COL.line, border_radius: box(8), overflow: 'hidden', css_classes: 'smg-lift',
        }, feature ? { grid_row: '2', grid_row_tablet: '1', grid_column_tablet: '2', grid_row_mobile: '1', grid_column_mobile: '1' } : {}), [
          container(merge(bgImage(img.getAttribute('src'), null), feature ? res('min_height', px(360), px(300), px(220)) : res('min_height', px(190), px(200), px(200)))),
          col([
            label(txt(q('.tag', a)), COL.glacier, type('typography', { family: 'Inter', weight: '700', size: px(11), transform: 'uppercase', spacing: px(2.4) })),
            h3(txt(q('h3', a)), COL.ink, feature ? 30 : 20),
            para(txt(q('p', a)), COL.gray, type('typography', { family: 'Inter', size: px(14.8), line: px(1.6, 'em') })),
            text(`<p>${txt(q('.go', a)).replace('›', '&rsaquo;')}</p>`, merge({ text_color: COL.sun }, type('typography', { family: 'Inter', weight: '700', size: px(12.8), transform: 'uppercase', spacing: px(1.3) }))),
          ], { padding: box(22, 22, 24, 22), flex_gap: gap(8) }),
        ]);
      })),
  ]));

  // Free resources
  const resSec = q('#resources');
  const rsh = q('.section-head', resSec);
  const cards = qa('.res', resSec);
  const gearOptions = qa('select option', cards[1]).map(o => `${clean(o.text)}|${media(o.getAttribute('value')).url}`);
  const resCard = (c, body) => card([
    text(`<p>${txt(q('.fmt', c))}</p>`, merge({ text_color: COL.glacier }, type('typography', { family: 'Inter', weight: '700', size: px(11.5), transform: 'uppercase', spacing: px(2.2) }))),
    h3(txt(q('h3', c)), COL.ink, 22),
    para(txt(q('p', c)), COL.gray, type('typography', { family: 'Inter', size: px(14.8), line: px(1.6, 'em') })),
    ...body,
  ], { padding: box(28, 26), flex_gap: gap(10) });
  const leadForm = (name, fields, buttonText, redirect, success) => widget('form', {
    form_name: name, form_fields: fields, show_labels: 'yes', input_size: 'sm', row_gap: px(10), column_gap: px(10),
    button_text: buttonText, button_size: 'sm', button_width: '100',
    submit_actions: ['save-to-database', 'email', 'redirect'], email_to: FORM_EMAIL, email_subject: `New download: ${name}`, email_content: '[all-fields]',
    email_from_name: 'Shasta Mountain Guides website', redirect_to: redirect, success_message: success,
    button_background_color: COL.glacier, button_text_color: COL.white, button_background_hover_color: COL.deep, button_hover_color: COL.white,
    __globals__: { button_typography_typography: T('accent') },
  });
  const nameEmail = [
    { _id: 'n1', custom_id: 'name', field_type: 'text', field_label: 'Name', placeholder: 'Your name', required: 'true', width: '100' },
    { _id: 'n2', custom_id: 'email', field_type: 'email', field_label: 'Email', placeholder: 'you@email.com', required: 'true', width: '100' },
  ];
  sections.push(section({ background_background: 'classic', background_color: COL.frost, _element_id: 'resources' }, {}, [
    sectionHead(txt(q('.label', rsh)), txt(q('h2', rsh)), txt(q('p', rsh))),
    container({ container_type: 'grid', ...res('grid_columns_grid', px(3, 'fr'), px(1, 'fr'), px(1, 'fr')), grid_rows_grid: { unit: 'custom', size: 'auto', sizes: [] }, grid_gaps: gap(18), grid_align_items: 'start' }, [
      resCard(cards[0], [leadForm('Training guide download', nameEmail, 'Send me the training guide', media('assets/downloads/smg-training-for-mount-shasta.pdf').url, 'On its way. Opening your training guide now.'), small('One email with your download. No spam, unsubscribe any time.')]),
      resCard(cards[1], [leadForm('Gear checklist download', [
        { _id: 'g0', custom_id: 'gear_list', field_type: 'select', field_label: 'Which trip?', required: 'true', width: '100', field_options: gearOptions.join('\n') },
        ...nameEmail.map((f, i) => ({ ...f, _id: `g${i + 1}` })),
      ], 'Send me the checklist', '[field id="gear_list"]', 'On its way. Opening your gear list now.'), small('One email with your download. No spam, unsubscribe any time.')]),
      resCard(cards[2], [html(quizHtml())]),
    ]),
  ]));

  // Photo strip
  sections.push(strip(qa('.strip img').map(i => i.getAttribute('src'))));

  // Contact
  const ct = q('#contact');
  const csh = q('.section-head', ct);
  const right = qa('.cols > div', ct).pop();
  sections.push(section({ background_background: 'classic', background_color: COL.paper, _element_id: 'contact' }, {}, [
    sectionHead(txt(q('.label', csh)), txt(q('h2', csh)), txt(q('p', csh)), false),
    container({ flex_direction: 'row', flex_gap: gap(56), flex_align_items: 'flex-start', ...res('flex_direction', 'row', 'column', 'column'), ...res('flex_gap', gap(56), gap(36), gap(28)) }, [
      col([formCard('Plan my climb', planForm('', { page: 'Homepage' }), "We reply by email within one business day. Prefer a call? Leave your number in the message and we'll ring you.")], { ...res('width', px(54, '%'), px(100, '%'), px(100, '%')) }),
      col([
        label(txt(q('.label', right))),
        heading(txt(q('h2', right)), 'h2', merge(type('typography', { ...DISPLAY, size: px(32), sizeM: px(26) }), { title_color: COL.ink })),
        widget('icon-list', {
          icon_list: [
            { _id: 'c1', text: '305 Chestnut Street, Mt. Shasta, California 96067', selected_icon: { value: 'fas fa-map-marker-alt', library: 'fa-solid' }, link: { url: 'https://www.google.com/maps?q=305+Chestnut+St,+Mt+Shasta,+CA+96067', is_external: 'on' } },
            { _id: 'c2', text: 'info@shastaguides.com', selected_icon: { value: 'fas fa-envelope', library: 'fa-solid' }, link: { url: 'mailto:info@shastaguides.com' } },
          ],
          space_between: px(14), icon_color: COL.glacier, icon_size: px(18), text_color: COL.ink, text_color_hover: COL.glacier, text_indent: px(10),
          ...type('icon_typography', { family: 'Inter', weight: '600', size: px(16) }),
        }),
        text(`<p>${q('.phone-note', right).innerHTML}</p>`, merge({ text_color: COL.gray, link_color: COL.glacier }, type('typography', { family: 'Inter', size: px(14) }))),
        widget('google_maps', { address: '305 Chestnut St, Mt Shasta, CA 96067', zoom: px(15), height: px(260) }),
        widget('social-icons', {
          social_icon_list: [
            { _id: 's1', social_icon: { value: 'fab fa-instagram', library: 'fa-brands' }, link: { url: 'https://www.instagram.com/shastamountainguides/', is_external: 'on' } },
            { _id: 's2', social_icon: { value: 'fab fa-facebook-f', library: 'fa-brands' }, link: { url: 'https://www.facebook.com/shastaguides', is_external: 'on' } },
            { _id: 's3', social_icon: { value: 'fab fa-yelp', library: 'fa-brands' }, link: { url: 'https://www.yelp.com/biz/shasta-mountain-guides-mount-shasta', is_external: 'on' } },
          ],
          shape: 'circle', align: 'left', icon_color: 'custom', icon_primary_color: COL.white, icon_secondary_color: COL.glacier, icon_size: px(17), icon_padding: px(0.7, 'em'), icon_spacing: px(10),
          hover_primary_color: COL.glacier, hover_secondary_color: COL.white,
        }),
      ], { ...res('width', px(42, '%'), px(100, '%'), px(100, '%')), flex_gap: gap(14) }),
    ]),
  ]));

  return mainWrap(sections);
}

// Hello Elementor's skip link targets #content, which the full-width template doesn't output.
function mainWrap(sections) {
  return [container({ content_width: 'full', html_tag: 'main', _element_id: 'content', _attributes: 'tabindex|-1', padding: box(0), flex_gap: gap(0) }, sections, false)];
}

// ---------------- Program pages (from tools/trips-data.js) ----------------
function tripPage(t) {
  const sections = [];
  sections.push(container(merge(bgImage(t.hero.src, 'up'), {
    content_width: 'full', ...res('min_height', px(64, 'vh'), px(56, 'vh'), px(60, 'vh')), flex_direction: 'column', flex_justify_content: 'flex-end',
  }), [
    container({ content_width: 'boxed', boxed_width: px(1280), flex_direction: 'column', flex_gap: gap(10), ...res('padding', box(64, 64), box(56, 32), box(44, 18)) }, [
      text(`<p><a href="${HOME}/" style="color:#BFDDF2">Home</a> <span style="opacity:.6">/</span> <a href="${HOME}/#trips" style="color:#BFDDF2">Trips &amp; Courses</a> <span style="opacity:.6">/</span> <span style="color:#fff">${t.title}</span></p>`, merge({ text_color: COL.ice }, type('typography', { family: 'Inter', size: px(12.5), spacing: px(0.5) }))),
      label(t.eyebrow, COL.ice),
      heading(t.h1, 'h1', merge(type('typography', { ...DISPLAY, size: px(60), sizeT: px(46), sizeM: px(34), line: px(1.06, 'em') }), { title_color: COL.white })),
      para(t.lede, COL.ice, merge(type('typography', { family: 'Inter', size: px(18.5), sizeM: px(16), line: px(1.6, 'em') }), { _element_width: 'initial', _element_custom_width: px(680), ...res('_element_custom_width', px(680), px(100, '%'), px(100, '%')) })),
      row([btn('Book Now', BOOK), btn('Plan My Trip', '#inquire', 'ghost')], { padding: box(8, 0, 0, 0) }),
    ]),
  ], false));

  // Overview + at a glance
  sections.push(section({ background_background: 'classic', background_color: COL.white }, { flex_direction: 'row', flex_gap: gap(56), flex_align_items: 'flex-start', ...res('flex_direction', 'row', 'column', 'column'), ...res('flex_gap', gap(56), gap(32), gap(28)) }, [
    col([
      label('Overview'),
      ...t.intro.map(p => para(p)),
      t.status ? text(`<p><strong>Current status:</strong> ${t.status}</p>`, { text_color: COL.body, _background_background: 'classic', _background_color: COL.frost, _padding: box(16, 20), _border_border: 'solid', _border_width: box(0, 0, 0, 4), _border_color: COL.sun, _border_radius: box(0, 6, 6, 0) }) : null,
    ], { ...res('width', px(56, '%'), px(100, '%'), px(100, '%')) }),
    container({ flex_direction: 'column', flex_gap: gap(0), background_background: 'classic', background_color: COL.paper, border_border: 'solid', border_width: box(1), border_color: COL.line, border_radius: box(8), ...res('width', px(40, '%'), px(100, '%'), px(100, '%')) },
      t.glance.map(([k, v], i) => container({ flex_direction: 'row', flex_gap: gap(16), flex_wrap: 'nowrap', padding: box(15, 20), border_border: 'solid', border_width: box(0, 0, i === t.glance.length - 1 ? 0 : 1, 0), border_color: COL.line, flex_align_items: 'baseline' }, [
        text(`<p>${k}</p>`, merge({ text_color: COL.glacier, _element_width: 'initial', _element_custom_width: px(120) }, type('typography', { family: 'Inter', weight: '700', size: px(11.5), transform: 'uppercase', spacing: px(2.2) }))),
        text(`<p><strong>${v}</strong></p>`, merge({ text_color: COL.ink }, type('typography', { family: 'Inter', weight: '600', size: px(15.5) }))),
      ]))),
  ]));

  // Program cards
  if (t.programs) {
    sections.push(section({ background_background: 'classic', background_color: COL.paper, _element_id: 'programs' }, { flex_gap: gap(18) }, [
      sectionHead('Choose Your Trip', `${t.programs.length} ways to do it`, 'Every trip below is led by our certified local guides. Not sure which fits? Scroll down and ask, or take the one-minute route quiz on the homepage.', false),
      ...t.programs.map(pr => container({ flex_direction: 'row', flex_wrap: 'nowrap', flex_gap: gap(0), ...res('flex_direction', 'row', 'row', 'column'), background_background: 'classic', background_color: COL.white, border_border: 'solid', border_width: box(1), border_color: COL.line, border_radius: box(8), overflow: 'hidden', _element_id: pr.name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }, [
        container(merge(bgImage(pr.img, null), { ...res('width', px(34, '%'), px(38, '%'), px(100, '%')), ...res('min_height', px(260), px(260), px(210)), padding: box(14), flex_align_items: 'flex-start' }), [
          pr.tag ? text(`<p><span style="background:#E8A33D;color:#2A1C05;font-size:.7rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:.3rem .65rem;border-radius:4px">${pr.tag}</span></p>`) : null,
        ]),
        col([
          h3(pr.name, COL.ink, 24),
          text(`<p class="smg-chips">${[pr.length && ['Length', pr.length], pr.route && ['Route', pr.route], pr.cost && ['Cost', pr.cost]].filter(Boolean).map(([k, v]) => `<span><b>${k}</b>${v}</span>`).join('')}</p>`),
          para(pr.blurb, COL.gray),
          container({ container_type: 'grid', ...res('grid_columns_grid', px(2, 'fr'), px(1, 'fr'), px(1, 'fr')), grid_rows_grid: { unit: 'custom', size: 'auto', sizes: [] }, grid_gaps: gap(14) }, [
            col([label('Experience', COL.glacier, type('typography', { family: 'Inter', weight: '700', size: px(11), transform: 'uppercase', spacing: px(2) })), para(pr.experience, COL.gray, type('typography', { family: 'Inter', size: px(14), line: px(1.55, 'em') }))], { flex_gap: gap(4) }),
            col([label('Physical demand', COL.glacier, type('typography', { family: 'Inter', weight: '700', size: px(11), transform: 'uppercase', spacing: px(2) })), para(pr.demand, COL.gray, type('typography', { family: 'Inter', size: px(14), line: px(1.55, 'em') }))], { flex_gap: gap(4) }),
          ]),
          row([
            btnSm('Book Now', BOOK),
            btnSm('Ask about this trip', '#inquire', 'outline', { _attributes: `data-trip|${pr.name}` }),
            pr.learn ? text(`<p><a href="${pr.learn}" style="color:#E8A33D;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:.8rem">Full details &rsaquo;</a></p>`) : null,
          ], { padding: box(6, 0, 0, 0), flex_gap: gap(12) }),
        ], { ...res('width', px(66, '%'), px(62, '%'), px(100, '%')), ...res('padding', box(26, 28), box(22, 22), box(20, 18)), flex_gap: gap(12) }),
      ])),
    ]));
  }

  // Private pricing tables (custom trips)
  if (t.pricing) {
    const table = (p) => {
      const head = p.head ? `<thead><tr>${p.head.map(h => `<th style="text-align:left;padding:.6rem .5rem;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#1F5D8C;border-bottom:1px solid #DCE7EF">${h}</th>`).join('')}</tr></thead>` : '';
      const rows = p.rows.map(r => `<tr>${r.map((c, i) => `<${i ? 'td' : 'th'} style="text-align:left;padding:.65rem .5rem;border-bottom:1px solid #DCE7EF;vertical-align:top;${i ? 'color:#54697A;font-weight:400' : 'color:#12222F;font-weight:600'}">${c}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('');
      return `<table style="width:100%;border-collapse:collapse;font-size:.93rem">${head}<tbody>${rows}</tbody></table>`;
    };
    sections.push(section({ background_background: 'classic', background_color: COL.paper, _element_id: 'pricing' }, { flex_gap: gap(18) }, [
      sectionHead('Private Pricing', 'Simple, per-person pricing', 'Pick a length, bring your crew. Everything else works like our scheduled trips.', false),
      container({ container_type: 'grid', ...res('grid_columns_grid', px(2, 'fr'), px(1, 'fr'), px(1, 'fr')), grid_rows_grid: { unit: 'custom', size: 'auto', sizes: [] }, grid_gaps: gap(18), grid_align_items: 'start' },
        t.pricing.map(p => card([h3(p.title, COL.ink, 22), text(table(p)), p.note ? small(p.note) : null]))),
      row([btn('Request a custom trip', '#inquire')]),
    ]));
  }

  // What's included + dates
  if (t.includes) {
    sections.push(section({ background_background: 'classic', background_color: COL.deep }, { flex_direction: 'row', flex_gap: gap(56), flex_align_items: 'flex-start', ...res('flex_direction', 'row', 'column', 'column'), ...res('flex_gap', gap(56), gap(32), gap(28)) }, [
      col([
        label("What's Included", COL.ice),
        h2('We carry the mountain stuff. You carry you.', COL.white),
        widget('icon-list', {
          icon_list: t.includes.map((x, i) => ({ _id: `i${i}`, text: x, selected_icon: { value: 'fas fa-check-circle', library: 'fa-solid' } })),
          space_between: px(10), icon_color: COL.sun, icon_size: px(18), text_color: COL.bodyOnDark, text_indent: px(10), icon_self_align: 'left',
          ...type('icon_typography', { family: 'Inter', size: px(15.5), line: px(1.5, 'em') }),
        }),
        t.notIncluded ? small(t.notIncluded, COL.ice) : null,
      ], { ...res('width', px(54, '%'), px(100, '%'), px(100, '%')) }),
      col([
        h3(t.dates ? t.dates.title : 'Dates and availability', COL.white, 22),
        t.dates
          ? text(`<ul style="list-style:none;margin:0;padding:0;display:grid;gap:.5rem">${t.dates.rows.map(r => `<li style="padding:.6rem .8rem;background:rgba(255,255,255,.06);border-radius:6px;color:#fff;font-weight:500">${r[0]}</li>`).join('')}</ul>`)
          : para('Scheduled departures run through the season and private dates are available on request. Tell us your window and we will match you to a trip.', COL.ice),
        t.dates && t.dates.note ? small(t.dates.note, COL.ice) : null,
        row([btn(t.dates ? 'Check availability' : 'Ask about dates', t.dates ? BOOK : '#inquire')]),
      ], { ...res('width', px(42, '%'), px(100, '%'), px(100, '%')), background_background: 'classic', background_color: 'rgba(11,28,43,0.55)', border_border: 'solid', border_width: box(1), border_color: COL.lineDk, border_radius: box(8), padding: box(26, 26), flex_gap: gap(12) }),
    ]));
  }

  if (t.extra) {
    sections.push(section({ background_background: 'classic', background_color: COL.glacier }, { flex_align_items: 'center', flex_gap: gap(18) }, [
      label(t.extra.title, COL.ice),
      heading(t.extra.text, 'h2', merge(type('typography', { ...DISPLAY, size: px(30), sizeM: px(24), line: px(1.15, 'em') }), { title_color: COL.white, align: 'center', _element_width: 'initial', _element_custom_width: px(820), ...res('_element_custom_width', px(820), px(100, '%'), px(100, '%')) })),
      btn('Get in touch', '#inquire'),
    ]));
  }

  sections.push(strip(t.strip));

  // Inquiry + resources
  const gearLink = (g) => ({ _id: `r${Math.random().toString(36).slice(2, 7)}`, text: `${g.label} (PDF)`, selected_icon: { value: 'fas fa-clipboard-check', library: 'fa-solid' }, link: { url: media(g.href).url, is_external: 'on' } });
  sections.push(section({ background_background: 'classic', background_color: COL.paper, _element_id: 'inquire' }, {}, [
    sectionHead('Plan Your Trip', `Ask us about ${t.title.toLowerCase()}.`, 'Send a few details and a guide will reply within one business day with a recommendation, dates and next steps. No phone tag.', false),
    container({ flex_direction: 'row', flex_gap: gap(56), flex_align_items: 'flex-start', ...res('flex_direction', 'row', 'column', 'column'), ...res('flex_gap', gap(56), gap(36), gap(28)) }, [
      col([formCard('Plan my trip', planForm(t.formOption, { page: t.title }), "We reply by email within one business day. Prefer a call? Leave your number in the message and we'll ring you.")], { ...res('width', px(54, '%'), px(100, '%'), px(100, '%')) }),
      col([
        label('Before You Go'),
        heading('Show up ready.', 'h2', merge(type('typography', { ...DISPLAY, size: px(32), sizeM: px(26) }), { title_color: COL.ink })),
        widget('icon-list', {
          icon_list: [
            gearLink(t.gear),
            ...(t.gear.alt ? [gearLink(t.gear.alt)] : []),
            { _id: 'rtr', text: 'Training for Mt. Shasta (PDF)', selected_icon: { value: 'fas fa-chart-line', library: 'fa-solid' }, link: { url: media('assets/downloads/smg-training-for-mount-shasta.pdf').url, is_external: 'on' } },
            { _id: 'rar', text: t.article.title, selected_icon: { value: 'fas fa-book-open', library: 'fa-solid' }, link: { url: t.article.href } },
            { _id: 'rtd', text: 'Trip details: meeting times, lodging, food, weather and tipping', selected_icon: { value: 'fas fa-info-circle', library: 'fa-solid' }, link: { url: 'https://shastaguides.com/tripdetails' } },
          ],
          space_between: px(14), icon_color: COL.glacier, icon_size: px(18), text_color: COL.ink, text_color_hover: COL.glacier, text_indent: px(10),
          ...type('icon_typography', { family: 'Inter', weight: '600', size: px(15.5) }),
        }),
        text('<p>Already booked and need us right now? Call <a href="tel:+15309263117">530.926.3117</a>.</p>', merge({ text_color: COL.gray, link_color: COL.glacier }, type('typography', { family: 'Inter', size: px(14) }))),
      ], { ...res('width', px(42, '%'), px(100, '%'), px(100, '%')), flex_gap: gap(14) }),
    ]),
    // "Ask about this trip" pre-fills the form message with the specific trip.
    html(`<script>document.addEventListener('click',function(e){var a=e.target.closest('[data-trip]');if(!a)return;var m=document.querySelector('#inquire textarea');if(m&&!m.value){m.value="I'm interested in the "+a.getAttribute('data-trip')+". ";}});</script>`),
  ]));

  return mainWrap(sections);
}

// ---------------- Menus ----------------
const menus = [
  { name: 'main', items: [
    { title: 'Trips & Courses', url: `${HOME}/#trips`, children: TRIPS.map(t => ({ title: t.title, url: pageUrl(t.slug) })) },
    { title: 'Our Guides', url: `${HOME}/#guides` },
    { title: 'Learn', url: `${HOME}/#learn` },
    { title: 'Free Resources', url: `${HOME}/#resources` },
    { title: 'Contact', url: `${HOME}/#contact` },
  ] },
  { name: 'footer', items: [
    ['Trip Details', 'https://shastaguides.com/tripdetails'], ['Gear', 'https://shastaguides.com/gear'], ['Training', 'https://shastaguides.com/training'],
    ['FAQ', 'https://shastaguides.com/faq'], ['Articles', 'https://shastaguides.com/articles'], ['Policies', 'https://shastaguides.com/policies'],
    ['Essentials of Eligibility', 'https://shastaguides.com/s/SMG-Essential-Eligibility-Criteria.pdf'], ['Privacy Policy', 'https://shastaguides.com/privacypolicy'],
  ].map(([title, url]) => ({ title, url })) },
];

// ---------------- Bundle ----------------
E.resetIds(1);
const header = headerTemplate();
E.resetIds(2);
const footer = footerTemplate();
E.resetIds(3);
const home = homePage();
const pages = [{ key: 'home', slug: 'home', title: 'Home', front: true, order: 0, elements: home }];
TRIPS.forEach((t, i) => {
  E.resetIds(10 + i);
  pages.push({ key: `trip-${t.slug}`, slug: t.slug, title: t.title, order: i + 1, excerpt: t.lede, elements: tripPage(t) });
});

const bundle = {
  kit: KIT,
  menus,
  templates: [
    { key: 'header', type: 'header', title: 'Site Header', elements: header, conditions: [['include', 'general']] },
    { key: 'footer', type: 'footer', title: 'Site Footer', elements: footer, conditions: [['include', 'general']] },
  ],
  pages,
};

fs.writeFileSync(process.argv[2], JSON.stringify(bundle));
const count = (els) => els.reduce((n, e) => n + 1 + count(e.elements || []), 0);
console.log(`bundle: kit + ${menus.length} menus + 2 templates + ${pages.length} pages (${pages.map(p => `${p.slug}:${count(p.elements)}`).join(', ')})`);
