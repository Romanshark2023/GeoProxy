// GeoProxy Analog Explorer: wires data, similarity engine, map, ranking and detail panel together.
import { loadData } from "./data.js";
import * as sim from "./similarity.js";
const { KEYS, similarity, selfTest, weightPercents, band, setThresholds } = sim;
import { createMap, distanceColor, escapeHtml as h } from "./map.js";
import { renderDetail } from "./detail.js";
import { OBJECTIVES } from "./objectives.js";

const DEFAULT_WEIGHTS = { relief_m: 50, slope_deg: 50, roughness_m: 50 };
const state = {
  body: "mars", targetId: null, weights: { ...DEFAULT_WEIGHTS },
  showEstablished: true, showCandidates: true, bareOnly: false, selectedKey: null, objective: "general",
};
let hiddenVegetated = 0;   // candidates hidden by the bare-ground filter (for the note under the ranking)
let hiddenByObjective = 0; // places hidden because they don't qualify for the chosen objective
const objective = () => OBJECTIVES[state.objective];
let data, mapApi, rows = [];
const $ = sel => document.querySelector(sel);

init().catch(err => {
  console.error(err);
  $("#app-error").hidden = false;
  $("#app-error").textContent = `Could not start GeoProxy: ${err.message}. If you opened index.html directly, serve the folder over HTTP instead (see README).`;
});

async function init() {
  data = await loadData();
  if (!selfTest(data.method)) throw new Error("similarity self-test failed");
  setThresholds(data.method);
  $("#legend-close").textContent = `close: within ×${sim.FACTOR_HOLD} (< ${sim.HOLD_Z.toFixed(2)} σ)`;
  $("#legend-moderate").textContent = `moderate: within ×${sim.FACTOR_PARTIAL}`;
  $("#legend-far").textContent = `weak: beyond ×${sim.FACTOR_PARTIAL}`;
  mapApi = createMap($("#map"), key => select(key, false));
  $("#stat-windows").textContent = data.scope.valid_land_windows.toLocaleString();
  $("#stat-sites").textContent = data.established.length;
  $("#stat-targets").textContent = data.targets.length;
  buildBodyToggle();
  buildObjectives();
  buildWeights();
  buildLayerToggles();
  renderMethod();
  $("#target-select").addEventListener("change", ev => setTarget(ev.target.value));
  setBody("mars");
  document.body.classList.remove("loading");
}

const currentTarget = () => data.targets.find(t => t.id === state.targetId);

// ---------- controls ----------
function buildBodyToggle() {
  document.querySelectorAll("[data-body]").forEach(btn =>
    btn.addEventListener("click", () => setBody(btn.dataset.body)));
}

function setBody(body) {
  state.body = body;
  document.querySelectorAll("[data-body]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.body === body)));
  const options = data.targets.filter(t => t.body === body);
  $("#target-select").innerHTML = options.map(t => `<option value="${t.id}">${h(t.name)}</option>`).join("");
  setTarget(options[0].id);
}

function setTarget(id) {
  state.targetId = id;
  $("#target-select").value = id;
  state.selectedKey = null;
  renderTargetCard();
  update({ fit: true, autoselect: true });
}

function buildObjectives() {
  const sel = $("#objective");
  sel.innerHTML = Object.entries(OBJECTIVES).map(([id, o]) => `<option value="${id}">${h(o.label)}</option>`).join("");
  sel.addEventListener("change", () => applyObjective(sel.value));
  $("#objective-why").textContent = objective().why;
}

function applyObjective(id) {
  state.objective = id;
  const o = objective();
  state.weights = { ...o.weights };
  document.querySelectorAll("#weights input").forEach(inp => { inp.value = state.weights[inp.dataset.key]; });
  state.bareOnly = o.bareOnly;
  $("#bare-only").checked = o.bareOnly;
  $("#objective-why").textContent = o.why;
  update({ fit: true, autoselect: true });
}

let weightFrame = null;

function buildWeights() {
  const wrap = $("#weights");
  wrap.innerHTML = KEYS.map(k => `
    <label class="weight">
      <span class="weight-head"><span>${h(data.features[k].label)}</span><output id="w-${k}"></output></span>
      <input type="range" min="0" max="100" step="5" value="${state.weights[k]}" data-key="${k}"
             aria-describedby="wd-${k}">
      <small id="wd-${k}">${h(data.features[k].definition)}</small>
    </label>`).join("");
  wrap.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => {
    state.weights[inp.dataset.key] = Number(inp.value);
    if (weightFrame !== null) return;
    weightFrame = requestAnimationFrame(() => {
      weightFrame = null;
      update({});
    });
  }));
  $("#weights-reset").addEventListener("click", () => {
    state.weights = { ...objective().weights };
    wrap.querySelectorAll("input").forEach(inp => { inp.value = state.weights[inp.dataset.key]; });
    update({});
  });
}

