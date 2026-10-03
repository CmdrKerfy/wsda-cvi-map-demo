/* MapLibre rendering of the WA State map, after CVI shiny/modules/mod_maps.R .build_county_map().
 * Labels are HTML markers so no glyph files are fetched (offline, file://). */
(function (root) {
  'use strict';
  const WA_VIEW_BOUNDS = [-124.90, 45.40, -116.85, 49.05];   // .WA_VIEW_BOUNDS
  const WA_BBOX = [-125.20, 45.30, -116.50, 49.20];          // .WA_BBOX (Fit to Washington)
  const LABEL_MIN_ZOOM = 5;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function create(container, geo, onReady, onError) {
    const map = new root.maplibregl.Map({
      container,
      style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f8f9fa' } }] },
      bounds: WA_VIEW_BOUNDS, fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true, customAttribution: geo.attribution }
    });
    const st = { map, labels: [], labelsVisible: true, hoverId: null, opacity: 0.6, ready: false, pending: null };
    const fail = () => { st.failed = true; if (onError) onError(); };
    map.on('error', fail);
    map.on('webglcontextlost', fail);
    map.addControl(new root.maplibregl.NavigationControl(), 'top-left');
    map.on('load', () => {
      if (st.failed) return;
      try {
        map.addSource('wa_land_source', { type: 'geojson', data: geo.counties });
        // Stand-in for the basemap's land colour (no tiles in S1).
        map.addLayer({ id: 'wa-land', type: 'fill', source: 'wa_land_source', paint: { 'fill-color': '#ececec', 'fill-opacity': 1 } });
        map.addLayer({ id: 'county-lines', type: 'line', source: 'wa_land_source', layout: { visibility: 'none' },
          paint: { 'line-color': '#8a8a8a', 'line-width': 0.8, 'line-opacity': 0.7 } });
        map.addSource('circles_source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'circles', type: 'circle', source: 'circles_source', paint: {
          'circle-color': ['get', 'color'], 'circle-radius': ['get', 'radius_px'], 'circle-opacity': 0.6,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-stroke-opacity': 1.0 } });
        geo.labels.forEach(l => {
          const el = document.createElement('div'); el.className = 'county-label'; el.textContent = l.name;
          st.labels.push(new root.maplibregl.Marker({ element: el }).setLngLat([l.lon, l.lat]).addTo(map));
        });
        const popup = new root.maplibregl.Popup({ closeButton: false, closeOnClick: false });
        st.clearHover = () => {
          map.getCanvas().style.cursor = '';
          if (st.hoverId !== null) map.setFeatureState({ source: 'circles_source', id: st.hoverId }, { hover: false });
          st.hoverId = null; popup.remove();
        };
        map.on('mousemove', 'circles', e => {
          if (!e.features.length) return;
          map.getCanvas().style.cursor = 'pointer';
          const f = e.features[0];
          if (st.hoverId !== null && st.hoverId !== f.id) map.setFeatureState({ source: 'circles_source', id: st.hoverId }, { hover: false });
          st.hoverId = f.id; map.setFeatureState({ source: 'circles_source', id: f.id }, { hover: true });
          const p = f.properties;
          popup.setLngLat(e.lngLat).setHTML('<strong>' + esc(p.county) + '</strong><br/>' + esc(p.direction) + ': ' + esc(p.amount) + ' animals').addTo(map);
        });
        map.on('mouseleave', 'circles', st.clearHover);
        map.on('zoom', () => applyLabelVisibility(st));
        st.ready = true;
        if (st.pending) { const p = st.pending; st.pending = null; draw(st, p.d, p.opts); }
        if (onReady) onReady(st);
      } catch (e) { fail(); }
    });
    return st;
  }

  function applyLabelVisibility(st) {
    const show = st.labelsVisible && st.map.getZoom() >= LABEL_MIN_ZOOM;
    st.labels.forEach(m => m.getElement().classList.toggle('hidden', !show));
  }

  // d: circle rows from aggregate.build(); opts: { palette, opacity, amounts (formatR strings, one per row) }
  function draw(st, d, opts) {
    if (st.failed) return;
    if (!st.ready) { st.pending = { d, opts }; return; }
    st.clearHover();
    const P = root.CVIWA.palettes, op = Number(opts.opacity);
    // Largest circles first (drawn underneath); stable for ties, like R's order(-radius_px).
    const idx = d.map((r, i) => i).sort((a, b) => d[b].radius_px - d[a].radius_px || a - b);
    const features = idx.map((i, k) => {
      const r = d[i], amount = opts.amounts[i];   // same padded format() string as the live tooltip
      return { type: 'Feature', id: k + 1, geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
        properties: { county: r.county, direction: r.direction, amount, color: P.circleColor(opts.palette, r.direction), radius_px: r.radius_px } };
    });
    st.map.getSource('circles_source').setData({ type: 'FeatureCollection', features });
    st.map.setPaintProperty('circles', 'circle-opacity', ['case', ['boolean', ['feature-state', 'hover'], false], Math.min(1, op + 0.25), op]);
    st.drawn = features;
  }

  function setLabels(st, visible) { st.labelsVisible = !!visible; if (st.ready) applyLabelVisibility(st); }
  function setLines(st, visible) { if (st.ready) st.map.setLayoutProperty('county-lines', 'visibility', visible ? 'visible' : 'none'); }

  // .fit_to_bbox(): centre of the box, zoom = 6.7 + log2(9 / span), clamped to [3, 12], then fly there.
  function fitWashington(st) {
    const b = WA_BBOX, ctr = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    const span = Math.max(b[2] - b[0], b[3] - b[1], 0.05);
    const zoom = Math.max(3, Math.min(12, 6.7 + Math.log2(9 / span)));
    st.map.flyTo({ center: ctr, zoom });
  }

  root.CVIWA = root.CVIWA || {};
  root.CVIWA.map = { create, draw, setLabels, setLines, fitWashington, WA_VIEW_BOUNDS, WA_BBOX };
})(typeof window !== 'undefined' ? window : globalThis);
