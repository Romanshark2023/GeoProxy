# GeoProxy data guide (for the web app)

This folder holds everything the web app needs. All files are **static JSON**, so load them with `fetch("data/<file>.json")`. No server or API is needed, which means GitHub Pages works.

| File | What it contains | Produced by |
|---|---|---|
| `sites.json` | Established Earth analog sites, with terrain and climate values | `colab/geoproxy_pipeline.ipynb` |
| `targets.json` | Moon/Mars reference sites (the "targets"), with terrain values | `colab/geoproxy_pipeline.ipynb` |
| `discoveries.json` | Global search results: for each target, 20 Earth candidates found by scanning all land, plus validation | `colab/geoproxy_discovery.ipynb` |
| `demo.json`, `*.jpg` | Old prototype data and globe textures | earlier prototype (no longer needed except the images) |

> **Never invent or fill in values in the frontend.** If a value is `null`, show it as "not available" and leave it out of calculations. Do not treat it as zero.

---

## 1. The three terrain features (shared by all files)

| Key | Label | Unit | Meaning |
|---|---|---|---|
| `relief_m` | Relief | m | Height range in a 20 × 20 km window (90th minus 10th percentile of elevation) |
| `slope_deg` | Median slope | degrees | Typical steepness |
| `roughness_m` | Roughness (TRI) | m | Average height difference between neighbouring 500 m cells |

Absolute elevation is **deliberately absent**: height references differ between Earth, Mars and the Moon. The same three features are measured the same way on every body (20 km window, 500 m grid), so they are directly comparable.

Environment features (`temp_mean_c`, `temp_min_c`, `temp_max_c`, `precip_mm_day`): Earth values come from NASA POWER (climate model, ~50 km grid, `"method": "modelled"`). Moon/Mars targets carry published measurements where we have a checked source (`"method": "literature"`, with a `citation` field — show it): Apollo 11 / Mare Tranquillitatis (NASA Moon Fact Sheet, equatorial **surface** temperature 95–390 K), Shackleton (Kaguya: shadowed interior ~90 K; the sunlit rim is far warmer) and Jezero (MEDA early-mission diurnal range). Gale and Elysium are still `"missing"`. **Caveat to display:** Moon values are surface temperatures (no atmosphere), Mars values are near-surface air, Earth values are 2 m air — context only, **do not score them**.

---

## 2. `sites.json` and `targets.json` (schema 0.2)

Both files share a header and differ only in the list name (`sites` vs `targets`).

```jsonc
{
  "schema_version": "0.2",
  "generated_utc": "...",
  "method":   { "window_km": 20, "pixel_m": 500, ... },
  "features": { "relief_m": { "label": "Relief", "unit": "m", "group": "terrain", "definition": "..." }, ... },
  "sources":  { "copernicus-glo90": { "dataset": "...", "provider": "...", "url": "...", "attribution": "...", "caveat": "..." }, ... },
  "sites": [                       // "targets" in targets.json
    {
      "id": "mount-cameroon", "body": "earth", "name": "Mount Cameroon", "region": "...",
      "lat": 4.217, "lon": 9.167,
      "analog_for": ["mars"],      // sites only: the team's hypothesis, not a measurement
      "notes": "...",
      "features": {
        "relief_m":    { "value": 2150.26, "unit": "m",  "method": "measured", "source": "copernicus-glo90" },
        "temp_mean_c": { "value": 25.78,   "unit": "°C", "method": "modelled", "source": "nasa-power" },
        ...
      },
      "qc": { "coverage": 1.0, "sea_fraction": 0.0, "errors": [] }
    }
  ]
}
```

- Read a number as `site.features.relief_m.value`.
- `method` is one of `measured`, `modelled`, `literature` (then a `citation` field is present) or `missing`. Show it next to the value; it is how the app stays scientifically honest.
- `source` is a key into `sources`. Use it for tooltips and the "Data & provenance" panel.
- `features` in the header gives labels, units, groups (`terrain` / `environment`) and definitions. Build the UI from it instead of hard-coding.

---

## 3. `discoveries.json` (schema 0.2)

