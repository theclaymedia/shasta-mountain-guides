// Helpers that produce Elementor (classic, container-based) element data.
// Value formats follow Elementor 4.3: sliders {unit,size}, dimensions {unit,top,...},
// gaps {column,row,isLinked,unit}, typography group keys prefixed with the group name.
const crypto = require('crypto');

let counter = 0;
const id = () => crypto.createHash('md5').update(`smg-${counter++}`).digest('hex').slice(0, 7);
const resetIds = (seed) => { counter = 0; if (seed) counter = seed * 10000; };

const px = (size, unit = 'px') => ({ unit, size, sizes: [] });
const box = (t, r = t, b = t, l = r, unit = 'px') => ({ unit, top: String(t), right: String(r), bottom: String(b), left: String(l), isLinked: t === r && r === b && b === l });
const gap = (n, unit = 'px') => ({ column: String(n), row: String(n), isLinked: true, unit, size: n });
const gap2 = (row, col, unit = 'px') => ({ column: String(col), row: String(row), isLinked: false, unit });

// Global references into the kit (see build-site.js KIT).
const C = (key) => `globals/colors?id=${key}`;
const T = (key) => `globals/typography?id=${key}`;

// Responsive helper: res('padding', d, t, m) → { padding, padding_tablet, padding_mobile }
function res(key, desktop, tablet, mobile) {
  const o = {};
  if (desktop !== undefined) o[key] = desktop;
  if (tablet !== undefined) o[`${key}_tablet`] = tablet;
  if (mobile !== undefined) o[`${key}_mobile`] = mobile;
  return o;
}

// Typography group settings for a widget. prefix: 'typography', 'button_typography', etc.
function type(prefix, t) {
  const o = { [`${prefix}_typography`]: 'custom' };
  const map = { family: 'font_family', weight: 'font_weight', size: 'font_size', line: 'line_height', transform: 'text_transform', spacing: 'letter_spacing', style: 'font_style' };
  for (const [k, v] of Object.entries(t)) {
    if (k === 'sizeT') o[`${prefix}_font_size_tablet`] = v;
    else if (k === 'sizeM') o[`${prefix}_font_size_mobile`] = v;
    else if (map[k]) o[`${prefix}_${map[k]}`] = v;
  }
  return o;
}

function merge(...parts) {
  const out = {};
  for (const p of parts) {
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      if (k === '__globals__') out.__globals__ = Object.assign({}, out.__globals__, v);
      else out[k] = v;
    }
  }
  return out;
}

function container(settings, children = [], isInner = true) {
  return { id: id(), elType: 'container', isInner, settings: merge({ content_width: 'full' }, settings), elements: children.filter(Boolean) };
}
// Top-level section: full-width band with a boxed (max 1280) inner container.
function section(outer, inner, children) {
  return container(merge({ content_width: 'full', ...res('padding', box(88, 0), box(72, 0), box(56, 0)) }, outer), [
    container(merge({ content_width: 'boxed', boxed_width: px(1280), flex_direction: 'column', ...res('padding', box(0, 64), box(0, 32), box(0, 18)) }, inner), children),
  ], false);
}
function widget(widgetType, settings) {
  return { id: id(), elType: 'widget', widgetType, isInner: false, settings: merge(settings), elements: [] };
}

// ---- Common widgets ----
const heading = (title, tag, s) => widget('heading', merge({ title, header_size: tag }, s));
const text = (html, s) => widget('text-editor', merge({ editor: html }, s));
const html = (code) => widget('html', { html: code });
const button = (label, url, s) => widget('button', merge({ text: label, link: { url, is_external: '', nofollow: '' } }, s));
const image = (media, s) => widget('image', merge({ image: { id: media.id, url: media.url }, image_size: 'full' }, s));

module.exports = { id, resetIds, px, box, gap, gap2, C, T, res, type, merge, container, section, widget, heading, text, html, button, image };
