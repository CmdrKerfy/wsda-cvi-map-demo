/* Page wiring for the S1 WA State map: master file activation, filters (F1-F4), style controls (S1a-S1c, S1h),
 * 250 ms debounce (F9), legend (M15) and status/no-match messages (M17). Defaults follow mod_maps.R.
 * Data-loading foundation (F1 day 4): controls whose data is missing are greyed with the reason (shared feature
 * gating, CVI dataset list), and a master table handed over by the landing page (WSDA.load.handoff) is loaded
 * exactly as if it had been chosen here; its bundle.json banner is shown. */
(function (root) {
  'use strict';
  const W = root.CVIWA, doc = root.document;
  const $ = id => doc.getElementById(id);
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
  const st = {
    master: null, loading: false, species: [], speciesSub: [], years: [], quarters: QUARTERS.slice(),
    direction: ['Inbound', 'Outbound'], mode: 'side_by_side', scaling: 'log', nBins: 5, opacity: '0.6', palette: 'WSDA Default',
    labels: true, lines: false, data: [], amounts: [], liveTooltips: [], legend: null, version: 0, lastMessage: null
  };
  W.state = st;   // read-only test hook (tests/browser/run_s1_browser.js)

  let mapSt = null, mapFailed = false;
  $('attrib').textContent = root.CVIWA_GEO.attribution + ' (2023 cartographic boundary file) · Map engine: MapLibre GL JS 5.22.0';

  // ---- generic checklist with All / Clear ------------------------------------------------------------------------
  function renderChecklist(el, choices, selected, onChange) {
    el.textContent = '';
    choices.forEach(c => {
      const lab = doc.createElement('label'), cb = doc.createElement('input');
      cb.type = 'checkbox'; cb.value = String(c); cb.checked = selected.map(String).indexOf(String(c)) >= 0;
      cb.addEventListener('change', () => onChange([...el.querySelectorAll('input:checked')].map(x => x.value)));
      lab.appendChild(cb); lab.appendChild(doc.createTextNode(' ' + c)); el.appendChild(lab);
    });
  }
  const lists = {
    species: { el: () => $('f-species'), choices: () => st.master ? st.master.speciesChoices : [], set: v => { st.species = v; refreshSub(); } },
    years: { el: () => $('f-years'), choices: () => st.master ? st.master.yearChoices : [], set: v => { st.years = v.map(Number); } },
    quarters: { el: () => $('f-quarters'), choices: () => QUARTERS, set: v => { st.quarters = v; } }
  };
  function renderList(key) {
    const L = lists[key], sel = key === 'species' ? st.species : key === 'years' ? st.years : st.quarters;
    renderChecklist(L.el(), L.choices(), sel, v => { L.set(v); schedule(); });
  }
  doc.querySelectorAll('[data-all]').forEach(b => b.addEventListener('click', () => {
    const k = b.getAttribute('data-all'); lists[k].set(lists[k].choices().slice()); renderList(k); schedule();
  }));
  doc.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
    const k = b.getAttribute('data-clear'); lists[k].set([]); renderList(k); schedule();
  }));

  // "Refine by species": raw Species within the selected group(s); keep still-valid picks (mod_maps.R:3441-3457).
  function refreshSub() {
    const m = st.master;
    let choices = [];
    if (m && m.hasSpecies) {
      const g = new Set(st.species);
      choices = [...new Set(m.rows.filter(r => g.has(r['Species.Group'])).map(r => r.Species).filter(s => s !== null && s !== ''))].sort(W.master.collate);
    }
    st.speciesSub = st.speciesSub.filter(s => choices.indexOf(s) >= 0);
    renderChecklist($('f-species-sub'), choices, st.speciesSub, v => { st.speciesSub = v; schedule(); });
  }

  // ---- master activation ---------------------------------------------------------------------------------------
  function setStatus(cls, text) { const el = $('master-status'); el.className = 'status ' + cls; el.textContent = text; }
  let activeReader = null, loadVersion = 0;
  function clearMaster() {
    st.master = null; st.species = []; st.speciesSub = []; st.years = [];
    st.lastMessage = null; $('toast').textContent = '';
    renderAll();
    if (timer) root.clearTimeout(timer);
    recompute();
  }
  $('file-input').addEventListener('change', ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    // Clearing the input permits retrying the same file after a read failure.
    ev.target.value = '';
    showBanner(null);                 // a file chosen here is not the handed-over bundle
    loadFile(f);
  });
  // A load superseded by a newer one (a file chosen here) still answers the landing page, once (audit E-02).
  const SUPERSEDED = 'a file was chosen on the map page while yours were on their way, and that file is kept. Click "Open the CVI map" to send yours again.';
  function loadFile(f, reply) {          // reply({ ok, message }): only for files handed over by the landing page
    let replied = false;
    const done = reply && (r => { if (!replied) { replied = true; reply(r); } });
    const request = ++loadVersion, previousSpecies = st.species.slice(), previousSub = st.speciesSub.slice();
    if (activeReader && activeReader.readyState === 1) activeReader.abort();
    activeReader = null;
    st.loading = true;
    clearMaster();
    setStatus('info', 'Loading ' + f.name + '… Previous dataset cleared.');
    const reader = new root.FileReader();
    activeReader = reader;
    const current = () => request === loadVersion && activeReader === reader;
    const fail = message => {
      if (!current()) { if (done) done({ ok: false, message: SUPERSEDED }); return; }
      activeReader = null; st.loading = false;
      clearMaster();
      setStatus('err', 'Master dataset failed to load (' + f.name + '). ' + message + ' No dataset is active. Choose a CSV to retry.');
      if (done) done({ ok: false, message });
    };
    reader.onerror = () => fail('The file could not be read.');
    reader.onabort = () => fail('Reading was cancelled.');
    reader.onload = () => {
      if (!current()) { if (done) done({ ok: false, message: SUPERSEDED }); return; }
      let m;
      try { m = W.master.load(String(reader.result)); } catch (e) { m = { ok: false, error: e.message }; }
      if (!m.ok) { fail(m.error); return; }
      activeReader = null; st.loading = false;
      const keep = (cur, all) => { const k = cur.filter(x => all.indexOf(x) >= 0); return k.length ? k : all.slice(); };
      st.species = keep(previousSpecies, m.speciesChoices);
      st.speciesSub = previousSub;
      st.master = m;
      st.years = m.yearChoices.slice();
      setStatus('ok', 'Master loaded (' + f.name + '): ' + m.physicalRows.toLocaleString('en-US') + ' rows in the file; ' +
        m.mapRows.toLocaleString('en-US') + ' map rows (each WA-to-WA record is drawn as one inbound and one outbound row).');
      renderAll(); schedule(0);
      if (done) done({ ok: true, message: '' });
    };
    try { reader.readAsText(f); } catch (e) { fail('The file could not be read.'); }
  }
  function renderAll() { renderList('species'); renderList('years'); renderList('quarters'); refreshSub(); gateControls(); }

  // ---- F1: feature gating and files handed over by the landing page ---------------------------------------------
  const F = root.WSDA;
  function gateControls() {
    const m = st.master;
    const result = { datasets: m ? [{ id: 'master', status: 'found', header: m.header }] : [] };
    st.features = F.checklist.gate(result, F.profiles.cvi);
    F.checklist.applyGates(doc, st.features);
  }
  function showBanner(text) { const b = $('bundle-banner'); b.textContent = text || ''; b.hidden = !text; }
  // Files arriving after the user chose a file on this page are not used: the newer choice, its status and its banner
  // stay (audit E-02: a slow read on the landing page could otherwise replace it, or report a failure over it).
  const askedAt = loadVersion;
  F.load.handoff.receive('cvi', (d, reply) => {
    const m = d.datasets && d.datasets.master;
    st.received = { datasets: Object.keys(d.datasets || {}), banner: d.banner || null };   // test hook
    if (loadVersion !== askedAt) {    // a read failure there was already reported there; otherwise say why nothing loaded
      st.received.superseded = true;
      if (!d.error) reply({ ok: false, message: SUPERSEDED });
      return;
    }
    if (d.error) {                    // the landing page could not read the files (audit D4-02)
      st.received.error = String(d.error);
      showBanner(null);
      setStatus('err', 'Your files could not be sent from the landing page: ' + d.error + ' No dataset is active. Load your files again there and click "Open the CVI map", or choose a CSV here.');
      return;
    }
    showBanner(typeof d.banner === 'string' ? d.banner : null);
    if (m && m.file instanceof root.Blob) loadFile(m.file, reply);
    else reply({ ok: false, message: 'No CVI master table was sent.' });
  });

  // ---- other controls ------------------------------------------------------------------------------------------
  doc.querySelectorAll('input[name=direction]').forEach(cb => cb.addEventListener('change', () => {
    st.direction = [...doc.querySelectorAll('input[name=direction]:checked')].map(x => x.value); schedule();
  }));
  doc.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { st.mode = r.value; schedule(); }));
  $('s-scaling').addEventListener('change', e => { st.scaling = e.target.value; $('bins-field').hidden = !(st.scaling === 'quantile' || st.scaling === 'natural'); schedule(); });
  $('s-bins').addEventListener('change', e => { st.nBins = Number(e.target.value); schedule(); });
  $('s-opacity').addEventListener('change', e => { st.opacity = e.target.value; schedule(); });
  const pal = $('s-palette');
  Object.keys(W.palettes.DIRECTION_PALETTES).forEach(n => { const o = doc.createElement('option'); o.value = n; o.textContent = n; o.selected = n === st.palette; pal.appendChild(o); });
  pal.addEventListener('change', e => { st.palette = e.target.value; schedule(); });
  $('s-labels').addEventListener('change', e => { st.labels = e.target.checked; if (mapSt && !mapFailed) W.map.setLabels(mapSt, st.labels); });
  $('s-lines').addEventListener('change', e => { st.lines = e.target.checked; if (mapSt && !mapFailed) W.map.setLines(mapSt, st.lines); });
  $('fit-wa').addEventListener('click', () => { if (mapSt && !mapFailed) W.map.fitWashington(mapSt); });
  $('legend-toggle').addEventListener('click', () => {
    const p = $('legend-panel'), open = p.hidden; p.hidden = !open;
    const b = $('legend-toggle'); b.innerHTML = open ? 'Legend &#9650;' : 'Legend &#9660;'; b.setAttribute('aria-expanded', String(open));
  });

  // ---- recompute (debounced 250 ms) ----------------------------------------------------------------------------
  let timer = null;
  function schedule(ms) { if (timer) root.clearTimeout(timer); timer = root.setTimeout(recompute, ms === undefined ? 250 : ms); }
  function toast(msg) {
    st.lastMessage = msg;
    const box = $('toast'), d = doc.createElement('div'); d.setAttribute('role', 'status'); d.textContent = msg; box.appendChild(d);
    root.setTimeout(() => d.remove(), 4000);
  }
  function recompute() {
    timer = null;
    let d = [];
    // req(): every filter must have at least one value, otherwise nothing is drawn (and no message).
    if (st.master && st.species.length && st.quarters.length && st.direction.length && st.years.length) {
      d = W.aggregate.build(st.master.rows, { species: st.species, years: st.years, quarters: st.quarters, direction: st.direction,
        mode: st.mode, scaling: st.scaling, nBins: st.nBins, rawSpecies: st.speciesSub, hasSpecies: st.master.hasSpecies });
      if (!d.length) toast('No records match current county map filters.');
    }
    st.data = d;
    st.amounts = W.scaling.formatR(d.map(r => W.scaling.rRound(r.total_animals)));
    st.liveTooltips = W.aggregate.liveTooltips(d);
    if (mapSt && !mapFailed) {
      W.map.draw(mapSt, d, { palette: st.palette, opacity: st.opacity, amounts: st.amounts });
      W.map.setLabels(mapSt, st.labels); W.map.setLines(mapSt, st.lines);
    }
    renderLegend(d);
    st.version++;
  }

  // ---- legend (mod_maps.R map_legend_ui, county branch) ----------------------------------------------------------
  function renderLegend(d) {
    const p = $('legend-panel'); p.textContent = '';
    if (!d.length) { const em = doc.createElement('em'); em.textContent = 'No data loaded'; p.appendChild(em); st.legend = null; return; }
    const head = t => { const h = doc.createElement('div'); h.style.marginBottom = '4px'; const s = doc.createElement('strong'); s.textContent = t; h.appendChild(s); return h; };
    p.appendChild(head('Direction'));
    const present = new Set(d.map(r => r.direction));
    const dirs = ['Inbound', 'Outbound', 'Total'].filter(x => present.has(x));
    const swatches = dirs.map(x => {
      const row = doc.createElement('div'); row.className = 'lg-row';
      const dot = doc.createElement('span'); dot.className = 'lg-dot'; dot.style.width = dot.style.height = '14px';
      dot.style.background = W.palettes.legendColor(st.palette, x);
      const t = doc.createElement('span'); t.textContent = x; row.appendChild(dot); row.appendChild(t); p.appendChild(row);
      return { direction: x, color: W.palettes.legendColor(st.palette, x) };
    });
    const tiers = W.scaling.legendTiers(d.map(r => r.total_animals), st.scaling, st.nBins);
    const sizes = [];
    if (tiers) {
      p.appendChild(doc.createElement('hr')).style.margin = '6px 0';
      p.appendChild(head('Circle size'));
      tiers.values.forEach((v, i) => {
        const r = Math.min(tiers.radii[i], 20), px = Math.ceil(r * 2);
        const row = doc.createElement('div'); row.className = 'lg-row'; row.style.marginBottom = '3px';
        const dot = doc.createElement('span'); dot.className = 'lg-dot'; dot.style.width = dot.style.height = px + 'px'; dot.style.background = '#888';
        const t = doc.createElement('span'); t.style.fontSize = '0.75em'; t.textContent = W.scaling.comma(v);
        row.appendChild(dot); row.appendChild(t); p.appendChild(row);
        sizes.push({ label: t.textContent, diameter_px: px });
      });
      if (st.direction.length > 1 && st.mode !== 'total') {
        const n = doc.createElement('div'); n.style.cssText = 'font-size:0.72em;color:#777;margin-top:4px;font-style:italic;';
        n.textContent = 'Sizes scaled per direction'; p.appendChild(n);
      }
    }
    st.legend = { swatches, sizes, tiers };
  }

  // Wire the page before starting WebGL, so a renderer failure cannot disable file handling.
  function mapError() {
    mapFailed = true;
    const box = $('map-status'); box.hidden = false; box.className = 'status err';
    box.textContent = 'Map unavailable. Chrome could not start or continue drawing the map. Reload this page to retry. If it still fails, report your browser version and whether this is a managed work device.';
    $('map').style.visibility = 'hidden';
    $('legend-panel').hidden = true;
    $('legend-toggle').setAttribute('aria-expanded', 'false');
    ['fit-wa', 'legend-toggle', 's-labels', 's-lines'].forEach(id => { $(id).disabled = true; });
  }
  try {
    mapSt = W.map.create($('map'), root.CVIWA_GEO, () => {
      if (!mapFailed) { $('map-status').hidden = true; schedule(0); }
    }, mapError);
    st.mapHandle = mapSt;   // test hook: MapLibre instance for rendered-feature checks
  } catch (e) { mapError(); }
  renderAll();
})(window);
