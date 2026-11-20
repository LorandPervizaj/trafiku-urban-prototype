import { state, persist, reset, applyTheme, esc } from "./state.js";
import { storageAvailable } from "./storage.js";
import { icon } from "./icons.js";
import { lineStyle } from "./line-colors.js";
import { stopArrivalBoard, arrivalLabel } from "./stop-arrivals.js";
import { routeNearbyLines } from "./stop-coverage.js";
import { localize } from "./i18n.js";
import { navigate, startRouter } from "./router.js";
import { departure } from "./departures.js";
import { findRoutes, findStop } from "./routes.js";
import { resolvePlace } from "./place-search.js";
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
let stopRefreshTimer = null;
function applyLanguage() {
  const language=state.prefs.language || "en";
  document.documentElement.lang=language === "sq" ? "sq" : "en";
  document.title="TRIP · Prishtina";
  const langToggle=document.querySelector("#lang-toggle");
  if(langToggle)langToggle.dataset.current=language;
  document.querySelectorAll("#lang-toggle [data-lang]").forEach(b=>{
    b.setAttribute("aria-pressed", String(b.dataset.lang === language));
  });
  localize(document.body,language);
}
function setLanguage(language) {
  if (!["en","sq"].includes(language)) return;
  state.prefs.language=language;
  savePrefs();
  applyLanguage();
}
export function toast(text) {
  $("#toast").textContent = text;
  localize($("#toast"),state.prefs.language);
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function savePrefs() {
  if (!persist())
    toast("Storage unavailable. Changes last for this visit only.");
}
function filters() {
  const ids=state.lines.map(l=>l.id);
  const allOn=ids.length>0 && ids.every(id=>state.prefs.lines.includes(id));
  const container=$("#filters");
  const expected=ids.length+1;
  if(container.children.length!==expected ||
    !Array.from(container.children).slice(1).every((el,i)=>el.dataset.filter===ids[i])) {
    container.innerHTML=`<button class="chip chip-all" data-filter="all" aria-pressed="${allOn}">All</button>`+
      ids.map(id=>`<button class="chip line-chip" style="${lineStyle(id)}" data-filter="${id}" aria-pressed="${state.prefs.lines.includes(id)}"><span class="line-chip-dot" aria-hidden="true"></span>${id}</button>`).join("");
  }
  const toggle=container.querySelector('[data-filter="all"]');
  toggle.textContent=allOn?"None":"All";
  toggle.setAttribute("aria-pressed",String(allOn));
  toggle.setAttribute("aria-label",allOn?"None":"All");
  toggle.dataset.allState=allOn?"all":state.prefs.lines.length?"partial":"none";
  for(const element of container.querySelectorAll('[data-filter]:not([data-filter="all"])')) {
    const selected=state.prefs.lines.includes(element.dataset.filter);
    element.setAttribute("aria-pressed",String(selected));
  }
  $("#stops-toggle").setAttribute("aria-pressed",state.prefs.showStops);
  localize(container,state.prefs.language);
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
function clearStopRefresh(){
  if(stopRefreshTimer!==null)clearInterval(stopRefreshTimer);
  stopRefreshTimer=null;
}

function stationRows(stop){
  const rows=stopArrivalBoard(stop,state.lines,state.buses||[]);
  // Nearness to a mapped street is not verified boarding service. Show a
  // separate, clearly labeled line rather than inventing any ETA for it.
  const valid=new Set(state.lines.map(l=>l.id));
  const near=routeNearbyLines(stop)
    .filter(id=>valid.has(id)&&state.prefs.lines.includes(id))
    .slice(0,6);
  const assigned=rows.map(({line,arrivals,hasGeometry})=>{
    const entry=state.lines.find(l=>l.id===line);
    const onMap=state.prefs.lines.includes(line);
    const times=arrivals.length
      ? '<div class="eta-times">'+arrivals.map(a=>
          '<span class="eta-chip">'+esc(arrivalLabel(a.seconds))+'</span>'
        ).join("")+'</div>'
      : '<small class="eta-unavailable">'+
          (hasGeometry?'No demo arrival in next 20 min':'ETA not available')+
        '</small>';
    return '<div class="station-service '+(onMap?'station-served-selected':'')+'">'+
      '<span class="line-badge" style="'+lineStyle(line)+'">'+esc(line)+'</span>'+
      '<div class="station-service-details"><b>Line '+esc(line)+'</b>'+
        '<small>'+esc(entry?.to||"Mapped route")+'</small></div>'+
      times+'</div>';
  }).join("");
  const proximity=near.map(line=>
    '<div class="station-service station-nearby">'+
      '<span class="line-badge" style="'+lineStyle(line)+'">'+esc(line)+'</span>'+
      '<div class="station-service-details"><b>Line '+esc(line)+'</b>'+
      '<small>Route passes nearby · stop not verified</small></div>'+
      '<small class="eta-unavailable">No verified ETA</small></div>'
  ).join("");
  return assigned+proximity ||
    '<p class="unassigned-note">No mapped bus lines assigned to this stop yet.</p>';
}

function renderSheet(selection) {
  clearStopRefresh();
  if (selection?.type==="clear"){activeSelection=null;selection=null;}
  else if(selection)activeSelection=selection;
  else selection=activeSelection;
  const sheet=$("#stop-sheet"),screen=$("#map-screen");
  sheet.classList.remove("station-sheet");
  if(!selection){
    sheetContext=null;
    sheet.hidden=true;
    sheet.classList.remove("has-selection","collapsed");
    screen.dataset.sheet="empty";
    return;
  }
  const stop=selection.type==="stop"?selection.stop:null;
  if(stop){
    // A white stop still describes all of its mapped services. Filter
    // selection changes its map color, not what the OSM relation says.
    sheetContext=null;
    $("#sheet-content").innerHTML=
      '<div class="row"><span class="eyebrow">STOP · SIMULATED ARRIVALS</span>'+
      '<button class="sheet-close" data-action="dismiss-sheet" aria-label="Close details">×</button></div>'+
      '<h2>'+esc(stop.properties.name)+'</h2>'+
      '<p class="station-subtitle">Mapped lines at or near this stop · next 20 minutes</p>'+
      '<div id="station-service-list" class="station-service-list">'+stationRows(stop)+'</div>'+
      '<p class="station-note">Demo estimates only. Not live GPS or an official timetable.</p>';
    sheet.classList.add("station-sheet","has-selection");
    sheet.classList.remove("collapsed");
    sheet.hidden=false;
    screen.dataset.sheet="stop";
    $(".sheet-handle").setAttribute("aria-expanded","true");
    $(".sheet-handle").setAttribute("aria-label","Collapse map information");
    applyLanguage();
    // Update the displayed times without rebuilding the rest of the sheet.
    // Do not run the update when the app or document is hidden.
    stopRefreshTimer=setInterval(()=>{
      if(state.view!=="map" || document.hidden ||
        activeSelection?.type!=="stop" ||
        activeSelection.stop.properties.id!==stop.properties.id)return;
      const element=$("#station-service-list");
      if(!element)return;
      element.innerHTML=stationRows(stop);
      localize(element,state.prefs.language);
    },10000);
    return;
  }
  let line,nearest,heading,title;
  if(selection.type==="bus"){
    line=state.lines.find(l=>l.id===selection.bus.line);
    nearest=state.stops.filter(s=>s.properties.lines.includes(line?.id)).reduce((best,s)=>{
      const p=selection.bus.position;
      const d=x=>(x.geometry.coordinates[0]-p[0])**2+
        (x.geometry.coordinates[1]-p[1])**2;
      return !best||d(s)<d(best)?s:best;
    },null);
    heading="BUS ON MAP";
    title="Line "+selection.bus.line;
  }
  if(!line){activeSelection=null;renderSheet({type:"clear"});return;}
  if(line.roadOnly){
    sheetContext=null;
    $("#sheet-content").innerHTML=
      '<div class="row"><span class="eyebrow">MAPPED ROUTE</span>'+
      '<button class="sheet-close" data-action="dismiss-sheet" aria-label="Close details">×</button></div>'+
      '<h2>Line '+esc(line.id)+'</h2>'+
      '<p class="unassigned-note">'+esc(line.from)+' → '+esc(line.to)+'</p>'+
      '<p class="unassigned-note">Route geometry is available, but no verified boarding stops or departures are mapped yet.</p>';
  }else{
    let reverse=selection.bus.direction===-1;
    if(nearest?.properties.name===line.from)reverse=false;
    if(nearest?.properties.name===line.to)reverse=true;
    const direction=reverse?line.from:line.to;
    sheetContext={line:line.id,origin:nearest?.properties.name,reverse};
    const d=departure(line.id,sheetContext);
    $("#sheet-content").innerHTML=
      '<div class="row"><span class="eyebrow">'+heading+'</span>'+
      '<button class="sheet-close" data-action="dismiss-sheet" aria-label="Close details">×</button></div>'+
      '<h2>'+esc(title)+'</h2>'+
      '<button class="departure-row" id="sheet-departure">'+
        '<span class="line-badge" style="'+lineStyle(line.id)+'">'+esc(line.id)+'</span>'+
        '<span><b>Towards '+esc(direction)+'</b><small>'+esc(d.label)+'</small></span>'+
        '<span class="time">'+esc(d.time)+'</span></button>';
    $("#sheet-departure").onclick=()=>{
      prepareJourney(nearest,line,reverse);
      navigate("details");
    };
  }
  sheet.hidden=false;
  sheet.classList.add("has-selection");
  screen.dataset.sheet="selected";
  sheet.classList.remove("collapsed");
  $(".sheet-handle").setAttribute("aria-expanded","true");
  $(".sheet-handle").setAttribute("aria-label","Collapse map information");
  applyLanguage();
}
async function render(view) {
  if (!screens) screens = await import("./ui/screens.js");
  clearPreview();
  if(view!=="map")clearStopRefresh();
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
    applyLanguage();
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
    $("#journey-form").addEventListener("submit", async e => {
      e.preventDefault();
      const f=e.currentTarget;
      const from=String(f.elements.from.value).trim();
      const to=String(f.elements.to.value).trim();
      const msg=$("#search-feedback");
      const btn=f.querySelector('[type="submit"]');
      btn.disabled=true;
      msg.hidden=false;
      msg.textContent="Finding nearby stops…";
      state.lookup=null;
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6500);
      try {
        const start=await resolvePlace(from,state.stops,controller.signal);
        const finish=await resolvePlace(to,state.stops,controller.signal);
        state.lookup={from:start,to:finish};
        state.journey={from,to};
        const routes=findRoutes(from,to);
        if(!routes.length) {
          msg.textContent="We found the places, but have no mapped bus connection between them yet. Try another stop.";
          localize(msg,state.prefs.language);
          return;
        }
        document.activeElement?.blur();
        navigate("routes");
      } catch(error) {
        msg.textContent=error.name==="AbortError"?
          "Place search timed out. Choose a named bus stop or try again.":
          (error.message || "Place search is unavailable. Try a named stop.");
        localize(msg,state.prefs.language);
      } finally {
        clearTimeout(timeout);
        btn.disabled=false;
      }
    });
  applyLanguage();
}
function selectStop(id) {
  const s = state.stops.find((s) => s.properties.id === id);
  if (!s) return;
  const line = state.lines.find((l) => l.id === s.properties.lines[0]);
  if(!line) {
    state.journey={from:s.properties.name,to:""};
    state.lookup=null;
    navigate("plan");
    return;
  }
  prepareJourney(s, line);
  navigate("details");
}
function openSettings() {
  if(state.view!=="settings")state.returnView=state.view;
  navigate("settings");
}
document.addEventListener("click", (e) => {
  const language=e.target.closest("[data-lang]");
  if(language){setLanguage(language.dataset.lang);return;}
  const filter = e.target.closest("[data-filter]");
  if (filter) {
    const id = filter.dataset.filter;
    const available=state.lines.map(l=>l.id);
    if(id==="all") {
      const allOn=available.length>0 && available.every(x=>state.prefs.lines.includes(x));
      state.prefs.lines=allOn ? [] : available;
    } else {
      state.prefs.lines=state.prefs.lines.includes(id)
        ? state.prefs.lines.filter(x=>x!==id)
        : [...state.prefs.lines,id];
    }
    state.prefs.allLines=available.length>0 && available.every(x=>state.prefs.lines.includes(x));
    savePrefs();
    filters();
    refreshLayers();
    if (!state.prefs.lines.length) activeSelection=null;
    else if (activeSelection?.type === "bus" && !state.prefs.lines.includes(activeSelection.bus.line)) activeSelection=null;
    else if (activeSelection?.type === "stop" && !activeSelection.stop.properties.lines.some(line=>state.prefs.lines.includes(line))) activeSelection=null;
    renderSheet();
    return;
  }
  const showLine=e.target.closest("[data-show-line]");
  if(showLine){
    const id=showLine.dataset.showLine;
    if(!state.lines.some(l=>l.id===id))return;
    state.prefs.lines=[id];
    state.prefs.allLines=false;
    savePrefs();
    filters();
    refreshLayers();
    activeSelection=null;
    navigate("map");
    requestAnimationFrame(()=>{
      document.querySelector(`#filters [data-filter="${id}"]`)?.scrollIntoView({
        behavior:state.prefs.reducedMotion?"instant":"smooth",
        block:"nearest",inline:"center"
      });
    });
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
    state.lookup = s.fromStop && s.toStop ? {
      from:{query:s.from,stop:state.stops.find(x=>x.properties.id===s.fromStop)},
      to:{query:s.to,stop:state.stops.find(x=>x.properties.id===s.toStop)}
    }:null;
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
  if (a === "open-settings") { openSettings(); return; }
  if (a === "settings-back" || a === "close-settings") { navigate(state.returnView || "map"); return; }
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
    const s = { ...state.journey, line: state.selected.id,
      fromStop: findStop(state.journey.from)?.properties.id,
      toStop: findStop(state.journey.to)?.properties.id };
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
    state.prefs.allLines=true;
    savePrefs();
    applyTheme();
    filters();
    refreshLayers();
    render(state.view);
    toast("Preferences reset");
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "language") {setLanguage(el.value);return;}
  if (el.id === "theme") {
    state.prefs.theme = el.value;
    applyTheme();
  }
  if (el.id === "show-stops") state.prefs.showStops = el.checked;
  if (el.id === "show-routes") state.prefs.showRoutes = el.checked;
  if (el.id === "reduce-motion") state.prefs.reducedMotion = el.checked;
  if (el.id === "departure-mode") {
    state.departureMode = el.value;
    if(state.view!=="settings")render(state.view);
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
    const availableIds=state.lines.map(line=>line.id);
    const storedIds=state.prefs.lines || [];
    state.prefs.lines=state.prefs.allLines ? availableIds : storedIds.filter(id=>availableIds.includes(id));
    state.prefs.allLines=state.prefs.lines.length===availableIds.length;
    filters();
    try {
      initMap((selection) => renderSheet(selection));
    } catch (error) {
      $("#map-warning").hidden = false;
      $("#map-warning").textContent =
        "Map unavailable. Use Plan for local routes.";
    }
    // Noncritical fragments load after the first map/buses are interactive.
    const extraRoutes=()=>{
      fetch("data/route-fragments.geojson")
        .then(r=>r.ok?r.json():null)
        .then(data=>{
          if(data?.type==="FeatureCollection"&&Array.isArray(data.features)){
            state.fragments=data.features;
            refreshLayers();
          }
        }).catch(()=>{});
    };
    if("requestIdleCallback" in window)
      window.requestIdleCallback(extraRoutes,{timeout:1800});
    else setTimeout(extraRoutes,500);
    screens = await import("./ui/screens.js");
    $("#settings").onclick = openSettings;
    startRouter(render);
    if (!storageAvailable)
      toast("Local storage unavailable. Preferences last for this visit.");
  } catch (error) {
    $("#stop-sheet").hidden=false;
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
