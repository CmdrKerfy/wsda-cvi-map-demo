/* Sample bundle download: a minimal ZIP writer and the download itself. The archive is "stored" (not
 * compressed): browsers do not promise the same compressed bytes, so storing removes that difference. The download is
 * measured byte-identical in Chrome and in Node (both V8), where tests/synthetic/make_bundles.js writes the same archive
 * for the tests to compare; other engines are expected to match (see cvi/sample.js on Math.exp); Safari did, others
 * are not yet compared.
 * Entries are marked UTF-8 and written as by MS-DOS tools (no Unix permissions), so Windows Explorer, macOS Archive
 * Utility and unzip extract ordinary readable files. Fixed date 2026-09-15 12:00 (no clock), as in the test bundles.
 * Needs zip.js (crc32). Nothing leaves the browser: the download is a local blob: link.
 *
 * zip([{ name, data?: Uint8Array | string, dir?: true }]) -> Uint8Array   strings are written as UTF-8
 * download(fileName, bytes) -> void                                      saves through the browser's download */
(function (root) {
  'use strict';
  const DOS_TIME = 0x6000, DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 15;   // 2026-09-15 12:00:00
  const UTF8 = 0x800;

  function zip(entries) {
    const enc = new TextEncoder(), crc32 = root.WSDA.zip.crc32;
    const locals = [], centrals = []; let offset = 0;
    for (const e of entries) {
      const name = enc.encode(e.dir && !e.name.endsWith('/') ? e.name + '/' : e.name);
      const data = e.dir ? new Uint8Array(0) : typeof e.data === 'string' ? enc.encode(e.data) : e.data;
      const crc = e.dir ? 0 : crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, UTF8, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, DOS_TIME, true); lh.setUint16(12, DOS_DATE, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, UTF8, true);
      ch.setUint16(12, DOS_TIME, true); ch.setUint16(14, DOS_DATE, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(38, e.dir ? 0x10 : 0, true);                  // MS-DOS directory attribute
      ch.setUint32(42, offset, true);
      locals.push(new Uint8Array(lh.buffer), name, data); centrals.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cenSize = centrals.reduce((s, b) => s + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
    const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
    const out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
    let at = 0; for (const b of parts) { out.set(b, at); at += b.length; }
    return out;
  }

  function download(fileName, bytes) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.hidden = true;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);     // long enough for every browser to start saving
  }

  root.WSDA = root.WSDA || {};
  root.WSDA.sample = { zip, download };
})(typeof window !== 'undefined' ? window : globalThis);
