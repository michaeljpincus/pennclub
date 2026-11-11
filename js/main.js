import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.12.0/dist/maplibre-gl.mjs';

const map = new maplibregl.Map({
  container: 'map',
  minZoom: 10,
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: [-73.9795, 40.7555], 
  zoom: 13
});
window.map = map;
map.addControl(new maplibregl.NavigationControl(), 'top-right');

const attrib = document.querySelector('.maplibregl-ctrl-attrib');
    attrib?.classList.remove('maplibregl-compact-show');
    attrib?.removeAttribute('open');

// ---------- helpers ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const hasLocation = (f) => {
  const c = f.geometry && f.geometry.coordinates;
  return Array.isArray(c) && c.length >= 2 &&
    Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
    !(c[0] === 0 && c[1] === 0);
};


const dateLabel = (p) => {
  const m = String(p.start_date || '').match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!m) return '';
  const precision = String(p.date_precision || '').toLowerCase();
  if (precision.startsWith('year') || !m[2]) return m[1];
  return `${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}`;
};

const fullAddress = (p) =>
  [p.address, p.city, p.state].filter((s) => s && String(s).trim()).join(', ');

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

// ---------- load data ----------
const [geojson] = await Promise.all([
  fetch('places.geojson').then((r) => r.json()),
  new Promise((resolve) => map.on('load', resolve))
]);

// One slider step per event, in chronological order. Each step shows exactly
// one dot, so overlapping or back-to-back date ranges can never stack up.
const events = [...geojson.features].sort((a, b) =>
  String(a.properties.start_date).localeCompare(String(b.properties.start_date)) ||
  (a.properties.id - b.properties.id)
);

// "home" view for the no-location event = middle of the located points
const coords = events.filter(hasLocation).map((f) => f.geometry.coordinates);
const homeCenter = coords.length
  ? [
      coords.reduce((s, c) => s + c[0], 0) / coords.length,
      coords.reduce((s, c) => s + c[1], 0) / coords.length
    ]
  : map.getCenter().toArray();
map.jumpTo({ center: homeCenter, zoom: 13 });

// ---------- map layer (a single dot) ----------
const EMPTY = { type: 'FeatureCollection', features: [] };
map.addSource('current', { type: 'geojson', data: EMPTY });
map.addLayer({
  id: 'current-point',
  type: 'circle',
  source: 'current',
  paint: {
    'circle-radius': 9,
    'circle-color': '#aa1e22',
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2.5
  }
});

// ---------- tooltip (popup) ----------
const popupContent = (p) => {
  const wrap = el('div');
  const addr = fullAddress(p);
  if (addr) wrap.append(el('div', 'popup-address', addr));
  wrap.append(el('div', 'popup-title', p.title || ''));
  if (p.description) wrap.append(el('div', 'popup-desc', p.description));
  return wrap;
};

let popup = null;
const showPopup = (f) => {
  if (popup) popup.remove();
  popup = new maplibregl.Popup({ offset: 14, maxWidth: '300px' })
    .setLngLat(f.geometry.coordinates)
    .setDOMContent(popupContent(f.properties))
    .addTo(map);
};

let current = null;
map.on('click', 'current-point', () => current && showPopup(current));
map.on('mouseenter', 'current-point', () => (map.getCanvas().style.cursor = 'pointer'));
map.on('mouseleave', 'current-point', () => (map.getCanvas().style.cursor = ''));

// ---------- slider UI ----------
const slider = document.getElementById('slider');
const yearEl = document.getElementById('year');
const noteEl = document.getElementById('center-note');

slider.min = 0;
slider.max = events.length - 1;
slider.step = 1;
slider.value = 0;
document.getElementById('min-label').textContent = dateLabel(events[0].properties);
document.getElementById('max-label').textContent = dateLabel(events[events.length - 1].properties);

const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

function update(i) {
  const f = events[i];
  const p = f.properties;
  current = f;
  slider.value = i;
  prevBtn.disabled = i <= 0;
  nextBtn.disabled = i >= events.length - 1;
  yearEl.textContent = dateLabel(p);

  if (popup) { popup.remove(); popup = null; }
  noteEl.replaceChildren();
  noteEl.hidden = true;

  if (hasLocation(f)) {
    map.getSource('current').setData({ type: 'FeatureCollection', features: [f] });
    map.easeTo({ center: f.geometry.coordinates, zoom: 15, duration: 700 });
    showPopup(f); // address + title + description live in the tooltip
  } else {
    // edge case: no location -> no dot, centered text popup
    map.getSource('current').setData(EMPTY);
    map.easeTo({ center: homeCenter, zoom: 13, duration: 700 });
    const note = el('div', 'note');
    note.append(el('div', 'note-title', p.title || ''));
    if (p.description) note.append(el('div', 'note-desc', p.description));
    noteEl.append(note);
    noteEl.hidden = false;
  }
}

slider.addEventListener('input', () => update(Number(slider.value)));
prevBtn.addEventListener('click', () => update(Math.max(0, Number(slider.value) - 1)));
nextBtn.addEventListener('click', () => update(Math.min(events.length - 1, Number(slider.value) + 1)));
update(0);