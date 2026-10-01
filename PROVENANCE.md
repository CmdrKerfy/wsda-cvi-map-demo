# Provenance — S1 WA State map experiment

Everything the page loads is in this folder. Nothing is fetched at run time.

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

`index.html` and `app/*.js` are internal WSDA work product published as a synthetic-only demo. They are **not
licensed for reuse or redistribution**; no licence has been granted. The behavior reproduces the WA State map of
WSDA's internal CVI tool and was checked against that tool's own functions on fabricated data.

## Sample data

`samples/*.csv` are fabricated. Counts, certificate numbers and coordinates are invented; county anchor
coordinates are rounded Census-derived label points. They contain no real records.
