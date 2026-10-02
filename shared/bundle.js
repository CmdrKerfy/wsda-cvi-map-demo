/* Optional bundle.json (F1). A bundle may describe itself in a small JSON file named bundle.json:
 *   { "profile": "cvi", "label": "Partner – county totals only", "prepared": "2026-09-15",
 *     "coverage": { "from": "2024-01-01", "to": "2025-12-31" }, "files": { "feedlots": "feedlots_2025.csv" } }
 * Every field is optional. The page shows label, preparation date and coverage in a banner ("Partner – county
 * totals only · prepared 2026-09-15 · covers 2024–2025"); "files" (dataset id -> file name) ranks recognition
 * claims (recognise.js: the user's pick > bundle.json > columns and names) and never excludes a file; "profile"
 * lets the landing page route the bundle. A bundle.json that cannot be read, or a field that is not understood,
 * gives a plain warning and is otherwise ignored: the files themselves still load. Nothing leaves the browser.
 *
 * read(items) -> Promise<{ found, path, paths, info: { profile, label, prepared, coverage, files }, banner, warnings }>
 *   paths: every bundle.json used (identical copies).
 *   items: the loader's items (load.js); every file named bundle.json (any folder, any case) is considered.
 *   Several bundle.json files are used only if their contents are identical; otherwise none is used.
 * filesFor(bundle, profile) -> the "files" entries to give recognition, or {} when the bundle names another
 *   profile (warning added). */
(function (root) {
  'use strict';
  const MAX_BYTES = 64 * 1024, MAX_FILES = 1000, MAX_LABEL = 200;
  const KNOWN = ['profile', 'label', 'prepared', 'coverage', 'files'];
  const isBundleName = n => String(n).trim().toLowerCase() === 'bundle.json';

  /** A real calendar date written YYYY-MM-DD. */
  function isDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  const clean = s => String(s).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();

  /** "2024–2025" for whole calendar years, "2024" for one, otherwise "2024-03-01 to 2025-06-30". */
  function coverageText(c) {
    const y1 = c.from.slice(0, 4), y2 = c.to.slice(0, 4);
    if (c.from.slice(5) === '01-01' && c.to.slice(5) === '12-31') return y1 === y2 ? y1 : y1 + '–' + y2;
    return c.from === c.to ? c.from : c.from + ' to ' + c.to;
  }

  function bannerText(info) {
    const parts = [];
    if (info.label) parts.push(info.label);
    if (info.prepared) parts.push((parts.length ? 'prepared ' : 'Prepared ') + info.prepared);
    if (info.coverage) parts.push((parts.length ? 'covers ' : 'Covers ') + coverageText(info.coverage));
    return parts.length ? parts.join(' · ') : null;
  }

  /** Validates parsed JSON; returns { info, warnings }. */
  function parse(obj) {
    const info = { profile: null, label: null, prepared: null, coverage: null, files: Object.create(null) }, warnings = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { info, warnings: ['bundle.json does not describe a bundle (it should be a list of named entries in { }); it was not used'] };
    const unknown = Object.keys(obj).filter(k => !KNOWN.includes(k));
    if (unknown.length) warnings.push('bundle.json entries not understood and ignored: ' + unknown.map(clean).join(', '));
    if (obj.profile !== undefined) {
      if (typeof obj.profile === 'string' && /^[a-z0-9_-]{1,40}$/i.test(obj.profile.trim())) info.profile = obj.profile.trim().toLowerCase();
      else warnings.push('bundle.json "profile" is not a profile name; ignored');
    }
    if (obj.label !== undefined) {
      if (typeof obj.label === 'string' && clean(obj.label)) {
        const l = clean(obj.label);
        info.label = l.length > MAX_LABEL ? l.slice(0, MAX_LABEL - 1) + '…' : l;
      } else warnings.push('bundle.json "label" is not text; ignored');
    }
    if (obj.prepared !== undefined) {
      if (isDate(obj.prepared)) info.prepared = obj.prepared;
      else warnings.push('bundle.json "prepared" is not a date written as YYYY-MM-DD; ignored');
    }
    if (obj.coverage !== undefined) {
      const c = obj.coverage;
      if (c && typeof c === 'object' && isDate(c.from) && isDate(c.to) && c.from <= c.to) info.coverage = { from: c.from, to: c.to };
      else warnings.push('bundle.json "coverage" needs "from" and "to" dates written as YYYY-MM-DD, "from" first; ignored');
    }
    if (obj.files !== undefined) {
      const f = obj.files;
      if (f && typeof f === 'object' && !Array.isArray(f)) {
        const bad = [];
        for (const [k, v] of Object.entries(f).slice(0, MAX_FILES)) {
          if (typeof v === 'string' && v.trim() && k.trim()) info.files[k.trim()] = v.trim();
          else bad.push(clean(k) || '(blank)');
        }
        if (bad.length) warnings.push('bundle.json "files" entries without a file name were ignored: ' + bad.join(', '));
        if (Object.keys(f).length > MAX_FILES) warnings.push(`bundle.json "files" lists more than ${MAX_FILES} entries; the rest were ignored`);
      } else warnings.push('bundle.json "files" should list dataset names and file names in { }; ignored');
    }
    return { info, warnings };
  }

  async function read(items) {
    const found = (items || []).filter(i => isBundleName(i.name));
    const out = { found: false, path: null, info: null, banner: null, warnings: [] };
    if (!found.length) return out;
    const texts = [];
    for (const it of found) {
      if (it.size > MAX_BYTES) { out.warnings.push(`"${it.path}" is larger than 64 KB, so it is not a bundle description; it was not used`); return out; }
      try { texts.push((await it.text()).replace(/^﻿/, '')); }
      catch (e) { out.warnings.push(`"${it.path}" could not be read: ${e.message}`); return out; }
    }
    if (texts.some(t => t !== texts[0])) {
      out.warnings.push('more than one bundle.json was supplied and they differ (' + found.map(i => '"' + i.path + '"').join(', ') + '); none was used');
      return out;
    }
    let obj;
    try { obj = JSON.parse(texts[0]); }
    catch (e) { out.warnings.push(`"${found[0].path}" is not valid JSON, so it was not used; check it in a text editor`); return out; }
    const p = parse(obj);
    Object.assign(out, { found: true, path: found[0].path, paths: found.map(i => i.path), info: p.info, banner: bannerText(p.info), warnings: p.warnings });
    return out;
  }

  function filesFor(bundle, profile) {
    if (!bundle || !bundle.found) return {};
    if (bundle.info.profile && bundle.info.profile !== profile.id) {
      const w = `bundle.json says this bundle is for the "${bundle.info.profile}" profile, so its "files" entries were not used for ${profile.name}`;
      if (Object.keys(bundle.info.files).length && !bundle.warnings.includes(w)) bundle.warnings.push(w);
      return {};
    }
    return Object.assign(Object.create(null), bundle.info.files);   // no inherited keys: "constructor" is a plain entry
  }

  root.WSDA = root.WSDA || {};
  root.WSDA.bundle = { read, parse, filesFor, bannerText, coverageText, isBundleName, MAX_BYTES };
})(typeof window !== 'undefined' ? window : globalThis);
