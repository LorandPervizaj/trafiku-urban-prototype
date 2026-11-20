import assert from "node:assert/strict";
import fs from "node:fs";
import {colorForLine,textForLine} from "../assets/js/line-colors.js";
import {fleetCount,createSimulation} from "../assets/js/simulation.js";
import {DOCUMENTED_UNMAPPED} from "../assets/js/network-catalog.js";
const data=new URL("../data/",import.meta.url);
const lines=JSON.parse(fs.readFileSync(new URL("lines.json",data),"utf-8"));
const routes=JSON.parse(fs.readFileSync(new URL("routes.geojson",data),"utf-8"));
const map=fs.readFileSync(new URL("../assets/js/map.js",import.meta.url),"utf-8");
assert(!map.includes('dashArray:"3 6"'),"No dotted route fragments");
assert(!map.includes('dashArray: f.properties.direction'),"No dashed return-direction routes");
assert(!map.includes('style: { color: "#17624d", weight: 4 }'),"Route previews use line colors");
const ids=new Set(lines.map(l=>l.id));
assert(ids.size===lines.length,"Unique mapped line ids");
for(const l of lines){
  assert(routes.features.some(f=>f.properties.line===l.id),"Mapped road for "+l.id);
  assert(/^#[0-9a-f]{6}$/i.test(colorForLine(l.id)),"Line color for "+l.id);
  assert(["#151919","#FFFFFF"].includes(textForLine(l.id)),"Line text for "+l.id);
}
assert(DOCUMENTED_UNMAPPED.includes("10A")&&DOCUMENTED_UNMAPPED.includes("10B")&&DOCUMENTED_UNMAPPED.includes("20"),"Other known 10-family lines documented");
globalThis.performance={now:()=>0};
let n=0;globalThis.requestAnimationFrame=()=>++n;
globalThis.cancelAnimationFrame=()=>{};
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
const sim=createSimulation(routes.features,()=>{});
assert.equal(sim.buses.length,[...ids].reduce((n,id)=>n+fleetCount(id),0),"Fleet grouped by line, not direction");
assert(sim.buses.every(b=>b.route.total>0),"Bus geometry exists");
sim.stop();
console.log("Network catalog, solid styling and fleet coverage checks passed:",ids.size,"mapped lines");
