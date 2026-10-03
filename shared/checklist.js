/* Data checklist panel and feature gating (F1). Shows, for one profile, which datasets were found in the user's
 * files, which are missing, which file feeds which dataset, and which features that switches on or off, with a
 * plain reason for everything that is off or not used. Two choices are made in the panel and recognition is run
 * again (recognise.js, header rows only):
 *   - conflict chooser: two files claim one dataset -> "Which file is the …?" (choices: dataset id -> file id);
 *   - "which layer is this file?" picker (owner scope addition 2026-10-01): for a file recognisable only as "a
 *     facility layer", the layers it could be (assign: file id -> dataset id). The user's pick outranks bundle.json,
 *     which outranks columns and names. Since a later owner answer, the same dropdown is also offered as
 *     "change layer" on every facility file that could be more than one layer, so a file placed by its name or by
 *     bundle.json can be re-pointed; its first option keeps or restores the automatic result.
 * Also shows the bundle.json banner (bundle.js). Every text from the user's files is escaped; nothing leaves the
 * browser.
 *
 * Safeguards: dropdown options come from the latest recognition only (never cached); user-controlled ids
 * live in objects without inherited keys; a new load removes the previous panel at once and every dropdown carries
 * its load's generation, so an old control cannot change a newer load; a pick made while bundle.json is still being
 * read waits for it; layer options are filled in when a dropdown is opened (many files x many layers would otherwise
 * mean hundreds of thousands of <option> elements); file headers and the manifest are read once per load.
 *
 * gate(result, profile) -> [{ id, name, on, reason }]   pure; result from recognise()
 * layerOptions(result, fileId, assign) -> [{ value, text }] or null: the layers the file's dropdown offers
 * create({ container, banner, profile, onUpdate? }) -> { show(loadResult), assign(fileId, datasetId, gen?), choose(datasetId,
 *   fileId, gen?), clear(), state }   state: { load, bundle, result, features, assign, choices, version, busy, gen }
 *   onUpdate(state) is called whenever the panel has been redrawn (new load, pick, choice or clear; the
 *   landing page's next step follows the checklist).
 * applyGates(scope, features): greys every element marked data-feature="<id>" whose feature is off: its controls
 *   are disabled, a <details> cannot be opened, and its [data-gate-reason] element shows why (CVI page). */
