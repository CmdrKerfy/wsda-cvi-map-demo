# CVI WA State map — experimental demo (synthetic data only)

**This is an experimental technical demo, not an official WSDA service or product.** It contains only fabricated
sample data. Do not load real records into it.

The page draws a Washington county-circle map of animal movements from a CSV file you choose. It reproduces the
WA State map of an internal WSDA analysis tool, so that tool's numbers, circle sizes, colors and display options can
be checked in a browser without installing anything.

## Privacy

- The page runs entirely in your browser. The file you choose is read in the tab and **never uploaded**.
- The page makes no network requests beyond loading its own files. There are no map tiles, analytics, fonts or
  third-party services, and a Content Security Policy blocks outgoing connections (`connect-src 'none'`).
- To check this, open DevTools → Network, tick *Preserve log*, reload, load a file and use the controls. The only
  entries should be this site's own files plus `blob:` and `data:`.

## Try it

1. Open the page in Google Chrome (the GitHub Pages address for this repository, or `index.html` from a download).
2. Download a sample from `samples/`: `cvi_master_small.csv` (22 rows) or `cvi_master_wa39.csv` (1,500 rows).
3. Choose it with the file picker. Hover a circle to see its total. With `cvi_master_small.csv`, King's orange
   (outbound) circle reads "King / Outbound: 2,500 animals".
4. Use the filters (species, years, quarters, direction) and the style options (size scaling, bins, opacity,
   palette, labels, county lines). The legend is at the bottom left of the map.

## What is not here

Tile basemaps, other map types, charts and exports belong to later work. County outlines stand in for a basemap.

## Notices

- Own code: internal WSDA work product, **not licensed for reuse or redistribution**; no licence has been granted.
- MapLibre GL JS 5.22.0: BSD 3-Clause, © MapLibre contributors (`vendor/maplibre-gl/LICENSE.txt`).
- County boundaries: U.S. Census Bureau, 2023 cartographic boundary file (public domain).
- Details and checksums: [PROVENANCE.md](PROVENANCE.md).
