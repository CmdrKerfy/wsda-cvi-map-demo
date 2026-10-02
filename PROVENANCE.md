# Provenance — landing page and CVI WA State map demo

Everything the pages load is in this repository. Nothing is fetched at run time.

## MapLibre GL JS 5.22.0 (`vendor/maplibre-gl/`)

| File | SHA-256 |
|---|---|
| `maplibre-gl.js` | `2e3fc89bc9bbbe9fedc6f4bebbdfca31114474b7641db3064324a89a1dfaffc9` |
| `maplibre-gl.css` | `761a1130f0960ea369d917ec843f7d1af5ca1dcf27701aef1d9d59821b3bab25` |
| `LICENSE.txt` | `ee5fc05a0677eaf69601d2c7db0d9ecd6cc27c3abc1d0733bc9ed34707cf8ef2` |

- Licence: BSD 3-Clause, MapLibre contributors (`LICENSE.txt`, kept with the files).
- Upstream: <https://github.com/maplibre/maplibre-gl-js/releases/tag/v5.22.0> (also published on npm as
  `maplibre-gl@5.22.0`).
- Obtained 2026-09-30 by copying the unmodified files that the R package `mapgl` 0.4.6 ships
  (`htmlwidgets/lib/maplibre-gl/`; its `maplibregl.yaml` declares version 5.22.0). That is the same engine CVI's
  live Maps tab uses. No package manager or network download was used. To verify against upstream, compare the
  hashes above with the npm tarball's `dist/` files.

## WA county geometry (`geo/wa-counties.js`)

- Source: U.S. Census Bureau, 2023 cartographic boundary file `cb_2023_us_county_500k.zip`,
  <https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip>, SHA-256
  `99d6597b1fc7767deef62e01d28d8b5dcbd578e151855f7dc0d173cbf5bf0868` (checked by the build script).
- Terms: Census cartographic boundary files are public domain; the Census Bureau asks for acknowledgement as the
  source, which the page shows in its attribution and footer.
- Derivation: kept `STATEFP == "53"` (39 counties), transformed to EPSG:4326, rounded coordinates to 5 decimals and
  computed label points with `sf::st_centroid()` (R, s2 on). The derivation script is kept in the private source
  repository.

## Own code

`index.html`, `landing.js`, `shared/*.js`, `cvi/index.html`, `cvi/datasets.js`, `cvi/sample.js` and `cvi/app/*.js` are
internal WSDA work product published as a synthetic-only demo. They are **not licensed for reuse or redistribution**;
no licence has been granted. The map reproduces the WA State map of WSDA's internal CVI tool and was checked against
that tool's own functions on fabricated data.

## Sample data

Everything in `samples/` is fabricated: counts, certificate numbers, facility names, addresses and coordinates are
invented (phone numbers use the fictional 555-01xx range, e-mail addresses the reserved `example.invalid` domain);
county anchor coordinates are rounded Census-derived label points. They contain no real records. The page's
"Download a sample bundle (ZIP)" builds the same files as `cvi_tier_full.zip` in the browser (`cvi/sample.js`).

| File | SHA-256 |
|---|---|
| `cvi_master_small.csv` | `26639aa5dbe47547ed2bc924435759547d0ef9e836c196fa6ee3085bc5ce8eab` |
| `cvi_master_wa39.csv` | `8847a63960213a8d1840476dc4b5c8445455d91764576b71b9dddf8a19a8d13d` |
| `cvi_tier_full.zip` | `6792b679a9ddcfcf597eec707b07efeb48f3b28c8547c9a4ac46cbaf059c0db2` |
| `cvi_tier_partner.zip` | `993460fbdffc74db50b18e85b9c08935aa67b2175e353da47481a6cb3d5dd573` |
| `cvi_tier_public.zip` | `04493ebba9d4cbe3002b6c19ee0786c5a22262c307e67540f8e0887be5d9c272` |
