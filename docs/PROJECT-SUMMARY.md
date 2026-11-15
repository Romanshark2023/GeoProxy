# GeoProxy — Project Summary

**NASA Space Apps Challenge 2026 · "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"**

GeoProxy finds and characterises places on Earth whose terrain genuinely resembles specific Moon and Mars exploration sites — not by reputation or convenience, but by measuring the same physical quantities, the same way, on all three bodies, and scanning **all of Earth's land** for the best matches.

The project has two halves:

| Part | What it is | Owner |
|---|---|---|
| **Data pipeline** (Google Colab notebooks) | Measures terrain on Earth/Moon/Mars, searches the whole Earth, validates the results, exports static JSON | *(data side — fill in name)* |
| **Web app** (static site, this repo) | Interactive map and comparison UI that reads those JSON files | *(frontend — fill in name)* |

They meet at a single, documented interface: the JSON files in `data/` and their contract in [`data/README.md`](../data/README.md). No server, no database — the whole result is static files, so it runs on GitHub Pages.

---

## Part 1 — The data pipeline (decisions and why)

### 1.1 What we measure, and why only that

Three terrain features per 20 km × 20 km window, on a 500 m grid:

| Feature | Definition | Why it was chosen |
|---|---|---|
| **Relief** | 90th minus 10th percentile of elevation | Robust height range — percentiles ignore single bad pixels |
| **Median slope** | Median of cell slopes | Typical steepness; median resists outliers |
| **Roughness (TRI)** | Mean height difference between neighbouring cells (Wilson et al. 2007) | Small-scale ruggedness, the scale a rover or habitat feels |

**Why no absolute elevation:** "zero" means sea level on Earth, the areoid on Mars, a reference sphere on the Moon. The datums are not comparable, so elevation is deliberately excluded rather than fudged.

**Why one common grid (500 m) and window (20 km):** the coarsest global dataset (Mars MOLA, 463 m) sets the floor. Comparing a 30 m Earth measurement against a 463 m Mars measurement would make Earth look artificially rougher; measuring everything at the same resolution with the same code is the only fair comparison. Terrain features are scale-dependent (our own data shows roughness roughly doubles from 1 km to 500 m grids), which is why cross-resolution numbers are never mixed.

**Why our own map projection code (azimuthal equidistant, per-site):** off-the-shelf geo libraries assume Earth. One small, self-tested function works identically on Earth, Mars and the Moon — poles included (Shackleton sits at 89.7°S, where naive lat/lon grids break).

### 1.2 How similarity is scored, and why

1. Features are compared on a **log scale** — a 100 m vs 200 m difference matters as much as 1,000 m vs 2,000 m.
2. Each log-difference is divided by **Earth's natural variability** (robust standard deviation over all land windows), so "1 unit apart" means the same thing for slope as for relief.
3. A weighted distance combines the three (user-adjustable weights in the app).
4. The score shown is a **percentile**: *"more similar than 99.99 % of Earth's land windows."* Percentiles are honest — an arbitrary "87/100 similarity score" would imply precision we don't have.

**Why plain-ratio verdicts (holds ≤ ×1.5, partial ≤ ×2, breaks > ×2):** every per-feature claim can be checked by anyone with a calculator by dividing the two numbers. Transparency beats sophistication in a tool meant to be trusted.

**Why an eps "noise floor" in every comparison:** DEMs cannot resolve arbitrarily small differences (Copernicus vertical accuracy is a few metres; MOLA/LOLA cells are partly interpolated between laser tracks). Values are compared as log10(value + eps) with eps ≈ the measurement floor (5 m relief, 0.2° slope, 2 m roughness), so "roughness 0.5 m vs 2 m" — both below what the data can measure — no longer counts as a real difference. This matters most for very flat targets like Elysium Planitia.

### 1.3 The global search (discovery mode), and why two stages

