// Similarity engine: the same formula as the Colab notebooks (see data/README.md, section 4).
// Verified against the notebook: Jezero candidate #1 gives 0.034565 here vs 0.034564 in Python.

export const KEYS = ["relief_m", "slope_deg", "roughness_m"];

// Verdicts use plain ratios, which anyone can check: Earth and target within x1.5 = holds, within x2 = partial.
// The rule is read from discoveries.json (method.verdict_rule) so the website and the data always agree;
// these defaults only apply to older data files without that field.
export let FACTOR_HOLD = 1.5;
export let FACTOR_PARTIAL = 2.0;
export let BARE_HOLD = 0.7;     // Moon/Mars are 100% bare: >= 70% bare ground holds
export let BARE_PARTIAL = 0.3;  // >= 30% partial, otherwise breaks
// The same thresholds expressed in sigma (for the overall distance, map colours and bands).
// Set from the data at start-up: sigma = log10(factor) / mean Earth variability.
export let HOLD_Z = 0.28;
export let PARTIAL_Z = 0.48;
export let ruleSource = "default";
export function setThresholds(method) {
  const rule = method.verdict_rule;
  if (rule) {
    FACTOR_HOLD = rule.factor_hold; FACTOR_PARTIAL = rule.factor_partial;
    BARE_HOLD = rule.bare_hold; BARE_PARTIAL = rule.bare_partial;
    ruleSource = "discoveries.json";
  }
  const s = KEYS.map(k => method.earth_variability_scale[k]);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  HOLD_Z = Math.log10(FACTOR_HOLD) / mean;
  PARTIAL_Z = Math.log10(FACTOR_PARTIAL) / mean;
}

/** How many times larger/smaller Earth's value is than the target's (always >= 1), and in which direction. */
export function ratio(e, t, k, method) {
  const eps = method.eps[k];
  const r = (e + eps) / (t + eps);
  return { factor: r >= 1 ? r : 1 / r, higher: r >= 1 };
}

export function verdictFromFactor(factor) {
  return factor <= FACTOR_HOLD ? "holds" : factor <= FACTOR_PARTIAL ? "partial" : "breaks";
}

export function bareVerdict(fraction) {
  return fraction >= BARE_HOLD ? "holds" : fraction >= BARE_PARTIAL ? "partial" : "breaks";
}

/**
 * earth, target: { relief_m, slope_deg, roughness_m } as plain numbers (null = missing)
 * weights: { relief_m, slope_deg, roughness_m } any non-negative numbers (normalised here)
 * method: discoveries.json "method" block (eps + earth_variability_scale)
 * Returns { distance, z, used } or null if nothing can be compared.
 * distance is in units of Earth's natural variability: 0 = identical.
 */
export function similarity(earth, target, weights, method) {
  const eps = method.eps;
  const scale = method.earth_variability_scale;
  let num = 0;
  let wsum = 0;
  const z = {};
  const used = [];
  for (const k of KEYS) {
    const e = earth?.[k];
    const t = target?.[k];
    const w = weights[k] ?? 0;
    if (e == null || t == null || !Number.isFinite(e) || !Number.isFinite(t)) continue; // missing: skip, never 0
    z[k] = (Math.log10(e + eps[k]) - Math.log10(t + eps[k])) / scale[k];
    if (w > 0) {
      num += w * z[k] ** 2;
      wsum += w;
      used.push(k);
    }
  }
  if (wsum === 0) return null;
  return { distance: Math.sqrt(num / wsum), z, used };
}

export function verdict(z) {
  const a = Math.abs(z);
  return a < HOLD_Z ? "holds" : a < PARTIAL_Z ? "partial" : "breaks";
}

/** Plain-language band for an overall distance, using the same thresholds as the per-feature verdicts. */
export function band(distance) {
  if (distance == null) return { label: "not ranked", cls: "none" };
  if (distance < HOLD_Z) return { label: "close terrain match", cls: "close" };
  if (distance < PARTIAL_Z) return { label: "moderate match", cls: "moderate" };
  return { label: "weak match", cls: "far" };
}

/** Weights as percentages that add up to 100 (for display). */
export function weightPercents(weights) {
  const total = KEYS.reduce((s, k) => s + (weights[k] || 0), 0);
  return Object.fromEntries(KEYS.map(k => [k, total ? Math.round((100 * (weights[k] || 0)) / total) : 0]));
}

// Self-check run once at start-up; logs to the console so a broken edit is caught immediately.
export function selfTest(method) {
  const cand = { relief_m: 138.42579487070907, slope_deg: 0.6239054923170525, roughness_m: 6.716752564160088 };
  const tgt = { relief_m: 140.8551750393408, slope_deg: 0.6606728634877733, roughness_m: 6.282867292525669 };
  const r = similarity(cand, tgt, { relief_m: 1, slope_deg: 1, roughness_m: 1 }, method);
  const same = similarity(tgt, tgt, { relief_m: 1, slope_deg: 1, roughness_m: 1 }, method);
  const missing = similarity({ relief_m: 138.4, slope_deg: null, roughness_m: 6.7 }, tgt, { relief_m: 1, slope_deg: 1, roughness_m: 1 }, method);
  const ok = Math.abs(r.distance - 0.034564) < 0.00005 && same.distance === 0 && missing.used.length === 2;
  console[ok ? "info" : "error"](`GeoProxy similarity self-test ${ok ? "PASS" : "FAIL"}`, { distance: r.distance });
  return ok;
}
