// Lunar south pole base module: compares an Earth place with the factors that decide where a permanent
// Moon base can go. Moon-side values come from published papers (cited); Earth-side values are measured
// (NASA POWER, ESA WorldCover) or computed from latitude. Nothing is invented.
import { escapeHtml as h } from "./map.js";

export const LUNAR_SOUTH_POLE = {
  appliesTo: ["shackleton-crater"],
  sunMaxDeg: 1.5,
  ridgeSunlitPct: [92.27, 95.65],     // at 2 m and 10 m above ground
  ridgeLongestDarkDays: [3, 5],
  coldTrapMinK: 29,
  sources: {
    sun: "Moon's spin axis is tilted ~1.5° to the Sun, so at the poles the Sun never rises more than ~1.5° above the horizon.",
    ridge: "Gläser, P. et al. (2014). Illumination conditions at the lunar south pole using high resolution Digital Terrain Models from LOLA. Icarus 243, 78–90.",
    cold: "Paige, D. A. et al. (2010). Diviner Lunar Radiometer observations of cold traps in the Moon's south polar region. Science 330, 479–482.",
    ice: "Zuber, M. T. et al. (2012). Constraints on the volatile distribution within Shackleton crater at the lunar south pole. Nature 486, 378–381.",
  },
};

/** Highest the Sun gets in the sky over a year at a given latitude (degrees). */
export function maxSunElevation(lat) {
  const a = Math.abs(lat);
  return a <= 23.44 ? 90 : 90 - a + 23.44;
}
const hasPolarDay = lat => Math.abs(lat) >= 66.56;
const K = c => c + 273.15;

export function renderLunarModule(e, target) {
  const L = LUNAR_SOUTH_POLE;
  if (!L.appliesTo.includes(target.id)) return "";
  const rows = [];

  const sun = maxSunElevation(e.lat);
  rows.push({
    factor: "Sun height",
    moon: `never above ~${L.sunMaxDeg}°: long grazing shadows, solar panels must face sideways`,
    earth: `up to ${sun.toFixed(0)}° (from latitude ${Math.abs(e.lat).toFixed(1)}°)`,
    verdict: "breaks",
    note: "No place on Earth has a sun this low all year; polar sites come closest",
  });

  rows.push({
    factor: "Near-continuous sunlight",
    moon: `rim ridge sunlit ${L.ridgeSunlitPct[0]}% of the time (2 m height), dark spells of only ${L.ridgeLongestDarkDays[0]}–${L.ridgeLongestDarkDays[1]} days`,
    earth: hasPolarDay(e.lat) ? "24-hour daylight in polar summer, polar night in winter" : "daily day–night cycle all year",
    verdict: hasPolarDay(e.lat) ? "partial" : "breaks",
    note: hasPolarDay(e.lat) ? "Good for testing power systems under weeks of low-angle sun" : "",
  });

  const tmin = e.climate?.temp_min_c;
  rows.push({
    factor: "Cold-trap temperature",
    moon: `crater floors as low as ${L.coldTrapMinK} K (${(L.coldTrapMinK - 273.15).toFixed(0)}°C)`,
    earth: tmin != null ? `coldest ${tmin.toFixed(0)}°C (${K(tmin).toFixed(0)} K), NASA POWER` : "no temperature data",
    verdict: tmin != null ? "breaks" : "na",
    note: tmin != null ? `About ${(K(tmin) - L.coldTrapMinK).toFixed(0)} K warmer: useful for cold-equipment testing, not a cold-trap equivalent` : "",
  });

  const snow = e.landCover?.snow_ice;
  rows.push({
    factor: "Ice at the surface",
    moon: "possible ice in Shackleton's permanently shadowed floor (authors are cautious)",
    earth: snow != null ? `${Math.round(100 * snow)}% snow/ice cover (ESA WorldCover)` : "not measured for this place",
    verdict: snow == null ? "na" : snow >= 0.1 ? "partial" : "breaks",
    note: snow != null && snow >= 0.1 ? "Earth ice is water ice in an atmosphere, not vacuum-stable cold-trap ice" : "",
  });

  const label = { holds: "Holds", partial: "Partly", breaks: "Breaks", na: "Not assessed" };
  return `
    <section class="lunar">
      <h4>Lunar south-pole base factors</h4>
      <table class="lunar-table">
        <thead><tr><th>Factor</th><th>Shackleton region</th><th>${h(e.name)}</th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <th>${r.factor}</th><td>${r.moon}</td><td>${r.earth}${r.note ? `<span class="z">${r.note}</span>` : ""}</td>
          <td><span class="v v-${r.verdict}">${label[r.verdict]}</span></td></tr>`).join("")}</tbody>
      </table>
      <p class="cite">Sources: ${Object.values(L.sources).map(h).join(" · ")}</p>
    </section>`;
}
