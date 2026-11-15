// Interactive Earth map (Leaflet + NASA GIBS imagery).
/* global L */
import { HOLD_Z, PARTIAL_Z } from "./similarity.js";

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** Colour for a distance (0 = identical). Same thresholds as the verdicts (x1.5 and x2, expressed in sigma). */
export function distanceColor(d) {
  if (d == null) return "#6b7c88";
  if (d < HOLD_Z) return "#7ee2b0";
  if (d < PARTIAL_Z) return "#f0c96a";
  return "#f08a6a";
}

export function createMap(el, onSelect) {
  const map = L.map(el, { worldCopyJump: true, minZoom: 2, maxZoom: 10, zoomControl: true, attributionControl: true })
    .setView([20, 10], 2);

  L.tileLayer(`${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/2004-08/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`, {
    maxNativeZoom: 8, maxZoom: 10,
    attribution: 'Imagery: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> Blue Marble',
  }).addTo(map);
  L.tileLayer(`${GIBS}/Reference_Labels_15m/default/2023-01-01/GoogleMapsCompatible_Level13/{z}/{y}/{x}.png`, {
    maxNativeZoom: 13, maxZoom: 10, opacity: 0.85,
  }).addTo(map);

  const layer = L.layerGroup().addTo(map);
  const markers = new Map();

  function render(rows, selectedKey) {
    layer.clearLayers();
    markers.clear();
    // Draw weak matches first so the best ones sit on top.
    [...rows].reverse().forEach(row => {
      const e = row.entry;
      const selected = e.key === selectedKey;
      let m;
      if (e.kind === "established") {
        const icon = L.divIcon({
          className: "",
          html: `<span class="pin-known${selected ? " is-selected" : ""}" style="--c:${distanceColor(row.distance)}"></span>`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        });
        m = L.marker([e.lat, e.lon], { icon, keyboard: true, title: e.name });
      } else {
        m = L.circleMarker([e.lat, e.lon], {
          radius: selected ? 10 : 7,
          color: selected ? "#ffffff" : "#08131b",
          weight: selected ? 3 : 1.5,
          fillColor: distanceColor(row.distance),
          fillOpacity: e.excluded ? 0.35 : 0.95,
          dashArray: e.excluded ? "3 3" : null,
        });
      }
      const sub = e.kind === "established" ? "Established analog" : (e.excluded ? "Excluded candidate" : `Candidate #${row.rank}`);
      m.bindTooltip(`<strong>${escapeHtml(e.name)}</strong><br>${sub}${row.distance != null ? ` · ${row.distance.toFixed(2)} σ` : ""}`, { direction: "top", offset: [0, -6] });
      m.on("click", () => onSelect(e.key));
      m.addTo(layer);
      markers.set(e.key, m);
    });
  }

  function focus(entry) {
    map.flyTo([entry.lat, entry.lon], Math.max(map.getZoom(), 6), { duration: 0.8 });
  }

  function fit(rows) {
    const pts = rows.map(r => [r.entry.lat, r.entry.lon]);
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 4 });
  }

  return { map, render, focus, fit, invalidate: () => map.invalidateSize() };
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
