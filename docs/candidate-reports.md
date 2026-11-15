# GeoProxy: newly identified candidate analogs

Three candidates selected **by the data**, not by hand. Each one is the strongest place that passes all three tests for its target:

1. **Terrain:** relief, slope and roughness within ×1.5 of the target (500 m grid, 20 km window).
2. **Bare ground:** at least 70% bare (ESA WorldCover). Moon and Mars surfaces have no vegetation.
3. **Rock type:** mapped rock class matches the target's published geology (holds or partly).

Each is also more than 1,000 km from every established analog in our list. *"Newly identified" means not in GeoProxy's list of 14 established sites. These places have **not** been checked against the scientific literature, and every one needs field verification.*

All numbers come from `data/discoveries.json` (SHA-256 `d56af8af…`), produced by `colab/geoproxy_discovery.ipynb`.

---

## 1. Turayf basalt plateau, Saudi Arabia: a lunar mare analog

**Target:** Mare Tranquillitatis (Apollo 11 landing site), Moon · **Location:** 31.56° N, 38.01° E, 64 km from Turayf, Northern Borders Province

| Evidence | Earth | Moon | Verdict |
|---|---|---|---|
| Relief | 198 m | 202 m | holds (×1.02) |
| Median slope | 0.81° | 0.74° | holds (×1.10) |
| Roughness | 6.9 m | 6.7 m | holds (×1.03) |
| Rock type | "Cenozoic basalt" (1:5M International Geological Map of Europe and Adjacent Areas) | mare basalt (Apollo 11 samples, LSPET 1969) | **holds** |
| Bare ground | 99.9% | 100% | **holds** |
| Rain | 0.09 mm/day (NASA POWER, hyper-arid) | none | context |

**How sure:** more similar than **99.995%** of Earth's 318,539 land windows. It stays within Earth's **top 49** under all 200 random weightings. Terrain and land cover are measured (high confidence); rock type comes from a 1:5,000,000 map (moderate); climate is modelled on a ~50 km grid (moderate).

**Why it's interesting:** a flat, barren **basalt** plain is the closest Earth equivalent to a lunar mare: the same rock family, the same flatness at landing-site scale, and no vegetation. Most famous lunar analogs are volcanic highlands or craters, not wide basalt plains.

**What it could test:** rover traverses and navigation on basalt plains; regolith handling and in-situ resource experiments on basaltic material; landing-hazard detection over low-relief volcanic terrain; sample-collection procedures for mare basalts.

**Where it breaks:**
- Earth's atmosphere, weathering and wind-blown sediment versus the Moon's vacuum and impact-gardened regolith.
- Temperature range −7 to 47 °C, versus the Moon's far wider day–night swing.
- Mare basalt at Apollo 11 is titanium-rich; the Turayf basalt's chemistry is unknown here.
- Gravity, radiation.

**Needs field checks:** basalt chemistry; roughness at rover scale (below our 500 m grid); access and safety near international borders.

---

## 2. Central Baffin Island, Canada: a cold flat-plain analog for InSight

**Target:** Elysium Planitia (InSight landing site), Mars · **Location:** 66.82° N, 71.95° W, central Baffin Island, Nunavut (377 km from Iqaluit)

| Evidence | Earth | Mars | Verdict |
|---|---|---|---|
| Relief | 65 m | 66 m | holds (×1.02) |
| Median slope | 0.25° | 0.26° | holds (×1.02) |
| Roughness | 2.0 m | 1.9 m | holds (×1.08) |
| Rock type | sedimentary carbonate (Geological Map of the Arctic, GSC Map 2159A) | basaltic lava under regolith; older sediments beneath (Golombek 2020) | partly |
| Bare ground | 75% (42% bare/sparse + 34% moss & lichen) | 100% | holds |
| Temperature | mean −10 °C, coldest −52 °C (NASA POWER) | far colder | context |

**How sure:** **#1 of 318,539 land windows under all 200 random weightings.** No other result in the global search is this stable. Terrain is measured (high); rock type comes from a regional Arctic map (moderate); climate is modelled (moderate).

**Why it's interesting:** InSight was sent to Elysium because it is one of the flattest, smoothest places on Mars. This window matches that smoothness almost exactly, in a cold, largely barren polar setting, so it combines a lander-friendly surface with extreme cold and seasonal polar light.

**What it could test:** deploying instruments on frozen ground (seismometers, heat-flow probes; InSight's own heat-flow probe struggled to penetrate the soil); cold-weather operation of power and thermal systems; navigation on very low-relief terrain with few landmarks.

**Where it breaks:**
- Carbonate sediments rather than basalt.
- 9% water and 15% vegetation in the window; a third of the "bare" share is moss and lichen.
- Atmosphere, gravity, radiation; Mars is much colder and drier.

**Needs field checks:** surface material and permafrost depth; how much of the window is lakes and wetland in summer; logistics, which are remote and Arctic.

---

## 3. Southern Tarim Basin near Waxxari, China: a hyper-arid analog for Jezero's crater floor

**Target:** Jezero Crater (Perseverance landing site), Mars · **Location:** 37.14° N, 88.08° E, Xinjiang (186 km from Waxxari)

| Evidence | Earth | Mars | Verdict |
|---|---|---|---|
| Relief | 138 m | 141 m | holds (×1.02) |
| Median slope | 0.62° | 0.66° | holds (×1.06) |
| Roughness | 6.7 m | 6.3 m | holds (×1.07) |
| Rock type | Paleozoic sedimentary rocks (world map, very coarse scale) | igneous crater floor; delta sediments to the west (Farley 2022) | partly |
| Bare ground | 89% | 100% | holds |
| Climate | 0.14 mm/day rain; −32 to 25 °C (NASA POWER) | dry, far colder | context |

**How sure:** **#1 for Jezero after the 500 m confirmation.** It stays within Earth's top 31 under all 200 weightings. Terrain and land cover are measured (high); rock type comes from a very small-scale world map (low: needs better geological data).

**Why it's interesting:** a hyper-arid, barren, low-relief basin margin with Jezero's exact terrain profile, far from the analogs usually used for Mars (Atacama, Utah, Iceland).

**What it could test:** rover traverse and autonomous navigation on low-relief sedimentary plains; dust and wind effects on hardware (the region borders the Taklamakan desert); sample selection and caching workflows in sedimentary settings.

**Where it breaks:**
- Jezero's floor is igneous; here the mapped bedrock is sedimentary (it matches Jezero's delta, not its floor).
- 11% of the window is water in ESA WorldCover; check whether it's seasonal.
- Atmosphere, gravity, radiation; Mars is far colder.

**Needs field checks:** actual rock exposure and detailed geology; whether the water is permanent; access permissions.

---

## What the search could not find, also a result

- **Gale crater (Mars):** of 20 candidates, **none** passes all three tests. Terrain like Gale's (a 5 km mountain inside a crater) occurs on Earth mostly in vegetated or glaciated mountains.
- **Shackleton crater (lunar south pole):** **none** either. Earth's steepest terrain is vegetated or glaciated, and no place on Earth reproduces the Moon's polar conditions:
  - the Sun never above ~1.5°
  - rim ridges sunlit about 92% of the time (Gläser 2014)
  - cold traps as low as 29 K (Paige 2010)

  The best Earth option for **polar base operations** is an established site, **Vinson Massif (Antarctica)**. It beats 99.8% of Earth's land on terrain, has polar summer daylight and reaches −53 °C, which makes it useful for testing cold equipment and low-sun power systems, while still 191 K warmer than a lunar cold trap.

These gaps tell mission planners which lunar and Martian conditions Earth can and cannot rehearse.