function showWeightPercents() {
  const p = weightPercents(state.weights);
  KEYS.forEach(k => { $(`#w-${k}`).textContent = `${p[k]}%`; });
  const allZero = KEYS.every(k => !state.weights[k]);
  $("#weights-warning").hidden = !allZero;
}

function buildLayerToggles() {
  $("#show-established").addEventListener("change", ev => { state.showEstablished = ev.target.checked; update({}); });
  $("#show-candidates").addEventListener("change", ev => { state.showCandidates = ev.target.checked; update({}); });
  $("#bare-only").addEventListener("change", ev => { state.bareOnly = ev.target.checked; update({ fit: true }); });
  $("#bare-only-label").textContent = `Bare ground only (≥ ${Math.round(100 * sim.BARE_HOLD)}%)`;
}

/** Share of bare ground for a candidate (ESA WorldCover); null when not measured. */
const bareFraction = e => e.bareGround?.fraction
  ?? (e.landCover ? (e.landCover.bare_sparse || 0) + (e.landCover.moss_lichen || 0) : null);

// ---------- core update ----------
function compute() {
  const t = currentTarget();
  let candidates = state.showCandidates ? data.candidatesFor(t) : [];
  hiddenVegetated = 0;
  if (state.bareOnly) {
    const kept = candidates.filter(c => (bareFraction(c) ?? 0) >= sim.BARE_HOLD);
    hiddenVegetated = candidates.length - kept.length;
    candidates = kept;
  }
  let entries = [...(state.showEstablished ? data.established : []), ...candidates];
  const o = objective();
  hiddenByObjective = 0;
  if (o.qualifies) {
    const kept = entries.filter(o.qualifies);
    hiddenByObjective = entries.length - kept.length;
    entries = kept;
  }
  rows = entries.map(entry => {
    const s = entry.excluded || !entry.features500 ? null : similarity(entry.features500, t.features500, state.weights, data.method);
    // The ranking key: terrain distance by default, or the objective's own measure (e.g. coldest first).
    const key = entry.excluded ? null : (o.sortValue ? o.sortValue(entry) : (s ? s.distance : null));
    return { entry, sim: s, distance: s ? s.distance : null, key };
  });
  rows.sort((a, b) => (a.key == null) - (b.key == null) || (a.key ?? 0) - (b.key ?? 0));
  let r = 0;
  rows.forEach(row => { row.rank = row.key == null ? null : ++r; });
}

function update({ fit = false, autoselect = false }) {
  showWeightPercents();
  compute();
  if (autoselect || !rows.some(r => r.entry.key === state.selectedKey)) {
    state.selectedKey = rows.find(r => r.key != null)?.entry.key ?? null;
  }
  mapApi.render(rows, state.selectedKey);
  if (fit) mapApi.fit(rows);
  renderRanking();
  renderSelected();
}

function select(key, fromList) {
  state.selectedKey = key;
  mapApi.render(rows, key);
  renderRanking();
  renderSelected();
  const row = rows.find(r => r.entry.key === key);
  if (row && fromList) mapApi.focus(row.entry);
  if (!fromList) document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "nearest" });
}

function renderSelected() {
  const row = rows.find(r => r.entry.key === state.selectedKey);
  renderDetail($("#detail"), { entry: row?.entry, row, target: currentTarget(), data, weights: state.weights,
    objectiveLabel: objective().label, objectiveMetric: objective().metric });
}

