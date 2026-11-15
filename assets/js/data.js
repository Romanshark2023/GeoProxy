// Loads the three JSON files produced by the Colab notebooks and turns them into one consistent model.
import { KEYS } from "./similarity.js";

async function getJSON(name) {
  const r = await fetch(`data/${name}.json`);
  if (!r.ok) throw new Error(`Could not load data/${name}.json (HTTP ${r.status})`);
  return r.json();
}

const valuesOf = (features) =>
  Object.fromEntries(Object.entries(features || {}).map(([k, f]) => [k, f && typeof f === "object" ? f.value : f]));

export async function loadData() {
  const [sitesFile, targetsFile, disc] = await Promise.all([getJSON("sites"), getJSON("targets"), getJSON("discoveries")]);

  // Feature labels/units/definitions come from the data, not hard-coded.
  const features = sitesFile.features;

  // One shared provenance table (keys used in every "source" field).
  const sources = { ...sitesFile.sources, ...targetsFile.sources, ...disc.sources };

  const targetsById = Object.fromEntries(targetsFile.targets.map(t => [t.id, t]));
  const targets = disc.targets.map(dt => {
    const t = targetsById[dt.id] || {};
    return {
      id: dt.id, name: dt.name, body: dt.body, lat: dt.lat, lon: dt.lon,
      region: t.region || "", notes: t.notes || "",
      features500: { ...dt.features_500m },
      featureMeta: t.features || {},              // per-value method/source (measured / missing ...)
      geology: dt.geology || null,
      candidates: dt.candidates,
    };
  });

  const established = sitesFile.sites.map(s => {
    const v = valuesOf(s.features);
    return {
      key: `site:${s.id}`, kind: "established", id: s.id,
      name: s.name, region: s.region, lat: s.lat, lon: s.lon,
      features500: Object.fromEntries(KEYS.map(k => [k, v[k] ?? null])),
      featureMeta: s.features,
      climate: { temp_mean_c: v.temp_mean_c, temp_min_c: v.temp_min_c, temp_max_c: v.temp_max_c, precip_mm_day: v.precip_mm_day },
      climateMeta: s.features,
      notes: s.notes, analogFor: s.analog_for || [], qc: s.qc,
      knownPercentile: disc.validation?.established_sites_percentile?.[s.id] || {},
    };
  });

  const candidatesFor = (target) => target.candidates.map((c, i) => ({
    key: `cand:${target.id}#${i}`, kind: "candidate", targetId: target.id,
    name: c.place?.name ? `Near ${c.place.name}` : `${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}`,
    region: [c.place?.admin1, c.place?.country].filter(Boolean).join(", "),
    lat: c.lat, lon: c.lon,
    features500: c.features_500m ? { ...c.features_500m } : null,
    climate: c.climate, geology: c.geology, landCover: c.land_cover, bareGround: c.bare_ground || null,
    place: c.place, novelty: c.novelty, nearestKnown: c.nearest_known_site, nearKnownSite: c.near_known_site,
    excluded: c.excluded, errors: c.errors || [],
    pctA: c.pct_a, rankWorst: c.rank_worst, rankMedian: c.rank_median, stability: c.stability,
    confirmRank: c.confirm_rank, screenRank: c.screen_rank,
  }));

  // Ranges of log-feature values over everything we have, for the radar chart's common axes.
  const all = [...established.map(e => e.features500), ...targets.map(t => t.features500),
               ...targets.flatMap(t => t.candidates.map(c => c.features_500m).filter(Boolean))];
  const eps = disc.method.eps;
  const logRange = Object.fromEntries(KEYS.map(k => {
    const logs = all.map(f => f?.[k]).filter(v => v != null).map(v => Math.log10(v + eps[k]));
    return [k, [Math.min(...logs), Math.max(...logs)]];
  }));

  return {
    features, sources, targets, established, candidatesFor, logRange,
    method: disc.method, validation: disc.validation, scope: disc.scope,
    generated: { sites: sitesFile.generated_utc, discoveries: disc.generated_utc },
  };
}
