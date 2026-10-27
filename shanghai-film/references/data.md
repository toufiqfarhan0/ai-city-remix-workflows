# Data

`build-city.mjs` fetches today's footprints and the ground by itself. Two larger datasets you download once.

## Fetched by the script (cached in `<project>/cache/`)

| Data | From | Licence | Credit on screen |
|---|---|---|---|
| Building footprints, `height`, `building:levels`, `start_date` | OpenStreetMap through the Overpass API (overpass-api.de and mirrors) | ODbL 1.0 | © OpenStreetMap contributors |
| Water, parks, streets | OpenFreeMap vector tiles (OpenMapTiles schema) | ODbL / OpenMapTiles | © OpenMapTiles © OpenStreetMap contributors |

## Downloaded by you

### Construction years: a Colouring Cities extract (`--colouring`)

- Colouring London / Colouring Britain: https://colouringbritain.org/data-extracts.html (the latest extract is a ZIP of about 8 GB; it contains `building_attributes.csv`, about 2.2 GB).
- Licence: ODbL 1.0. Credit: "Colouring London contributors" (or the platform you use).
- Fields used: `ref_osm_id`, `location_latitude`, `location_longitude`, `date_year`, `date_lower`, `date_upper`, `size_height_apex`, `size_storeys_core`, `location_name`. The CSV is streamed; only rows inside `city.bbox` are kept.
- Matching: by OSM id, then by the record's point falling inside the footprint.
- The extract has no footprints and no inferred years; only crowdsourced `date_year` (or `date_lower..date_upper`).

### A historic footprint survey (`--victorian`, optional)

- London: Petitpierre, di Lenardo, Hudson et al. (2026), *A Layer of Late Victorian London: The Building Footprints from the 1:1,056 Ordnance Survey Map (1891-1896)*, https://zenodo.org/records/21282700 (use `london_buildings_1891-96_corr_v1.gpkg`, 640 MB). Licence: CC BY 4.0.
- Any GeoPackage of polygons in EPSG:3857 works; read with Node's built-in `node:sqlite`.
- It is shown as its own layer in the era marked `"victorian": true`. It is never used to date today's buildings: in a city that was already built up, a rebuilt building overlaps the old footprint just as an old one does (in London the rule was right 54% of the time).

## Landmark years

Use a source you can cite (Wikidata, the site's own history page, a heritage list) and put it in `sources`.
