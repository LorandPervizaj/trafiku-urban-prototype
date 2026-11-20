import assert from "node:assert/strict";
import fs from "node:fs";
import {createSimulation,prepare,distance} from "../assets/js/simulation.js";
import {projectStop,busArrivalsAtStop,stopArrivalBoard,arrivalLabel}
  from "../assets/js/stop-arrivals.js";

const coords=[[21.15,42.65],[21.16,42.65],[21.17,42.65]];
const r=prepare(coords);
const at={type:"Feature",properties:{id:"example",name:"Example stop",lines:["4","6"]},
  geometry:{type:"Point",coordinates:[21.16,42.6502]}};
const far={type:"Feature",properties:{id:"far",name:"Far stop",lines:["4"]},
  geometry:{type:"Point",coordinates:[21.16,42.70]}};
const pr=projectStop(at,r);
assert(pr && pr.gap>10 && pr.gap<40,"Stop is projected to road, not just a vertex");
assert(Math.abs(pr.progress-r.total/2)<100,"Stop projection follows road distance");
assert(projectStop(far,r).gap>125,"Far stop not treated as a served boarding point");

globalThis.performance={now:()=>0};
let callback;
globalThis.requestAnimationFrame=fn=>{callback=fn;return 1;};
globalThis.cancelAnimationFrame=()=>{};
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
const sim=createSimulation([{type:"Feature",
  properties:{line:"4",stopDistances:[0,r.total/2,r.total]},
  geometry:{type:"LineString",coordinates:coords}}],()=>{});
callback(30000);
assert(sim.buses.every(b=>Number.isFinite(b.cycleSeconds)),"Buses expose simulation phase");
const list=sim.buses.flatMap(bus=>busArrivalsAtStop(bus,at,1200));
assert(list.length>0,"At least one arrival on connected road within twenty minutes");
assert(list.every(v=>v.seconds>=0 && v.seconds<=1200),"ETA window capped at 20 min");
assert(sim.buses.every(b=>busArrivalsAtStop(b,far,1200).length===0),"Distant station gets no made-up ETA");
const board=stopArrivalBoard(at,[{id:"4"},{id:"6"}],sim.buses);
assert(board.length===2,"Station lists all mapped bus lines, not only selected filters");
assert(board.find(v=>v.line==="4").arrivals.length>0,"Line 4 has simulated arrivals");
assert(board.find(v=>v.line==="6").arrivals.length===0,"Missing route has no invented arrival");
assert(board.find(v=>v.line==="6").hasGeometry===false,"Missing geometry explained");
assert.equal(arrivalLabel(10),"Due now");
assert.equal(arrivalLabel(61),"2 min");
assert.equal(arrivalLabel(1200),"20 min");
sim.stop();

const map=fs.readFileSync(new URL("../assets/js/map.js",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../assets/js/main.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../assets/css/app.css",import.meta.url),"utf8");
assert(map.includes("stop-marker-served")&&map.includes("stop-marker-unselected"),
  "Black/white station marker classes are implemented");
assert(map.includes("stopSelectedForLines(stop,selected)"),
  "Marker uses explicit stop lines plus nearby mapped roads");
assert(css.includes(".stop-marker-served::after")&&css.includes(".stop-marker-unselected::after"),
  "Station fill styles present");
assert(main.includes("Demo estimates only. Not live GPS or an official timetable."),
  "Simulation disclaimer visible in stop panel");
assert(main.includes("setInterval(") && main.includes("stationRows(stop)"),
  "Station ETAs refresh periodically");
console.log("Stop highlighting, all-line station board and next-20-minute demo ETA tests passed");