```jsonc
{
  "scope":  { "mode": "global", "valid_land_windows": ..., ... },
  "method": {
    "eps": { "relief_m": 5.0, "slope_deg": 0.2, "roughness_m": 2.0 },   // ≈ measurement noise floors (see eps_rationale)
    "earth_variability_scale": { "relief_m": 0.6265, "slope_deg": 0.6304, "roughness_m": 0.6498 },
    "weights": { ... }, "score": "...", "stability": "...", "ranking": "...", ...   // human-readable method text
  },
  "validation": { "dataset_agreement_1km": {...}, "stage_a_vs_b_spearman": {...},
                  "established_sites_percentile": { "<site id>": { "<target id>": 99.8 } } },
  "sources": { ... },
  "targets": [
    {
      "id": "jezero-crater", "name": "Jezero Crater", "body": "mars", "lat": 18.38, "lon": 77.58,
      "features_500m": { "relief_m": 140.86, "slope_deg": 0.66, "roughness_m": 6.28 },   // plain numbers here
      "features_1km":  { ... },
      "skew_500m": -0.42, "landform_500m": "basin-like",   // elevation skewness: basin-like / peak-like / mixed-flat
      "geology": { "primary": ["volcanic", "plutonic"], "secondary": ["sedimentary"], "summary": "...", "citation": "..." },
      "candidates": [ ... 20 objects, already in final order ... ]
    }
  ]
}
```

Note: in `discoveries.json` the features are **plain numbers**, not `{value, unit, ...}` objects.

### A candidate