// ---------- views ----------
function renderTargetCard() {
  const t = currentTarget();
  const f = data.features;
  const fmtVal = (k, v) => v == null ? "—" : k === "slope_deg" ? `${v.toFixed(2)}°` : `${Math.round(v).toLocaleString()} m`;
  const tg = t.geology;
  $("#target-card").innerHTML = `
    <div class="eyebrow">${t.body === "mars" ? "Mars" : "Moon"} reference site</div>
    <h2>${h(t.name)}</h2>
    <p class="muted">${h(t.region)}</p>
    <dl class="tfeat">${KEYS.map(k => `<div><dt>${h(f[k].label)}</dt><dd>${fmtVal(k, t.features500[k])}</dd>
      <span class="fmeta">${h(t.featureMeta[k]?.method || "measured")} · ${h(t.featureMeta[k]?.source || "")}</span></div>`).join("")}</dl>
    ${tg ? `<div class="tgeo"><strong>Rock type:</strong> ${h(tg.primary.join(" / "))}${tg.secondary?.length ? ` <span class="muted">(also ${h(tg.secondary.join(", "))})</span>` : ""}
      <p>${h(tg.summary)}</p><p class="cite">${h(tg.citation)}</p></div>` : ""}`;
}

function renderRanking() {
  const list = $("#ranking");
  const ranked = rows.filter(r => r.key != null);
  const unranked = rows.filter(r => r.key == null);
  const o = objective();
  $("#ranking-count").textContent = `${ranked.length} ranked`;
  const item = r => {
    const e = r.entry;
    const b = band(r.distance);
    const tag = e.kind === "established" ? `<span class="tag established">Known analog</span>`
      : e.excluded ? `<span class="tag excluded">Excluded</span>` : `<span class="tag candidate">New candidate</span>`;
    const extra = e.kind === "candidate" && !e.excluded ? `<span class="robust" title="Worst rank on Earth across 200 random weightings">robust to #${e.rankWorst}</span>`
      : e.excluded ? `<span class="robust">${h(e.excluded)}</span>` : "";
    return `<li><button class="result ${e.key === state.selectedKey ? "is-selected" : ""} ${e.excluded ? "is-excluded" : ""}" data-key="${h(e.key)}">
      <span class="rank">${r.rank ?? "–"}</span>
      <span class="dot" style="--c:${distanceColor(r.distance)}"></span>
      <span class="who"><span class="name">${h(e.name)}</span><span class="region">${h(e.region)}</span>${tag} ${extra}</span>
      ${o.metric && r.key != null
        ? `<span class="dist">${o.metric(e).value}<small>${o.metric(e).sub}${r.distance != null ? ` · terrain ${r.distance.toFixed(2)} σ` : ""}</small></span>`
        : `<span class="dist">${r.distance != null ? r.distance.toFixed(2) : "—"}<small>${r.distance != null ? `σ · ${b.label.split(" ")[0]}` : ""}</small></span>`}
    </button></li>`;
  };
  const notes = [];
  if (state.bareOnly) notes.push(`${hiddenVegetated} vegetated candidate${hiddenVegetated === 1 ? "" : "s"} hidden (under ${Math.round(100 * sim.BARE_HOLD)}% bare ground).` +
    (state.showEstablished ? " Established sites stay visible: their land cover isn't measured." : ""));
  if (o.qualifies && hiddenByObjective) notes.push(`${hiddenByObjective} place${hiddenByObjective === 1 ? "" : "s"} hidden for “${o.label}”: ${o.hiddenReason}.`);
  const filterNote = notes.length ? `<li class="filter-note">${notes.join("<br>")}</li>` : "";
  list.innerHTML = filterNote + ranked.map(item).join("") +
    (unranked.length ? `<li class="divider">Not ranked</li>${unranked.map(item).join("")}` : "");
  list.querySelectorAll("button.result").forEach(btn => btn.addEventListener("click", () => select(btn.dataset.key, true)));
}

