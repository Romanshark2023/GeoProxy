// Mission objectives: each one is a transparent preset (weights + which places qualify + how to rank),
// built only from data already in the JSON files. Different objectives need different analogs.

const coldest = e => e.climate?.temp_min_c;

export const OBJECTIVES = {
  general: {
    label: "General terrain match",
    why: "Ranks every place by overall terrain similarity: relief, slope and roughness weighted equally.",
    weights: { relief_m: 50, slope_deg: 50, roughness_m: 50 },
    bareOnly: false,
  },
  mobility: {
    label: "Rover mobility & landing",
    why: "Wheels, legs and landers are limited by slope and surface roughness, not by overall relief, so relief is switched off. The target has no vegetation, so only bare-ground candidates qualify.",
    weights: { relief_m: 0, slope_deg: 60, roughness_m: 40 },
    bareOnly: true,
  },
  geology: {
    label: "Geology & sample science",
    why: "Keeps only candidates whose mapped rock type matches the target's published geology (holds or partly), then ranks by terrain. Established sites stay visible; their rock type isn't looked up.",
    weights: { relief_m: 50, slope_deg: 50, roughness_m: 50 },
    bareOnly: false,
    qualifies: e => e.kind !== "candidate" || ["holds", "partial"].includes(e.geology?.verdict),
    hiddenReason: "rock type does not match the target",
  },
  cold: {
    label: "Cold & extreme-environment testing",
    why: "Ranks places by how cold they get (NASA POWER minimum air temperature), with terrain similarity shown for context. No place on Earth reaches lunar or Martian temperatures: this finds Earth's harshest cold, not an equivalent.",
    weights: { relief_m: 50, slope_deg: 50, roughness_m: 50 },
    bareOnly: false,
    qualifies: e => coldest(e) != null,
    hiddenReason: "no temperature data",
    sortValue: e => coldest(e),                 // lower = better
    metric: e => ({ value: `${coldest(e).toFixed(0)}°C`, sub: "coldest" }),
  },
  polar: {
    label: "Ice & polar operations",
    why: "Restricts to polar or freezing places (latitude beyond 60° or mean air temperature at or below 0°C), then ranks by terrain. Relevant to lunar polar bases and Martian ice.",
    weights: { relief_m: 50, slope_deg: 50, roughness_m: 50 },
    bareOnly: false,
    qualifies: e => Math.abs(e.lat) >= 60 || (e.climate?.temp_mean_c != null && e.climate.temp_mean_c <= 0),
    hiddenReason: "not polar and not freezing",
  },
};
