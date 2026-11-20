import assert from "node:assert/strict";
import fs from "node:fs";
import {
  prepare,
  interpolate,
  distance,
  createSimulation,
  fleetCount,
} from "../assets/js/simulation.js";
const routes = JSON.parse(
  fs.readFileSync(new URL("../data/routes.geojson", import.meta.url)),
).features;
const stops = JSON.parse(
  fs.readFileSync(new URL("../data/stops.geojson", import.meta.url)),
).features;
let now = 0,
  callback;
globalThis.performance = { now: () => now };
globalThis.requestAnimationFrame = (fn) => ((callback = fn), 1);
globalThis.cancelAnimationFrame = () => {};
const listeners = {};
globalThis.document = {
  hidden: false,
  addEventListener: (n, f) => (listeners[n] = f),
  removeEventListener: (n) => delete listeners[n],
};
let checks = 0;
const check = (v, label) => {
  assert(v, label);
  checks++;
};
for (const f of routes) {
  const r = prepare(f.geometry.coordinates);
  check(r.total > 1000, "Nontrivial route");
  check(r.coordinates.length > 100, "Detailed street geometry");
  for (let i = 1; i < r.cumulative.length; i++)
    check(r.cumulative[i] >= r.cumulative[i - 1], "Ordered distances");
  for (const d of f.properties.stopDistances)
    check(d <= r.total + 1, "Stops within route length");
  for (let d = 0; d < r.total; d += 17) {
    const p = interpolate(r, d).coordinate;
    check(p.every(Number.isFinite), "Finite interpolation");
    let nearest = 1;
    while (r.cumulative[nearest] < d) nearest++;
    const a = r.coordinates[nearest - 1],
      b = r.coordinates[nearest];
    check(
      Math.abs(distance(a, p) + distance(p, b) - distance(a, b)) < 0.1,
      "Position stays on its route segment",
    );
  }
}
for (const stop of stops)
  check(
    stop.properties.lines.every((l) =>
      routes.some((r) => r.properties.line === l),
    ),
    "Stop line references valid",
  );
let previous = new Map(),
  maxStep = 0;
const simulation = createSimulation(routes, (b) => {
  const old = previous.get(b.id);
  if (old) maxStep = Math.max(maxStep, distance(old, b.position));
  previous.set(b.id, [...b.position]);
});
for (let i = 0; i < 6000; i++) {
  now = (i * 1000) / 60;
  callback(now);
}
check(maxStep < 0.3, "No interpolation jumps at easing boundaries");
check(simulation.buses.length === routes.reduce((sum, route)=>sum+fleetCount(route.properties.line),0), "Configured fleet counts match route data");
check(
  simulation.buses.every(
    (b) => b.progress >= 0 && b.progress <= b.route.total + 0.1,
  ),
  "Progress stays inside geometry",
);
const a = [0, 0],
  b = [0.001, 0];
const small = {
  type: "Feature",
  properties: { line: "x", stopDistances: [0, 55, 111] },
  geometry: { type: "LineString", coordinates: [a, b] },
};
let dwelling = false;
simulation.stop();
const tiny = createSimulation([small], (bus) => {
  if (bus.movementState === "boarding") dwelling = true;
});
for (let i = 0; i < 2000; i++) {
  now += 1000 / 60;
  callback(now);
}
check(dwelling, "Vehicles dwell at stops");
document.hidden = true;
listeners.visibilitychange();
now += 600000;
document.hidden = false;
listeners.visibilitychange();
callback(now);
check(
  tiny.buses.every((b) => b.position.every(Number.isFinite)),
  "Hidden-tab resume is finite",
);
tiny.reset();
tiny.stop();
check(!listeners.visibilitychange, "Visibility listener cleaned up");
check(fleetCount("4") > fleetCount("19"), "Busy city route has more illustrative vehicles");
console.log(
  `${checks} assertions passed; maximum bus movement per 60Hz frame: ${maxStep.toFixed(3)}m`,
);

globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
const {state}=await import('../assets/js/state.js');
const {departure}=await import('../assets/js/departures.js');
state.lines=routes.map(r=>({id:r.properties.line}));state.stops=stops;
state.journey.from='Hotel Prishtina';state.selected={id:'4',reverse:true};
now=0;const live=createSimulation(routes,()=>{});callback(now);state.buses=live.buses;
check(/min|Due now/.test(departure('4').time),'Live estimate is derived from simulation');
state.departureMode='unavailable';check(departure('4').time==='Time unavailable','Unavailable has no countdown');
state.departureMode='scheduled';check(departure('4').label.includes('SCHEDULED'),'Scheduled estimate is labeled');
live.stop();console.log('Departure-state assertions passed');
