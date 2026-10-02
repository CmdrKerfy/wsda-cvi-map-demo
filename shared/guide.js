/* "What data does this need?" (F1 day 5). Generated from each profile's dataset list (site/<profile>/datasets.js):
 * for every dataset its name, the recommended file name, required or optional, what it is (about), the columns that
 * identify it, and what it turns on (features, and later versions' uses of optional columns); then the optional
 * bundle.json, and a download of the profile's synthetic sample bundle when it has one (owner decision 2026-10-02:
 * a section of the landing page, linked from the next step and the cards). Text comes from the site's own files and is
 * still escaped. Nothing leaves the browser.
 *
 * model(profile) -> { id, name, datasets: [{ id, name, file, required, kind, about, columns, exact, unlocks, note }], bundleExample }
 *   pure; columns are display labels, exact[i] says whether columns[i] is a column name (otherwise a description of the
 *   spellings accepted); unlocks are sentences; note is shown once for all datasets that share it.
 * html(profile, opts) -> HTML of one profile's part; opts.sample: true adds the download button.
 * create({ container, profiles: [{ list, name, available, sample?: { build: async () => { fileName, bytes } } }] })
 *   -> { state }   writes the section and wires the download buttons. state: { downloads, last: { id, ok, text } } */
(function (root) {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const listOf = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const label = c => typeof c === 'string' ? c : c.label;
  const size = n => n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  const colWord = cols => 'the ' + listOf(cols.map(c => '"' + c + '"')) + (cols.length === 1 ? ' column' : ' columns');

  function model(profile) {
    const featureName = id => (profile.features.find(f => f.id === id) || { name: id }).name;
    const datasets = profile.datasets.map(d => {
      const unlocks = [];
      for (const f of profile.features) for (const n of f.needs) {
        if (n.dataset !== d.id) continue;
        unlocks.push(n.columns ? `${f.name}, with ${colWord(n.columns)}` : f.name);
      }
      for (const u of d.useful || []) {
        if (u.feature && !profile.features.some(f => f.id === u.feature && f.needs.some(n => n.dataset === d.id && n.columns))) unlocks.push(`${featureName(u.feature)}, with ${colWord(u.columns)}`);
        if (u.later) unlocks.push(`${u.later}, with ${colWord(u.columns)}`);
      }
      if (d.later) unlocks.push(d.later);
      const note = d.kind === 'facility'
        ? 'Facility layers have the same kind of columns, so the file name says which layer it is: use the recommended name, name the file in bundle.json, or choose its layer in Datasets after loading.'
        : d.kind === 'manifest' ? 'Each layer it lists is then expected as its own file, named as in the list.' : '';
      return { id: d.id, name: d.name, file: d.file, required: !!d.required, kind: d.kind, about: d.about || '',
        columns: d.columns.map(label), exact: d.columns.map(c => typeof c === 'string'), unlocks, note };
    });
    const fac = profile.datasets.find(d => d.kind === 'facility');
    const bundleExample = { profile: profile.id, label: 'Partner – county totals only', prepared: '2026-09-15',
      coverage: { from: '2024-01-01', to: '2025-12-31' } };
    if (fac) bundleExample.files = { [fac.id]: fac.id + '_2025.csv' };
    return { id: profile.id, name: profile.name, datasets, bundleExample };
  }

  function html(profile, opts) {
    const m = model(profile), id = esc(m.id);
    let h = `<h3 id="guide-${id}" tabindex="-1">${esc(m.name)}</h3>`;
    const req = m.datasets.filter(d => d.required).map(d => d.name);
    h += `<p>${esc(req.length ? `Needs the ${listOf(req)}; everything else is optional and switches on more.` : 'Every file is optional.')}` +
      ' A file may have more columns than listed; extra columns are ignored.</p>';
    h += `<div class="table-wrap"><table class="guide-table" data-guide-profile="${id}"><thead><tr><th>Dataset</th><th>Recommended file name</th>` +
      '<th>What it is</th><th>Columns it must have</th><th>What it turns on</th></tr></thead><tbody>';
    const fileName = f => esc(f).replace(/_/g, '_<wbr>');             // long file names break after underscores
    const notes = [];                                                  // each note once, under the table
    for (const d of m.datasets) {
      if (d.note) { const n = notes.find(x => x.note === d.note); if (n) n.names.push(d.name); else notes.push({ note: d.note, names: [d.name] }); }
      h += `<tr data-guide-dataset="${esc(d.id)}"><td>${esc(d.name)} <span class="req">${d.required ? 'required' : 'optional'}</span></td>` +
        `<td><code>${fileName(d.file)}</code></td><td>${esc(d.about)}</td>` +
        `<td>${d.columns.map((c, i) => d.exact[i] ? `<code>${esc(c)}</code>` : esc(c)).join(', ')}</td>` +
        `<td>${d.unlocks.length ? '<ul>' + d.unlocks.map(u => `<li>${esc(u)}</li>`).join('') + '</ul>' : ''}</td></tr>`;
    }
    h += '</tbody></table></div>';
    for (const n of notes) h += `<p class="guide-note"><strong>${esc(listOf(n.names))}:</strong> ${esc(n.note)}</p>`;
    const ids = m.datasets.map(d => `${d.id} (${d.name})`);
    h += `<details class="guide-bundle"><summary>Optional: a <code>bundle.json</code> file describing the bundle</summary>` +
      '<p>A small file named <code>bundle.json</code> among your files can say which dashboard they are for, give a label, ' +
      'the date they were prepared and the period they cover (shown in a banner), and say which file is which dataset ' +
      `when the names differ from the recommended ones. Every part is optional. Dataset names to use under "files": ${esc(listOf(ids))}.</p>` +
      `<pre>${esc(JSON.stringify(m.bundleExample, null, 2))}</pre></details>`;
    if (opts && opts.sample) {
      h += `<div class="guide-sample"><button type="button" class="btn" data-sample="${id}">Download a sample bundle (ZIP)</button>` +
        ' <span class="muted">Made-up data in the shapes above: every dataset listed, and a bundle.json. Load it under' +
        ' "Load your data" to see every feature switched on. Not real records.</span>' +
        `<div class="status" role="status" data-sample-status="${id}" hidden></div></div>`;
    }
    return h;
  }

  function create(opts) {
    const c = opts.container, state = { downloads: 0, last: null };
    let h = '<h2 id="guide">What data does this need?</h2>' +
      '<p class="muted">Each dashboard works with the files you have: a feature whose data is missing is switched off, with the reason. ' +
      'Files are CSV (comma-separated, first row = column names). Load them as one ZIP, several files, or a folder.</p>';
    for (const p of opts.profiles) {
      if (p.list) h += html(p.list, { sample: !!p.sample });
      else h += `<h3 data-guide-soon="${esc(p.id)}">${esc(p.name)}</h3><p class="muted">In preparation: its data list comes with the dashboard.</p>`;
    }
    c.innerHTML = h;
    c.addEventListener('click', async e => {
      const b = e.target.closest && e.target.closest('button[data-sample]');
      if (!b || b.disabled) return;
      const id = b.getAttribute('data-sample'), p = opts.profiles.find(x => x.id === id && x.sample);
      const st = c.querySelector(`[data-sample-status="${CSS.escape(id)}"]`);
      if (!p) return;
      const say = (kind, text) => { st.hidden = false; st.className = 'status ' + kind; st.textContent = text; state.last = { id, ok: kind === 'ok', text }; };
      b.disabled = true; say('info', 'Making the sample bundle…');
      try {
        const out = await p.sample.build();
        root.WSDA.sample.download(out.fileName, out.bytes);
        state.downloads++;
        say('ok', `Your browser is saving ${out.fileName} (${size(out.bytes.length)} of made-up data). Load it under "Load your data" above.`);
      } catch (err) {
        say('err', 'The sample bundle could not be made: ' + (err && err.message || err) + ' Reload the page and try again.');
      } finally { b.disabled = false; }
    });
    return { state };
  }

  root.WSDA = root.WSDA || {};
  root.WSDA.guide = { model, html, create };
})(typeof window !== 'undefined' ? window : globalThis);
