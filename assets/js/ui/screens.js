import { state, esc } from "../state.js";
import { icon } from "../icons.js";
import { departure } from "../departures.js";
import { findRoutes, findStop } from "../routes.js";
const action = (text, id, cls = "button") =>
  `<button class="${cls}" data-action="${id}" ${id === "close-settings" ? 'aria-label="Close settings"' : id === "back" ? 'aria-label="Back to previous screen"' : ""}>${text}</button>`;
const stopButton = (s) =>
  `<button class="list-button" data-stop="${esc(s.properties.id)}"><span class="wallet-icon">${icon("pin")}</span><span><b>${esc(s.properties.name)}</b><small>Lines ${s.properties.lines.join(", ")} · Departure board</small></span><span class="chevron">${icon("chevron")}</span></button>`;
const header = (title, subtitle, back) =>
  `<header><div class="screen-heading-line"><div>
    ${back ? `<div class="page-top">${action(icon("back"),"back","icon-button")}<span class="eyebrow">YOUR JOURNEY</span></div>`:""}
    <h1 tabindex="-1">${title}</h1><p>${subtitle}</p>
    </div><button type="button" class="icon-button screen-settings" data-action="open-settings" aria-label="Open settings">${icon("settings")}</button>
    </div></header>`;
export function selectedStop() {
  return (
    findStop(state.journey.from) ||
    state.stops.find((s) => s.properties.id === state.selected?.from) ||
    state.stops[0]
  );
}
export function plan() {
  return `${header("Plan your ride", "Find the right bus, stop and direction.")}<span class="eyebrow">YOUR JOURNEY</span><p class="search-hint">Search bus stops or places in Prishtina</p><div class="search-feedback" id="search-feedback" role="status" aria-live="polite" hidden></div><form id="journey-form" class="card journey-form"><label class="field"><span>FROM</span><input name="from" list="destinations" value="${esc(state.journey.from)}" autocomplete="off" placeholder="Stop or place" required></label><label class="field"><span>TO</span><input name="to" list="destinations" value="${esc(state.journey.to)}" autocomplete="off" placeholder="Where to?" required></label><button type="button" class="icon-button swap" data-action="swap" aria-label="Reverse journey">${icon("swap")}</button><datalist id="destinations">${state.stops.map((s) => `<option value="${esc(s.properties.name)}"></option>`).join("")}</datalist><button class="button" type="submit">Find routes</button></form><div class="section-title"><h2>Your usual journeys</h2>${action("See all", "saved", "text-button")}</div>${state.prefs.saved.length ? savedCard(state.prefs.saved[0], 0) : `<div class="card"><p>No saved journeys yet.</p><small>Plan a ride and save it for next time.</small></div>`}<div class="section-title"><h2>Stops to explore</h2><small>Local map</small></div>${state.stops.slice(0, 4).map(stopButton).join("")}<p class="notice">Stops and roads come from OpenStreetMap; coverage remains partial. For unfamiliar place names, TRIP can check an online place index. Routes and bus times are simulated.</p>`;
}
export function routes() {
  const results = findRoutes(state.journey.from, state.journey.to);
  return `${header("Your route options", `${esc(state.journey.from)} → ${esc(state.journey.to)}`, true)}<div class="route-preview" id="preview"><span class="preview-label">Route preview</span></div><div class="section-title"><h2>Choose a bus</h2><small>${results.length} available</small></div>${
    results.length
      ? results
          .map((r) => {
            const d = departure(r.first || r.id, { reverse: r.reverse });
            const transfer = r.type === "transfer";
            const walk = transfer ? `<div class="transfer-brief">Transfer near ${esc(r.transfer.from)} → ${esc(r.transfer.to)} · approx. ${r.transfer.meters} m between mapped stops</div>` : "";
            return `<button class="card result-card ${r.id === results[0].id ? "dark-card" : ""}" data-line="${esc(r.id)}"><div class="row"><span class="line-badge">${transfer ? esc(r.first) : esc(r.id)}</span><span><b>${transfer ? `Lines ${esc(r.first)} + ${esc(r.second)}` : `Line ${esc(r.id)}`}</b><small>Towards ${esc(r.direction)}</small></span><span style="margin-left:auto">${icon("chevron")}</span></div>${walk}<span class="status">${d.label}</span><b>${d.time}</b>${r.reverse ? "<small>Return direction is illustrative; check local stop signage.</small>" : ""}</button>`;
          })
          .join("")
      : `<div class="empty">${icon("plan")}<h3>No mapped connection found</h3><p>Try a nearby stop or another destination. TRIP currently uses partial bus routes and walking transfers of up to 400 m.</p>${action("Edit journey", "plan", "text-button")}</div>`
  }<p class="notice">LIVE · DEMO is simulated tracking. SCHEDULED is an illustrative timetable. UNAVAILABLE means there is no reliable time.</p>${action("Edit journey", "plan", "button secondary")}`;
}
export function details() {
  const r = state.selected;
  if (!r)
    return `${header("Choose a journey", "Plan your ride to see boarding information.", true)}${action("Plan a ride", "plan")}`;
  const d = departure(r.first || r.id),
    stop = selectedStop(),
    fav = state.prefs.favorites.includes(stop?.properties.id);
  return `${header("Departure details", `${r.type === "transfer" ? `Lines ${esc(r.first)} + ${esc(r.second)}` : `Line ${esc(r.id)}`} · towards ${esc(r.direction || r.to)}`, true)}<div class="card dark-card"><span class="eyebrow">NEXT DEPARTURE</span><div class="row"><div class="large-time">${d.mode === "unavailable" ? '<span style="font-size:28px;letter-spacing:-1px">Time unavailable</span>' : d.time.replace(" min", " <em>min</em>")}</div><span class="pill">${d.label}</span></div><small>${d.description}</small></div><div class="section-title"><h2>Board here</h2><button class="icon-button" data-action="favorite" aria-label="${fav ? "Remove saved stop" : "Save stop"}" aria-pressed="${fav}">${icon("save")}</button></div><div class="card board-card"><h3>${esc(stop?.properties.name || "Stop data unavailable")}</h3><p>Towards ${esc(r.direction || r.to)}</p><small>Boarding side is not verified. Confirm the destination on the bus and stop sign.</small><div class="timeline">${icon("pin")} ${r.reverse ? "Return journey · illustrative direction" : "OSM road segment · illustrative service direction"}</div>${r.type === "transfer" ? `<div class="transfer-instructions"><b>Change from line ${esc(r.first)} to ${esc(r.second)}</b><span>Get off at ${esc(r.transfer.from)}, walk approximately ${r.transfer.meters} m to ${esc(r.transfer.to)}, then board line ${esc(r.second)} towards ${esc(r.finalDirection)}.</span><small>Transfer is based on mapped stop positions, not verified walking directions or schedules.</small></div>` : ""}<div class="route-preview" id="preview"><span class="preview-label">Your boarding area</span></div><small>${fav ? "Saved stop" : "Save this stop with the bookmark above."}</small></div><div class="button-pair">${action(icon("save") + " Save journey", "save", "button secondary")}${action(icon("ticket") + " Ticket info", "ticket")}</div><p class="notice">Demo service only. Do not use these departures to make a real journey.</p>${action("Compare routes", "routes", "text-button")}`;
}
function savedCard(s, i) {
  const d = departure(s.line.split(">")[0], {
    origin: s.from,
    reverse: findRoutes(s.from, s.to).find((r) => r.id === s.line)?.reverse,
  });
  return `<button class="card dark-card saved-card" data-saved="${i}"><span class="eyebrow">FREQUENT JOURNEY</span><strong>${esc(s.from)} → ${esc(s.to)}</strong><p>Saved journey</p><div class="row"><small>Line ${esc(s.line).replace(">", " + ")} · ${d.label}</small><b>${d.time}</b></div></button>`;
}
export function saved() {
  return `${header("Saved journeys", "Your usual routes, one tap away.", true)}${state.prefs.saved.length ? state.prefs.saved.map((s, i) => `<div class="saved-row" style="align-items:start"><div style="flex:1;min-width:0">${savedCard(s, i)}</div><button class="remove-button" data-delete="${i}" aria-label="Delete saved journey ${i + 1}">${icon("trash")}</button></div>`).join("") : '<div class="card empty"><h3>Your next routine starts here.</h3><p>Save a journey from Departure details.</p></div>'}<div class="section-title"><h2>Saved stops</h2></div>${
    state.prefs.favorites.length
      ? state.stops
          .filter((s) => state.prefs.favorites.includes(s.properties.id))
          .map(
            (s) =>
              `<div class="saved-row">${stopButton(s)}<button class="remove-button" data-unfavorite="${s.properties.id}" aria-label="Remove ${esc(s.properties.name)} from saved stops">${icon("trash")}</button></div>`,
          )
          .join("")
      : '<p class="muted">No saved stops yet. Bookmark one in Departure details.</p>'
  }<div class="section-title"><h2>Quick access</h2></div><div class="button-pair">${action("Plan another", "plan", "button secondary")}${action("View the map", "map", "button secondary")}</div>`;
}
export function ticket() {
  return `${header("Tickets", "Pay with the official city wallet.")}
  <div class="card dark-card">
    <span class="eyebrow">TICKET PRICES</span>
    <div class="fare-grid" style="margin-top:19px">
      <span class="fare-heading"></span><span class="fare-heading">Digital</span><span class="fare-heading">Physical</span>
      <div class="fare-cell"><div class="fare-name">Single journey</div><div class="fare-sub">Valid for one journey</div></div>
      <strong class="fare-value fare-cell">€0.60</strong><strong class="fare-value fare-cell">€0.80</strong>
      <div class="fare-cell"><div class="fare-name">Daily ticket</div><div class="fare-sub">Valid until midnight</div></div>
      <strong class="fare-value fare-cell">€1.00</strong><strong class="fare-value fare-cell">€1.20</strong>
      <div class="fare-cell"><div class="fare-name">Airport · Line 1A</div><div class="fare-sub">One-way airport ticket</div></div>
      <strong class="fare-value fare-cell">€5.00</strong><strong class="fare-value fare-cell">€6.00</strong>
    </div>
    <p class="fare-explainer"><span>Prices effective 1 July 2026 · Trafiku Urban.</span>
      <a href="https://trafikurban-pr.com/2022/njoftim-per-qytetaret-3/" target="_blank" rel="noopener noreferrer">View fare source</a>.
      <span>Prices and eligibility may change. Check the operator before buying.</span></p>
  </div>
  <h2 class="ticket-heading">Your ticket, one tap away</h2>
  <div class="card wallet-card">
    <div class="row" style="justify-content:start"><div class="wallet-official-icon"><img loading="lazy" referrerpolicy="no-referrer" src="https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/c8/d2/c6/c8d2c659-f92f-2082-5307-cf148dbbb761/AppIcon-0-0-1x_U007ephone-0-1-85-220.png/1200x630wa.png" alt="Kuleta Digjitale app icon" /></div>
      <div><b>Kuleta Digjitale</b><small style="display:block">Official municipal wallet</small></div></div>
    <p>Buy or display your ticket in the wallet. Your payment stays with the city's existing service.</p>
  </div>
  <a class="button" href="https://kd.pbc.group/index" target="_blank" rel="noopener noreferrer">Open Kuleta Digjitale</a>
  `;
}
export function settings() {
  return `<header class="settings-page-head">
    <div class="page-top"><button class="icon-button" data-action="settings-back" aria-label="Back to previous screen">${icon("back")}</button><span class="eyebrow">TRIP</span></div>
    <h1 tabindex="-1">Settings</h1><p>Your experience, your preferences.</p>
  </header>
  <div class="settings-section">
    <h2>General</h2>
    <div class="card">
      <label class="setting">Language<select id="language"><option value="en" ${state.prefs.language==="en"?"selected":""}>English</option><option value="sq" ${state.prefs.language==="sq"?"selected":""}>Albanian</option></select></label>
      <label class="setting">Appearance<select id="theme">${["light","dark","system"].map(t=>`<option value="${t}" ${state.prefs.theme===t?"selected":""}>${t[0].toUpperCase()+t.slice(1)}</option>`).join("")}</select></label>
      <label class="setting">Show bus stops<input id="show-stops" type="checkbox" ${state.prefs.showStops?"checked":""}></label>
      <label class="setting">Show route lines<input id="show-routes" type="checkbox" ${state.prefs.showRoutes?"checked":""}></label>
      <label class="setting">Reduce interface motion<input id="reduce-motion" type="checkbox" ${state.prefs.reducedMotion?"checked":""}></label>
    </div>
  </div>
  <div class="settings-section">
    <h2>Privacy &amp; demo</h2>
    <div class="card"><p class="muted">Preferences are stored on this device only.</p>
      <p class="notice">Demo mode · All buses and departure times are simulated. Map geometry is from OpenStreetMap; current operations may differ.</p>
      <details><summary>Testing controls</summary><div class="testing-controls">
        <label class="setting">Departure state<select id="departure-mode">${["mixed","live","scheduled","unavailable"].map(m=>`<option value="${m}" ${state.departureMode===m?"selected":""}>${m[0].toUpperCase()+m.slice(1)}</option>`).join("")}</select></label>
        ${action("Reset simulation position","reset-simulation","button secondary")}
        ${action("Clear saved journeys","clear-saved","button secondary")}
      </div></details>
      ${action("Reset preferences","reset-preferences","button secondary")}
    </div>
  </div>`;
}
