/* CVI dataset list v1 (F1). Declares every file the CVI profile can use: what it is called, the file name CVI
 * expects, whether it is required, the columns that identify it, the optional columns that switch features on, and
 * a one-line description for the in-app guide. Shapes follow CVI as-is (stable per the owner, 2026-09-30):
 *   master           CVI_Traceability shiny/R/master_loader.R:45-58 (13 required columns, exact names as fread
 *                    reads them); optional columns from the parity inventory N2.
 *   facility layers  map_helpers.R .OVERLAY_REGISTRY_BUILTIN (key, file, name_col) and load_overlay_csv() (any
 *                    lat/latitude/y and long/lon/lng/longitude/x spelling, case-insensitive). CVI tells these
 *                    layers apart by file name only; their columns are generic (owner decision 1A, 2026-10-01).
 *   manifest         map_helpers.R .read_overlay_manifest(): adds layers, or overrides a built-in layer's file.
 * Any CVI schema change updates this file and its tests in the same change.
 *
 * Boundary (audit F1-R3): this list reproduces what CVI needs to RECOGNISE its files, not CVI's whole loaders.
 * Still to match when the maps that use them are built: master type coercion and normalisation (S1 engine does
 * this for the WA map); facility rows need numeric coordinates to be plotted ("found" only means the right
 * columns), display-name fallback, geo_source; manifest label vs live_label, marker shape/colour and filter_cols;
 * R's read.csv type inference (e.g. a numeric-looking key). Differences kept on purpose: the dataset ids "master"
 * and "manifest" cannot be manifest keys; at most 500 manifest layers; CVI's fread also accepts semicolon- or
 * tab-separated master files, which F1 reports as "save it as a comma-separated CSV file".
 *
 * Column specs: a string is an exact column name (after trimming); { anyOf, caseless, label } accepts any of the
 * spellings. Dataset kinds: 'table', 'facility' (identified by file name; columns only show it is a facility
 * layer) and 'manifest' (expanded by expandManifest() into extra facility datasets). */
