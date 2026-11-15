// Detail panel for one Earth location: radar chart, HOLDS / BREAKS generated from the data, context.
/* global Chart */
import { KEYS, band, ratio, verdictFromFactor, bareVerdict, FACTOR_HOLD } from "./similarity.js";
import { renderLunarModule } from "./lunar.js";
import { escapeHtml as h, distanceColor } from "./map.js";

let chart = null;

const fmt = {
  relief_m: v => `${Math.round(v).toLocaleString()} m`,
  slope_deg: v => `${v < 10 ? v.toFixed(2) : v.toFixed(1)}°`,
  roughness_m: v => `${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString()} m`,
};
const pct = v => `${Math.round(100 * v)}%`;
const coord = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat < 0 ? "S" : "N"}, ${Math.abs(lon).toFixed(2)}°${lon < 0 ? "W" : "E"}`;

export function renderDetail(el, ctx) {
  const { entry: e, row, target, data, weights } = ctx;
  if (!e) {
    el.innerHTML = `<div class="empty">Select a location on the map or in the ranking to see why it is, or isn't, an analog.</div>`;
    destroyChart();
    return;
  }
  const b = band(row?.distance);
  const labels = data.features;

  // ---------- evidence lists, generated from the numbers ----------
  const holds = [], breaks = [], partial = [], notAssessed = [];
  const summary = { terrainHolds: 0, terrainTotal: 0, rock: null, bare: null };
  const dirWord = { relief_m: ["more relief", "less relief"], slope_deg: ["steeper", "gentler"], roughness_m: ["rougher", "smoother"] };
  if (e.features500) {
    for (const k of KEYS) {
      const ev = e.features500[k], tv = target.features500[k];
      if (ev == null || tv == null) { notAssessed.push(`<strong>${labels[k].label}</strong>: value missing`); continue; }
      const { factor, higher } = ratio(ev, tv, k, data.method);
      const v = verdictFromFactor(factor);
      summary.terrainTotal++;
      if (v === "holds") summary.terrainHolds++;
      const diff = factor < 1.05 ? "practically equal" : `×${factor.toFixed(2)} ${dirWord[k][higher ? 0 : 1]}`;
      const text = `<strong>${labels[k].label}</strong>: ${fmt[k](ev)} on Earth vs ${fmt[k](tv)} at ${h(target.name)} <span class="z">(${diff}${weights[k] ? "" : "; not weighted"})</span>`;
      (v === "holds" ? holds : v === "partial" ? partial : breaks).push(text);
    }
  } else {
    notAssessed.push("Terrain: no 500 m measurement for this location");
  }

  // Surface cover: share of bare ground (ESA WorldCover). Moon/Mars surfaces are entirely bare.
  if (e.landCover) {
    const bare = (e.landCover.bare_sparse || 0) + (e.landCover.moss_lichen || 0);
    const veg = ["tree", "shrub", "grass", "cropland", "wetland", "mangrove"].reduce((s, c) => s + (e.landCover[c] || 0), 0);
    summary.bare = bare;
    const text = `<strong>Bare surface</strong>: ${pct(bare)} bare ground, ${pct(veg)} vegetation <span class="z">(${h(target.name)}: 100% bare)</span>`;
    const bv = bareVerdict(bare);   // Moon and Mars have no vegetation: bare ground is a direct comparison
    (bv === "holds" ? holds : bv === "partial" ? partial : breaks).push(text);
  } else {
    notAssessed.push("<strong>Bare surface</strong>: land cover not measured for this location");
  }

  const tg = target.geology;
  if (e.kind === "candidate") {
    const g = e.geology;
    if (g && g.verdict && g.verdict !== "unknown" && tg) {
      summary.rock = g.verdict;
      const text = `<strong>Rock type</strong>: ${h(g.unit || "map unit")} → ${h((g.classes || []).join(" / "))}; ${h(target.name)} is ${h(tg.primary.join(" / "))}` +
        (g.confidence === "low" ? ` <span class="z">(low confidence: from the map's long description)</span>` : "");
      (g.verdict === "holds" ? holds : g.verdict === "partial" ? partial : breaks).push(text);
    } else {
      notAssessed.push("<strong>Rock type</strong>: no geological map unit found at this point");
    }
    if (e.excluded) breaks.unshift(`<strong>Excluded from ranking</strong>: ${h(e.excluded)}`);
  } else {
    notAssessed.push("<strong>Rock type</strong>: not looked up for established sites (see the site notes)");
  }
  notAssessed.push("<strong>Temperature, atmosphere, radiation</strong>: no Moon/Mars values in the data; Earth climate below is context only");

  // One-line synthesis built only from the evidence above.
  const word = { holds: "matches", partial: "partly matches", breaks: "does not match" };
  const parts = [];
  if (summary.terrainTotal) parts.push(`terrain: <b>${summary.terrainHolds} of ${summary.terrainTotal}</b> features within ×${FACTOR_HOLD}`);
  if (summary.rock) parts.push(`rock type <b>${word[summary.rock]}</b>`);
  if (summary.bare != null) parts.push(`<b>${pct(summary.bare)}</b> bare ground`);
  if (e.excluded) parts.push("<b>excluded</b> (glaciated)");
  if (ctx.objectiveMetric && e.climate?.temp_min_c != null) parts.push(`coldest <b>${e.climate.temp_min_c.toFixed(0)}°C</b>`);
  const objectiveLine = ctx.objectiveLabel ? `<span class="objective-tag">${h(ctx.objectiveLabel)}${row?.rank ? ` · #${row.rank}` : ""}</span> ` : "";
  const synthesis = parts.length ? `<p class="synthesis">${objectiveLine}${parts.join(" · ")}</p>` : "";

  const list = (title, items, cls) => items.length
    ? `<div class="evidence ${cls}"><h4>${title}</h4><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul></div>` : "";

  // ---------- scores ----------
  let scoreBits = `<div class="score-main" style="--c:${distanceColor(row?.distance)}">
      <span class="score-num">${row?.distance != null ? row.distance.toFixed(2) : "—"}</span><span class="score-unit">σ</span>
      <span class="score-band">${b.label}${row?.rank ? ` · #${row.rank} with your weights` : ""}</span></div>`;
  if (e.kind === "candidate") {
    scoreBits += `<dl class="facts">
      <dt>Global screen</dt><dd>More similar than <strong>${e.pctA.toFixed(3)}%</strong> of Earth's ${data.scope.valid_land_windows.toLocaleString()} land windows (1 km, equal weights)</dd>
      <dt>Robustness</dt><dd>Worst rank on Earth across 200 random weightings: <strong>#${e.rankWorst}</strong> (median #${e.rankMedian})</dd>
      <dt>Novelty</dt><dd>${h(e.novelty)}</dd></dl>`;
  } else {
    const p = e.knownPercentile?.[target.id];
    scoreBits += `<dl class="facts">
      <dt>Global screen</dt><dd>${p != null ? `More similar than <strong>${p.toFixed(1)}%</strong> of Earth's land windows (1 km, equal weights)` : "not available"}</dd>
      <dt>Why it is known</dt><dd>${h(e.notes)}</dd></dl>`;
  }

  // ---------- context ----------
  const lc = e.landCover;
  const lcBits = lc ? (() => {
    const groups = [
      ["Bare / sparse", (lc.bare_sparse || 0) + (lc.moss_lichen || 0), "#d9b27c"],
      ["Vegetation", (lc.tree || 0) + (lc.shrub || 0) + (lc.grass || 0) + (lc.cropland || 0) + (lc.wetland || 0) + (lc.mangrove || 0), "#5fae6e"],
      ["Snow / ice", lc.snow_ice || 0, "#dfe9f2"],
      ["Water", lc.water || 0, "#4f8fd1"],
      ["Built", lc.built || 0, "#b05f6d"],
    ].filter(g => g[1] > 0.005);
    return `<div class="ctx"><h4>Land cover <span class="src">ESA WorldCover 2021</span></h4>
      <div class="stack">${groups.map(g => `<span style="flex:${g[1]};background:${g[2]}" title="${g[0]} ${pct(g[1])}"></span>`).join("")}</div>
      <div class="stack-legend">${groups.map(g => `<span><i style="background:${g[2]}"></i>${g[0]} ${pct(g[1])}</span>`).join("")}</div></div>`;
  })() : "";

  const cl = e.climate;
  const clBits = cl && cl.temp_mean_c != null ? `<div class="ctx"><h4>Earth climate <span class="src">NASA POWER, ~50 km grid, modelled</span></h4>
      <div class="climate"><span><b>${cl.temp_mean_c.toFixed(1)}°C</b> mean</span><span><b>${cl.temp_min_c.toFixed(1)}°C</b> min</span>
      <span><b>${cl.temp_max_c.toFixed(1)}°C</b> max</span><span><b>${cl.precip_mm_day.toFixed(2)}</b> mm/day rain</span></div></div>` : "";

  const geoRef = e.kind === "candidate" && e.geology?.reference
    ? `<div class="ctx small"><h4>Geological map</h4>${h(e.geology.unit || "")}${e.geology.age ? ` · ${h(e.geology.age)}` : ""}<br><span class="src">${h(e.geology.reference)}</span></div>` : "";

  el.innerHTML = `
    <div class="detail-head">
      <span class="tag ${e.kind}">${e.kind === "established" ? "Established analog" : (e.excluded ? "Excluded candidate" : "Newly identified candidate")}</span>
      <h2>${h(e.name)}</h2>
      <div class="sub">${h(e.region)} · ${coord(e.lat, e.lon)} ·
        <a href="https://www.openstreetmap.org/?mlat=${e.lat}&mlon=${e.lon}#map=9/${e.lat}/${e.lon}" target="_blank" rel="noopener">open map ↗</a></div>
      ${synthesis}
    </div>
    <div class="detail-grid">
      <div class="detail-scores">${scoreBits}</div>
      <div class="radar-wrap"><canvas id="radar" aria-label="Radar chart comparing terrain features with ${h(target.name)}"></canvas>
        <p class="note">Axes: log scale, normalised over every site and target in GeoProxy (500 m grid).</p></div>
    </div>
    <div class="evidence-grid">
      ${list("Holds", holds, "holds")}${list("Partly", partial, "partial")}${list("Breaks", breaks, "breaks")}${list("Not assessed", notAssessed, "na")}
    </div>
    ${renderLunarModule(e, target)}
    <div class="context-grid">${lcBits}${clBits}${geoRef}</div>`;

  drawRadar(el.querySelector("#radar"), e, target, data);
}

function destroyChart() {
  if (chart) { chart.destroy(); chart = null; }
}

function drawRadar(canvas, e, target, data) {
  destroyChart();
  if (!canvas || !e.features500) return;
  const eps = data.method.eps;
  const norm = (k, v) => {
    if (v == null) return null;
    const [lo, hi] = data.logRange[k];
    return hi > lo ? (Math.log10(v + eps[k]) - lo) / (hi - lo) : 0.5;
  };
  const labels = KEYS.map(k => data.features[k].label);
  chart = new Chart(canvas, {
    type: "radar",
    data: {
      labels,
      datasets: [
        { label: target.name, data: KEYS.map(k => norm(k, target.features500[k])),
          borderColor: "#f0a35e", backgroundColor: "rgba(240,163,94,0.18)", pointBackgroundColor: "#f0a35e", borderWidth: 2 },
        { label: e.name, data: KEYS.map(k => norm(k, e.features500[k])),
          borderColor: "#7ee2b0", backgroundColor: "rgba(126,226,176,0.18)", pointBackgroundColor: "#7ee2b0", borderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      scales: { r: { min: 0, max: 1, ticks: { display: false, stepSize: 0.25 },
        grid: { color: "rgba(160,190,205,0.18)" }, angleLines: { color: "rgba(160,190,205,0.18)" },
        pointLabels: { color: "#c6d6de", font: { size: 12 } } } },
      plugins: {
        legend: { labels: { color: "#c6d6de", boxWidth: 12 } },
        tooltip: { callbacks: { label: c => {
          const k = KEYS[c.dataIndex];
          const src = c.datasetIndex === 0 ? target.features500 : e.features500;
          return `${c.dataset.label}: ${fmt[k](src[k])}`;
        } } },
      },
    },
  });
}
