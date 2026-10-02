/* Landing page (F1): profile cards, then the user's files through the shared loader and the data checklist
 * (bundle.json banner, datasets found / missing, features on / off, what each file is used as), then a clear next
 * step: "Open the CVI map" when its data is found, otherwise what is missing (owner feedback on day 3).
 * Each dashboard opens in its own tab, reused on the next click, and receives the files it uses in memory
 * (WSDA.load.handoff; owner decision 2026-10-01). Routing: a bundle.json "profile" names the dashboard the bundle
 * is for. CVI is the only dashboard available, so files are always checked against CVI; a bundle for a dashboard in
 * preparation, or for one this site does not have, is reported in the next step and on the cards.
 * Day 5: "What data does this need?" (shared/guide.js) is a section of this page, linked from the cards, the intro
 * and the next step whenever data is missing; it offers each profile's synthetic sample bundle as a download
 * (owner decision 2026-10-02). The CVI sample is built from the county label points, so geo/wa-counties.js is read
 * only when the sample is first asked for.
 * A new profile adds a folder, a dataset list and an entry in PROFILES. */
(function (root) {
  'use strict';
  const L = root.WSDA.load;
  const S = root.WSDA.samples.cvi;
  let geo = null;
  const needGeo = () => root.CVIWA_GEO ? Promise.resolve() : geo || (geo = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'geo/wa-counties.js'; s.onload = res;
    s.onerror = () => { geo = null; s.remove(); rej(new Error('The county file geo/wa-counties.js could not be read.')); };
    document.head.appendChild(s);
  }));
  const PROFILES = [
    { id: 'cvi', name: 'CVI Traceability', available: true, url: 'cvi/index.html', open: 'Open the CVI map', map: 'the CVI map',
      mapFeature: 'wa-map', list: root.WSDA.profiles.cvi,
      sample: { build: async () => { await needGeo(); return { fileName: S.fileName, bytes: root.WSDA.sample.zip(S.entries(root.CVIWA_GEO.labels)) }; } },
      about: 'Animal movements recorded on certificates of veterinary inspection (CVI): the WA State county map, with more CVI maps in later versions.' },
    { id: 'emergency', name: 'Emergency Response', available: false,
      about: 'Maps for emergency response. In preparation: not available yet.' }
  ];
  const CHECKED = PROFILES[0];                       // the profile files are checked against (the only one available)
  const state = { version: 0, loading: false, result: null, op: 0, opened: null };
  const $ = id => document.getElementById(id);
  const plural = (n, w) => n.toLocaleString('en-US') + ' ' + w + (n === 1 ? '' : 's');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /** The dashboard a bundle.json names: { profile, note } (pure). */
  function route(bundle) {
    const id = bundle && bundle.found && bundle.info && bundle.info.profile;
    if (!id || id === CHECKED.id) return { profile: id ? CHECKED : null, note: null };
    const p = PROFILES.find(x => x.id === id);
    if (!p) return { profile: null, note: `bundle.json says this bundle is for "${id}", which this site does not have. Your files were checked against ${CHECKED.name}.` };
    return { profile: p, note: `bundle.json says this bundle is for ${p.name}, which is in preparation. Your files were checked against ${CHECKED.name}.` };
  }

  /** What to do after the checklist (pure): null when there is nothing to say (nothing loaded, or the files could not
   * be checked: the status line says why), otherwise { kind, text, notes, open, guide } where open is the profile to
   * open and guide says whether to link "What data does this need?" (something is missing). */
  function nextStep(load, cl) {
    if (!load || !load.items.length || !cl || !cl.result || !cl.features) return null;
    const p = CHECKED, notes = [], r = route(cl.bundle);
    if (r.note) notes.push(r.note);
    const map = cl.features.find(f => f.id === p.mapFeature);
    if (map && map.on) {
      const off = cl.features.filter(f => !f.on);
      if (off.length) notes.push('Not available with these files: ' + off.map(f => `${f.name} (${f.reason})`).join('; ') + '.');
      return { kind: 'ok', text: `Next: open ${p.map}. Your files have what it needs.`, notes, open: p.id, guide: off.length > 0 };
    }
    const reason = map ? map.reason : 'needs data that was not found';
    if (/^choose /.test(reason)) return { kind: 'warn', text: `Next: ${reason} in Datasets below. Then you can open ${p.map}.`, notes, open: null, guide: false };
    notes.unshift('Your files below show what each one was recognised as, and why a file was not used.');
    return { kind: 'warn', text: `${cap(p.map)} ${reason}, and none of your files is it. Add that file and load your files again.`, notes, open: null, guide: true };
  }

  // ---- cards ------------------------------------------------------------------------------------------------------
  function renderCards() {
    const box = $('profiles');
    box.textContent = '';
    for (const p of PROFILES) {
      const card = document.createElement('section');
      card.className = 'card' + (p.available ? '' : ' soon');
      card.setAttribute('data-profile', p.id);
      const h = document.createElement('h3'); h.textContent = p.name; card.appendChild(h);
      const t = document.createElement('p'); t.textContent = p.about; card.appendChild(t);
      const note = document.createElement('p'); note.className = 'card-note'; note.hidden = true; card.appendChild(note);
      if (p.available) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = p.open;
        b.setAttribute('data-open', p.id); card.appendChild(b);
        const m = document.createElement('span'); m.className = 'muted'; m.textContent = ' Opens in a new tab.'; card.appendChild(m);
        if (p.list) {
          const g = document.createElement('p'); g.className = 'muted';
          const a = document.createElement('a'); a.href = '#guide-' + p.id; a.textContent = 'What data does this need?';
          a.setAttribute('data-guide-link', p.id); g.appendChild(a); card.appendChild(g);
        }
      } else {
        const s = document.createElement('span'); s.className = 'soon-badge'; s.textContent = 'In preparation'; card.appendChild(s);
      }
      box.appendChild(card);
    }
  }

  function paintCards(cl) {
    const r = route(cl && cl.load && cl.load.items.length ? cl.bundle : null);
    for (const card of document.querySelectorAll('#profiles .card')) {
      const id = card.getAttribute('data-profile'), note = card.querySelector('.card-note');
      const mine = r.profile && r.profile.id === id;
      card.classList.toggle('routed', !!mine);
      note.hidden = !mine;
      note.textContent = mine ? 'Your bundle.json says the files are for this dashboard.' : '';
    }
  }

  // ---- next step --------------------------------------------------------------------------------------------------
  // While files are read or rechecked (a choice in Datasets) nothing can be opened: the buttons are disabled and the
  // next step says the files are being checked, so an earlier "Open" cannot send an outdated result (audit D4-03).
  function paintNext() {
    const cl = checklist.state, box = $('next-step'), checking = state.loading || cl.busy;
    const n = checking ? null : nextStep(cl.load, cl);
    paintCards(cl);
    for (const b of document.querySelectorAll('button[data-open]')) b.disabled = checking;
    state.opened = null;              // a new load or choice: an earlier click's report no longer applies
    $('next-opened').hidden = true;
    if (checking && !state.loading && cl.load && cl.load.items.length) {
      box.hidden = false; box.className = 'next info'; box.setAttribute('data-kind', 'checking');
      $('next-text').textContent = 'Checking your files again… The next step appears here when that is done.';
      $('next-notes').hidden = true; $('next-open').hidden = true; $('next-open-help').hidden = true; $('next-guide').hidden = true;
      return;
    }
    if (!n) { box.hidden = true; return; }
    box.hidden = false; box.className = 'next ' + n.kind; box.setAttribute('data-kind', n.kind);
    $('next-text').textContent = n.text;
    const notes = $('next-notes'); notes.textContent = '';
    for (const t of n.notes) { const li = document.createElement('li'); li.textContent = t; notes.appendChild(li); }
    notes.hidden = !n.notes.length;
    $('next-guide').hidden = !n.guide;
    const p = PROFILES.find(x => x.id === n.open);
    $('next-open').hidden = !p; $('next-open-help').hidden = !p;
    if (p) { $('next-open').textContent = p.open; $('next-open').setAttribute('data-open', p.id); }
  }

  // The files a dashboard's features use, taken now (a later load or choice does not change what this click sends).
  function payloadFor(p, cl) {
    const res = cl.result, items = new Map(cl.load.items.map(i => [i.id, i])), banner = (cl.bundle && cl.bundle.banner) || null;
    const used = new Set(p.list.features.flatMap(f => f.needs.map(n => n.dataset)));
    const found = res.datasets.filter(d => used.has(d.id) && d.status === 'found' && items.has(d.fileId));
    return async () => {
      const datasets = Object.create(null);
      for (const d of found) {
        const it = items.get(d.fileId);
        datasets[d.id] = { name: it.name, path: it.path, file: new File([await it.read()], it.name, { type: 'text/csv' }) };
      }
      return { banner, datasets };
    };
  }

  function say(kind, text) { const msg = $('next-opened'); msg.hidden = false; msg.className = 'status ' + kind; msg.textContent = text; }

  // Success is reported only when the dashboard says it has loaded the files; a file that cannot be read, here or
  // there, is reported with what to do (audit D4-02).
  function report(opened, p, s) {
    if (state.opened !== opened) return;               // a later click, load or choice
    if (s.state === 'loaded') say('ok', `${cap(p.map)} is open in its own tab with your files. If you load other files here, click "${p.open}" again to send them.`);
    else if (s.state === 'failed') say('err', `Your files could not be sent to ${p.map}: ${s.message} Load your files again (a new copy if one is damaged), then click "${p.open}".`);
    else say('err', `${cap(p.map)} could not load your files: ${s.message}`);
  }

  function openProfile(id) {
    const p = PROFILES.find(x => x.id === id && x.available);
    const cl = checklist.state;
    if (!p || state.loading || cl.busy) return null;   // still checking: nothing to open yet (audit D4-03)
    const n = nextStep(cl.load, cl), ready = n && n.open === p.id;
    const opened = { id: p.id, withFiles: !!ready };
    const win = L.handoff.open(p.id, p.url, ready ? payloadFor(p, cl) : () => null, s => report(opened, p, s));
    if (!win) {
      if (!$('next-step').hidden) say('err', 'The browser blocked the new tab. Allow pop-ups for this page, then click the button again.');
      return null;
    }
    state.opened = opened;
    if (ready) say('info', `Opening ${p.map} and sending your files…`);
    return win;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button[data-open]');
    if (b) openProfile(b.getAttribute('data-open'));
  });

  // ---- loading ----------------------------------------------------------------------------------------------------
  renderCards();
  const guide = root.WSDA.guide.create({ container: $('guide-section'), profiles: PROFILES });
  const checklist = root.WSDA.checklist.create({ container: $('load-results'), banner: $('bundle-banner'), profile: CHECKED.list, onUpdate: () => paintNext() });

  // Only the most recent selection may publish its result: an older, slower load finishing later is discarded.
  async function run(collect) {
    const op = ++state.op;
    state.loading = true;
    setStatus('info', 'Reading files…');
    checklist.clear();                // the previous checklist and banner go at once (audit D3-02)
    let result = null, error = null;
    try { result = await collect(); } catch (e) { error = e; }
    if (op !== state.op) return;
    if (error) { state.result = null; setStatus('err', 'The files could not be read: ' + error.message); await checklist.clear(); }
    else {
      state.result = result; status(result);
      if (result.items.length) setStatus('info', 'Checking which datasets these files are…');
      await checklist.show(result);
      if (op !== state.op) return;
      status(result);
    }
    state.loading = false; state.version++;
    paintNext();
  }

  function setStatus(kind, text) { const s = $('load-status'); s.className = 'status ' + kind; s.textContent = text; }

  function status(r) {
    const n = r.items.length;
    if (r.errors.length) setStatus('err', r.errors.map(e => e.message).join(' '));
    else if (!n) setStatus('warn', 'No usable files were found' + (r.ignored.length ? ' (' + plural(r.ignored.length, 'file') + ' skipped, listed below).' : '.'));
    else setStatus('ok', plural(n, 'file') + ' received' + (r.ignored.length ? '; ' + r.ignored.length + ' skipped.' : '.'));
  }

  $('files-input').addEventListener('change', e => { const fl = e.target.files; run(() => L.fromFileList(fl, 'files')).then(() => { e.target.value = ''; }); });
  $('folder-input').addEventListener('change', e => { const fl = e.target.files; run(() => L.fromFileList(fl, 'folder')).then(() => { e.target.value = ''; }); });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); const dt = e.dataTransfer; run(() => L.fromDataTransfer(dt)); });
  // A file dropped anywhere else must not navigate the browser away from the page.
  ['dragover', 'drop'].forEach(t => root.addEventListener(t, e => e.preventDefault()));

  root.WSDA.landing = { state, checklist, guide, nextStep, route, openProfile, PROFILES };
})(window);
