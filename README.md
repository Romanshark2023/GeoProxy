# GeoProxy local prototype

Run `node server.cjs` from this folder, then open http://127.0.0.1:4173.

The demo uses vanilla HTML/JS and a small Node HTTP server for quick review. It is not yet the planned Next.js production application. `/api/match` serves reproducible precomputed rankings, not a new global scan on each click. NASA GIBS WMS provides live satellite imagery requests.

Rebuild data with scripts/build-demo.py using NumPy, Pillow and h5py (the latter installed in ../.runtime). Source inputs remain in geoproxy-data/raw. The derived data/demo.json is small enough to ship with the frontend.

Method: sample 7 by 7 points at 10 km spacing on each planet; calculate P90 minus P10 elevation and median slope. Compare log-transformed features with equal weights and standard deviations from Earth samples. Score = 100 exp(-RMS standardized distance). Earth sample centers are 2 degrees apart between 60 S and 80 N, with windows rejected if any sample is at or below sea level. This simple mask excludes some valid land and is not a complete global search. The latitude/longitude grid is not area weighted. The two features are correlated, and this exploratory score has not been calibrated or validated as analog quality.

MOLA: PDS megt90n000eb version 1.1, big-endian signed int16 meters above areoid, 1/16 degree grid. Contains source-interpolated bins, with coverage not resolved here. Earth: existing GMT earth_relief_05m.grd, 5 arc-minute grid with 0.5 scale factor applied; release date/version not recorded in workspace. Physical sampling distance is common, but source effective resolution and measurement methods differ. The Earth grid is too coarse for rover safety or fine slope analysis. No temperature, mineralogy, access or environmental equivalence is claimed. Missing elevation is rejected. Satellite image date: 2024-01-15, MODIS Terra true color; imagery does not enter the similarity calculation.

Verified all three targets return five candidates; candidate selection updates detail; NASA GIBS image loaded in browser; no JavaScript errors during the verification flow. Current viewer uses shaded image spheres rather than a true georeferenced 3D globe.
