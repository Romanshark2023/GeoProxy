# GeoProxy | NASA Space Apps Challenge

[Open the public demo](https://geoproxy-nine.vercel.app) · [Interactive field map](https://geoproxy-nine.vercel.app/field-map.html) · [Candidate reports](docs/candidate-reports.md)

GeoProxy searches sampled Earth terrain for places that resemble lunar and Martian exploration targets. Choose Jezero Crater in the globe explorer, inspect the top Earth candidate and compare relief, slope and roughness. Adjust isolation or rover openness and watch the shortlist reorder. Use the field map to compare discoveries with established analog sites and explore mission objectives.

**How the result is produced.** The discovery notebook scans Earth offline and refines shortlisted terrain windows. The browser reads those results and reranks candidates with the selected weights. A percentage describes relative fit under those settings. Terrain similarity cannot reproduce vacuum, gravity or radiation, and operational preferences do not predict crew safety or rover performance.

**Evidence and reproducibility**

- [Discovery notebook](colab/geoproxy_discovery.ipynb): global search, refinement and validation.
- [Site and target notebook](colab/geoproxy_pipeline.ipynb): source data, terrain features and cited temperature context.
- [Data guide](data/README.md): schemas, sources, units, score formula, export hashes and known gaps.
- [Candidate reports](docs/candidate-reports.md): worked examples for evaluation.

The November 15 notebook revision adds landform comparisons, updated noise floors and screening changes. The published discovery JSON still contains the previous run. Regenerate the exports in Colab and update their hashes before claiming results from the revised scan. The globe explorer separately displays the cited temperatures from the notebook; these do not affect terrain scores.

**Run locally:** From the repository root, run `node server.cjs` and open http://127.0.0.1:4173. The static app runs without a build or API key. External map tiles, chart libraries and satellite imagery require internet access.