(function (root) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const listOf = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const size = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
  const dict = () => Object.create(null);
  // Sentence case for notes, but file names keep their own case ("bundle.json names it …").
  const cap = n => /^bundle\.json/i.test(n) ? n : n.charAt(0).toUpperCase() + n.slice(1);
  const VIA = { columns: 'recognised by its columns', name: 'recognised by its file name', 'name column': 'recognised by its name column',
    'bundle.json': 'named in bundle.json', 'your choice': 'your choice' };

  /** Each feature is on only if every dataset it needs is found (not in conflict) with the columns it needs. */
  function gate(result, profile) {
    const byId = new Map(((result && result.datasets) || []).map(d => [d.id, d]));
    return profile.features.map(f => {
      const out = { id: f.id, name: f.name, on: true, reason: null };
      for (const need of f.needs) {
        const d = byId.get(need.dataset), spec = profile.datasets.find(x => x.id === need.dataset) || {};
        const name = (d && d.name) || spec.name || need.dataset;
        if (!d || d.status === 'missing') return Object.assign(out, { on: false, reason: `needs the ${name}` + (spec.file ? ` (${spec.file})` : '') });
        if (d.status === 'conflict') return Object.assign(out, { on: false, reason: `choose which file is the ${name}` });
        const miss = (need.columns || []).filter(c => d.header.indexOf(c) < 0);
        if (miss.length) return Object.assign(out, { on: false, reason: `needs ${miss.length === 1 ? 'the column' : 'the columns'} ${listOf(miss)} in the ${name}` });
      }
      return out;
    });
  }

  /** One-line summary and its tone for the top of the panel. */
  function summary(result, features) {
    const conflicts = result.datasets.filter(d => d.status === 'conflict');
    if (conflicts.length) return { kind: 'warn', text: 'Choose which file is the ' + listOf(conflicts.map(d => d.name)) + ' (see Datasets below).' };
    const missing = result.datasets.filter(d => d.required && d.status !== 'found');
    const on = features.filter(f => f.on).length;
    if (missing.length) return { kind: 'warn', text: 'The ' + listOf(missing.map(d => d.name)) + (missing.length === 1 ? ' was' : ' were') +
      ' not found, so the features that need ' + (missing.length === 1 ? 'it' : 'them') + ' are off. ' + on + ' of ' + features.length + ' features available.' };
    return { kind: 'ok', text: 'All required data found. ' + on + ' of ' + features.length + ' features available.' };
  }

  function select(attr, key, label, placeholder, options, value, gen, lazy) {
    let h = `<select ${attr}="${esc(key)}" data-gen="${gen}"${lazy ? ' data-lazy="1"' : ''} aria-label="${esc(label)}"><option value="">${esc(placeholder)}</option>`;
    for (const o of options) h += `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.text)}</option>`;
    return h + '</select>';
  }

  /** Layers a file's dropdown offers: an unclear file's candidates, or every layer it could be when there is more
   * than one (owner's "change layer"), or its layers when the user has picked one (so the pick can be changed). */
  function layerOptions(result, fileId, assign) {
    const f = result.files.find(x => x.id === fileId);
    if (!f) return null;
    const ids = f.candidates || (f.layers.length > 1 || own(assign, fileId) ? f.layers : null);
    if (!ids || !ids.length) return null;
    const names = new Map(result.datasets.map(d => [d.id, d.name]));
    return ids.map(id => ({ value: id, text: names.get(id) || id }));
  }

  /** The panel's HTML (pure). v: { profile, load, bundle, result, features, assign, choices, gen } */
  function panelHtml(v) {
    const { profile, load, result, features } = v, gen = v.gen || 0;
    const dsById = new Map(result.datasets.map(d => [d.id, d])), fileById = new Map(result.files.map(f => [f.id, f]));
    const neededFor = id => profile.features.filter(f => f.needs.some(n => n.dataset === id)).map(f => f.name);
    const sm = summary(result, features);
    let h = `<div id="checklist-summary" class="status ${sm.kind}" role="status">${esc(sm.text)}</div>`;

    // Datasets
    h += '<h3>Datasets</h3><table id="datasets-table"><thead><tr><th>Dataset</th><th>Status</th><th>File</th><th>Notes</th></tr></thead><tbody>';
    for (const d of result.datasets) {
      const spec = profile.datasets.find(x => x.id === d.id) || {};
      const name = d.fromManifest ? 'Additional facility layer: ' + d.name : d.name;
      const status = d.status === 'found' ? 'Found' : d.status === 'conflict' ? 'Choose a file' : d.required ? 'Missing (required)' : 'Not supplied (optional)';
      const notes = [];
      let file;
      const chosen = d.status === 'found' && own(v.choices, d.id) === d.fileId;
      if (d.options.length > 1) {
        file = select('data-choose', d.id, `Which file is the ${d.name}?`, 'Choose a file…', d.options.map(o => ({ value: o.id, text: o.path })), chosen ? d.fileId : '', gen);
        if (chosen) notes.push('your choice');
      } else if (d.status === 'found') file = esc(d.path);
      else file = `<span class="muted">expected name: ${esc(d.file || spec.file || '')}</span>`;
      if (d.status === 'found' && !chosen) { const f = fileById.get(d.fileId); if (f && VIA[f.via]) notes.push(VIA[f.via]); }
      const nf = neededFor(d.id);
      if (nf.length) notes.push('needed for: ' + nf.join(', '));
      if (d.status === 'found') for (const u of d.missingUseful) {
        const miss = u.columns.filter(c => d.header.indexOf(c) < 0);
        const what = u.feature ? ((profile.features.find(f => f.id === u.feature) || {}).name || u.feature) + ' is off' : u.later;
        notes.push(`without ${miss.length === 1 ? 'the column' : 'the columns'} ${listOf(miss)}: ${what}`);
      }
      const later = spec.later || (d.fromManifest || d.kind === 'facility' ? (profile.datasets.find(x => x.kind === 'facility') || {}).later : null);
      if (later) notes.push('used by: ' + later);
      h += `<tr data-dataset="${esc(d.id)}" data-status="${esc(d.status)}"><td>${esc(name)}${d.required ? ' <span class="req">required</span>' : ''}</td>` +
        `<td class="st-${esc(d.status)}">${esc(status)}</td><td>${file}</td><td>${notes.map(n => esc(cap(n))).join('<br>')}</td></tr>`;
    }
    h += '</tbody></table>';

    // Features
    h += '<h3>Features</h3><table id="features-table"><thead><tr><th>Feature</th><th>Available</th><th>Why</th></tr></thead><tbody>';
    for (const f of features) {
      h += `<tr data-feature="${esc(f.id)}" data-on="${f.on ? 1 : 0}"><td>${esc(f.name)}</td><td class="${f.on ? 'st-found' : 'st-missing'}">${f.on ? 'Yes' : 'No'}</td>` +
        `<td>${f.on ? '' : esc(cap(f.reason))}</td></tr>`;
    }
    h += '</tbody></table>';

    // Every file received, and what it is used as
    if (load.items.length) {
      h += '<h3>Your files</h3><table id="items-table"><thead><tr><th>File</th><th>From</th><th class="num">Size</th><th>Used as</th><th>Notes</th></tr></thead><tbody>';
      for (const it of load.items) {
        const f = fileById.get(it.id) || { status: 'not-used', reason: null, warning: null, candidates: null, layers: [] };
        const picked = own(v.assign, it.id);
        let used, note = f.reason || '';
        if (f.candidates || f.layers.length > 1 || picked) {
          // Unclear file: "Which layer is this file?"; recognised facility file: "change layer" (first option = automatic).
          // Only the current pick is written here; the other layers are added when the dropdown is opened.
          // A pick is shown as selected only while the file is really used as that layer; a pick that did not fit, or
          // that competes with another file, shows what actually happened (the Notes say why).
          const applied = picked && f.status === 'used' && f.dataset === picked;
          const auto = applied ? 'Undo my choice' : picked ? (f.status === 'conflict' ? 'Your choice: choose in Datasets above' : 'Not used (your choice did not fit)')
            : f.candidates ? 'Which layer is this file?'
            : f.status === 'used' ? (dsById.get(f.dataset) || { name: f.dataset }).name + ' (automatic)' : 'Not used (automatic)';
          used = select('data-pick', it.id, `Which layer is ${it.name}?`, auto,
            applied ? [{ value: picked, text: (dsById.get(picked) || { name: picked }).name }] : [], applied ? picked : '', gen, true);
          if (f.status === 'used' && picked) note = 'your choice';
        } else if (f.status === 'used') used = esc((dsById.get(f.dataset) || { name: f.dataset }).name);
        else if (f.status === 'bundle') {
          used = 'Bundle description (bundle.json)';
          const b = v.bundle;
          note = b && b.found && b.path === it.path ? '' : b && b.found && (b.paths || []).includes(it.path)
            ? `identical copy of ${b.path}, which is used` : 'not used; see the notes below';
        }
        else if (f.status === 'conflict') used = 'Choose in Datasets above';
        else used = 'Not used';
        h += `<tr data-file="${esc(it.id)}" data-status="${esc(f.status)}"><td>${esc(it.path)}</td><td>${esc(it.source === 'zip' ? 'ZIP: ' + it.archive : it.source)}</td>` +
          `<td class="num">${size(it.size)}</td><td>${used}</td><td>${[note, f.warning].filter(Boolean).map(n => esc(cap(n))).join('<br>')}</td></tr>`;
      }
      h += '</tbody></table>';
    }
    if (load.ignored.length) {
      h += '<table id="ignored-table"><thead><tr><th>Skipped</th><th>Reason</th></tr></thead><tbody>';
      for (const x of load.ignored) h += `<tr><td>${esc(x.path)}</td><td>${esc(x.reason)}</td></tr>`;
      h += '</tbody></table>';
    }

    // Notes: bundle.json problems, manifest results
    const notes = (v.bundle ? v.bundle.warnings : []).slice();
    const m = result.manifest;
    if (m && m.error) notes.push(`${m.path}: ${m.error}`);
    if (m && m.skipped) for (const s of m.skipped) notes.push(`${m.path}, row ${s.row}: ${s.reason}`);
    if (notes.length) h += '<ul id="checklist-notes">' + notes.map(n => `<li>${esc(cap(n))}</li>`).join('') + '</ul>';
    return h;
  }

  function create(opts) {
    const R = root.WSDA.recognise, B = root.WSDA.bundle, profile = opts.profile, c = opts.container;
    const st = { load: null, bundle: null, result: null, features: null, error: null, assign: dict(), choices: dict(),
      version: 0, busy: false, op: 0, gen: 0, cache: null, bundleReady: null };

    function paintBanner() {
      const b = opts.banner;
      if (!b) return;
      const text = st.bundle && st.bundle.banner;
      b.textContent = text || ''; b.hidden = !text;
    }

    function paintMessage(kind, text) { c.innerHTML = text ? `<div class="status ${kind}">${esc(text)}</div>` : ''; paintBanner(); }

    function paint() {
      if (!st.result) { paintMessage('err', st.error); return; }
      const doc = root.document, active = doc && c.contains && c.contains(doc.activeElement) ? doc.activeElement : null;
      const key = active && (active.getAttribute('data-pick') !== null ? ['data-pick', active.getAttribute('data-pick')]
        : active.getAttribute('data-choose') !== null ? ['data-choose', active.getAttribute('data-choose')] : null);
      c.innerHTML = panelHtml({ profile, load: st.load, bundle: st.bundle, result: st.result, features: st.features,
        assign: st.assign, choices: st.choices, gen: st.gen });
      paintBanner();
      if (key) { const el = Array.from(c.querySelectorAll('select[' + key[0] + ']')).find(x => x.getAttribute(key[0]) === key[1]); if (el) el.focus(); }
    }

    // Only the latest request (new load, pick, choice or clear) may publish; every published request ends idle.
    async function refresh(op) {
      st.busy = true;
      if (opts.onUpdate) opts.onUpdate(st);           // at the start too: the page shows "checking" at once
      let res = null, err = null;
      try {
        await st.bundleReady;                         // a pick made while bundle.json is read waits for it
        if (op !== st.op) return false;
        res = await R.recognise(st.load.items, profile, { assign: st.assign, choices: st.choices,
          files: B.filesFor(st.bundle, profile), cache: st.cache });
      } catch (e) { err = e; }
      if (op !== st.op) return false;
      try {
        if (err) throw err;
        st.result = res; st.features = gate(res, profile); st.error = null;
        paint();
      } catch (e) {
        st.result = null; st.features = null; st.error = 'The files could not be checked: ' + e.message;
        paint();
      }
      st.busy = false; st.version++;
      if (opts.onUpdate) opts.onUpdate(st);
      return true;
    }

    async function show(load) {
      const op = ++st.op, gen = ++st.gen;
      Object.assign(st, { load, bundle: null, result: null, features: null, error: null, assign: dict(), choices: dict(),
        cache: new Map(), bundleReady: null });
      // The previous panel goes at once: its dropdowns belong to other files.
      paintMessage('info', load && load.items.length ? 'Checking which datasets these files are…' : '');
      if (!load) { st.busy = false; st.version++; if (opts.onUpdate) opts.onUpdate(st); return true; }
      st.busy = true;
      st.bundleReady = B.read(load.items).then(b => { if (gen === st.gen) st.bundle = b; },
        e => { if (gen === st.gen) st.bundle = { found: false, path: null, info: null, banner: null, warnings: ['bundle.json could not be read: ' + e.message] }; });
      return refresh(op);
    }

    const current = gen => st.load && (gen === undefined || gen === st.gen);
    function assign(fileId, datasetId, gen) {
      if (!current(gen)) return Promise.resolve(false);
      if (datasetId) st.assign[fileId] = datasetId; else delete st.assign[fileId];
      return refresh(++st.op);
    }
    function choose(datasetId, fileId, gen) {
      if (!current(gen)) return Promise.resolve(false);
      if (fileId) st.choices[datasetId] = fileId; else delete st.choices[datasetId];
      return refresh(++st.op);
    }
    const clear = () => show(null);

    // Fills a layer dropdown with its options when it is opened (focus by keyboard, pointer or touch).
    function fill(sel) {
      if (!sel || !sel.getAttribute || sel.getAttribute('data-lazy') !== '1') return;
      if (Number(sel.getAttribute('data-gen')) !== st.gen || !st.result) return;
      const id = sel.getAttribute('data-pick'), list = layerOptions(st.result, id, st.assign) || [], keep = sel.value;
      const have = new Set(Array.from(sel.options).map(o => o.value));
      for (const o of list) if (!have.has(o.value)) { const el = root.document.createElement('option'); el.value = o.value; el.textContent = o.text; sel.appendChild(el); }
      sel.value = keep; sel.removeAttribute('data-lazy');
    }
    if (c.addEventListener) {
      ['focusin', 'mousedown', 'pointerdown', 'touchstart'].forEach(t => c.addEventListener(t, e => fill(e.target), true));
      c.addEventListener('change', e => {
        const t = e.target, gen = t.getAttribute && Number(t.getAttribute('data-gen'));
        const pick = t.getAttribute && t.getAttribute('data-pick'), ch = t.getAttribute && t.getAttribute('data-choose');
        if (pick !== null && pick !== undefined) assign(pick, t.value, gen);
        else if (ch !== null && ch !== undefined) choose(ch, t.value, gen);
      });
    }

    return { show, assign, choose, clear, state: st };
  }

  function applyGates(scope, features) {
    for (const f of features) {
      for (const el of Array.from(scope.querySelectorAll('[data-feature]')).filter(x => x.getAttribute('data-feature') === f.id)) {
        el.classList.toggle('gated', !f.on);
        if (f.on) el.removeAttribute('aria-disabled'); else el.setAttribute('aria-disabled', 'true');
        el.querySelectorAll('input, select, button').forEach(x => { x.disabled = !f.on; });
        const why = el.querySelector('[data-gate-reason]');
        if (why) { why.textContent = f.on ? '' : cap(f.reason) + '.'; why.hidden = f.on; }
        for (const d of el.tagName === 'DETAILS' ? [el] : Array.from(el.querySelectorAll('details'))) {
          if (!f.on) d.open = false;
          if (!d.hasAttribute('data-gate-hooked')) {
            d.setAttribute('data-gate-hooked', '');
            d.addEventListener('toggle', () => { if (d.open && el.classList.contains('gated')) d.open = false; });
          }
        }
      }
    }
  }

  root.WSDA = root.WSDA || {};
  root.WSDA.checklist = { gate, summary, panelHtml, layerOptions, create, applyGates };
})(typeof window !== 'undefined' ? window : globalThis);
