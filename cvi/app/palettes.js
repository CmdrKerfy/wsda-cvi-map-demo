/* WA State direction palettes: values from CVI shiny/R/map_helpers.R DIRECTION_PALETTES. */
(function (root) {
  'use strict';
  const DIRECTION_PALETTES = {
    'WSDA Default': { Inbound: '#1C9CD9', Outbound: '#F0A06E' },
    'WSDA Brand': { Inbound: '#1c5a83', Outbound: '#ee7e2c' },
    'Print Friendly': { Inbound: '#003F5C', Outbound: '#F4A261' },
    'High Contrast': { Inbound: '#0033A0', Outbound: '#D62728' },
    'Single — WSDA Blue': { Inbound: '#1c5a83', Outbound: '#1c5a83' },
    'Single — WSDA Teal': { Inbound: '#245566', Outbound: '#245566' },
    'Single — WSDA Orange': { Inbound: '#ee7e2c', Outbound: '#ee7e2c' },
    'Single — Slate Gray': { Inbound: '#555555', Outbound: '#555555' }
  };
  // .build_county_map: colour = palette[direction]; anything not in the palette (the "Total" circle) -> #245566.
  // The legend falls back to its own fixed swatches for missing palette entries (mod_maps.R map_legend_ui).
  const LEGEND_FALLBACK = { Inbound: '#1C9CD9', Outbound: '#F0A06E', Total: '#245566' };
  function circleColor(paletteName, direction) {
    const p = DIRECTION_PALETTES[paletteName] || DIRECTION_PALETTES['WSDA Default'];
    return p[direction] || '#245566';
  }
  function legendColor(paletteName, direction) {
    const p = DIRECTION_PALETTES[paletteName] || DIRECTION_PALETTES['WSDA Default'];
    return p[direction] || LEGEND_FALLBACK[direction] || '#888888';
  }
  root.CVIWA = root.CVIWA || {};
  root.CVIWA.palettes = { DIRECTION_PALETTES, circleColor, legendColor };
})(typeof window !== 'undefined' ? window : globalThis);
