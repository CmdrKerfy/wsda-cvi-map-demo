/* Master load + normalization: port of CVI shiny/R/master_loader.R load_master_csv() (inventory N1-N5, N7).
 * Rows become objects keyed by the original header names. Missing values are null. */
(function (root) {
  'use strict';
  const REQUIRED = ['Species.Group', 'Reporting.Year', 'Reporting.Quarter', 'Movement', 'Total.Animals',
    'Origin.State', 'Dest.State', 'Origin.County', 'Origin.County.Lat', 'Origin.County.Long',
    'Dest.County', 'Dest.County.Lat', 'Dest.County.Long'];
  const NUMERIC = ['Origin.County.Lat', 'Origin.County.Long', 'Dest.County.Lat', 'Dest.County.Long'];

  // R as.numeric() on a character value: surrounding white space allowed; decimal/exponent/hex/Inf forms; else NA.
  function asNumeric(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isNaN(v) ? null : v;
    const s = String(v).trim();
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return Number(s);
    if (/^[+-]?0[xX][0-9a-fA-F]+$/.test(s)) return (s[0] === '-' ? -1 : 1) * parseInt(s.replace(/^[+-]/, ''), 16);
    if (/^[+-]?(inf|infinity)$/i.test(s)) return s[0] === '-' ? -Infinity : Infinity;
    return null;
  }
  // R as.integer(): as.numeric then truncation toward zero (|x| >= 2^31 -> NA).
  function asInteger(v) { const x = asNumeric(v); if (x === null || !Number.isFinite(x) || Math.abs(x) >= 2147483648) return null; return Math.trunc(x); }

  function normalizeMovement(m) {
    if (m === null) return null;
    const t = m.trim().toLowerCase();
    if (t === 'import' || t === 'imports' || t === 'inbound') return 'Inbound';
    if (t === 'export' || t === 'exports' || t === 'outbound') return 'Outbound';
    if (t === 'intrastate') return 'Intrastate';
    return m;
  }
  const stripCounty = c => c === null ? null : c.replace(/\s+County$/i, '');

  function load(text) {
    const parsed = root.CVIWA.csv.parse(text);
    const header = parsed.header;
    const missing = REQUIRED.filter(c => header.indexOf(c) < 0);
    if (missing.length) {
      return { ok: false, error: 'Master CSV missing columns: ' + missing.join(', ') + '. Re-run Steps 3-5 on this data first.' };
    }
    const physical = parsed.rows.length;
    let nonNumericAnimals = 0;
    const base = parsed.rows.map(r => {
      const o = {};
      header.forEach((h, k) => { o[h] = r[k] === undefined ? null : r[k]; });
      o['Reporting.Year'] = asInteger(o['Reporting.Year']);
      const rawAnimals = o['Total.Animals'];
      o['Total.Animals'] = asNumeric(rawAnimals);
      if (o['Total.Animals'] === null) nonNumericAnimals++;
      const q = o['Reporting.Quarter'];
      o['Reporting.Quarter'] = q !== null && /^[1-4]$/.test(q) ? 'Q' + q : q;
      o.Movement = normalizeMovement(o.Movement);
      NUMERIC.forEach(c => { o[c] = asNumeric(o[c]); });
      o['Origin.County'] = stripCounty(o['Origin.County']);
      o['Dest.County'] = stripCounty(o['Dest.County']);
      return o;
    });
    // Intrastate (WA->WA) rows count as BOTH inbound (at destination) and outbound (at origin): rbind order is
    // non-intrastate rows, then the Inbound copies, then the Outbound copies (master_loader.R).
    const intra = base.filter(o => o.Movement === 'Intrastate');
    const rows = base.filter(o => o.Movement !== 'Intrastate')
      .concat(intra.map(o => Object.assign({}, o, { Movement: 'Inbound' })))
      .concat(intra.map(o => Object.assign({}, o, { Movement: 'Outbound' })));
    const species = [...new Set(rows.map(o => o['Species.Group']).filter(s => s !== null && s !== ''))].sort(collate);
    const years = [...new Set(rows.map(o => o['Reporting.Year']).filter(y => y !== null))].sort((a, b) => a - b);
    return { ok: true, rows, header, hasSpecies: header.indexOf('Species') >= 0,
      physicalRows: physical, mapRows: rows.length, intrastateRows: intra.length,
      missingAnimalCells: nonNumericAnimals, speciesChoices: species, yearChoices: years };
  }
  const collate = (a, b) => a.localeCompare(b, 'en');
  root.CVIWA = root.CVIWA || {};
  root.CVIWA.master = { load, asNumeric, asInteger, normalizeMovement, REQUIRED, collate };
})(typeof window !== 'undefined' ? window : globalThis);
