import { state, persist, esc } from "./state.js";
import { icon } from "./icons.js";
import { createSimulation } from "./simulation.js";
let map, routeLayer, stopLayer, busLayer, simulation, preview;
const markers = new Map();
let choose = () => {};
export function initMap(onChoose) {
  choose = onChoose;
  if (!window.L) throw new Error("The local map library could not load.");
  map = L.map("map", {
    zoomControl: false,
    minZoom: 12,
    maxZoom: 18,
    maxBounds: [
      [42.52, 20.98],
      [42.83, 21.35],
    ],
    maxBoundsViscosity: 0.8,
  });
  const p = state.prefs.position;
  map.setView(
    p ? [p[0], p[1]] : [42.658, 21.161],
    p ? Math.min(18, Math.max(12, p[2])) : 14,
  );
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  }).addTo(map);
  tiles.on("tileerror", () => {
    const e = document.querySelector("#map-warning");
    e.hidden = false;
    e.textContent =
      "Map tiles unavailable. Local bus routes and journey planning still work.";
  });
  routeLayer = L.layerGroup().addTo(map);
  stopLayer = L.layerGroup().addTo(map);
  busLayer = L.layerGroup().addTo(map);
  map.on("moveend", () => {
    const c = map.getCenter();
    state.prefs.position = [c.lat, c.lng, map.getZoom()];
    persist();
  });
  refreshLayers();
  simulation = createSimulation(state.routes, (b) => {
    let marker = markers.get(b.id);
    if (!marker) {
      marker = L.marker([b.position[1], b.position[0]], {
        icon: L.divIcon({
          className: "bus-marker",
          html: `<div class="bus-body">${icon("bus")}<b>${esc(b.line)}</b></div>`,
          iconSize: [33, 38],
          iconAnchor: [16, 19],
        }),
        title: `Simulated bus ${b.id}`,
        keyboard: true,
      });
      marker.on("click", () => {
        document
          .querySelectorAll(".bus-marker")
          .forEach((e) => e.classList.remove("selected"));
        marker.getElement()?.classList.add("selected");
        choose({ type: "bus", bus: b });
      });
      markers.set(b.id, marker);
      if (state.prefs.lines.includes(b.line)) busLayer.addLayer(marker);
    }
    marker.setLatLng([b.position[1], b.position[0]]);
    const el = marker.getElement();
    if (el) {
      el.setAttribute("aria-label", `Simulated bus ${b.id}`);
      el.title = `Line ${b.line} · ${b.movementState} · ${b.direction === 1 ? "outbound" : "return demonstration"}`;
      el.style.setProperty("--heading", `${b.heading}deg`);
    }
  });
  state.buses = simulation.buses;
  return map;
}
export function refreshLayers() {
  if (!map) return;
  routeLayer.clearLayers();
  stopLayer.clearLayers();
  for (const f of state.routes)
    if (state.prefs.showRoutes && state.prefs.lines.includes(f.properties.line))
      L.geoJSON(f, {
        style: {
          color: f.properties.line === "4" ? "#17624d" : "#6e8277",
          weight: f.properties.line === "4" ? 4 : 3,
          opacity: 0.8,
        },
      }).addTo(routeLayer);
  for (const stop of state.stops)
    if (
      state.prefs.showStops &&
      stop.properties.lines.some((l) => state.prefs.lines.includes(l))
    )
      L.marker([stop.geometry.coordinates[1], stop.geometry.coordinates[0]], {
        icon: L.divIcon({ className: "stop-marker", iconSize: [12, 12] }),
        title: stop.properties.name,
      })
        .on("click", () => choose({ type: "stop", stop }))
        .addTo(stopLayer);
  for (const [id, m] of markers) {
    const line = id.split("-")[0];
    if (state.prefs.lines.includes(line)) busLayer.addLayer(m);
    else busLayer.removeLayer(m);
  }
}
export function recenter() {
  map?.setView([42.658, 21.161], 14, {
    animate:
      !state.prefs.reducedMotion &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
}
export function showMap() {
  requestAnimationFrame(() => map?.invalidateSize());
}
export function focusStop(stop) {
  if (stop)
    map?.setView(
      [stop.geometry.coordinates[1], stop.geometry.coordinates[0]],
      16,
    );
}
export function drawPreview(element, line, stop) {
  preview?.remove();
  if (!window.L || !element) return;
  preview = L.map(element, {
    zoomControl: false,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    attributionControl: true,
    dragging: false,
    scrollWheelZoom: false,
    touchZoom: false,
    doubleClickZoom: false,
    keyboard: false,
  });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  }).addTo(preview);
  const f = state.routes.find((f) => f.properties.line === line);
  if (f) {
    const layer = L.geoJSON(f, {
      style: { color: "#17624d", weight: 4 },
    }).addTo(preview);
    preview.fitBounds(layer.getBounds(), { padding: [18, 18] });
  } else preview.setView([42.658, 21.161], 13);
  if (stop) {
    L.circleMarker(
      [stop.geometry.coordinates[1], stop.geometry.coordinates[0]],
      { radius: 6, color: "#17624d", fillColor: "white", fillOpacity: 1 },
    ).addTo(preview);
    preview.setView(
      [stop.geometry.coordinates[1], stop.geometry.coordinates[0]],
      15,
    );
  }
}
export function clearPreview() {
  preview?.stop();
  preview?.remove();
  preview = null;
}
export function resetSimulation() {
  simulation?.reset();
}
export function getBuses() {
  return simulation?.buses || [];
}