function renderMethod() {
  const m = data.method, v = data.validation;
  const src = Object.entries(data.sources).map(([k, s]) => `<tr>
      <td><a href="${h(s.url)}" target="_blank" rel="noopener">${h(s.dataset)}</a></td><td>${h(s.provider)}</td><td class="muted">${h(s.caveat || "")}</td></tr>`).join("");
  const feat = Object.entries(data.features).map(([k, f]) => `<li><strong>${h(f.label)}</strong> (${h(f.unit)}, ${h(f.group)}): ${h(f.definition)}</li>`).join("");
  const agree = KEYS.map(k => `<li>${h(data.features[k].label)}: r = <strong>${v.dataset_agreement_1km[k].pearson_r_log}</strong> (${h(v.dataset_agreement_1km[k].rating)})</li>`).join("");

  const tIds = data.targets.map(t => t.id);
  const heat = `<table class="heat"><thead><tr><th>Established site</th>${data.targets.map(t => `<th>${h(t.name)}</th>`).join("")}</tr></thead><tbody>
    ${data.established.map(s => `<tr><th>${h(s.name)}</th>${tIds.map(id => {
      const p = s.knownPercentile[id];
      const a = p == null ? 0 : Math.max(0, (p - 50) / 50);
      return `<td style="background:rgba(126,226,176,${(a * 0.75).toFixed(2)})">${p == null ? "—" : p.toFixed(1)}</td>`;
    }).join("")}</tr>`).join("")}</tbody></table>`;

  $("#method-body").innerHTML = `
    <div class="method-grid">
      <article><h3>How the match works</h3>
        <ol>
          <li>Every place, on Earth, Mars or the Moon, is measured the same way: a 20 × 20 km window on a common 500 m grid.</li>
          <li>Three terrain features are compared on a log scale, each divided by Earth's natural variability. Absolute elevation is never compared: height references differ between bodies.</li>
          <li>Each feature gets a verdict from a plain ratio: Earth and target within <strong>×${sim.FACTOR_HOLD}</strong> of each other = holds, within <strong>×${sim.FACTOR_PARTIAL}</strong> = partly, beyond = breaks.</li>
          <li>Your weights combine the features into one distance, shown in σ (0 = identical terrain). The same ratios set the bands: under ${sim.HOLD_Z.toFixed(2)} σ (about ×${sim.FACTOR_HOLD}) is close, under ${sim.PARTIAL_Z.toFixed(2)} σ (about ×${sim.FACTOR_PARTIAL}) moderate, beyond that weak.</li>
          <li>Surface cover: Moon and Mars surfaces are bare, so a candidate's share of bare ground (ESA WorldCover) is compared directly: ${Math.round(100 * sim.BARE_HOLD)}% or more holds, ${Math.round(100 * sim.BARE_PARTIAL)}–${Math.round(100 * sim.BARE_HOLD)}% partly, below that breaks. Rule read from ${sim.ruleSource}.</li>
          <li>New candidates come from scanning ${data.scope.valid_land_windows.toLocaleString()} land windows worldwide at 1 km, then re-measuring the best ones at 500 m. Rock type comes from Macrostrat geological maps, compared with the target's published geology. Mountain glaciers are excluded using ESA WorldCover.</li>
        </ol>
        <h4>Features</h4><ul>${feat}</ul>
      </article>
      <article><h3>How far to trust it</h3>
        <ul>
          <li>Two elevation products agree at 1 km:<ul>${agree}</ul></li>
          <li>${Math.round(100 * v.dataset_agreement_1km.recall_at_top1pct)}% of test windows measured with Copernicus find themselves in the top 1% of the global screen.</li>
          <li>Robustness: each candidate's worst rank across 200 random weightings is shown in the ranking.</li>
          <li>The global search independently rediscovered established analogs, for example Mount Cameroon for Gale crater.</li>
        </ul>
        <p class="caveat">${h(m.dataset_agreement_caveat)}</p>
        <h4>Limits</h4>
        <ul class="muted">
          <li>Terrain similarity at the 20 km scale, not proof that conditions are equivalent. Earth's atmosphere, gravity, water and life differ from Mars and the Moon.</li>
          <li>Rock type is a point lookup at each candidate's centre; map detail varies by country.</li>
          <li>Moon/Mars temperatures are not in the data yet, so climate is shown as Earth context only.</li>
          <li>"New candidate" means not in GeoProxy's list of established sites. It has not been checked against the scientific literature.</li>
        </ul>
      </article>
    </div>
    <h3>Where the established analogs rank <span class="muted">(% of Earth's land windows they beat; terrain only)</span></h3>
    <div class="heat-wrap">${heat}</div>
    <h3>Data sources</h3>
    <div class="table-wrap"><table class="sources"><thead><tr><th>Dataset</th><th>Provider</th><th>Caveat</th></tr></thead><tbody>${src}</tbody></table></div>
    <p class="muted small">Data generated ${h(data.generated.sites)} (sites/targets) and ${h(data.generated.discoveries)} (global search) by the notebooks in <code>colab/</code>.</p>`;
}
