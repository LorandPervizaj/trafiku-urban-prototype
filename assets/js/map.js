import { state, persist, esc } from "./state.js";
import { createSimulation } from "./simulation.js";
import { translate } from "./i18n.js";
import { colorForLine, lineStyle } from "./line-colors.js";
let map, fragmentLayer, routeLayer, stopLayer, busLayer, simulation, preview;
const markers = new Map();
let stopMarkersVisible = 0;
let viewportBounds = null;
let choose = () => {};
export function initMap(onChoose) {
  choose = onChoose;
  if (!window.L) throw new Error("The local map library could not load.");
  map = L.map("map", {
    zoomControl: false,
    zoomSnap: 0.5,
    wheelPxPerZoomLevel: 95,
    inertia: true,
    inertiaDeceleration: 2250,
    minZoom: 11,
    maxZoom: 18,
    maxBounds: [
      [42.36, 20.75],
      [43.18, 21.70],
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
  fragmentLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  stopLayer = L.layerGroup().addTo(map);
  busLayer = L.layerGroup().addTo(map);
  map.on("click", () => choose({ type: "clear" }));
  map.on("moveend", () => {
    viewportBounds=map.getBounds().pad(.18);
    refreshStopMarkers();
    const c = map.getCenter();
    state.prefs.position = [c.lat, c.lng, map.getZoom()];
    persist();
  });
  viewportBounds=map.getBounds().pad(.18);
  refreshLayers();
  simulation = createSimulation(state.routes, (b) => {
    let marker = markers.get(b.id);
    if (!marker) {
      marker = L.marker([b.position[1], b.position[0]], {
        icon: L.divIcon({
          className: "bus-marker",
          html: `<span class="bus-pin" style="${lineStyle(b.line)}">
            <svg class="bus-vehicle" viewBox="0 0 26 43" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect class="bus-wheel" x="2" y="9" width="4" height="9" rx="1.6"/>
              <rect class="bus-wheel" x="20" y="9" width="4" height="9" rx="1.6"/>
              <rect class="bus-wheel" x="2" y="28" width="4" height="9" rx="1.6"/>
              <rect class="bus-wheel" x="20" y="28" width="4" height="9" rx="1.6"/>
              <rect class="bus-body-shape" x="5" y="1" width="16" height="40" rx="4.2"/>
              <path class="bus-glass" d="M8 7q0-2 2-2h6q2 0 2 2v6H8z"/>
              <path class="bus-glass" opacity=".75" d="M8 18h10v14H8z"/>
              <path stroke="#e8ece9" stroke-width="1.7" d="M8 35h10"/>
              <circle class="bus-light" cx="8.5" cy="3.5" r="1"/>
              <circle class="bus-light" cx="17.5" cy="3.5" r="1"/>
            </svg>
            <span class="bus-line-tag">${esc(b.line)}</span>
          </span>`,
          iconSize: [28, 43],
          iconAnchor: [14, 22],
        }),
        title: translate(`Simulated bus ${b.id}`, state.prefs.language),
        keyboard: true,
      });
      marker.on("click", () => {
        if (!state.prefs.reducedMotion && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          map.panTo(marker.getLatLng(), { animate: true, duration: 0.32, easeLinearity: 0.28 });
        }
        document
          .querySelectorAll(".bus-marker")
          .forEach((e) => e.classList.remove("selected"));
        marker.getElement()?.classList.add("selected");
        choose({ type: "bus", bus: b });
      });
      markers.set(b.id, marker);
      if (state.prefs.lines.includes(b.line)) busLayer.addLayer(marker);
    }
    if (b.position) {
      // Animation is elapsed-time based; avoid costly DOM work for buses
      // outside the visible map. They catch up when brought back into view.
      const point=L.latLng(b.position[1],b.position[0]);
      if (viewportBounds?.contains(point)) marker.setLatLng(point);
    }
    const el = marker.getElement();
    if (el) {
      // Accessibility attributes only change on state/language changes, not every frame.
      const status=`${b.movementState}:${b.direction}:${state.prefs.language}`;
      if(el.dataset.lastStatus!==status){
        el.setAttribute("aria-label",translate(`Simulated bus ${b.id}`,state.prefs.language));
        el.title=translate(`Line ${b.line} · ${b.movementState} · ${b.direction === 1 ? "outbound" : "return demonstration"}`,state.prefs.language);
        el.dataset.lastStatus=status;
      }
      el.style.setProperty("--heading",`${b.heading}deg`);
    }
  });
  state.buses = simulation.buses;
  return map;
}
export function refreshLayers() {
  if (!map) return;
  routeLayer.clearLayers();
  fragmentLayer.clearLayers();
  stopLayer.clearLayers();
  if (state.prefs.showRoutes) {
    for(const piece of state.fragments||[]){
      if(!state.prefs.lines.includes(piece.properties.line))continue;
      L.geoJSON(piece,{
        style:{
          color:colorForLine(piece.properties.line),
          weight:state.prefs.lines.length===1?2.8:1.9,
          opacity:state.prefs.lines.length===1?.62:.31,
          dashArray:"3 6",
        }
      }).addTo(fragmentLayer);
    }
  }
  for (const f of state.routes)
    if (state.prefs.showRoutes && state.prefs.lines.includes(f.properties.line))
      L.geoJSON(f, {
        style: {
          color: colorForLine(f.properties.line),
          weight: state.prefs.lines.length===1 ? 4.6 : 3,
          opacity: state.prefs.lines.length===1 ? 0.92 : 0.60,
          dashArray: f.properties.direction==="return" ? "6 5" : null,
        },
      }).addTo(routeLayer);
  refreshStopMarkers();
  for (const [id, m] of markers) {
    const line = id.split("-")[0];
    if (state.prefs.lines.includes(line)) busLayer.addLayer(m);
    else busLayer.removeLayer(m);
  }
}
function refreshStopMarkers(){
  if(!map || !stopLayer)return;
  stopLayer.clearLayers();
  stopMarkersVisible=0;
  if(!state.prefs.showStops)return;
  const zoom=map.getZoom();
  if(zoom<12.7)return;
  const bounds=map.getBounds().pad(.23);
  const visible=state.stops.filter(stop=>
    bounds.contains([stop.geometry.coordinates[1],stop.geometry.coordinates[0]]) &&
    (zoom>=13.7 || stop.properties.lines.length)
  ).slice(0,180);
  for(const stop of visible){
    const unassigned=!stop.properties.lines.length;
    L.marker([stop.geometry.coordinates[1],stop.geometry.coordinates[0]],{
      icon:L.divIcon({className:unassigned?"stop-marker stop-marker-unassigned":"stop-marker",
        iconSize:[30,30],iconAnchor:[15,15]}),
      title:stop.properties.name,
      keyboard:true
    }).on("click",()=>{
      if(!state.prefs.reducedMotion && !matchMedia("(prefers-reduced-motion: reduce)").matches)
        map.panTo([stop.geometry.coordinates[1],stop.geometry.coordinates[0]],{animate:true,duration:.28});
      choose({type:"stop",stop});
    }).addTo(stopLayer);
    stopMarkersVisible++;
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
      { radius: 6, color: colorForLine(String(line||"").split(">")[0]), fillColor: "white", fillOpacity: 1 },
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