(function (root) {
  'use strict';
  const LAT = { anyOf: ['lat', 'latitude', 'y'], caseless: true, label: 'latitude column (Lat, Latitude or y)' };
  const LONG = { anyOf: ['long', 'lon', 'lng', 'longitude', 'x'], caseless: true, label: 'longitude column (Long, Lon, Lng, Longitude or x)' };
  const FACILITY_LATER = 'Facilities map and County Focus facility markers (later version)';

  function facility(id, name, file, nameColumn, group, about) {
    return { id, name, file, required: false, kind: 'facility', group, nameColumn, columns: [LAT, LONG],
      useful: [], features: [], later: FACILITY_LATER, about };
  }

  const MASTER_COLUMNS = [
    'Species.Group', 'Reporting.Year', 'Reporting.Quarter', 'Movement', 'Total.Animals',
    'Origin.State', 'Dest.State',
    'Origin.County', 'Origin.County.Lat', 'Origin.County.Long',
    'Dest.County', 'Dest.County.Lat', 'Dest.County.Long'
  ];

  const datasets = [
    { id: 'master', name: 'CVI master table', file: 'CVI_Consolidated_Master.csv', required: true, kind: 'table',
      columns: MASTER_COLUMNS,
      useful: [
        { columns: ['Species'], feature: 'species-refine' },
        { columns: ['CVI'], later: 'Unique CVI counts and certificate numbers in pop-ups (later version)' },
        { columns: ['Origin.Lat', 'Origin.Long', 'Dest.Lat', 'Dest.Long'], later: 'County Focus premises map (later version)' },
        { columns: ['Origin.City', 'Dest.City'], later: 'County Focus premises labels (later version)' },
        { columns: ['farm_entity_id_origin', 'farm_entity_id_dest'], later: 'County Focus premises grouping (later version)' }
      ],
      features: ['wa-map'],
      about: 'One row per animal movement record (CVI), with species, period, direction, head count and the origin and destination counties.' },
    facility('slaughterhouses', 'Packing plants', 'usda_wa_slaughter_facilities.csv', 'USDA.Slaughter.Facility',
      'Processing & Harvest', 'USDA-inspected slaughter and packing facilities, one row per facility with its location.'),
    facility('fairgrounds', 'Fairgrounds', 'wa_state_fairs.csv', 'Fair.Name',
      'Events', 'Fairs and fairgrounds, one row per fair with its location.'),
    facility('markets', 'Livestock markets', 'wa_state_public_livestock_markets.csv', 'name',
      'Markets & Sales', 'Public livestock markets, one row per market with its location.'),
    facility('feedlots', 'Feedlots', 'wa_state_feedlots.csv', 'name',
      'Holding & Feeding', 'Feedlots, one row per feedlot with its location.'),
    facility('restricted', 'Restricted holding facilities', 'wa_state_restricted_holding_facilities.csv', 'NAME',
      'Holding & Feeding', 'Restricted holding facilities, one row per facility with its location.'),
    { id: 'manifest', name: 'Facility layer list (manifest)', file: 'facility_overlays_manifest.csv', required: false,
      kind: 'manifest',
      columns: [{ anyOf: ['key'], caseless: true, label: 'key' }, { anyOf: ['file'], caseless: true, label: 'file' }],
      useful: [], features: [], later: 'Adds more facility layers to the Facilities map (later version)',
      about: 'Optional list of extra facility layers: one row per layer with its file name, label and group.' }
  ];

  const features = [
    { id: 'wa-map', name: 'WA State map', needs: [{ dataset: 'master' }] },
    { id: 'species-refine', name: 'Refine by species', needs: [{ dataset: 'master', columns: ['Species'] }] }
  ];

  /** CVI's .read_overlay_manifest() rules, on rows parsed from the manifest CSV (header row first).
   * Column names are lower-cased and trimmed; blank keys, keys starting with "#", blank files and
   * enabled = false/no/0/f rows are skipped; the text "NA" counts as blank. A key equal to a built-in layer
   * overrides that layer (file, name column, label); other keys add layers in manifest order.
   * Returns { overrides: { id: { file, nameColumn, name, group } }, added: [dataset], skipped: [{ row, reason }] }. */
  const MAX_MANIFEST_LAYERS = 500;

  function expandManifest(rows) {
    const out = { overrides: {}, added: [], skipped: [] }, at = new Map();
    if (!rows.length) return out;
    const head = rows[0].map(h => String(h == null ? '' : h).trim().toLowerCase());
    const col = name => head.indexOf(name);
    const get = (r, name) => {
      const i = col(name); if (i < 0) return '';
      const v = r[i] == null ? '' : String(r[i]).trim();
      return v.toUpperCase() === 'NA' ? '' : v;
    };
    if (col('key') < 0 || col('file') < 0) return out;
    const builtins = new Set(datasets.filter(d => d.kind === 'facility').map(d => d.id));
    const reserved = new Set(datasets.filter(d => d.kind !== 'facility').map(d => d.id));
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const key = get(r, 'key'), file = get(r, 'file');
      if (!key || key.startsWith('#') || !file) continue;
      const en = get(r, 'enabled').toLowerCase();
      if (en && ['false', 'no', '0', 'f'].includes(en)) continue;
      if (reserved.has(key)) { out.skipped.push({ row: i + 1, reason: `the key "${key}" is reserved` }); continue; }
      const label = get(r, 'label') || key;
      const spec = { file, nameColumn: get(r, 'name_col') || 'name', name: get(r, 'live_label') || label,
        group: get(r, 'group') || 'Other' };
      if (builtins.has(key)) { out.overrides[key] = spec; continue; }
      const ds = Object.assign(facility(key, spec.name, file, spec.nameColumn, spec.group,
        'Extra facility layer listed in the manifest.'), { fromManifest: true });
      if (at.has(key)) { out.added[at.get(key)] = ds; continue; }   // a repeated key replaces the earlier row, as in CVI
      if (out.added.length >= MAX_MANIFEST_LAYERS) { out.skipped.push({ row: i + 1, reason: `more than ${MAX_MANIFEST_LAYERS} layers; the rest were not added` }); break; }
      at.set(key, out.added.length); out.added.push(ds);
    }
    return out;
  }

  root.WSDA = root.WSDA || {};
  root.WSDA.profiles = root.WSDA.profiles || {};
  root.WSDA.profiles.cvi = {
    id: 'cvi', name: 'CVI Traceability', version: 1, datasets, features, expandManifest
  };
})(typeof window !== 'undefined' ? window : globalThis);
