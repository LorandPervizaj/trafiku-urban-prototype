import { state, persist, reset, applyTheme, esc } from "./state.js";
import { storageAvailable } from "./storage.js";
import { icon } from "./icons.js";
import { navigate, startRouter } from "./router.js";
import { departure } from "./departures.js";
import { findRoutes } from "./routes.js";
import {
  initMap,
  refreshLayers,
  recenter,
  showMap,
  drawPreview,
  clearPreview,
  resetSimulation,
} from "./map.js";
let screens;
const $ = (s) => document.querySelector(s);
let toastTimer;
let sheetContext;
let activeSelection = null;
export function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function savePrefs() {
  if (!persist())
    toast("Storage unavailable. Changes last for this visit only.");
}
function filters() {
  const ids = state.lines.map((l) => l.id);
  $("#filters").innerHTML =
    `<button class="chip" data-filter="all" aria-pressed="${state.prefs.lines.length === ids.length}">All</button>${ids.map((id) => `<button class="chip" data-filter="${id}" aria-pressed="${state.prefs.lines.includes(id)}">${id}</button>`).join("")}<button class="chip" data-filter="none" aria-pressed="${!state.prefs.lines.length}">None</button>`;
  $("#stops-toggle").setAttribute("aria-pressed", state.prefs.showStops);
}
function prepareJourney(stop, line, reverse = false) {
  // A stop at the segment endpoint boards the illustrative return direction.
  if (stop?.properties.name === line.to) reverse = true;
  if (stop?.properties.name === line.from) reverse = false;
  const from = stop?.properties.name || line.from;
  const to = reverse ? line.from : line.to;
  state.journey = { from, to };
  state.selected = findRoutes(from, to).find(
    (route) => route.id === line.id,
  ) || { ...line, reverse, direction: to };
}
function renderSheet(selection) {
  if (selection?.type === "clear") { activeSelection = null; selection = null; }
  else if (selection) activeSelection = selection;
  else selection = activeSelection;
  const sheet = $("#stop-sheet");
  const screen = $("#map-screen");
  if (!selection) {
    sheetContext = null;
    const active = state.lines.filter((line) => state.prefs.lines.includes(line.id));
    $("#sheet-content").innerHTML = `<div class="map-intro-compact">
      <div class="map-intro-copy"><strong>Find a bus</strong><small>Tap any bus or stop on the map</small></div>
      <span class="map-intro-count">${active.length} lines</span>
      <button class="map-intro-plan" data-action="plan" aria-label="Plan a journey">${icon("chevron")}</button>
      </div>`;
  } else {
    let stop, line, heading, title;
    if (selection.type === "stop") {
      stop = selection.stop;
      line = state.lines.find((l) => l.id === stop.properties.lines.find((id) => state.prefs.lines.includes(id))) ||
        state.lines.find((l) => l.id === stop.properties.lines[0]);
      heading = "STOP DEPARTURES";
      title = stop.properties.name;
    } else if (selection.type === "bus") {
      line = state.lines.find((l) => l.id === selection.bus.line);
      stop = state.stops.filter((s) => s.properties.lines.includes(line?.id)).reduce((best,s) => {
        const p = selection.bus.position;
        const d = (x) => (x.geometry.coordinates[0]-p[0])**2 + (x.geometry.coordinates[1]-p[1])**2;
        return !best || d(s)<d(best) ? s : best;
      },null);
      heading = "BUS ON MAP";
      title = `Line ${selection.bus.line}`;
    }
    if (!line) {
      activeSelection = null;
      renderSheet({type:"clear"});
      return;
    }
    let reverse = selection.type === "bus" && selection.bus.direction === -1;
    if (stop?.properties.name === line.from) reverse = false;
    if (stop?.properties.name === line.to) reverse = true;
    const direction = reverse ? line.from : line.to;
    sheetContext = {line:line.id,origin:stop?.properties.name,reverse};
    const d = departure(line.id,sheetContext);
    $("#sheet-content").innerHTML = `<div class="row">
      <span class="eyebrow">${heading}</span>
      <button class="sheet-close" data-action="dismiss-sheet" aria-label="Close details">×</button>
      </div><h2>${esc(title)}</h2>
      <button class="departure-row" id="sheet-departure">
        <span class="line-badge">${esc(line.id)}</span>
        <span><b>Towards ${esc(direction)}</b><small>${esc(d.label)}</small></span>
        <span class="time">${esc(d.time)}</span>
      </button>`;
    $("#sheet-departure").onclick = () => {prepareJourney(stop,line,reverse);navigate("details")};
  }
  sheet.classList.toggle("has-selection",Boolean(selection));
  screen.dataset.sheet = selection ? "selected" : "overview";
  sheet.classList.remove("collapsed");
  $(".sheet-handle").setAttribute("aria-expanded","true");
  $(".sheet-handle").setAttribute("aria-label","Collapse map information");
}
async function render(view) {
  if (!screens) screens = await import("./ui/screens.js");
  clearPreview();
  state.view = view;
  $("#map-screen").hidden = view !== "map";
  $("#page").hidden = view === "map";
  $("#navigation").innerHTML = ["plan", "map", "ticket"]
    .map(
      (v) =>
        `<a href="#${v}" class="nav-button ${v === "map" ? "map-nav" : ""}" ${v === (["routes", "details", "saved"].includes(view) ? "plan" : view) ? 'aria-current="page"' : ""}><span class="nav-icon">${icon(v)}</span><span>${v[0].toUpperCase() + v.slice(1)}</span></a>`,
    )
    .join("");
  if (view === "map") {
    showMap();
    renderSheet();
    return;
  }
  $("#page").innerHTML = screens[view]();
  $("#page").scrollTop = 0;
  $("#page h1")?.focus({ preventScroll: true });
  if (view === "routes") {
    const result = findRoutes(state.journey.from, state.journey.to)[0];
    drawPreview($("#preview"), result?.id);
  }
  if (view === "details")
    drawPreview($("#preview"), state.selected?.id, screens.selectedStop());
  if (view === "plan")
    $("#journey-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      state.journey = {
        from: String(data.get("from")).trim(),
        to: String(data.get("to")).trim(),
      };
      document.activeElement?.blur();
      navigate("routes");
    });
}
function selectStop(id) {
  const s = state.stops.find((s) => s.properties.id === id);
  if (!s) return;
  const line = state.lines.find((l) => l.id === s.properties.lines[0]);
  prepareJourney(s, line);
  navigate("details");
}
function openSettings() {
  $("#settings-dialog").innerHTML = screens.settings();
  $("#settings-dialog").showModal();
}
document.addEventListener("click", (e) => {
  const filter = e.target.closest("[data-filter]");
  if (filter) {
    const id = filter.dataset.filter;
    state.prefs.lines =
      id === "all"
        ? state.lines.map((l) => l.id)
        : id === "none"
          ? []
          : state.prefs.lines.includes(id)
            ? state.prefs.lines.filter((x) => x !== id)
            : [...state.prefs.lines, id];
    savePrefs();
    filters();
    refreshLayers();
    if (activeSelection?.type === "bus" && !state.prefs.lines.includes(activeSelection.bus.line)) activeSelection = null;
    renderSheet();
    return;
  }
  const line = e.target.closest("[data-line]");
  if (line) {
    state.selected = findRoutes(state.journey.from, state.journey.to).find(
      (l) => l.id === line.dataset.line,
    );
    navigate("details");
    return;
  }
  const stop = e.target.closest("[data-stop]");
  if (stop) {
    selectStop(stop.dataset.stop);
    return;
  }
  const saved = e.target.closest("[data-saved]");
  if (saved) {
    const s = state.prefs.saved[Number(saved.dataset.saved)];
    state.journey = { from: s.from, to: s.to };
    state.selected = findRoutes(s.from, s.to).find((l) => l.id === s.line);
    navigate("details");
    return;
  }
  const del = e.target.closest("[data-delete]");
  if (del) {
    state.prefs.saved.splice(Number(del.dataset.delete), 1);
    savePrefs();
    render(state.view);
    toast("Journey removed");
    return;
  }
  const unfav = e.target.closest("[data-unfavorite]");
  if (unfav) {
    state.prefs.favorites = state.prefs.favorites.filter(
      (id) => id !== unfav.dataset.unfavorite,
    );
    savePrefs();
    render(state.view);
    return;
  }
  const a = e.target.closest("[data-action]")?.dataset.action;
  if (!a) return;
  if (["plan", "map", "ticket", "routes", "saved"].includes(a)) {
    navigate(a);
    return;
  }
  if (a === "dismiss-sheet") { renderSheet({type:"clear"}); return; }
  if (a === "back") {
    navigate(state.view === "details" ? "routes" : "plan");
  }
  if (a === "swap") {
    const f = $("#journey-form");
    const a = f.elements.from.value;
    f.elements.from.value = f.elements.to.value;
    f.elements.to.value = a;
  }
  if (a === "save") {
    const s = { ...state.journey, line: state.selected.id };
    if (
      !state.prefs.saved.some(
        (x) => x.from === s.from && x.to === s.to && x.line === s.line,
      )
    ) {
      state.prefs.saved.push(s);
      savePrefs();
      toast("Journey saved. Find it in Plan.");
    } else toast("This journey is already saved.");
  }
  if (a === "favorite") {
    const id = screens.selectedStop()?.properties.id;
    if (!id) return;
    state.prefs.favorites = state.prefs.favorites.includes(id)
      ? state.prefs.favorites.filter((x) => x !== id)
      : [...state.prefs.favorites, id];
    savePrefs();
    render("details");
    toast("Saved stops updated");
  }
  if (a === "close-settings") $("#settings-dialog").close();
  if (a === "reset-simulation") {
    resetSimulation();
    toast("Simulation restarted");
  }
  if (a === "clear-saved") {
    state.prefs.saved = [];
    savePrefs();
    toast("Saved journeys cleared");
  }
  if (a === "reset-preferences") {
    reset();
    state.prefs.lines = state.lines.map((line) => line.id);
    savePrefs();
    applyTheme();
    filters();
    refreshLayers();
    $("#settings-dialog").close();
    render(state.view);
    toast("Preferences reset");
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "theme") {
    state.prefs.theme = el.value;
    applyTheme();
  }
  if (el.id === "show-stops") state.prefs.showStops = el.checked;
  if (el.id === "show-routes") state.prefs.showRoutes = el.checked;
  if (el.id === "reduce-motion") state.prefs.reducedMotion = el.checked;
  if (el.id === "departure-mode") {
    state.departureMode = el.value;
    render(state.view);
  }
  if (["theme", "show-stops", "show-routes", "reduce-motion"].includes(el.id)) {
    savePrefs();
    filters();
    refreshLayers();
    document.documentElement.dataset.reducedMotion = String(
      state.prefs.reducedMotion,
    );
  }
});
function connection() {
  $("#connection").hidden = navigator.onLine;
}
window.addEventListener("online", connection);
window.addEventListener("offline", connection);
applyTheme();
connection();
$("#settings").innerHTML = icon("settings");
$("#stops-toggle").innerHTML = icon("pin");
$("#recenter").innerHTML = icon("locate");
$("#recenter").onclick = recenter;
$("#stops-toggle").onclick = () => {
  state.prefs.showStops = !state.prefs.showStops;
  savePrefs();
  filters();
  refreshLayers();
};
// One consistent handle interaction for tap, swipe up/down and touch.
const sheetHandle = $(".sheet-handle");
let dragStart = null, dragMoved = false, skipClick = false;
function applySheetCollapsed(collapsed) {
  const sheet = $("#stop-sheet");
  sheet.classList.toggle("collapsed", collapsed);
  $("#map-screen").dataset.sheet = collapsed ? "collapsed" : (activeSelection ? "selected" : "overview");
  sheetHandle.setAttribute("aria-expanded", String(!collapsed));
  sheetHandle.setAttribute("aria-label", collapsed ? "Expand map information" : "Collapse map information");
}
sheetHandle.addEventListener("pointerdown", (event) => {
  dragStart = event.clientY;
  dragMoved = false;
});
sheetHandle.addEventListener("pointerup", (event) => {
  if (dragStart === null) return;
  const dy = event.clientY - dragStart;
  if (Math.abs(dy) > 25) {
    applySheetCollapsed(dy > 0);
    dragMoved = true;
    skipClick = true;
  }
  dragStart = null;
});
sheetHandle.addEventListener("pointercancel", () => { dragStart = null; });
sheetHandle.addEventListener("click", () => {
  if (skipClick) { skipClick = false; return; }
  applySheetCollapsed(!$("#stop-sheet").classList.contains("collapsed"));
});
async function start() {
  try {
    const [lines, stops, routes] = await Promise.all(
      ["lines.json", "stops.geojson", "routes.geojson"].map(async (f) => {
        const r = await fetch(`data/${f}`);
        if (!r.ok) throw Error(`Cannot load ${f}`);
        return r.json();
      }),
    );
    state.lines = lines;
    state.stops = stops.features;
    state.routes = routes.features;
    // First launch is a neutral map overview; nobody has a preselected journey.
    state.journey = { from: "", to: "" };
    const availableIds = state.lines.map((line) => line.id);
    const storedIds = state.prefs.lines || [];
    // When a previous user had all original lines enabled, include any new data.
    if (["4","3","1"].every((id) => storedIds.includes(id)) && storedIds.length === 3) {
      state.prefs.lines = availableIds;
    } else {
      state.prefs.lines = storedIds.filter((id) => availableIds.includes(id));
    }
    filters();
    try {
      initMap((selection) => renderSheet(selection));
    } catch (error) {
      $("#map-warning").hidden = false;
      $("#map-warning").textContent =
        "Map unavailable. Use Plan for local routes.";
    }
    screens = await import("./ui/screens.js");
    $("#settings").onclick = openSettings;
    startRouter(render);
    if (!storageAvailable)
      toast("Local storage unavailable. Preferences last for this visit.");
  } catch (error) {
    $("#sheet-content").innerHTML =
      "<h2>Route data could not load</h2><p>Serve this app over HTTP, then reload. Ticket information remains available.</p>";
    screens = await import("./ui/screens.js");
    $("#settings").onclick = openSettings;
    startRouter(render);
  }
}
start();

// Refresh only the visible departure label, without replacing cards or user input.
function refreshDepartureTime() {
  if (document.hidden) return;
  if (state.view === "map" && sheetContext) {
    const label = document.querySelector("#sheet-departure .time");
    if (label)
      label.textContent = departure(sheetContext.line, sheetContext).time;
  }
  if (state.view === "details" && state.selected) {
    const label = document.querySelector(".large-time");
    const value = departure(state.selected.id);
    if (label && value.mode === "live")
      label.innerHTML = esc(value.time).replace(" min", " <em>min</em>");
  }
}
setInterval(refreshDepartureTime, 15000);
document.addEventListener("visibilitychange", refreshDepartureTime);
