# WSDA visualization demo — landing page and CVI WA State map (synthetic data only)

**This is an experimental technical demo, not an official WSDA service or product.** It contains only fabricated
sample data. Do not load real records into it.

The landing page reads the data files you give it, tells you which datasets it recognised and which features they
turn on, and opens the dashboards those files support. Today one dashboard is available: a Washington county-circle
map of animal movements (`cvi/`), which reproduces the WA State map of an internal WSDA analysis tool so that tool's
numbers, circle sizes, colors and display options can be checked in a browser without installing anything.

## Privacy

- The pages run entirely in your browser. The files you choose are read in the tab and **never uploaded**. The landing
  page passes them to the map's tab in memory, and the pages save nothing (the browser may still use its own temporary
  storage for large files; "Download a sample bundle" saves only the made-up sample you ask for).
- The pages make no network requests beyond loading their own files. There are no map tiles, analytics, fonts or
  third-party services, and a Content Security Policy blocks outgoing connections (`connect-src 'none'`).
- To check this, open DevTools → Network, tick *Preserve log*, reload, load files and use the controls. The only
  entries should be this site's own files plus `blob:` and `data:`.
- This demo's web address (its origin) is shared with other, unrelated GitHub Pages sites of the same GitHub account,
  and browsers let pages of one origin read each other. That is acceptable for made-up data only; it is one more
  reason never to load real records here.

## Try it

1. Open the GitHub Pages address of this repository in Google Chrome (or `index.html` from a download).
2. Load data in **Load your data**: a ZIP, several files, a folder, or drag and drop. Use a file from `samples/`, or
   click **Download a sample bundle (ZIP)** under **What data does this need?** and load what it saves.
3. Read the checklist: which datasets were found or are missing, which features are on or off and why, and what each
   file is used as.
4. Click **Open the CVI map**. The map opens in its own tab with your files; clicking Open again reuses that tab.
5. On the map, hover a circle to see its total. Use the filters (species, years, quarters, direction) and the style
   options (size scaling, bins, opacity, palette, labels, county lines). The legend is at the bottom left.

The map can also be opened on its own (`cvi/index.html`) with a single CSV: with `samples/cvi_master_small.csv`,
King's orange (outbound) circle reads "King / Outbound: 2,500 animals".

## Samples (`samples/`, all fabricated)

| File | What it is |
|---|---|
| `cvi_master_small.csv` | 22-row master table with known totals |
| `cvi_master_wa39.csv` | 1,500-row master table covering all 39 counties |
| `cvi_tier_full.zip` | Every dataset: the full master table, five facility layers, two extra layers and their list, `bundle.json` (the same files as the in-page sample download) |
| `cvi_tier_partner.zip` | Reduced data: master table with only the 13 required columns, two facility layers, `bundle.json` naming one of them |
| `cvi_tier_public.zip` | Reduced data: master table with the 13 required columns plus `Species`, no facility layers |

The reduced sets show how the pages behave with less data: features that need missing columns or layers are turned off
with the reason, and the rest works.

## What is not here

Tile basemaps, other map types, charts and exports belong to later work. County outlines stand in for a basemap.
The Emergency dashboard is shown as "in preparation".

## Notices

- Own code: internal WSDA work product, **not licensed for reuse or redistribution**; no licence has been granted.
- MapLibre GL JS 5.22.0: BSD 3-Clause, © MapLibre contributors (`vendor/maplibre-gl/LICENSE.txt`).
- County boundaries: U.S. Census Bureau, 2023 cartographic boundary file (public domain).
- Details and checksums: [PROVENANCE.md](PROVENANCE.md).
- Contact: the repository owner, as maintainer of this demo.