| Field | Show it as |
|---|---|
| `lat`, `lon` | Map marker |
| `confirm_rank` | **Final rank** (1 = best). `null` means not ranked (see `excluded`) |
| `place.name`, `place.admin1`, `place.country`, `place.distance_km` | "near Waxxari, Xinjiang, China (186 km)". This is the *nearest town*, which can be far away in deserts |
| `pct_a` | "More similar than 99.996% of Earth's land" (from the 1 km global scan) |
| `rank_median`, `rank_worst`, `stability` | Robustness: its rank on Earth across 200 random weightings. A small `rank_worst` means a robust result |
| `features_500m` | The candidate's three terrain values |
| `comparison.<feature>` | `{earth, target, factor, direction, z, verdict}`. `factor` is how many times larger/smaller Earth's value is (always ≥ 1, after adding `eps` — differences below the measurement noise floor don't count); `direction` is `higher`/`lower`. The verdict comes from the factor (see the verdict rule below). Use it for the radar chart and the **HOLDS / BREAKS** list |
| `landform` | `{earth_skew, target_skew, earth, target, verdict}`. Landform class from elevation skewness: `basin-like` (crater, depression), `peak-like` (volcano, massif) or `mixed/flat`. `verdict`: holds = same class as the target, partial = one is mixed/flat, breaks = basin vs peak. This is what tells a crater analog from a volcano of the same size — show it next to the terrain verdicts |
| `bare_ground` | `{fraction, verdict}`: share of bare ground (ESA WorldCover). Moon and Mars are 100% bare, so it is compared directly |
| `geology` | `unit` (map unit name), `classes`, `verdict` (`holds` / `partial` / `breaks` / `unknown`), `confidence` (`low` means classified only from a long description, so show "?"), `reference` (map citation) |
| `land_cover` | Shares (0–1) of `bare_sparse`, `tree`, `grass`, `snow_ice`, `water`, ... Show "bare ground 89%" |
| `climate` | Earth context only (not scored) |
| `nearest_known_site` | `{id, name, distance_km}` to the nearest established analog |
| `near_known_site` | Site id if within 50 km (it's an established analog), else `null` |
| `novelty` | Ready-made honest sentence. Show it as is |
| `excluded` | `null`, or a reason such as `"glaciated: 76% snow/ice in ESA WorldCover"` or `"water body: 34% water in ESA WorldCover"`. Show excluded candidates greyed out, not ranked. Most candidates never get this far: a pre-filter (`method.surface_prefilter`) already requires ≥30% bare ground, ≤30% snow/ice and ≤20% water before confirmation |
| `errors` | Usually empty; if not, show a small warning |

Candidates have **no `id`**. Use `` `${target.id}#${index}` `` as a key.

Wording for the UI: call them **"newly identified candidate analogues"**, never "discoveries" or "never studied". Novelty has not been checked against the scientific literature.

---

## 4. Similarity in the browser (for the weight sliders)

This is the exact formula the notebooks use (`discoveries.method`). It was checked against the notebook's output for Jezero's #1 candidate (agreement to 5 decimals; the tiny gap comes from rounding of `earth_variability_scale` in the JSON). Always read `eps` and `earth_variability_scale` from `discoveries.method` — never hard-code them; they changed in schema 0.2 (eps now ≈ measurement noise floors).

```js
const KEYS = ["relief_m", "slope_deg", "roughness_m"];

// earth, target: { relief_m, slope_deg, roughness_m } plain numbers (null allowed)
// weights: slider values, any positive numbers (normalised automatically)
// method: discoveries.method
function similarity(earth, target, weights, method) {
  const eps = method.eps, scale = method.earth_variability_scale;
  let num = 0, wsum = 0;
  const z = {};
  for (const k of KEYS) {
    const e = earth[k], t = target[k];
    if (e == null || t == null) continue;            // missing: skip, never treat as 0
    z[k] = (Math.log10(e + eps[k]) - Math.log10(t + eps[k])) / scale[k];
    num += weights[k] * z[k] ** 2;
    wsum += weights[k];
  }
  if (wsum === 0) return null;                        // nothing to compare
  return { distance: Math.sqrt(num / wsum), z };      // smaller distance = more similar
}

// Verdict rule: read it from discoveries.method.verdict_rule (single source of truth).
// A feature holds if Earth and target are within x1.5 of each other, partial within x2, otherwise breaks.
function featureVerdict(e, t, k, method) {
  const eps = method.eps[k], rule = method.verdict_rule;
  const r = (e + eps) / (t + eps);
  const factor = r >= 1 ? r : 1 / r;                  // e.g. 1.70 = "x1.70 steeper/gentler"
  const verdict = factor <= rule.factor_hold ? "holds" : factor <= rule.factor_partial ? "partial" : "breaks";
  return { factor, direction: r >= 1 ? "higher" : "lower", verdict };
}

// Bare ground (Moon/Mars are 100% bare): >= bare_hold holds, >= bare_partial partial, otherwise breaks.
const bareVerdict = (fraction, rule) =>
  fraction >= rule.bare_hold ? "holds" : fraction >= rule.bare_partial ? "partial" : "breaks";
```

The same ratio thresholds, converted to σ (`log10(1.5)` and `log10(2)` divided by the mean of `earth_variability_scale`, about **0.28 σ** and **0.48 σ**), give the bands for the overall distance: close, moderate, weak.

- **Inputs:** use 500 m values everywhere:
  - Candidates: `candidate.features_500m`.
  - Targets: `discoveries.targets[i].features_500m`, or the `.value`s in `targets.json` (same numbers).
  - Established sites: the `.value`s in `sites.json`.
- **Re-rank** candidates and established sites together by `distance` when sliders move.
- **`z`** is "how many Earth-variability units apart". It drives the overall distance; the per-feature verdicts use the plain `factor`, which is easier to explain ("×1.70 gentler").
- **Percentiles (`pct_a`) can't be recomputed in the browser** (that needs all 318,539 windows). Show `pct_a` as "global screen, equal weights" and the live `distance` as "your weighting".

---

## 5. Validation numbers worth showing (credibility panel)

- `validation.dataset_agreement_1km`: correlation ~1.0 between two elevation products. Caveat: ETOPO land data is largely derived from Copernicus, so this shows **processing consistency**, not fully independent measurements (`method.dataset_agreement_caveat`).
- `validation.established_sites_percentile`: where each established analog ranks for each target. For example, Vinson Massif beats 99.84% of Earth for Shackleton, and Mount Cameroon 99.97% for Gale. Good for a heatmap.
- Gale's #1 candidate is 6.6 km from Mount Cameroon (`near_known_site`). The global search independently rediscovered an established analog.

---

## 6. Known gaps (as of this commit)

1. **Gale and Elysium climate is still `missing`** (Apollo 11, Shackleton and Jezero now carry cited literature values). More can be added in the pipeline's `LITERATURE` setting, always with a citation.
2. **Rock type is a point lookup** at the window centre, not proportions; detail varies by country.
3. **Elysium's roughness (~1.9 m) and slope (~0.26°) sit at the measurement noise floor** of the source DEMs. The eps floors in schema 0.2 keep sub-floor differences from scoring, but Elysium matches remain the weakest claims — say so in the UI.
4. Both notebooks changed on 2026-11-15 (land below sea level kept, bare-ground pre-filter, landform verdicts, eps noise floors): the JSON data files must be **regenerated in Colab** before the new fields exist. Until then the committed data files are from the previous method version.

## 7. Updating the data

1. Run the notebook in Colab (`Runtime → Run all`).
2. Download the JSON it produces.
3. Put it in this folder, and commit with the SHA-256 the notebook prints, so the file can be traced.

Current files (SHA-256) — **from the previous method version**; replace this table when the 2026-11-15 notebooks are rerun:

| File | Contents | SHA-256 |
|---|---|---|
| `sites.json` | 14 established Earth analog sites | `85536856442b5dd06d41f549663bb1db038efc6a34f3c243186a22a613566ac6` |
| `targets.json` | 5 Moon/Mars targets | `494ba4e86b68e866089b2ca7e999b9acf8b07d3b3e591bfbe21314734e11ea5d` |
| `discoveries.json` | global search, 20 candidates per target (ratio verdicts, bare ground) | `d56af8af7b3b18b235c2f6c6e8db0fbc19b9995c646691e080b9bce2b52acfde` |