- **Stage A — screen:** Earth's land is cut into ~350,000 non-overlapping 20 km windows and measured at 1 km using ETOPO 2022 (streamed/downloaded inside Colab; nothing heavy touches a laptop). One latitude band is held in memory at a time.
- **Stage B — confirm:** the best well-separated candidates are independently re-measured at 500 m with Copernicus DEM (the main pipeline's method) and **re-ranked**; the final order comes from the confirmation, not the screen.

**Why two stages:** scanning the whole planet at 500 m would be ~100× the data for no decision-relevant gain; the 1 km screen finds the needles, the 500 m pass checks them with a second dataset.

Other deliberate choices:
- **Non-maximum suppression (150 km separation):** one mountain range cannot fill the whole top-20.
- **Stability test:** feature weights are a human choice, so they are redrawn randomly 200 times and each candidate's worst rank is reported. A candidate that is only good under one weighting is flagged by its own numbers.
- **Surface pre-filter:** candidates must be ≥ 30 % bare ground, ≤ 30 % snow/ice, ≤ 20 % water (ESA WorldCover 10 m) *before* selection. The Moon and Mars are 100 % bare — a forest with the right relief is not a usable analog. (Earlier versions only annotated this after selection; vegetated windows crowded out usable ones.)
- **Landform verdict (elevation skewness):** relief/slope/roughness are magnitude-only — they literally cannot tell a crater from a volcano of the same size (the search once proposed Mount Cameroon as a Gale *Crater* analog on terrain amplitude alone). The skewness of a window's elevations separates **basin-like** from **peak-like** from mixed/flat terrain, and each candidate's landform is compared with the target's.
- **Land is decided by a land mask, not by "elevation > 0":** land below sea level (Danakil Depression, Dead Sea shore, Death Valley, Turpan) is real land and often *prime* Mars-analog terrain. An earlier version silently discarded it as "water"; an independent review caught this, and the fix (offline GLOBE land mask + a WorldCover water check for lakes) made these regions searchable.

### 1.4 Context layers (why terrain alone isn't the whole story)

- **Geology:** the rock unit at each candidate (Macrostrat, a compilation of published geological maps) is classified into volcanic / plutonic / metamorphic / sedimentary / unconsolidated and compared with the target's rock type **taken from peer-reviewed papers** (each target carries its citation — e.g. Farley 2022 for Jezero, Grotzinger 2015 for Gale). Verdict: holds / partial / breaks / unknown, with a low-confidence flag when the classification came only from a map unit's prose description.
- **Climate:** Earth candidates get NASA POWER climatology for context. Moon/Mars targets carry **published measured values with citations** (Mare Tranquillitatis: NASA Moon Fact Sheet, 95–390 K surface; Shackleton's shadowed interior: Haruyama et al. 2008 / Kaguya, ~90 K; Jezero: NASA MEDA early-mission readings). Gale and Elysium are deliberately left `missing` rather than guessed — the project rule is *a value without a checked source does not go in the data*.
- **Novelty:** distance to the nearest of 14 established analog sites (Apollo training grounds, MDRS, Atacama, Rio Tinto, Pilbara, etc.). Wording is deliberately careful: "not in our list" is **not** claimed as "never studied".

### 1.5 Validation (how we know it isn't nonsense)

1. **Rediscovery:** the blind global scan independently re-found Mount Cameroon (6.6 km from our established-site coordinates) as the #1 terrain match for Gale, and the Sossusvlei area for Jezero. The method finds known analogs without being told about them.
2. **Established-sites matrix:** all 14 known analog sites are scored against every target — showing which famous analogs are *terrain* analogs and which are analogs for other reasons (Atacama: climate/chemistry, not terrain). Vinson Massif beats >99.8 % of Earth for Shackleton; that it ranks so high for a steep polar crater wall is exactly what it was included to test.
3. **Cross-dataset check:** 40 random windows measured with both ETOPO and Copernicus agree at r ≈ 1.0 — honestly caveated in the data itself: ETOPO's land heights derive largely from Copernicus, so this demonstrates processing consistency, not independent confirmation.
4. **Self-tests in every notebook:** the maths is checked against hand-computable answers (a 10 % plane has slope 5.71°, the batch code must equal the reference code to 10⁻⁹, Danakil must be land, a volcano shape must read "peak-like") before any real data is touched. If a run shows all PASS, the numbers can be traced end-to-end.
5. **Provenance everywhere:** every value carries `method` (measured / modelled / literature / missing) and a source key; output files are committed with their SHA-256 so any copy can be verified.

### 1.6 Independent review (what changed because of it)

Midway, the methodology was deliberately re-examined by an independent reviewer with the instruction *"do not assume the existing methodology is correct."* Findings that led to changes, all shipped:

| Finding | Fix |
|---|---|
| Land below sea level discarded as ocean (lost Danakil, Dead Sea, Death Valley…) | GLOBE land mask replaces the "elevation > 0" rule |
| Flattest target (Elysium) was being matched partly on DEM noise | eps raised to measurement noise floors |
| Crater vs volcano indistinguishable (features are magnitude-only) | Landform verdict from elevation skewness |
| Vegetated candidates crowded out bare ones | Bare-ground pre-filter before selection |
| Moon/Mars environment panel empty | Literature values with citations (only where verifiable) |

Known, documented limitations that remain (honesty section for the presentation): geology is a point lookup, not proportions; the ETOPO–Copernicus agreement is not fully independent; Elysium's terrain claims sit at the measurement floor; the Shackleton window measures the crater interior, while an actual base would sit on the sunlit rim.

---

## Part 2 — The web app (frontend)

> **✍️ _(teammate: this section is yours — suggested points below, replace freely)_**
>
> - What the app shows and how it's organised (map, target selector, ranked candidate list, detail panel).
> - How the similarity sliders work and why re-ranking happens live in the browser (the exact notebook formula, with eps and scale constants read from `discoveries.method` — never hard-coded).
> - How honesty is surfaced in the UI: holds/partial/breaks chips, the bare-ground filter, method badges (measured/modelled/literature/missing), citations and the data-provenance panel, "newly identified candidate analogue" wording.
> - Tech choices and why: static site (GitHub Pages, zero backend), Leaflet + NASA GIBS imagery, Chart.js radar charts.
> - What you built/changed and anything still planned.

---

## Part 3 — Results snapshot

*(Update this section after the final global run — numbers below are from the schema-0.2 quick scan, 30–40°N band.)*

- 38,427 valid land windows in the test band (previously 37,678 — the below-sea-level fix added real land).
- Surface pre-filter rejected 15–54 vegetated/water windows per target before selection; zero candidates needed excluding afterwards.
- Target landforms measured at 500 m: Shackleton **basin-like** (skew −0.52), Gale **mixed/flat** (crater floor + Mount Sharp flank), Jezero **peak-like** (its 20 km window is dominated by the delta remnant — an honest, non-obvious result the terrain data surfaced by itself).

Final global results (whole Earth, ~318k windows expected): top-20 confirmed candidates per target with ranks, verdicts, geology, landform and novelty — in `data/discoveries.json`.

## How to reproduce

1. Open `colab/geoproxy_discovery.ipynb` from the `colab-data-pipeline` branch in Google Colab → *Run all* (QUICK_SCAN first, then `QUICK_SCAN = False` for the full Earth, ~30–45 min).
2. Open `colab/geoproxy_pipeline.ipynb` the same way for `sites.json` / `targets.json`.
3. Every run prints PASS/FAIL self-tests and a SHA-256 for each output file; commit the files with that hash.
4. Serve the repo root with any static server and open `index.html`.
